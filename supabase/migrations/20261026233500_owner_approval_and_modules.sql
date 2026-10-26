
-- Tahir Tracker: owner approval, private module preferences and backend access enforcement.
-- Existing accounts remain approved; the verified original account alone is bootstrapped as owner.
CREATE TABLE IF NOT EXISTS public.platform_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended','rejected')),
  allowed_modules text[] NOT NULL DEFAULT ARRAY['finance','utility','loans','milk','petrol','rent']::text[],
  enabled_modules text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_allowed_modules CHECK (allowed_modules <@ ARRAY['finance','utility','loans','milk','petrol','rent']::text[]),
  CONSTRAINT valid_enabled_modules CHECK (enabled_modules <@ allowed_modules)
);
ALTER TABLE public.platform_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_profiles FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.platform_profiles FROM authenticated;
GRANT SELECT ON public.platform_profiles TO authenticated;

CREATE TABLE IF NOT EXISTS public.platform_access_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  target_user_id uuid NOT NULL REFERENCES auth.users(id),
  previous_status text,
  next_status text,
  action text NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_access_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_access_audit FROM anon, authenticated;
GRANT SELECT ON public.platform_access_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.is_tahir_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_profiles p
    WHERE p.user_id = (SELECT auth.uid()) AND p.role = 'owner' AND p.status = 'approved'
  );
$$;
REVOKE ALL ON FUNCTION public.is_tahir_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tahir_owner() TO authenticated;

DROP POLICY IF EXISTS "Profile self or owner read" ON public.platform_profiles;
CREATE POLICY "Profile self or owner read" ON public.platform_profiles
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_tahir_owner()));

DROP POLICY IF EXISTS "Owner reads access audit" ON public.platform_access_audit;
CREATE POLICY "Owner reads access audit" ON public.platform_access_audit
FOR SELECT TO authenticated USING ((SELECT public.is_tahir_owner()));

-- Called on every new email/password and Google account; unapproved users cannot read app records.
CREATE OR REPLACE FUNCTION public.create_tahir_platform_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.platform_profiles (user_id,email,role,status,allowed_modules,enabled_modules)
  VALUES (NEW.id,COALESCE(NEW.email,''),'member','pending',ARRAY['finance','utility','loans','milk','petrol','rent']::text[],'{}'::text[])
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_tahir_platform_profile() FROM PUBLIC;
DROP TRIGGER IF EXISTS tahir_create_platform_profile ON auth.users;
CREATE TRIGGER tahir_create_platform_profile
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_tahir_platform_profile();

-- Preserve existing access; only the original verified workspace is designated owner.
INSERT INTO public.platform_profiles (user_id,email,role,status,allowed_modules,enabled_modules)
SELECT id,COALESCE(email,''),
  CASE WHEN id = (SELECT first_user.id FROM auth.users AS first_user ORDER BY first_user.created_at, first_user.id LIMIT 1) THEN 'owner' ELSE 'member' END,
  'approved', ARRAY['finance','utility','loans','milk','petrol','rent']::text[], ARRAY['finance','utility','loans','milk','petrol','rent']::text[]
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Keeps email addresses current for owner approvals.
CREATE OR REPLACE FUNCTION public.sync_tahir_platform_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.platform_profiles
  SET email = COALESCE(NEW.email,''), updated_at = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_tahir_platform_email() FROM PUBLIC;
DROP TRIGGER IF EXISTS tahir_sync_platform_email ON auth.users;
CREATE TRIGGER tahir_sync_platform_email
AFTER UPDATE OF email ON auth.users FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.sync_tahir_platform_email();

CREATE OR REPLACE FUNCTION public.tahir_has_module_access(required_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_profiles p
    WHERE p.user_id = (SELECT auth.uid()) AND p.status = 'approved'
      AND (required_module IS NULL OR p.role = 'owner' OR required_module = ANY(p.allowed_modules))
  );
$$;
REVOKE ALL ON FUNCTION public.tahir_has_module_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tahir_has_module_access(text) TO authenticated;

-- Approved members can customize presentation only within owner-authorized modules.
CREATE OR REPLACE FUNCTION public.tahir_set_my_modules(requested_modules text[])
RETURNS public.platform_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  p public.platform_profiles%ROWTYPE;
  normalized text[];
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO p FROM public.platform_profiles WHERE user_id=(SELECT auth.uid()) FOR UPDATE;
  IF NOT FOUND OR p.status <> 'approved' THEN RAISE EXCEPTION 'Account has not been approved'; END IF;
  SELECT COALESCE(array_agg(DISTINCT item), '{}'::text[]) INTO normalized
  FROM unnest(COALESCE(requested_modules,'{}'::text[])) AS item;
  IF NOT normalized <@ p.allowed_modules THEN
    RAISE EXCEPTION 'One or more trackers are not allowed for your account';
  END IF;
  UPDATE public.platform_profiles
  SET enabled_modules=normalized,updated_at=now()
  WHERE user_id=p.user_id RETURNING * INTO p;
  RETURN p;
END;
$$;
REVOKE ALL ON FUNCTION public.tahir_set_my_modules(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tahir_set_my_modules(text[]) TO authenticated;

-- Never accepts a caller-provided owner flag; only the pre-authorized owner may manage others.
CREATE OR REPLACE FUNCTION public.tahir_manage_member(
  target_user_id uuid, requested_status text DEFAULT NULL, requested_allowed_modules text[] DEFAULT NULL
)
RETURNS public.platform_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
 p public.platform_profiles%ROWTYPE;
 before_status text;
 modules text[];
BEGIN
 IF NOT (SELECT public.is_tahir_owner()) THEN RAISE EXCEPTION 'Owner permission required'; END IF;
 SELECT * INTO p FROM public.platform_profiles WHERE user_id=target_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 IF p.role='owner' OR p.user_id=(SELECT auth.uid()) THEN
   RAISE EXCEPTION 'The owner account cannot be modified here';
 END IF;
 IF requested_status IS NOT NULL
   AND requested_status NOT IN ('pending','approved','rejected','suspended')
 THEN RAISE EXCEPTION 'Invalid access status'; END IF;
 IF requested_allowed_modules IS NOT NULL THEN
   SELECT COALESCE(array_agg(DISTINCT item),'{}'::text[]) INTO modules
   FROM unnest(requested_allowed_modules) AS item;
   IF NOT modules <@ ARRAY['finance','utility','loans','milk','petrol','rent']::text[] THEN RAISE EXCEPTION 'Invalid tracker requested'; END IF;
 ELSE modules := p.allowed_modules; END IF;
 before_status := p.status;
 UPDATE public.platform_profiles
 SET status=COALESCE(requested_status,p.status),allowed_modules=modules,
     enabled_modules=ARRAY(SELECT unnest(p.enabled_modules) INTERSECT SELECT unnest(modules)),
     updated_at=now()
 WHERE user_id=target_user_id RETURNING * INTO p;
 INSERT INTO public.platform_access_audit(actor_user_id,target_user_id,previous_status,next_status,action)
 VALUES ((SELECT auth.uid()),target_user_id,before_status,p.status,
         CASE WHEN requested_status IS NOT NULL THEN 'status_change' ELSE 'module_permissions' END);
 RETURN p;
END;
$$;
REVOKE ALL ON FUNCTION public.tahir_manage_member(uuid,text,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tahir_manage_member(uuid,text,text[]) TO authenticated;


DROP POLICY IF EXISTS "Authenticated owner access" ON public.utility_persons;
DROP POLICY IF EXISTS "Approved module access" ON public.utility_persons;
CREATE POLICY "Approved module access" ON public.utility_persons
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('utility')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('utility')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.utility_bills;
DROP POLICY IF EXISTS "Approved module access" ON public.utility_bills;
CREATE POLICY "Approved module access" ON public.utility_bills
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('utility')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('utility')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.utility_payments;
DROP POLICY IF EXISTS "Approved module access" ON public.utility_payments;
CREATE POLICY "Approved module access" ON public.utility_payments
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('utility')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('utility')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.milk_consumers;
DROP POLICY IF EXISTS "Approved module access" ON public.milk_consumers;
CREATE POLICY "Approved module access" ON public.milk_consumers
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('milk')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('milk')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.milk_logs;
DROP POLICY IF EXISTS "Approved module access" ON public.milk_logs;
CREATE POLICY "Approved module access" ON public.milk_logs
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('milk')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('milk')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.milk_monthly_records;
DROP POLICY IF EXISTS "Approved module access" ON public.milk_monthly_records;
CREATE POLICY "Approved module access" ON public.milk_monthly_records
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('milk')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('milk')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.petrol_refills;
DROP POLICY IF EXISTS "Approved module access" ON public.petrol_refills;
CREATE POLICY "Approved module access" ON public.petrol_refills
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('petrol')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('petrol')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.rent_properties;
DROP POLICY IF EXISTS "Approved module access" ON public.rent_properties;
CREATE POLICY "Approved module access" ON public.rent_properties
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('rent')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('rent')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.rent_portions;
DROP POLICY IF EXISTS "Approved module access" ON public.rent_portions;
CREATE POLICY "Approved module access" ON public.rent_portions
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('rent')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('rent')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.rent_records;
DROP POLICY IF EXISTS "Approved module access" ON public.rent_records;
CREATE POLICY "Approved module access" ON public.rent_records
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('rent')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('rent')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.loans;
DROP POLICY IF EXISTS "Approved module access" ON public.loans;
CREATE POLICY "Approved module access" ON public.loans
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('loans')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('loans')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.settings;
DROP POLICY IF EXISTS "Approved module access" ON public.settings;
CREATE POLICY "Approved module access" ON public.settings
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access(NULL)))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access(NULL)));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.finance_accounts;
DROP POLICY IF EXISTS "Approved module access" ON public.finance_accounts;
CREATE POLICY "Approved module access" ON public.finance_accounts
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.finance_categories;
DROP POLICY IF EXISTS "Approved module access" ON public.finance_categories;
CREATE POLICY "Approved module access" ON public.finance_categories
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.finance_transactions;
DROP POLICY IF EXISTS "Approved module access" ON public.finance_transactions;
CREATE POLICY "Approved module access" ON public.finance_transactions
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.finance_budgets;
DROP POLICY IF EXISTS "Approved module access" ON public.finance_budgets;
CREATE POLICY "Approved module access" ON public.finance_budgets
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.finance_recurring_transactions;
DROP POLICY IF EXISTS "Approved module access" ON public.finance_recurring_transactions;
CREATE POLICY "Approved module access" ON public.finance_recurring_transactions
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.finance_goals;
DROP POLICY IF EXISTS "Approved module access" ON public.finance_goals;
CREATE POLICY "Approved module access" ON public.finance_goals
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')));

DROP POLICY IF EXISTS "Authenticated owner access" ON public.finance_voice_entries;
DROP POLICY IF EXISTS "Approved module access" ON public.finance_voice_entries;
CREATE POLICY "Approved module access" ON public.finance_voice_entries
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.tahir_has_module_access('finance')));

-- Tahir Tracker multi-user SaaS hardening.
-- Existing records are not modified; only constraints/types are tightened.

begin;

-- Existing settings IDs remain unchanged. New workspaces use deterministic
-- 52-bit numeric IDs, so widen the legacy integer key without changing values.
alter table public.settings
  alter column id type bigint using id::bigint;

-- Every current production row was verified to have a non-null user_id before
-- this migration. Enforce ownership at the schema layer in addition to RLS.
do $$
declare
  tbl text;
  tbl_list text[] := array[
    'utility_persons', 'utility_bills', 'utility_payments',
    'milk_consumers', 'milk_logs', 'milk_monthly_records', 'petrol_refills',
    'rent_properties', 'rent_portions', 'rent_records', 'loans', 'settings',
    'finance_accounts', 'finance_categories', 'finance_transactions',
    'finance_budgets', 'finance_recurring_transactions',
    'finance_goals', 'finance_voice_entries'
  ];
begin
  foreach tbl in array tbl_list loop
    execute format('alter table public.%I alter column user_id set not null', tbl);
  end loop;
end
$$;

commit;

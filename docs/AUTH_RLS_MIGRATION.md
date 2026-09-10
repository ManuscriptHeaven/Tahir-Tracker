# Tahir Tracker — Production Authentication & Row Level Security (RLS) Migration

This guide details the exact, zero-data-loss procedure to transition Tahir Tracker from single-user anonymous development mode to production-grade, tenant-isolated Row Level Security (RLS) backed by Supabase Email + Password authentication.

> [!CAUTION]
> **DO NOT** apply restrictive RLS policies before completing Steps 1 through 7. Applying strict policies prematurely will immediately block cloud sync and lock out unmigrated records. Follow every step in chronological order.

---

## 1. Cloud Database Table Audit

The following table inventory has been audited against the application codebase (`src/db/db.ts`, `src/services/syncService.ts`, and `supabase_schema.sql`). All 18 business and configuration tables require the `user_id UUID` column and RLS policies:

| # | Table Name | Data Classification | Ownership Model | Sync Strategy |
| :---: | :--- | :--- | :--- | :--- |
| **1** | `utility_persons` | Shared Utility Household | `user_id UUID REFERENCES auth.users(id)` | Two-way LWW |
| **2** | `utility_bills` | Shared Utility Monthly | `user_id UUID REFERENCES auth.users(id)` | Two-way LWW |
| **3** | `utility_payments` | Shared Utility Ledger | `user_id UUID REFERENCES auth.users(id)` | Append-only historical |
| **4** | `milk_consumers` | Milk Customers/Household | `user_id UUID REFERENCES auth.users(id)` | Two-way LWW |
| **5** | `milk_logs` | Daily Delivery Logs | `user_id UUID REFERENCES auth.users(id)` | Append-only historical |
| **6** | `milk_monthly_records`| Milk Monthly Statements | `user_id UUID REFERENCES auth.users(id)` | Two-way LWW |
| **7** | `petrol_refills` | Fuel Refill Log | `user_id UUID REFERENCES auth.users(id)` | Append-only historical |
| **8** | `rent_portions` | Rental Properties/Portions | `user_id UUID REFERENCES auth.users(id)` | Two-way LWW |
| **9** | `rent_records` | Monthly Rent Ledger | `user_id UUID REFERENCES auth.users(id)` | Two-way LWW |
| **10**| `loans` | Loans Given / Taken | `user_id UUID REFERENCES auth.users(id)` | Append-only historical |
| **11**| `settings` | User Preferences & Defaults| `user_id UUID REFERENCES auth.users(id)` | Timestamp LWW |
| **12**| `finance_accounts` | Bank & Cash Accounts | `user_id UUID REFERENCES auth.users(id)` | Two-way LWW |
| **13**| `finance_categories`| Income / Expense Categories | `user_id UUID REFERENCES auth.users(id)` | Two-way LWW |
| **14**| `finance_transactions`| Financial Transactions | `user_id UUID REFERENCES auth.users(id)` | Append-only historical |
| **15**| `finance_budgets` | Monthly Spending Limits | `user_id UUID REFERENCES auth.users(id)` | Two-way LWW |
| **16**| `finance_recurring_transactions`| Automated Recurring | `user_id UUID REFERENCES auth.users(id)` | Two-way LWW |
| **17**| `finance_goals` | Savings Targets | `user_id UUID REFERENCES auth.users(id)` | Two-way LWW |
| **18**| `finance_voice_entries`| Voice Transcription Logs | `user_id UUID REFERENCES auth.users(id)` | Append-only historical |

> [!NOTE]
> **Local-Only Table**: `sync_queue` is strictly local to IndexedDB / Dexie. It is excluded from backups and is never created or synced in Supabase.

---

## Migration Steps Overview

| Step | Phase | Action | Purpose |
| :---: | :--- | :--- | :--- |
| **1** | Safety | Back up existing data | Guard against accidental data loss |
| **2** | Auth Setup | Create Tahir Supabase Auth User | Establish the primary owner account |
| **3** | Identification | Retrieve Tahir's Auth UUID | Obtain the primary owner foreign key |
| **4** | Pre-Audit & Claim | Pre-inspect rows & assign to UUID | Safe claiming of unowned historical records |
| **5** | Verification | Verify ownership row counts | Confirm zero unowned orphaned rows |
| **6** | Deployment | Deploy Auth-enabled application | Deploy web/PWA and compile Android APK |
| **7** | Client Verification | Verify client sign-in | Confirm frontend session persistence |
| **8** | Database Hardening | Apply Restrictive RLS Policies | Revoke anon access & enforce `auth.uid()` |
| **9** | Live Sync Verification | Test authenticated cloud sync | Verify two-way synchronization |
| **10**| Live Security Audit | Execute Live RLS test plan | Confirm anonymous access is denied |
| **11**| Integrity Check | Verify data completeness | Verify all historical balances and records |

---

## Step 1 — Back Up Existing Data

1. **Export Local Database**:
   - Open Tahir Tracker on your computer or Android device.
   - Navigate to **Settings** $\rightarrow$ **Backup & Restore**.
   - Click **Export Complete Backup (JSON)**.
   - Save the downloaded `.json` file in a secure location (e.g. external drive or secure cloud storage).
2. **Supabase Cloud Backup**:
   - In the [Supabase Dashboard](https://app.supabase.com/), open project `weomrqzammqldszitgcf`.
   - Go to **Database** $\rightarrow$ **Backups** and verify recent automated backup or trigger a manual snapshot.

---

## Step 2 — Create Tahir Supabase Auth User

1. In Supabase Dashboard, navigate to **Authentication** $\rightarrow$ **Users**.
2. Click **Add User** $\rightarrow$ **Create User**.
3. Enter your primary administrator credentials:
   - **Email**: `tahir@tracker.internal` (or your personal email)
   - **Password**: `[YOUR_STRONG_PASSWORD]`
   - **Auto Confirm User**: Toggle **ON** (so no email confirmation link is required).
4. Click **Create User**.

---

## Step 3 — Retrieve Tahir's User UUID

1. In Supabase Dashboard, open **SQL Editor** $\rightarrow$ **New Query**.
2. Run the following query to obtain your user's UUID:

```sql
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'tahir@tracker.internal';
```

3. Copy the returned `id` value (e.g., `a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d`).
   *This UUID is referenced as `<TAHIR_USER_UUID>` in subsequent steps.*

---

## Step 4 — Pre-Migration Inspection & Safe Ownership Assignment

### Phase A: Add Column and Inspect Existing Data
Before assigning ownership, run this script to ensure `user_id` columns exist, and check whether any rows are already owned:

```sql
-- 1. Ensure user_id column exists on all 18 tables
DO $$
DECLARE
    tbl text;
    tbl_list text[] := ARRAY[
        'utility_persons', 'utility_bills', 'utility_payments',
        'milk_consumers', 'milk_logs', 'milk_monthly_records', 'petrol_refills',
        'rent_portions', 'rent_records', 'loans', 'settings',
        'finance_accounts', 'finance_categories', 'finance_transactions',
        'finance_budgets', 'finance_recurring_transactions',
        'finance_goals', 'finance_voice_entries'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbl_list LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id)', tbl);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_user_id ON %I(user_id)', tbl, tbl);
    END LOOP;
END $$;

-- 2. Pre-Migration Safety Audit Query
SELECT 'utility_persons' AS tbl, count(*) AS total_rows, count(*) FILTER (WHERE user_id IS NULL) AS unowned_rows, count(*) FILTER (WHERE user_id IS NOT NULL) AS already_owned FROM utility_persons
UNION ALL SELECT 'utility_bills', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM utility_bills
UNION ALL SELECT 'utility_payments', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM utility_payments
UNION ALL SELECT 'milk_consumers', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM milk_consumers
UNION ALL SELECT 'milk_logs', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM milk_logs
UNION ALL SELECT 'milk_monthly_records', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM milk_monthly_records
UNION ALL SELECT 'petrol_refills', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM petrol_refills
UNION ALL SELECT 'rent_portions', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM rent_portions
UNION ALL SELECT 'rent_records', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM rent_records
UNION ALL SELECT 'loans', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM loans
UNION ALL SELECT 'settings', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM settings
UNION ALL SELECT 'finance_accounts', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM finance_accounts
UNION ALL SELECT 'finance_categories', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM finance_categories
UNION ALL SELECT 'finance_transactions', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM finance_transactions
UNION ALL SELECT 'finance_budgets', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM finance_budgets
UNION ALL SELECT 'finance_recurring_transactions', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM finance_recurring_transactions
UNION ALL SELECT 'finance_goals', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM finance_goals
UNION ALL SELECT 'finance_voice_entries', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id IS NOT NULL) FROM finance_voice_entries;
```

> [!WARNING]
> **Safety Guard**: If `already_owned` is greater than 0, inspect distinct existing owners:
> ```sql
> SELECT DISTINCT user_id FROM finance_transactions WHERE user_id IS NOT NULL;
> ```
> If any existing owner is NOT your `<TAHIR_USER_UUID>`, **STOP** and do not run automatic updates.

### Phase B: Assign Unowned Rows strictly WHERE user_id IS NULL
Replace `<TAHIR_USER_UUID>` with your actual UUID obtained in Step 3 and execute:

```sql
DO $$
DECLARE
    target_uuid UUID := '<TAHIR_USER_UUID>'::uuid;
    tbl text;
    tbl_list text[] := ARRAY[
        'utility_persons', 'utility_bills', 'utility_payments',
        'milk_consumers', 'milk_logs', 'milk_monthly_records', 'petrol_refills',
        'rent_portions', 'rent_records', 'loans', 'settings',
        'finance_accounts', 'finance_categories', 'finance_transactions',
        'finance_budgets', 'finance_recurring_transactions',
        'finance_goals', 'finance_voice_entries'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbl_list LOOP
        -- Strictly update ONLY unowned records; NEVER overwrite existing non-null owners
        EXECUTE format('UPDATE %I SET user_id = %L WHERE user_id IS NULL', tbl, target_uuid);
    END LOOP;
END $$;
```

---

## Step 5 — Verify Ownership Counts

Run this verification query in the SQL Editor to ensure zero unowned records remain:

```sql
SELECT 'utility_persons' AS tbl, count(*) FILTER (WHERE user_id IS NULL) AS unowned, count(*) AS total FROM utility_persons
UNION ALL SELECT 'utility_bills', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM utility_bills
UNION ALL SELECT 'utility_payments', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM utility_payments
UNION ALL SELECT 'milk_consumers', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM milk_consumers
UNION ALL SELECT 'milk_logs', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM milk_logs
UNION ALL SELECT 'milk_monthly_records', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM milk_monthly_records
UNION ALL SELECT 'petrol_refills', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM petrol_refills
UNION ALL SELECT 'rent_portions', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM rent_portions
UNION ALL SELECT 'rent_records', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM rent_records
UNION ALL SELECT 'loans', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM loans
UNION ALL SELECT 'settings', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM settings
UNION ALL SELECT 'finance_accounts', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM finance_accounts
UNION ALL SELECT 'finance_categories', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM finance_categories
UNION ALL SELECT 'finance_transactions', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM finance_transactions
UNION ALL SELECT 'finance_budgets', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM finance_budgets
UNION ALL SELECT 'finance_recurring_transactions', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM finance_recurring_transactions
UNION ALL SELECT 'finance_goals', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM finance_goals
UNION ALL SELECT 'finance_voice_entries', count(*) FILTER (WHERE user_id IS NULL), count(*) FROM finance_voice_entries;
```

> **Acceptance Criterion**: The `unowned` column must be **0** across all 18 tables.

---

## Step 6 — Deploy Auth-Enabled Application

1. Deploy the updated web application to Cloudflare Pages (or your hosting provider):
   ```bash
   npm run build
   # Deploy contents of dist/ directory
   ```
2. Re-sync and verify Android APK build:
   ```bash
   npx cap sync android
   cd android
   .\gradlew.bat assembleDebug
   ```

---

## Step 7 — Verify Client Sign-In

1. Launch Tahir Tracker in your browser or installed Android application.
2. Notice the top navigation bar displays **"Sign In to Sync"** (amber status pill).
3. Click **"Sign In to Sync"** or navigate to **Settings** $\rightarrow$ **Account & Cloud Authentication** $\rightarrow$ **Sign In**.
4. Enter the email and password configured in Step 2.
5. Click **Sign In to Cloud Sync**.
6. Verify:
   - Status updates to green: **"Authenticated"**.
   - Your email (`tahir@tracker.internal`) and user UUID are displayed.
   - All existing offline local records in Dexie remain intact and accessible.

---

## Step 8 — Apply Restrictive RLS Policies

Now that the client is authenticated and all rows have confirmed owners, lock down the database by executing this script in Supabase SQL Editor:

```sql
-- ==============================================================================
-- HARDENED ROW LEVEL SECURITY (TENANT ISOLATION)
-- ==============================================================================
DO $$
DECLARE
    tbl text;
    tbl_list text[] := ARRAY[
        'utility_persons', 'utility_bills', 'utility_payments',
        'milk_consumers', 'milk_logs', 'milk_monthly_records', 'petrol_refills',
        'rent_portions', 'rent_records', 'loans', 'settings',
        'finance_accounts', 'finance_categories', 'finance_transactions',
        'finance_budgets', 'finance_recurring_transactions',
        'finance_goals', 'finance_voice_entries'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbl_list LOOP
        -- 1. Enable RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

        -- 2. Drop all legacy permissive policies
        EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for anon" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated and anon" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Users can select own %s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Users can update own %s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %s" ON %I', tbl, tbl);

        -- 3. Create strict tenant-isolated policies
        -- SELECT: Users can only query their own records
        EXECUTE format('CREATE POLICY "Users can select own %s" ON %I FOR SELECT TO authenticated USING (auth.uid() = user_id)', tbl, tbl);
        
        -- INSERT: Users can only insert records stamped with their own user_id
        EXECUTE format('CREATE POLICY "Users can insert own %s" ON %I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', tbl, tbl);
        
        -- UPDATE: Cannot alter other users' rows, AND cannot transfer ownership to another user_id
        EXECUTE format('CREATE POLICY "Users can update own %s" ON %I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', tbl, tbl);
        
        -- DELETE: Users can only delete their own records
        EXECUTE format('CREATE POLICY "Users can delete own %s" ON %I FOR DELETE TO authenticated USING (auth.uid() = user_id)', tbl, tbl);
    END LOOP;
END $$;
```

---

## Step 9 — Test Authenticated Cloud Sync

1. In the Tahir Tracker app, click the Sync button in the navbar or tap **Sync Now** in Settings.
2. Verify the status progresses from `syncing` $\rightarrow$ `synced` $\rightarrow$ `Live Sync`.
3. Add a test transaction (e.g. PKR 50 expense).
4. Verify the row appears in the Supabase Table Editor under `finance_transactions` with `user_id` matching `<TAHIR_USER_UUID>`.

---

## Step 10 — Execute Live RLS Verification Tests

> [!IMPORTANT]
> The automated test suite (`npm test`) executes client-side simulation tests. The following tests verify **actual live PostgreSQL RLS enforcement** on your remote database instance.

### Test 1: Anonymous SELECT Denied
Run in your local terminal using your publishable anon key (without an auth bearer token):
```bash
curl -i "https://weomrqzammqldszitgcf.supabase.co/rest/v1/finance_transactions?select=id,description,amount" \
  -H "apikey: sb_publishable_cHnZ3ogxeByHrA-gDfjZ5g_Yq-_tKHD"
```
*Expected Result: `HTTP 200 OK` with an empty JSON array `[]` (RLS hides all private rows from anonymous callers).*

### Test 2: Anonymous INSERT Denied
```bash
curl -i -X POST "https://weomrqzammqldszitgcf.supabase.co/rest/v1/finance_transactions" \
  -H "apikey: sb_publishable_cHnZ3ogxeByHrA-gDfjZ5g_Yq-_tKHD" \
  -H "Content-Type: application/json" \
  -d '{"id":"anon_exploit_1","description":"Hacked expense","amount":999999}'
```
*Expected Result: `HTTP 401 Unauthorized` or `HTTP 403 Forbidden` with error `new row violates row-level security policy`.*

### Test 3: Anonymous UPDATE & DELETE Denied
```bash
curl -i -X PATCH "https://weomrqzammqldszitgcf.supabase.co/rest/v1/finance_transactions?id=eq.anon_exploit_1" \
  -H "apikey: sb_publishable_cHnZ3ogxeByHrA-gDfjZ5g_Yq-_tKHD" \
  -H "Content-Type: application/json" \
  -d '{"amount":0}'
```
*Expected Result: `HTTP 401 / 403` or zero rows modified.*

### Test 4: Authenticated Tahir Access Verified
1. Perform mutations (create transaction, update tenant rent, mark milk log) inside the authenticated Tahir Tracker application.
2. Confirm records sync bidirectionally without errors.

### Test 5: Cross-Tenant Isolation Verified
If an auxiliary test user is registered in Supabase Auth:
1. Log in as the auxiliary user on a secondary device or browser incognito window.
2. Confirm that the auxiliary user sees zero of Tahir's financial accounts, rent records, loans, or transactions.

---

## Step 11 — Verify Existing Data Completeness

1. Navigate through every module in Tahir Tracker:
   - **Personal Finance**: Check account balances and historical transactions.
   - **Rent Tracker**: Check portions, tenant names, arrears, and monthly records.
   - **Milk Tracker**: Check consumer list and daily delivery records.
   - **Utility Bills**: Check Saleem's 3-way split ledger and past payment receipts.
   - **Loans**: Check given/taken balances.
   - **Petrol Tracker**: Check odometer refill history and fuel averages.
2. Confirm all historical records are intact.

---

## Safe Emergency Recovery Procedures

> [!CAUTION]
> **NEVER** attempt to resolve an RLS issue by reopening tables to anonymous access (`USING (true)`). Doing so exposes private financial records to anyone on the internet. Use one of the four safe recovery options below:

### Recovery Option A: Client-Side Sync Pause (Fastest & Safest)
If an unexpected sync loop occurs, simply click **Sign Out** in **Settings** $\rightarrow$ **Account & Cloud Authentication**.
- Local Dexie functionality continues operating 100% offline.
- Mutations queue safely in IndexedDB without causing cloud errors.
- No database changes required while diagnosing.

### Recovery Option B: Fix Specific Authenticated Policy
If an authenticated query is rejected, verify the policy syntax in Supabase SQL Editor:
```sql
-- Re-assert strict authenticated policy for the affected table
DROP POLICY IF EXISTS "Users can select own finance_transactions" ON finance_transactions;
CREATE POLICY "Users can select own finance_transactions" 
  ON finance_transactions FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);
```

### Recovery Option C: Restrict Access to Tahir's UUID Only
If debugging requires bypassing `auth.uid()` dynamically, restrict access **strictly to Tahir's authenticated UUID**, NEVER to anonymous callers:
```sql
-- Temporary emergency policy strictly scoped to Tahir's UUID
CREATE POLICY "Tahir emergency access only" 
  ON finance_transactions FOR ALL 
  TO authenticated 
  USING (auth.uid() = '<TAHIR_USER_UUID>'::uuid)
  WITH CHECK (auth.uid() = '<TAHIR_USER_UUID>'::uuid);
```

### Recovery Option D: Administrative Backup Restore
If database corruption occurs, restore the snapshot exported in Step 1:
1. Restore cloud tables via Supabase Dashboard (**Database** $\rightarrow$ **Backups**).
2. Restore local database via **Settings** $\rightarrow$ **Backup & Restore** $\rightarrow$ **Restore Backup from JSON**.

-- ==============================================================================
-- TAHIR TRACKER — SUPABASE POSTGRESQL DATABASE SCHEMA
-- Execute this script in your Supabase Project's SQL Editor
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. UTILITY PERSONS
CREATE TABLE IF NOT EXISTS utility_persons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    monthly_expected_contribution NUMERIC DEFAULT 9500,
    currency TEXT DEFAULT 'PKR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. UTILITY BILLS
CREATE TABLE IF NOT EXISTS utility_bills (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    month_year TEXT NOT NULL,
    electricity NUMERIC DEFAULT 0,
    gas NUMERIC DEFAULT 0,
    water NUMERIC DEFAULT 0,
    saleem_water_gas_share NUMERIC DEFAULT 0,
    total_bill NUMERIC DEFAULT 0,
    expected_contribution NUMERIC DEFAULT 9500,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_utility_bills_month_year ON utility_bills(month_year);

-- 3. UTILITY PAYMENTS
CREATE TABLE IF NOT EXISTS utility_payments (
    id TEXT PRIMARY KEY,
    utility_bill_id TEXT,
    person_id TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_utility_payments_bill_id ON utility_payments(utility_bill_id);

-- 4. MILK CONSUMERS
CREATE TABLE IF NOT EXISTS milk_consumers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    default_daily_kg NUMERIC NOT NULL DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MILK LOGS
CREATE TABLE IF NOT EXISTS milk_logs (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    consumer_id TEXT NOT NULL,
    consumer_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('supplied', 'missed', 'custom')),
    actual_kg NUMERIC NOT NULL DEFAULT 0,
    rate_per_kg NUMERIC NOT NULL DEFAULT 260,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_milk_logs_date ON milk_logs(date);

-- 5b. MILK MONTHLY RECORDS (Payment and remaining balances)
CREATE TABLE IF NOT EXISTS milk_monthly_records (
    id TEXT PRIMARY KEY,
    month_year TEXT NOT NULL,
    total_kg NUMERIC DEFAULT 0,
    rate_per_kg NUMERIC DEFAULT 260,
    total_bill NUMERIC DEFAULT 0,
    previous_remaining NUMERIC DEFAULT 0,
    total_payable NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    remaining_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'unpaid',
    payment_date TEXT,
    payment_method TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_milk_monthly_records_month ON milk_monthly_records(month_year);

-- 6. PETROL REFILLS
CREATE TABLE IF NOT EXISTS petrol_refills (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    odometer_reading NUMERIC NOT NULL,
    litres NUMERIC NOT NULL,
    price_per_litre NUMERIC NOT NULL,
    total_cost NUMERIC NOT NULL,
    distance_travelled NUMERIC DEFAULT 0,
    mileage_kmpl NUMERIC DEFAULT 0,
    cost_per_km NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_petrol_refills_date ON petrol_refills(date);

-- 7. RENT PORTIONS
CREATE TABLE IF NOT EXISTS rent_portions (
    id TEXT PRIMARY KEY,
    portion_name TEXT NOT NULL,
    tenant_name TEXT NOT NULL,
    tenant_phone TEXT,
    expected_rent NUMERIC NOT NULL DEFAULT 0,
    due_day INT DEFAULT 10,
    initial_arrears NUMERIC DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. RENT RECORDS
CREATE TABLE IF NOT EXISTS rent_records (
    id TEXT PRIMARY KEY,
    portion_id TEXT NOT NULL,
    portion_name TEXT NOT NULL,
    tenant_name TEXT NOT NULL,
    month_year TEXT NOT NULL,
    expected_amount NUMERIC NOT NULL DEFAULT 0,
    arrears_amount NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_date TEXT,
    payment_method TEXT,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rent_records_month_year ON rent_records(month_year);

-- 9. LOANS
CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    person_name TEXT NOT NULL,
    person_phone TEXT,
    type TEXT NOT NULL CHECK (type IN ('given', 'taken')),
    principal_amount NUMERIC NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    due_date TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    payments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. APP SETTINGS
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY DEFAULT 1,
    currency TEXT DEFAULT 'PKR',
    milk_default_rate NUMERIC DEFAULT 260,
    rent_due_day_default INT DEFAULT 10,
    theme TEXT DEFAULT 'light',
    last_backup_date TIMESTAMPTZ
);

-- ==============================================================================
-- PERSONAL FINANCE TABLES
-- ==============================================================================

-- 11. FINANCE ACCOUNTS
CREATE TABLE IF NOT EXISTS finance_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'PKR',
    institution TEXT,
    account_number TEXT,
    icon TEXT,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. FINANCE CATEGORIES
CREATE TABLE IF NOT EXISTS finance_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    parent_category_id TEXT,
    icon TEXT DEFAULT '📦',
    color TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. FINANCE TRANSACTIONS
CREATE TABLE IF NOT EXISTS finance_transactions (
    id TEXT PRIMARY KEY,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('expense', 'income', 'transfer')),
    amount NUMERIC NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'PKR',
    category_id TEXT,
    category_name TEXT,
    account_id TEXT NOT NULL,
    account_name TEXT,
    transfer_to_account_id TEXT,
    transfer_to_account_name TEXT,
    transaction_date TEXT NOT NULL,
    description TEXT NOT NULL,
    source TEXT DEFAULT 'manual',
    status TEXT DEFAULT 'completed',
    attachment_note TEXT,
    raw_voice_transcript TEXT,
    confidence_score NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_tx_date ON finance_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_finance_tx_cat ON finance_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_finance_tx_acc ON finance_transactions(account_id);

-- 14. FINANCE BUDGETS
CREATE TABLE IF NOT EXISTS finance_budgets (
    id TEXT PRIMARY KEY,
    category_id TEXT,
    category_name TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    period TEXT DEFAULT 'monthly',
    start_date TEXT,
    end_date TEXT,
    alert_threshold NUMERIC DEFAULT 80,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. FINANCE RECURRING TRANSACTIONS
CREATE TABLE IF NOT EXISTS finance_recurring_transactions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    category_id TEXT,
    account_id TEXT NOT NULL,
    transfer_to_account_id TEXT,
    description TEXT,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    start_date TEXT NOT NULL,
    next_run_date TEXT NOT NULL,
    end_date TEXT,
    auto_process BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. FINANCE GOALS
CREATE TABLE IF NOT EXISTS finance_goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_amount NUMERIC NOT NULL DEFAULT 0,
    current_amount NUMERIC NOT NULL DEFAULT 0,
    target_date TEXT,
    status TEXT DEFAULT 'in_progress',
    notes TEXT,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. FINANCE VOICE ENTRIES
CREATE TABLE IF NOT EXISTS finance_voice_entries (
    id TEXT PRIMARY KEY,
    audio_url TEXT,
    transcript TEXT NOT NULL,
    parsed_data JSONB DEFAULT '{}'::jsonb,
    confidence_score NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'confirmed',
    transaction_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE utility_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE milk_consumers ENABLE ROW LEVEL SECURITY;
ALTER TABLE milk_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE milk_monthly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE petrol_refills ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_portions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_voice_entries ENABLE ROW LEVEL SECURITY;

-- Allow full access to anon/authenticated users (for personal tracker)
DO $$
BEGIN
    EXECUTE 'CREATE POLICY "Allow all access to utility_persons" ON utility_persons FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to utility_bills" ON utility_bills FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to utility_payments" ON utility_payments FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to milk_consumers" ON milk_consumers FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to milk_logs" ON milk_logs FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to milk_monthly_records" ON milk_monthly_records FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to petrol_refills" ON petrol_refills FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to rent_portions" ON rent_portions FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to rent_records" ON rent_records FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to loans" ON loans FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to settings" ON settings FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'CREATE POLICY "Allow all access to finance_accounts" ON finance_accounts FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to finance_categories" ON finance_categories FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to finance_transactions" ON finance_transactions FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to finance_budgets" ON finance_budgets FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to finance_recurring_transactions" ON finance_recurring_transactions FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to finance_goals" ON finance_goals FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to finance_voice_entries" ON finance_voice_entries FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 18. SUPABASE REALTIME CDC & REPLICA IDENTITY CONFIGURATION
-- Enables sub-second WebSocket synchronization between Android APK, PWA & Desktop
-- ==============================================================================
DO $$
BEGIN
    -- Set REPLICA IDENTITY FULL so DELETE events contain old.id across all tables
    ALTER TABLE utility_persons REPLICA IDENTITY FULL;
    ALTER TABLE utility_bills REPLICA IDENTITY FULL;
    ALTER TABLE utility_payments REPLICA IDENTITY FULL;
    ALTER TABLE milk_consumers REPLICA IDENTITY FULL;
    ALTER TABLE milk_logs REPLICA IDENTITY FULL;
    ALTER TABLE milk_monthly_records REPLICA IDENTITY FULL;
    ALTER TABLE petrol_refills REPLICA IDENTITY FULL;
    ALTER TABLE rent_portions REPLICA IDENTITY FULL;
    ALTER TABLE rent_records REPLICA IDENTITY FULL;
    ALTER TABLE loans REPLICA IDENTITY FULL;
    ALTER TABLE settings REPLICA IDENTITY FULL;

    ALTER TABLE finance_accounts REPLICA IDENTITY FULL;
    ALTER TABLE finance_categories REPLICA IDENTITY FULL;
    ALTER TABLE finance_transactions REPLICA IDENTITY FULL;
    ALTER TABLE finance_budgets REPLICA IDENTITY FULL;
    ALTER TABLE finance_recurring_transactions REPLICA IDENTITY FULL;
    ALTER TABLE finance_goals REPLICA IDENTITY FULL;
    ALTER TABLE finance_voice_entries REPLICA IDENTITY FULL;

    -- Add all tables to supabase_realtime publication (safely adding each table)
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
            BEGIN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
            EXCEPTION
                WHEN duplicate_object THEN NULL;
                WHEN others THEN NULL;
            END;
        END LOOP;
    END;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN others THEN null;
END $$;

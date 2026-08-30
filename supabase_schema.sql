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

-- Enable Row Level Security (RLS)
ALTER TABLE utility_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE milk_consumers ENABLE ROW LEVEL SECURITY;
ALTER TABLE milk_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE petrol_refills ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_portions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow full access to anon/authenticated users (for personal tracker)
DO $$
BEGIN
    EXECUTE 'CREATE POLICY "Allow all access to utility_persons" ON utility_persons FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to utility_bills" ON utility_bills FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to utility_payments" ON utility_payments FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to milk_consumers" ON milk_consumers FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to milk_logs" ON milk_logs FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to petrol_refills" ON petrol_refills FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to rent_portions" ON rent_portions FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to rent_records" ON rent_records FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to loans" ON loans FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all access to settings" ON settings FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

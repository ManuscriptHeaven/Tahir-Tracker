import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  db, 
  exportDatabaseToJson, 
  importDatabaseFromJson, 
  resetDatabaseToDefaults 
} from '../../db/db';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection, 
  isSupabaseConfigured 
} from '../../lib/supabase';
import { 
  syncWithSupabase, 
  subscribeSyncStatus, 
  SyncStatus 
} from '../../services/syncService';
import download from 'downloadjs';
import { 
  Settings, 
  Download, 
  Upload, 
  RotateCcw, 
  Smartphone, 
  Database,
  CheckCircle2,
  DollarSign,
  Milk,
  Home,
  Cloud,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const settingsList = useLiveQuery(() => db.settings.toArray());
  const currentSettings = settingsList?.[0];

  const [milkRate, setMilkRate] = useState(currentSettings?.milkDefaultRate?.toString() || '260');
  const [rentDueDay, setRentDueDay] = useState(currentSettings?.rentDueDayDefault?.toString() || '10');
  const [currency, setCurrency] = useState(currentSettings?.currency || 'PKR');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Supabase State
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'unconfigured',
    lastSyncedAt: null,
    message: ''
  });

  useEffect(() => {
    const config = getSupabaseConfig();
    setSupabaseUrl(config.url);
    setSupabaseKey(config.anonKey);

    const unsubscribe = subscribeSyncStatus((status) => {
      setSyncStatus(status);
    });

    return () => unsubscribe();
  }, []);

  // Handle Save Preferences
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const rate = parseFloat(milkRate) || 260;
    const due = parseInt(rentDueDay, 10) || 10;

    if (currentSettings?.id) {
      await db.settings.update(currentSettings.id, {
        milkDefaultRate: rate,
        rentDueDayDefault: due,
        currency: currency.trim() || 'PKR'
      });
    } else {
      await db.settings.add({
        currency: currency.trim() || 'PKR',
        milkDefaultRate: rate,
        rentDueDayDefault: due,
        theme: 'light'
      });
    }

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Handle Save Supabase Credentials
  const handleSaveSupabaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(supabaseUrl, supabaseKey);
    setTestResult({
      success: true,
      message: 'Supabase credentials saved successfully in local storage!'
    });
    setTimeout(() => setTestResult(null), 3000);
  };

  // Handle Test Connection
  const handleTestConnection = async () => {
    saveSupabaseConfig(supabaseUrl, supabaseKey);
    setIsTestingSupabase(true);
    setTestResult(null);
    const res = await testSupabaseConnection();
    setIsTestingSupabase(false);
    setTestResult(res);
  };

  // Handle Manual Sync
  const handleManualSyncNow = async () => {
    setIsSyncing(true);
    const res = await syncWithSupabase();
    setIsSyncing(false);
    alert(res.message);
  };

  // Handle Copy Schema SQL
  const handleCopySchemaSql = async () => {
    try {
      const response = await fetch('/supabase_schema.sql');
      let sql = '';
      if (response.ok) {
        sql = await response.text();
      } else {
        sql = `-- Run this in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS utility_persons (id TEXT PRIMARY KEY, name TEXT, monthly_expected_contribution NUMERIC, currency TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS utility_bills (id TEXT PRIMARY KEY, person_id TEXT, month INT, year INT, month_year TEXT, electricity NUMERIC, gas NUMERIC, water NUMERIC, saleem_water_gas_share NUMERIC, total_bill NUMERIC, expected_contribution NUMERIC, notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS utility_payments (id TEXT PRIMARY KEY, utility_bill_id TEXT, person_id TEXT, payment_date TEXT, amount NUMERIC, note TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS milk_consumers (id TEXT PRIMARY KEY, name TEXT, default_daily_kg NUMERIC, active BOOLEAN, created_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS milk_logs (id TEXT PRIMARY KEY, date TEXT, consumer_id TEXT, consumer_name TEXT, status TEXT, actual_kg NUMERIC, rate_per_kg NUMERIC, notes TEXT);
CREATE TABLE IF NOT EXISTS petrol_refills (id TEXT PRIMARY KEY, date TEXT, odometer_reading NUMERIC, litres NUMERIC, price_per_litre NUMERIC, total_cost NUMERIC, distance_travelled NUMERIC, mileage_kmpl NUMERIC, cost_per_km NUMERIC, notes TEXT, created_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS rent_portions (id TEXT PRIMARY KEY, portion_name TEXT, tenant_name TEXT, tenant_phone TEXT, expected_rent NUMERIC, due_day INT, initial_arrears NUMERIC, active BOOLEAN, created_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS rent_records (id TEXT PRIMARY KEY, portion_id TEXT, portion_name TEXT, tenant_name TEXT, month_year TEXT, expected_amount NUMERIC, arrears_amount NUMERIC, paid_amount NUMERIC, status TEXT, payment_date TEXT, payment_method TEXT, notes TEXT, updated_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS loans (id TEXT PRIMARY KEY, person_name TEXT, person_phone TEXT, type TEXT, principal_amount NUMERIC, date TEXT, due_date TEXT, notes TEXT, status TEXT, payments JSONB, created_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS settings (id INT PRIMARY KEY DEFAULT 1, currency TEXT, milk_default_rate NUMERIC, rent_due_day_default INT, theme TEXT, last_backup_date TIMESTAMPTZ);`;
      }
      await navigator.clipboard.writeText(sql);
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 3000);
    } catch (err) {
      alert('Could not copy automatically. Please open supabase_schema.sql in the project root.');
    }
  };

  // Handle Export Backup
  const handleExportBackup = async () => {
    try {
      const json = await exportDatabaseToJson();
      const dateStr = new Date().toISOString().split('T')[0];
      download(json, `Tahir_Tracker_Backup_${dateStr}.json`, 'application/json');
    } catch (err) {
      alert('Failed to export backup data.');
    }
  };

  // Handle Import Backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Importing this backup will overwrite existing local data. Do you want to proceed?')) {
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      await importDatabaseFromJson(text);
      alert('Database restored successfully from backup!');
      window.location.reload();
    } catch (err) {
      alert('Invalid backup JSON file. Restore failed.');
    }
    e.target.value = '';
  };

  // Handle Reset to Demo
  const handleResetToDemo = async () => {
    if (!confirm('Reset all trackers to sample demo records? All custom changes will be reset.')) return;
    await resetDatabaseToDefaults();
    alert('Reset completed successfully.');
    window.location.reload();
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-600" />
          Settings & Cloud Integration
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Connect Supabase database, manage offline sync, and configure default preferences
        </p>
      </div>

      {/* 1. SUPABASE CLOUD DATABASE CONFIGURATION */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Supabase Cloud Database</h3>
              <p className="text-xs text-slate-500">PostgreSQL backend with offline-first synchronization</p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            isSupabaseConfigured() ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
          }`}>
            {isSupabaseConfigured() ? 'Configured' : 'Not Connected'}
          </span>
        </div>

        <form onSubmit={handleSaveSupabaseConfig} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              placeholder="https://xyzcompany.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Supabase Anon Public API Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {testResult && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
              testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {testResult.success ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTestingSupabase || !supabaseUrl || !supabaseKey}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isTestingSupabase ? 'Testing Connection...' : 'Test Connection'}
            </button>

            <button
              type="button"
              onClick={handleManualSyncNow}
              disabled={isSyncing || !isSupabaseConfigured()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now (Push & Pull)'}
            </button>

            <button
              type="button"
              onClick={handleCopySchemaSql}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ml-auto cursor-pointer"
              title="Copy SQL script to paste in Supabase SQL Editor"
            >
              {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSchema ? 'SQL Copied!' : 'Copy SQL Schema'}
            </button>

            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
            >
              Save Credentials
            </button>
          </div>
        </form>

        {syncStatus.lastSyncedAt && (
          <div className="text-[11px] text-slate-400 pt-1">
            Last Synced: <strong>{new Date(syncStatus.lastSyncedAt).toLocaleString()}</strong>
          </div>
        )}
      </div>

      {/* 2. GLOBAL PREFERENCES FORM */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          App Preferences & Defaults
        </h3>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Milk className="w-3.5 h-3.5 text-teal-600" />
                Default Milk Rate (PKR/kg)
              </label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={milkRate}
                onChange={(e) => setMilkRate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-emerald-600" />
                Rent Due Day of Month
              </label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={rentDueDay}
                onChange={(e) => setRentDueDay(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Preferences saved!
              </span>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="ml-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. BACKUP & RESTORE SECTION */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            Offline Backup & Restore
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Your data is stored 100% locally in your phone's IndexedDB and synchronizes with Supabase. Export a JSON backup to keep offline archives.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/90 hover:border-emerald-300 transition-all flex items-center gap-3 text-left group cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 group-hover:scale-105 transition-transform">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">Download Backup (JSON)</div>
              <div className="text-xs text-slate-500">Export full database file</div>
            </div>
          </button>

          <label className="p-4 rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-200/90 hover:border-blue-300 transition-all flex items-center gap-3 text-left cursor-pointer group">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-800 group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">Restore from Backup</div>
              <div className="text-xs text-slate-500">Select previously saved JSON</div>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handleResetToDemo}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Sample Demo Data
          </button>
        </div>
      </div>

      {/* 4. PWA & MOBILE INSTALLATION GUIDE */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-5 sm:p-6 border border-emerald-200/80 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-600 text-white font-bold">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Progressive Web App (PWA)</h3>
            <p className="text-xs text-emerald-800">Install to your Android, iPhone or Desktop</p>
          </div>
        </div>

        <div className="text-xs text-slate-700 space-y-1.5 pl-1">
          <p><strong>On Android (Chrome/Edge):</strong> Tap the 3 dots (⋮) in your browser &gt; Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</p>
          <p><strong>On iPhone (Safari):</strong> Tap the Share button (<span className="text-sm">⎋</span>) &gt; Tap <strong>"Add to Home Screen"</strong>.</p>
          <p><strong>On Desktop (Chrome/Edge):</strong> Click the install icon (<Download className="w-3 h-3 inline" />) in the address bar to install as a standalone desktop app.</p>
          <p className="text-emerald-900 font-bold">✓ Works 100% offline and auto-syncs with Supabase cloud when internet is available!</p>
        </div>
      </div>
    </div>
  );
};

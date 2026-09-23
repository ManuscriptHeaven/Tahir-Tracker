import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  db, 
  exportDatabaseToJson, 
  importDatabaseFromJson, 
  validateBackupJson,
  resetDatabaseToDefaults,
  cleanupLegacyDummyData
} from '../../db/db';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection, 
  isSupabaseConfigured 
} from '../../lib/supabase';
import { getTodayLocalDateStr } from '../../utils/dateTime';
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
  Trash2,
  Cloud,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  Lock,
  LogIn,
  LogOut,
  User as UserIcon,
  Eye,
  EyeOff,
  KeyRound,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LoginModal } from '../auth/LoginModal';
import { PageHeader } from '../ui/PageHeader';

export const SettingsView: React.FC = () => {
  const { user, isAuthenticated, signOut, updatePassword } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Change Password State
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);

    if (newPassword.length < 6) {
      setPasswordChangeError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordChangeError('Passwords do not match. Please re-enter.');
      return;
    }

    setPasswordChangeLoading(true);
    const res = await updatePassword(newPassword);
    setPasswordChangeLoading(false);

    if (res.success) {
      setPasswordChangeSuccess('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordChangeSuccess(null);
        setIsChangePasswordOpen(false);
      }, 2500);
    } else {
      setPasswordChangeError(res.error || 'Failed to update password.');
    }
  };

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
        theme: 'dark'
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
      const sql = `-- Refer to supabase_schema.sql in the project root for complete schema and RLS policies.
-- Documentation: docs/AUTH_RLS_MIGRATION.md
-- To review or execute the full schema, open supabase_schema.sql directly.`;
      await navigator.clipboard.writeText(sql);
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 3000);
      alert('Refer to supabase_schema.sql in your workspace root for the complete production SQL schema and RLS policies.');
    } catch (err) {
      alert('Please open supabase_schema.sql in the project root.');
    }
  };

  // Handle Export Backup
  const handleExportBackup = async () => {
    try {
      const json = await exportDatabaseToJson();
      const dateStr = getTodayLocalDateStr();
      download(json, `Tahir_Tracker_Backup_${dateStr}.json`, 'application/json');
    } catch (err) {
      alert('Failed to export backup data.');
    }
  };

  // Handle Import Backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validation = validateBackupJson(parsed);
      if (!validation.isValid) {
        alert(`Cannot restore backup: ${validation.error}`);
        e.target.value = '';
        return;
      }

      const summaryDetails = Object.entries(validation.summary || {})
        .filter(([_, cnt]) => cnt > 0)
        .map(([tbl, cnt]) => `• ${tbl.replace(/_/g, ' ')}: ${cnt}`)
        .join('\n');

      const confirmed = confirm(
        `✅ Backup file verified successfully!\n\nFound records:\n${summaryDetails || 'Empty tables'}\n\nRestoring will replace current local database records. Do you want to proceed?`
      );

      if (!confirmed) {
        e.target.value = '';
        return;
      }

      await importDatabaseFromJson(text);
      alert('Database restored successfully from backup!');
      window.location.reload();
    } catch (err: any) {
      alert(`Invalid backup JSON file. Restore failed: ${err.message || 'Parse error'}`);
    }
    e.target.value = '';
  };

  // Handle Purge Dummy Records
  const handlePurgeDummyData = async () => {
    if (!confirm('Purge all sample/dummy records (dummy fuel entries, sample loans, fake tenants, etc.)? Your real custom entries will remain intact.')) return;
    await cleanupLegacyDummyData();
    if (isSupabaseConfigured()) {
      await syncWithSupabase();
    }
    alert('All dummy and sample records have been purged successfully!');
    window.location.reload();
  };

  // Handle Reset to Clean State
  const handleResetToClean = async () => {
    if (!confirm('Reset database to clean default state? All tracker entries will be wiped with zero dummy records added.')) return;
    await resetDatabaseToDefaults();
    alert('Database successfully reset to clean state (zero dummy entries).');
    window.location.reload();
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
      {/* Header */}
      <PageHeader
        title="Settings & Cloud Integration"
        subtitle="Connect Supabase database, manage offline sync, and configure default preferences"
        icon={Settings}
      />

      {/* 0. SUPABASE AUTHENTICATION & ACCOUNT */}
      <div className="bg-[#0B1D2C] rounded-3xl p-5 sm:p-6 border border-cyan-500/20 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-[#18E6BE] border border-teal-500/20 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Account & Cloud Authentication</h3>
              <p className="text-xs text-slate-400">Secure owner session required for cloud sync</p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
            isAuthenticated 
              ? 'bg-teal-500/20 text-[#18E6BE] border-teal-500/40' 
              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
          }`}>
            {isAuthenticated ? 'Authenticated' : 'Sign In Required'}
          </span>
        </div>

        {isAuthenticated && user ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#071724] border border-teal-500/30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-[#18E6BE]" />
                  <span className="text-xs font-bold text-white">{user.email}</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  User ID: {user.id}
                </p>
                <p className="text-[11px] text-teal-400 font-semibold">
                  ✓ Cloud synchronization is active and user-scoped.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangePasswordOpen(!isChangePasswordOpen);
                    setPasswordChangeError(null);
                    setPasswordChangeSuccess(null);
                  }}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                    isChangePasswordOpen 
                      ? 'bg-teal-500/20 text-[#18E6BE] border-teal-500/40' 
                      : 'bg-[#102638] hover:bg-slate-700 text-[#18E6BE] border-teal-500/30'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isChangePasswordOpen ? 'Cancel' : 'Change Password'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                  }}
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* In-app Change Password Subform */}
            {isChangePasswordOpen && (
              <form 
                onSubmit={handleUpdatePassword} 
                className="p-4 rounded-2xl bg-[#071724] border border-cyan-500/30 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-[#18E6BE] flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Change Account Password</h4>
                    <p className="text-[10px] text-slate-400">Update your cloud authentication password</p>
                  </div>
                </div>

                {passwordChangeError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{passwordChangeError}</span>
                  </div>
                )}

                {passwordChangeSuccess && (
                  <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-[#18E6BE] text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#18E6BE]" />
                    <span>{passwordChangeSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      New Password <span className="text-[10px] font-normal text-slate-400">(min 6 chars)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
                        className="w-full px-3 py-2 pr-9 bg-[#0B1D2C] border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        aria-label="Toggle new password visibility"
                      >
                        {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
                        className="w-full px-3 py-2 pr-9 bg-[#0B1D2C] border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        aria-label="Toggle confirm password visibility"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={passwordChangeLoading || !newPassword || !confirmPassword}
                    className="px-5 py-2 bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] text-[#06131F] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {passwordChangeLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save New Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#071724] border border-amber-500/30">
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-300">
                Not signed in to Supabase Cloud
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Your local Dexie database remains fully functional offline. To enable cloud synchronization and multi-device backups, please sign in.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] text-[#06131F] rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-teal-500/20 shrink-0 cursor-pointer self-start sm:self-auto"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In to Cloud Sync</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. SUPABASE CLOUD DATABASE CONFIGURATION */}
      <div className="bg-[#0B1D2C] rounded-3xl p-5 sm:p-6 border border-cyan-500/20 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-[#18E6BE] border border-teal-500/20 flex items-center justify-center font-bold">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Supabase Cloud Database</h3>
              <p className="text-xs text-slate-400">PostgreSQL backend with offline-first synchronization</p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
            isSupabaseConfigured() 
              ? 'bg-teal-500/20 text-[#18E6BE] border-teal-500/40' 
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {isSupabaseConfigured() ? 'Configured' : 'Not Connected'}
          </span>
        </div>

        <form onSubmit={handleSaveSupabaseConfig} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              placeholder="https://xyzcompany.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-white focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Supabase Anon Public API Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-white focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE]"
            />
          </div>

          {testResult && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 border ${
              testResult.success 
                ? 'bg-teal-500/10 text-teal-300 border-teal-500/30' 
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}>
              {testResult.success ? (
                <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
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
              className="px-4 py-2 bg-[#102638] hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isTestingSupabase ? 'Testing Connection...' : 'Test Connection'}
            </button>

            <button
              type="button"
              onClick={handleManualSyncNow}
              disabled={isSyncing || !isSupabaseConfigured()}
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] text-[#06131F] rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-teal-500/20 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now (Push & Pull)'}
            </button>

            <button
              type="button"
              onClick={handleCopySchemaSql}
              className="px-3 py-2 bg-[#102638] hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ml-auto cursor-pointer"
              title="Copy SQL script to paste in Supabase SQL Editor"
            >
              {copiedSchema ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSchema ? 'SQL Copied!' : 'Copy SQL Schema'}
            </button>

            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] text-[#06131F] rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer"
            >
              Save Credentials
            </button>
          </div>
        </form>

        {syncStatus.lastSyncedAt && (
          <div className="text-[11px] text-slate-400 pt-1">
            Last Synced: <strong className="text-teal-300">{new Date(syncStatus.lastSyncedAt).toLocaleString()}</strong>
          </div>
        )}
      </div>

      {/* 2. GLOBAL PREFERENCES FORM */}
      <div className="bg-[#0B1D2C] rounded-3xl p-5 sm:p-6 border border-cyan-500/20 shadow-xl">
        <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[#18E6BE]" />
          App Preferences & Defaults
        </h3>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <Milk className="w-3.5 h-3.5 text-teal-400" />
                Default Milk Rate (PKR/kg)
              </label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={milkRate}
                onChange={(e) => setMilkRate(e.target.value)}
                className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-sm font-bold text-white focus:border-[#18E6BE]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-teal-400" />
                Rent Due Day of Month
              </label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={rentDueDay}
                onChange={(e) => setRentDueDay(e.target.value)}
                className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-sm font-bold text-white focus:border-[#18E6BE]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-sm font-bold text-white focus:border-[#18E6BE]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {saveSuccess && (
              <span className="text-xs font-bold text-[#18E6BE] flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Preferences saved!
              </span>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="ml-auto px-5 py-2 bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] text-[#06131F] rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-teal-500/20 transition-all cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. BACKUP & RESTORE SECTION */}
      <div className="bg-[#0B1D2C] rounded-3xl p-5 sm:p-6 border border-cyan-500/20 shadow-xl space-y-4">
        <div>
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-[#18E6BE]" />
            Offline Backup & Restore
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Your data is stored 100% locally in your phone's IndexedDB and synchronizes with Supabase. Export a JSON backup to keep offline archives.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="p-4 rounded-2xl bg-[#071724] hover:bg-[#102638] border border-cyan-500/20 hover:border-cyan-500/40 transition-all flex items-center gap-3 text-left group cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-[#18E6BE] border border-teal-500/20 group-hover:scale-105 transition-transform">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">Download Backup (JSON)</div>
              <div className="text-xs text-slate-400">Export full database file</div>
            </div>
          </button>

          <label className="p-4 rounded-2xl bg-[#071724] hover:bg-[#102638] border border-cyan-500/20 hover:border-cyan-500/40 transition-all flex items-center gap-3 text-left cursor-pointer group">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">Restore from Backup</div>
              <div className="text-xs text-slate-400">Select previously saved JSON</div>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>

        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={handlePurgeDummyData}
            className="px-3.5 py-2 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Purge Legacy Dummy Records
          </button>

          <button
            onClick={handleResetToClean}
            className="px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white bg-[#102638] hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All Data to Clean State
          </button>
        </div>
      </div>

      {/* 4. PWA & MOBILE INSTALLATION GUIDE */}
      <div className="bg-gradient-to-br from-[#0B1D2C] to-[#102638] rounded-3xl p-5 sm:p-6 border border-cyan-500/20 shadow-xl space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-500/10 text-[#18E6BE] border border-teal-500/20 font-bold">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Progressive Web App (PWA)</h3>
            <p className="text-xs text-teal-400">Install to your Android, iPhone or Desktop</p>
          </div>
        </div>

        <div className="text-xs text-slate-300 space-y-1.5 pl-1">
          <p><strong className="text-white">On Android (Chrome/Edge):</strong> Tap the 3 dots (⋮) in your browser &gt; Tap <strong className="text-teal-300">&quot;Install app&quot;</strong> or <strong className="text-teal-300">&quot;Add to Home screen&quot;</strong>.</p>
          <p><strong className="text-white">On iPhone (Safari):</strong> Tap the Share button (<span className="text-sm">⎋</span>) &gt; Tap <strong className="text-teal-300">&quot;Add to Home Screen&quot;</strong>.</p>
          <p><strong className="text-white">On Desktop (Chrome/Edge):</strong> Click the install icon (<Download className="w-3 h-3 inline text-teal-400" />) in the address bar to install as a standalone desktop app.</p>
          <p className="text-[#18E6BE] font-bold">✓ Works 100% offline and auto-syncs with Supabase cloud when internet is available!</p>
        </div>
      </div>

      {/* Supabase Authentication Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};

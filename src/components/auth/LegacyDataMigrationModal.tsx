import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Download, 
  ArrowRight, 
  X, 
  Loader2, 
  CheckCircle2, 
  ShieldAlert,
  Database
} from 'lucide-react';
import { 
  exportLegacyDatabaseBackupJson, 
  migrateLegacyDataToUser 
} from '../../db/db';

interface LegacyDataMigrationModalProps {
  userId: string;
  recordCount: number;
  isOpen: boolean;
  onClose: () => void;
  onMigrated: () => void;
}

export const LegacyDataMigrationModal: React.FC<LegacyDataMigrationModalProps> = ({
  userId,
  recordCount,
  isOpen,
  onClose,
  onMigrated
}) => {
  const [downloading, setDownloading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [hasExportedBackup, setHasExportedBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadBackup = async () => {
    setDownloading(true);
    setError(null);
    try {
      const json = await exportLegacyDatabaseBackupJson();
      if (!json) throw new Error('Could not export legacy database snapshot.');

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tahir_tracker_legacy_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setHasExportedBackup(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to download backup JSON');
    } finally {
      setDownloading(false);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setError(null);
    try {
      const res = await migrateLegacyDataToUser(userId);
      if (res.success) {
        setSuccess(`Successfully migrated ${res.migratedCount} records to your private account.`);
        setTimeout(() => {
          onMigrated();
        }, 1500);
      } else {
        setError(res.error || 'Failed to migrate legacy records.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during migration.');
    } finally {
      setMigrating(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('tahir_tracker_legacy_migrated', 'dismissed');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div 
        className="w-full max-w-md bg-[#0B1D2C] border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#071724] px-6 pt-5 pb-4 border-b border-slate-800 relative">
          <button
            onClick={handleDismiss}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Historical Data Found
              </h2>
              <p className="text-[11px] text-amber-400 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {recordCount} records from legacy single-user version
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            We discovered unassigned local tracker records stored on this browser from before multi-user accounts were enabled.
          </p>

          <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Owner Verification Required</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              If this is Tahir’s personal device, you can import your existing history into this account. 
              If you are a new user, choose <strong>Start Fresh</strong> to keep an empty private workspace.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          {/* Action 1: Download Safety Backup */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={downloading || migrating}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-[#071724] hover:bg-[#102638] border border-slate-700 hover:border-slate-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : hasExportedBackup ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{hasExportedBackup ? 'Safety Backup Downloaded ✓' : 'Download Safety Backup (JSON)'}</span>
            </button>

            {/* Action 2: Import into Account */}
            <button
              type="button"
              onClick={handleMigrate}
              disabled={migrating || !!success}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.25)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {migrating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" />
                  <span>Migrating records safely...</span>
                </>
              ) : (
                <>
                  <span>Import Records into My Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Action 3: Start Fresh / Dismiss */}
            <button
              type="button"
              onClick={handleDismiss}
              disabled={migrating}
              className="w-full py-2 px-3 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors text-center cursor-pointer mt-1"
            >
              Start Fresh (Keep Empty Workspace)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

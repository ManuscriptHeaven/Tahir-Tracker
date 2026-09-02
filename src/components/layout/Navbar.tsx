import React, { useState, useEffect } from 'react';
import { NavTab } from '../../types';
import { 
  Calendar, 
  WifiOff, 
  Mic, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Download
} from 'lucide-react';
import { getMonthYearFormatted } from '../../utils/formatters';
import { subscribeSyncStatus, syncWithSupabase, SyncStatus } from '../../services/syncService';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  selectedMonth: string; // YYYY-MM
  setSelectedMonth: (month: string) => void;
  onOpenAI?: () => void;
  installPrompt?: any;
  onInstallPWA?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  selectedMonth,
  setSelectedMonth,
  onOpenAI,
  installPrompt,
  onInstallPWA
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'unconfigured',
    lastSyncedAt: null,
    message: ''
  });

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((status) => {
      setSyncStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Quick navigation helper for months
  const shiftMonth = (direction: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + direction, 1);
    const newY = date.getFullYear();
    const newM = (date.getMonth() + 1).toString().padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  const handleManualSync = async () => {
    if (syncStatus.state === 'unconfigured') {
      setActiveTab('settings');
    } else {
      await syncWithSupabase();
    }
  };

  const formattedMonth = getMonthYearFormatted(selectedMonth);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm no-print">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & App Name */}
          <div 
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20">
              <span className="text-xl">TT</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-slate-800 text-base sm:text-lg leading-tight tracking-tight">
                  Tahir Tracker
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 hidden sm:inline-block">
                  PWA • Cloud
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-none">Finance & Household</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80">
            {[
              { id: 'dashboard' as NavTab, label: 'Dashboard' },
              { id: 'finance' as NavTab, label: '💰 Finance' },
              { id: 'utility' as NavTab, label: 'Utility' },
              { id: 'loans' as NavTab, label: 'Loans' },
              { id: 'milk' as NavTab, label: 'Milk' },
              { id: 'petrol' as NavTab, label: 'Petrol' },
              { id: 'rent' as NavTab, label: 'Rent' },
              { id: 'reports' as NavTab, label: 'Reports' },
              { id: 'settings' as NavTab, label: 'Settings' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Month Selector Controls */}
          <div className="flex items-center gap-1 sm:gap-2 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Previous Month"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors shadow-sm text-xs font-semibold"
            >
              ◀
            </button>

            <div className="relative flex items-center gap-1 px-2 py-1 text-slate-800 font-semibold text-xs sm:text-sm">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>{formattedMonth}</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Choose Month"
              />
            </div>

            <button
              onClick={() => shiftMonth(1)}
              aria-label="Next Month"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors shadow-sm text-xs font-semibold"
            >
              ▶
            </button>
          </div>

          {/* Status & Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* PWA Install Button if browser supports install prompt */}
            {installPrompt && onInstallPWA && (
              <button
                onClick={onInstallPWA}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs transition-all active:scale-95"
                title="Install Tahir Tracker as App on this device"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
            )}

            {/* Cloud Sync Status Indicator & Trigger */}
            <button
              onClick={handleManualSync}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                syncStatus.state === 'syncing'
                  ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                  : syncStatus.state === 'realtime_active'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-xs'
                  : syncStatus.state === 'synced'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : syncStatus.state === 'error'
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : syncStatus.state === 'offline'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title={syncStatus.message || 'Realtime Supabase Sync Status'}
            >
              {syncStatus.state === 'syncing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span className="hidden md:inline">Syncing...</span>
                </>
              ) : syncStatus.state === 'realtime_active' ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline font-black text-emerald-700">Live Sync</span>
                </>
              ) : syncStatus.state === 'synced' ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline">Cloud Synced</span>
                </>
              ) : syncStatus.state === 'offline' ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden md:inline">Offline</span>
                </>
              ) : syncStatus.state === 'error' ? (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-rose-600" />
                  <span className="hidden md:inline">Sync Error</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden md:inline">Connect Supabase</span>
                </>
              )}
            </button>

            {onOpenAI && (
              <button
                onClick={onOpenAI}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                title="Open AI Voice Assistant"
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">AI Voice</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

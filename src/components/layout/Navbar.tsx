import React, { useState, useEffect } from 'react';
import { NavTab } from '../../types';
import {
  BarChart3,
  Calendar,
  Cloud,
  CloudOff,
  Download,
  Fuel,
  HandCoins,
  Home,
  LayoutDashboard,
  Lock,
  Mic,
  Milk,
  RefreshCw,
  Settings,
  WalletCards,
  WifiOff,
  Zap,
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
  onOpenLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  selectedMonth,
  setSelectedMonth,
  onOpenAI,
  installPrompt,
  onInstallPWA,
  onOpenLogin
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

  const handleManualSync = async () => {
    if (syncStatus.state === 'unconfigured') {
      setActiveTab('settings');
    } else if (syncStatus.state === 'auth_required') {
      if (onOpenLogin) {
        onOpenLogin();
      } else {
        setActiveTab('settings');
      }
    } else {
      await syncWithSupabase();
    }
  };

  const formattedMonth = getMonthYearFormatted(selectedMonth);
  const isRentMode = (import.meta as any).env?.VITE_APP_MODE === 'rent';

  const desktopTabs = isRentMode
    ? [
        { id: 'rent' as NavTab, label: 'Rent', icon: Home },
        { id: 'reports' as NavTab, label: 'Reports', icon: BarChart3 },
        { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
      ]
    : [
        { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'finance' as NavTab, label: 'Finance', icon: WalletCards },
        { id: 'utility' as NavTab, label: 'Utility', icon: Zap },
        { id: 'loans' as NavTab, label: 'Loans', icon: HandCoins },
        { id: 'milk' as NavTab, label: 'Milk', icon: Milk },
        { id: 'petrol' as NavTab, label: 'Petrol', icon: Fuel },
        { id: 'rent' as NavTab, label: 'Rent', icon: Home },
        { id: 'reports' as NavTab, label: 'Reports', icon: BarChart3 },
        { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
      ];

  const syncIndicator = () => {
    if (syncStatus.state === 'syncing') {
      return {
        icon: <RefreshCw className="w-4 h-4 animate-spin" />,
        title: 'Syncing',
        subtitle: 'Updating cloud',
        classes: 'text-blue-700 bg-blue-50 border-blue-100',
      };
    }

    if (syncStatus.state === 'realtime_active') {
      return {
        icon: (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        ),
        title: 'Live Sync',
        subtitle: 'Up to date',
        classes: 'text-emerald-800 bg-emerald-50 border-emerald-100',
      };
    }

    if (syncStatus.state === 'synced') {
      return {
        icon: <Cloud className="w-4 h-4" />,
        title: 'Synced',
        subtitle: 'Cloud ready',
        classes: 'text-emerald-700 bg-emerald-50 border-emerald-100',
      };
    }

    if (syncStatus.state === 'offline') {
      return {
        icon: <WifiOff className="w-4 h-4" />,
        title: 'Offline',
        subtitle: 'Local mode',
        classes: 'text-amber-700 bg-amber-50 border-amber-100',
      };
    }

    if (syncStatus.state === 'auth_required') {
      return {
        icon: <Lock className="w-4 h-4" />,
        title: 'Sign In',
        subtitle: 'Sync paused',
        classes: 'text-amber-800 bg-amber-50 border-amber-100',
      };
    }

    if (syncStatus.state === 'error') {
      return {
        icon: <CloudOff className="w-4 h-4" />,
        title: 'Sync Error',
        subtitle: 'Check status',
        classes: 'text-rose-700 bg-rose-50 border-rose-100',
      };
    }

    return {
      icon: <Cloud className="w-4 h-4" />,
      title: 'Cloud',
      subtitle: 'Connect',
      classes: 'text-slate-600 bg-slate-50 border-slate-200',
    };
  };

  const sync = syncIndicator();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl no-print">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
        <div className="h-[72px] flex items-center gap-3">
          {/* Brand */}
          <button
            type="button"
            onClick={() => setActiveTab(isRentMode ? 'rent' : 'dashboard')}
            className="flex items-center gap-3 shrink-0 rounded-2xl pr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label={isRentMode ? 'Open Rent dashboard' : 'Open Tahir Tracker dashboard'}
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black shadow-sm shadow-emerald-500/20">
              <span className="text-xl">{isRentMode ? '🏠' : 'TT'}</span>
            </div>
            <div className="hidden sm:block text-left">
              <h1 className="font-extrabold text-slate-800 text-[17px] leading-tight tracking-tight">
                {isRentMode ? 'Rent Tracking' : 'Tahir Tracker'}
              </h1>
              <p className="mt-0.5 text-[11px] font-medium text-slate-400 leading-none">
                {isRentMode ? 'Property & Tenant Management' : 'Finance & Household'}
              </p>
            </div>
          </button>

          {/* Desktop navigation — intentionally flat, with no bulky grey container */}
          <nav className="hidden xl:flex flex-1 items-center justify-center gap-0.5 min-w-0" aria-label="Main navigation">
            {desktopTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`group flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-4 h-4 ${
                    isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right-side controls */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {/* Compact month selector */}
            <label className="relative flex items-center gap-2 h-10 px-3 sm:px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-xs hover:border-slate-300 transition-colors cursor-pointer">
              <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="hidden md:inline text-sm font-bold whitespace-nowrap">{formattedMonth}</span>
              <span className="md:hidden text-xs font-bold whitespace-nowrap">{selectedMonth.slice(5, 7)}/{selectedMonth.slice(2, 4)}</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Choose month"
                aria-label="Choose month"
              />
            </label>

            {/* PWA install is retained but de-emphasized */}
            {installPrompt && onInstallPWA && (
              <button
                type="button"
                onClick={onInstallPWA}
                className="hidden lg:flex w-10 h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 transition-all"
                title="Install Tahir Tracker"
                aria-label="Install Tahir Tracker"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Clean sync status */}
            <button
              type="button"
              onClick={handleManualSync}
              className={`h-10 flex items-center gap-2 px-3 rounded-2xl border transition-all hover:brightness-[0.98] ${sync.classes}`}
              title={syncStatus.message || 'Supabase sync status'}
            >
              <span className="shrink-0">{sync.icon}</span>
              <span className="hidden lg:block text-left leading-none">
                <span className="block text-[12px] font-extrabold whitespace-nowrap">{sync.title}</span>
                <span className="block mt-1 text-[10px] font-semibold opacity-70 whitespace-nowrap">{sync.subtitle}</span>
              </span>
            </button>

            {/* AI voice stays available as a compact action instead of competing with navigation */}
            {onOpenAI && (
              <button
                type="button"
                onClick={onOpenAI}
                className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95"
                title="Open AI Voice Assistant"
                aria-label="Open AI Voice Assistant"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

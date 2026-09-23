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
  Menu,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getMonthYearFormatted } from '../../utils/formatters';
import { subscribeSyncStatus, syncWithSupabase, SyncStatus } from '../../services/syncService';
import { MobileDrawer } from './MobileDrawer';
import { useAuth } from '../../context/AuthContext';

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
  const { user, isAuthenticated } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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

  const shiftMonth = (direction: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + direction, 1);
    const newY = date.getFullYear();
    const newM = (date.getMonth() + 1).toString().padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

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
        { id: 'loans' as NavTab, label: 'Lease', icon: HandCoins },
        { id: 'milk' as NavTab, label: 'Milk', icon: Milk },
        { id: 'petrol' as NavTab, label: 'Petrol', icon: Fuel },
        { id: 'rent' as NavTab, label: 'Rent', icon: Home },
        { id: 'reports' as NavTab, label: 'Reports', icon: BarChart3 },
        { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
      ];

  const syncIndicator = () => {
    if (syncStatus.state === 'syncing') {
      return {
        icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
        title: 'Syncing',
        classes: 'text-[#39AFFF] bg-[#102638] border-[rgba(57,175,255,0.3)]',
      };
    }

    if (syncStatus.state === 'realtime_active') {
      return {
        icon: (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#18E6BE] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#18E6BE]" />
          </span>
        ),
        title: 'Live',
        classes: 'text-[#18E6BE] bg-[rgba(24,230,190,0.1)] border-[rgba(24,230,190,0.3)]',
      };
    }

    if (syncStatus.state === 'synced') {
      return {
        icon: <Cloud className="w-3.5 h-3.5" />,
        title: 'Synced',
        classes: 'text-[#14E6AA] bg-[rgba(20,230,170,0.08)] border-[rgba(20,230,170,0.25)]',
      };
    }

    if (syncStatus.state === 'offline') {
      return {
        icon: <WifiOff className="w-3.5 h-3.5" />,
        title: 'Offline',
        classes: 'text-[#F7B733] bg-[rgba(247,183,51,0.08)] border-[rgba(247,183,51,0.25)]',
      };
    }

    if (syncStatus.state === 'auth_required') {
      return {
        icon: <Lock className="w-3.5 h-3.5" />,
        title: 'Sign In',
        classes: 'text-[#F7B733] bg-[rgba(247,183,51,0.08)] border-[rgba(247,183,51,0.25)]',
      };
    }

    if (syncStatus.state === 'error') {
      return {
        icon: <CloudOff className="w-3.5 h-3.5" />,
        title: 'Error',
        classes: 'text-[#FF627B] bg-[rgba(255,98,123,0.08)] border-[rgba(255,98,123,0.25)]',
      };
    }

    return {
      icon: <Cloud className="w-3.5 h-3.5" />,
      title: 'Cloud',
      classes: 'text-[#A9BDCC] bg-[#0B1D2C] border-[rgba(70,150,180,0.2)]',
    };
  };

  const sync = syncIndicator();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[rgba(70,150,180,0.18)] bg-[#071724]/90 backdrop-blur-xl no-print">
        <div className="max-w-[1680px] mx-auto px-3 sm:px-6">
          <div className="h-[68px] flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Mobile Menu Trigger + Brand */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="xl:hidden p-2 rounded-xl bg-[#0B1D2C] hover:bg-[#102638] text-[#A9BDCC] hover:text-[#F4F8FB] border border-[rgba(70,150,180,0.2)] transition-colors"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(isRentMode ? 'rent' : 'dashboard')}
                className="flex items-center gap-2.5 sm:gap-3 rounded-2xl pr-1 text-left focus:outline-none"
                aria-label="Tahir Tracker home"
              >
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#059669] to-[#18E6BE] flex items-center justify-center text-[#06131F] font-black text-lg shadow-[0_0_15px_rgba(24,230,190,0.3)]">
                  {isRentMode ? '🏠' : 'TT'}
                </div>
                <div>
                  <h1 className="font-extrabold text-[#F4F8FB] text-base sm:text-[17px] leading-tight tracking-tight flex items-center gap-1.5">
                    <span>{isRentMode ? 'Rent Tracking' : 'Tahir Tracker'}</span>
                  </h1>
                  <p className="hidden md:block text-[10px] sm:text-[11px] font-medium text-[#6F899B] leading-none mt-0.5">
                    {isRentMode ? 'Property & Tenant Management' : 'Track Everything — Finance & Household'}
                  </p>
                </div>
              </button>
            </div>

            {/* Desktop Navigation Links (Centered) */}
            <nav className="hidden xl:flex flex-1 items-center justify-center gap-1 min-w-0 px-2" aria-label="Main navigation">
              {desktopTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`group flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                      isActive
                        ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE] border border-[rgba(24,230,190,0.32)] shadow-[0_0_12px_rgba(24,230,190,0.18)]'
                        : 'text-[#A9BDCC] hover:text-[#F4F8FB] hover:bg-[#0B1D2C]'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className={`w-3.5 h-3.5 ${
                      isActive ? 'text-[#18E6BE]' : 'text-[#6F899B] group-hover:text-[#A9BDCC]'
                    }`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right-side Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Synchronized Month Selector */}
              <div className="flex items-center bg-[#0B1D2C] p-0.5 rounded-xl border border-[rgba(70,150,180,0.2)] text-xs">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="p-1.5 rounded-lg text-[#A9BDCC] hover:text-[#18E6BE] hover:bg-[#102638] transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <label className="relative flex items-center gap-1.5 px-2 py-1 cursor-pointer font-bold text-[#F4F8FB] text-xs">
                  <Calendar className="w-3.5 h-3.5 text-[#18E6BE]" />
                  <span className="hidden sm:inline">{formattedMonth}</span>
                  <span className="sm:hidden">{selectedMonth.slice(5, 7)}/{selectedMonth.slice(2, 4)}</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Choose month"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="p-1.5 rounded-lg text-[#A9BDCC] hover:text-[#18E6BE] hover:bg-[#102638] transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Supabase Live Sync Status Pill */}
              <button
                type="button"
                onClick={handleManualSync}
                className={`h-9 flex items-center gap-1.5 px-2.5 rounded-xl border transition-all hover:brightness-110 ${sync.classes}`}
                title={syncStatus.message || 'Supabase sync status'}
              >
                <span>{sync.icon}</span>
                <span className="hidden lg:inline text-xs font-bold whitespace-nowrap">{sync.title}</span>
              </button>

              {/* PWA Install Button */}
              {installPrompt && onInstallPWA && (
                <button
                  type="button"
                  onClick={onInstallPWA}
                  className="hidden md:flex w-9 h-9 items-center justify-center rounded-xl border border-[rgba(70,150,180,0.2)] bg-[#0B1D2C] text-[#A9BDCC] hover:text-[#18E6BE] hover:bg-[#102638] transition-all"
                  title="Install Tahir Tracker app"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}

              {/* AI Voice Assistant trigger */}
              {onOpenAI && !isRentMode && (
                <button
                  type="button"
                  onClick={onOpenAI}
                  className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#059669] to-[#18E6BE] text-[#06131F] flex items-center justify-center shadow-[0_0_15px_rgba(24,230,190,0.3)] hover:brightness-110 active:scale-95 transition-all"
                  title="Open AI Voice Assistant"
                  aria-label="Open AI Voice Assistant"
                >
                  <Mic className="w-4 h-4 stroke-[2.5]" />
                </button>
              )}

              {/* User Avatar */}
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-2 pl-1 group relative"
                title={isAuthenticated ? `Cloud Sync: ${user?.email}` : 'Local Device Profile'}
              >
                <div className={`w-8 h-8 rounded-full bg-[#18E6BE] text-[#06131F] font-black text-xs flex items-center justify-center shadow-[0_0_10px_rgba(24,230,190,0.3)] group-hover:scale-105 transition-transform ${isAuthenticated ? 'ring-2 ring-cyan-400' : ''}`}>
                  {user?.email ? user.email.charAt(0).toUpperCase() : 'T'}
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out Mobile Navigation Drawer */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        syncStatus={syncStatus}
        onManualSync={handleManualSync}
        onOpenAI={onOpenAI}
        installPrompt={installPrompt}
        onInstallPWA={onInstallPWA}
        onOpenLogin={onOpenLogin}
      />
    </>
  );
};

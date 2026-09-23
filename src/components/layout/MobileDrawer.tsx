import React from 'react';
import { NavTab } from '../../types';
import {
  X,
  LayoutDashboard,
  WalletCards,
  Zap,
  HandCoins,
  Milk,
  Fuel,
  Home,
  BarChart3,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Mic,
  Download,
  Cloud,
  Shield,
  RefreshCw,
  LogIn
} from 'lucide-react';
import { getMonthYearFormatted } from '../../utils/formatters';
import { SyncStatus } from '../../services/syncService';
import { useAuth } from '../../context/AuthContext';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  syncStatus: SyncStatus;
  onManualSync: () => void;
  onOpenAI?: () => void;
  installPrompt?: any;
  onInstallPWA?: () => void;
  onOpenLogin?: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  selectedMonth,
  setSelectedMonth,
  syncStatus,
  onManualSync,
  onOpenAI,
  installPrompt,
  onInstallPWA,
  onOpenLogin,
}) => {
  const { user, isAuthenticated } = useAuth();
  const isRentMode = (import.meta as any).env?.VITE_APP_MODE === 'rent';

  if (!isOpen) return null;

  const formattedMonth = getMonthYearFormatted(selectedMonth);

  const shiftMonth = (direction: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + direction, 1);
    const newY = date.getFullYear();
    const newM = (date.getMonth() + 1).toString().padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  const navItems = isRentMode
    ? [
        { id: 'rent' as NavTab, label: 'Rent Management', icon: Home, desc: 'Portions & Tenants' },
        { id: 'reports' as NavTab, label: 'Reports & Receipts', icon: BarChart3, desc: 'Monthly Statements' },
        { id: 'settings' as NavTab, label: 'Settings', icon: Settings, desc: 'Preferences & Cloud Sync' },
      ]
    : [
        { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard, desc: 'Household Overview' },
        { id: 'finance' as NavTab, label: 'Personal Finance', icon: WalletCards, desc: 'Income, Expenses & Budget' },
        { id: 'utility' as NavTab, label: 'Utility Tracking', icon: Zap, desc: 'Electricity, Gas & Water' },
        { id: 'loans' as NavTab, label: 'Lease & Loans', icon: HandCoins, desc: 'Udhaar & Person Ledgers' },
        { id: 'milk' as NavTab, label: 'Milk Tracking', icon: Milk, desc: 'Daily Subscriptions & Usage' },
        { id: 'petrol' as NavTab, label: 'Petrol Tracking', icon: Fuel, desc: 'Fuel Logs & Mileage' },
        { id: 'rent' as NavTab, label: 'Rent Management', icon: Home, desc: 'Portion Rental Records' },
        { id: 'reports' as NavTab, label: 'Reports & Analytics', icon: BarChart3, desc: 'Charts & Export Statement' },
        { id: 'settings' as NavTab, label: 'Settings & Profile', icon: Settings, desc: 'Backups, Theme & Sync' },
      ];

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-out Panel */}
      <div className="relative w-full max-w-xs sm:max-w-sm bg-[#071724] border-r border-[rgba(70,150,180,0.2)] shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-left duration-300">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[rgba(70,150,180,0.14)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#059669] to-[#18E6BE] flex items-center justify-center text-[#06131F] font-black text-lg shadow-[0_0_15px_rgba(24,230,190,0.3)]">
              {isRentMode ? '🏠' : 'TT'}
            </div>
            <div>
              <h2 className="font-extrabold text-base text-[#F4F8FB] tracking-tight">
                {isRentMode ? 'Rent Tracking' : 'Tahir Tracker'}
              </h2>
              <p className="text-[10px] text-[#6F899B] font-medium">
                Track Everything — Finance & Household
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#0B1D2C] hover:bg-[#102638] text-[#A9BDCC] hover:text-[#F4F8FB] transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile & Sync Info Pill */}
        <div className="p-4 border-b border-[rgba(70,150,180,0.12)] bg-[#0B1D2C]/60">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                onClose();
                onOpenLogin?.();
              }}
              className="flex items-center gap-2.5 text-left hover:opacity-85 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full bg-[#18E6BE] text-[#06131F] font-black flex items-center justify-center text-xs shadow-[0_0_10px_rgba(24,230,190,0.3)]">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'T'}
              </div>
              <div className="truncate max-w-[150px]">
                <div className="text-xs font-bold text-[#F4F8FB] truncate">
                  {user?.email ? user.email.split('@')[0] : 'Tahir Household'}
                </div>
                <div className="text-[10px] text-[#6F899B] flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5 text-[#18E6BE]" />
                  <span>{isAuthenticated ? 'Cloud Authenticated' : 'Local Device'}</span>
                </div>
              </div>
            </button>

            <button
              onClick={onManualSync}
              className="px-2 py-1 rounded-lg bg-[#102638] border border-[rgba(70,150,180,0.2)] text-[10px] font-semibold text-[#18E6BE] flex items-center gap-1 hover:bg-[#122B3E] transition-all"
            >
              {syncStatus.state === 'syncing' ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Cloud className="w-3 h-3" />
              )}
              <span>{syncStatus.state === 'synced' ? 'Synced' : 'Sync'}</span>
            </button>
          </div>

          {!isAuthenticated && (
            <button
              onClick={() => {
                onClose();
                onOpenLogin?.();
              }}
              className="mt-2.5 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 border border-teal-500/40 text-[#18E6BE] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Forgot Password</span>
            </button>
          )}

          {/* Month Selector in Drawer */}
          <div className="mt-3 flex items-center justify-between bg-[#071724] p-1.5 rounded-xl border border-[rgba(70,150,180,0.18)]">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-1 rounded-lg text-[#A9BDCC] hover:text-[#18E6BE] hover:bg-[#0B1D2C]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <label className="relative flex items-center gap-1.5 cursor-pointer text-xs font-bold text-[#F4F8FB]">
              <Calendar className="w-3.5 h-3.5 text-[#18E6BE]" />
              <span>{formattedMonth}</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>
            <button
              onClick={() => shiftMonth(1)}
              className="p-1 rounded-lg text-[#A9BDCC] hover:text-[#18E6BE] hover:bg-[#0B1D2C]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE] border border-[rgba(24,230,190,0.3)] shadow-[0_0_15px_rgba(24,230,190,0.15)] font-bold'
                    : 'text-[#A9BDCC] hover:bg-[#0B1D2C] hover:text-[#F4F8FB] font-medium'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-[rgba(24,230,190,0.15)] text-[#18E6BE]' : 'bg-[#0B1D2C] text-[#6F899B]'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 truncate">
                  <div className="text-xs sm:text-sm font-semibold tracking-tight">{item.label}</div>
                  <div className="text-[10px] text-[#6F899B] font-normal">{item.desc}</div>
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#18E6BE] shadow-[0_0_6px_#18E6BE]" />}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[rgba(70,150,180,0.14)] bg-[#0B1D2C]/40 space-y-2">
          {onOpenAI && !isRentMode && (
            <button
              onClick={() => {
                onClose();
                onOpenAI();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-[#06131F] font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(24,230,190,0.25)] transition-all"
            >
              <Mic className="w-4 h-4" />
              <span>AI Voice Assistant</span>
            </button>
          )}

          {installPrompt && onInstallPWA && (
            <button
              onClick={onInstallPWA}
              className="w-full py-2 px-3 rounded-xl bg-[#102638] hover:bg-[#122B3E] text-[#A9BDCC] hover:text-[#F4F8FB] border border-[rgba(70,150,180,0.2)] font-semibold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4 text-[#18E6BE]" />
              <span>Install Tahir Tracker</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

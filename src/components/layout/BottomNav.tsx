import React from 'react';
import { NavTab } from '../../types';
import { 
  LayoutDashboard, 
  Layers, 
  Plus, 
  FileText,
  Home,
  Settings,
  WalletCards
} from 'lucide-react';

interface BottomNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ 
  activeTab, 
  setActiveTab, 
  onOpenQuickAdd 
}) => {
  const isRentMode = (import.meta as any).env?.VITE_APP_MODE === 'rent';

  if (isRentMode) {
    return (
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#071724]/95 backdrop-blur-md border-t border-[rgba(70,150,180,0.18)] shadow-2xl px-2 no-print md:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
      >
        <div className="max-w-md mx-auto grid grid-cols-3 items-center py-1">
          <button
            onClick={() => setActiveTab('rent')}
            className={`w-full flex flex-col items-center justify-center py-1 transition-all ${
              activeTab === 'rent'
                ? 'text-[#18E6BE] font-bold'
                : 'text-[#6F899B] hover:text-[#A9BDCC] font-medium'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${activeTab === 'rent' ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE]' : ''}`}>
              <Home className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 leading-none tracking-tight truncate w-full text-center block px-1">
              Portions
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full flex flex-col items-center justify-center py-1 transition-all ${
              activeTab === 'reports'
                ? 'text-[#18E6BE] font-bold'
                : 'text-[#6F899B] hover:text-[#A9BDCC] font-medium'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${activeTab === 'reports' ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE]' : ''}`}>
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 leading-none tracking-tight truncate w-full text-center block px-1">
              Reports
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex flex-col items-center justify-center py-1 transition-all ${
              activeTab === 'settings'
                ? 'text-[#18E6BE] font-bold'
                : 'text-[#6F899B] hover:text-[#A9BDCC] font-medium'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${activeTab === 'settings' ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE]' : ''}`}>
              <Settings className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 leading-none tracking-tight truncate w-full text-center block px-1">
              Settings
            </span>
          </button>
        </div>
      </nav>
    );
  }

  const isTrackerActive = ['utility', 'loans', 'milk', 'petrol', 'rent'].includes(activeTab);

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#071724]/95 backdrop-blur-md border-t border-[rgba(70,150,180,0.18)] shadow-2xl px-1 sm:px-3 no-print xl:hidden"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center py-1 relative">
        {/* 1. Home / Dashboard */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`w-full flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'dashboard' 
              ? 'text-[#18E6BE] font-bold' 
              : 'text-[#6F899B] hover:text-[#A9BDCC] font-medium'
          }`}
        >
          <div className={`p-1 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE]' : ''}`}>
            <LayoutDashboard className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none tracking-tight truncate w-full text-center block px-0.5">
            Home
          </span>
        </button>

        {/* 2. Personal Finance */}
        <button
          onClick={() => setActiveTab('finance')}
          className={`w-full flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'finance' 
              ? 'text-[#18E6BE] font-bold' 
              : 'text-[#6F899B] hover:text-[#A9BDCC] font-medium'
          }`}
        >
          <div className={`p-1 rounded-xl transition-colors ${activeTab === 'finance' ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE]' : ''}`}>
            <WalletCards className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none tracking-tight truncate w-full text-center block px-0.5">
            Finance
          </span>
        </button>

        {/* 3. Center Elevated Quick Add Button */}
        <div className="w-full flex items-center justify-center -mt-3.5">
          <button
            onClick={onOpenQuickAdd}
            aria-label="Quick Add Transaction"
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#059669] to-[#18E6BE] hover:from-[#10b981] hover:to-[#23F2CB] active:scale-95 text-[#06131F] flex items-center justify-center shadow-[0_0_15px_rgba(24,230,190,0.35)] border-2 border-[#071724] transition-all transform duration-150"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* 4. Household Trackers Hub */}
        <button
          onClick={() => {
            if (!isTrackerActive) {
              setActiveTab('utility');
            }
          }}
          className={`w-full flex flex-col items-center justify-center py-1 transition-all ${
            isTrackerActive 
              ? 'text-[#18E6BE] font-bold' 
              : 'text-[#6F899B] hover:text-[#A9BDCC] font-medium'
          }`}
        >
          <div className={`p-1 rounded-xl transition-colors ${isTrackerActive ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE]' : ''}`}>
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none tracking-tight truncate w-full text-center block px-0.5">
            Trackers
          </span>
        </button>

        {/* 5. Reports */}
        <button
          onClick={() => setActiveTab('reports')}
          className={`w-full flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'reports' 
              ? 'text-[#18E6BE] font-bold' 
              : 'text-[#6F899B] hover:text-[#A9BDCC] font-medium'
          }`}
        >
          <div className={`p-1 rounded-xl transition-colors ${activeTab === 'reports' ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE]' : ''}`}>
            <FileText className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none tracking-tight truncate w-full text-center block px-0.5">
            Reports
          </span>
        </button>
      </div>
    </nav>
  );
};

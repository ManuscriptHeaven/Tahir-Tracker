import React from 'react';
import { NavTab } from '../../types';
import { 
  LayoutDashboard, 
  Layers, 
  Plus, 
  FileText,
  Home,
  Settings
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
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-xl px-4 pb-safe no-print">
        <div className="max-w-md mx-auto flex items-center justify-around py-1.5">
          <button
            onClick={() => setActiveTab('rent')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all duration-150 ${
              activeTab === 'rent'
                ? 'text-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'rent' ? 'bg-emerald-50 text-emerald-600' : ''}`}>
              <Home className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px] mt-0.5 leading-none tracking-tight">
              Portions
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all duration-150 ${
              activeTab === 'reports'
                ? 'text-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'reports' ? 'bg-emerald-50 text-emerald-600' : ''}`}>
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px] mt-0.5 leading-none tracking-tight">
              Reports & Receipts
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all duration-150 ${
              activeTab === 'settings'
                ? 'text-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'settings' ? 'bg-emerald-50 text-emerald-600' : ''}`}>
              <Settings className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px] mt-0.5 leading-none tracking-tight">
              Sync & Settings
            </span>
          </button>
        </div>
      </nav>
    );
  }

  // Check if current active tab is one of the expenses / tracker tabs
  const isTrackerActive = ['utility', 'loans', 'milk', 'petrol', 'rent'].includes(activeTab);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-xl px-3 pb-safe no-print">
      <div className="max-w-md mx-auto flex items-center justify-between py-1 relative">
        
        {/* 1. Home / Dashboard */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-all duration-150 ${
            activeTab === 'dashboard' 
              ? 'text-emerald-600 font-bold' 
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-600' : ''}`}>
            <LayoutDashboard className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none tracking-tight">
            Home
          </span>
        </button>

        {/* 2. Personal Finance */}
        <button
          onClick={() => setActiveTab('finance')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-all duration-150 ${
            activeTab === 'finance' 
              ? 'text-emerald-600 font-bold' 
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'finance' ? 'bg-emerald-50 text-emerald-600' : ''}`}>
            <span className="text-base leading-none">💰</span>
          </div>
          <span className="text-[10px] mt-0.5 leading-none tracking-tight">
            Finance
          </span>
        </button>

        {/* 3. Center Elevated Quick Add Button */}
        <div className="flex-1 flex items-center justify-center -mt-5">
          <button
            onClick={onOpenQuickAdd}
            aria-label="Quick Add Transaction"
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 border-2 border-white transition-all transform duration-150"
          >
            <Plus className="w-6 h-6 stroke-[2.8]" />
          </button>
        </div>

        {/* 4. Household Trackers Hub */}
        <button
          onClick={() => {
            if (!isTrackerActive) {
              setActiveTab('utility');
            }
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-all duration-150 ${
            isTrackerActive 
              ? 'text-emerald-600 font-bold' 
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${isTrackerActive ? 'bg-emerald-50 text-emerald-600' : ''}`}>
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none tracking-tight">
            Trackers
          </span>
        </button>

        {/* 5. Reports */}
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-all duration-150 ${
            activeTab === 'reports' 
              ? 'text-emerald-600 font-bold' 
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'reports' ? 'bg-emerald-50 text-emerald-600' : ''}`}>
            <FileText className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none tracking-tight">
            Reports
          </span>
        </button>

      </div>
    </nav>
  );
};

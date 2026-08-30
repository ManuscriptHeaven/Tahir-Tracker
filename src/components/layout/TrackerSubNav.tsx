import React from 'react';
import { NavTab } from '../../types';
import { Zap, Milk, Fuel, Home, HandCoins } from 'lucide-react';

interface TrackerSubNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
}

export const TrackerSubNav: React.FC<TrackerSubNavProps> = ({ activeTab, setActiveTab }) => {
  const trackers = [
    { id: 'utility' as NavTab, label: 'Utility', icon: Zap },
    { id: 'rent' as NavTab, label: 'Rent', icon: Home },
    { id: 'milk' as NavTab, label: 'Milk', icon: Milk },
    { id: 'petrol' as NavTab, label: 'Petrol', icon: Fuel },
    { id: 'loans' as NavTab, label: 'Loans', icon: HandCoins },
  ];

  if (!['utility', 'loans', 'milk', 'petrol', 'rent'].includes(activeTab)) {
    return null;
  }

  return (
    <div className="mb-5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1 overflow-x-auto no-scrollbar">
      {trackers.map((t) => {
        const Icon = t.icon;
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-[72px] py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              isActive
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400 fill-emerald-400' : ''}`} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};

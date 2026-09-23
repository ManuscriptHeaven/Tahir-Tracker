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
    { id: 'loans' as NavTab, label: 'Lease & Loans', icon: HandCoins },
  ];

  if (!['utility', 'loans', 'milk', 'petrol', 'rent'].includes(activeTab)) {
    return null;
  }

  return (
    <div className="mb-6 bg-[#0B1D2C] p-1.5 rounded-2xl border border-[rgba(70,150,180,0.18)] shadow-sm flex items-center gap-1 overflow-x-auto no-scrollbar">
      {trackers.map((t) => {
        const Icon = t.icon;
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              isActive
                ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE] border border-[rgba(24,230,190,0.3)] shadow-[0_0_12px_rgba(24,230,190,0.2)]'
                : 'text-[#A9BDCC] hover:bg-[#102638] hover:text-[#F4F8FB]'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#18E6BE]' : 'text-[#6F899B]'}`} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};

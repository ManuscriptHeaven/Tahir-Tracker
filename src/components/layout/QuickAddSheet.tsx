import React from 'react';
import { NavTab } from '../../types';
import { 
  X, 
  Milk, 
  Fuel, 
  Zap, 
  Home, 
  HandCoins, 
  User, 
  Plus,
  Sparkles
} from 'lucide-react';

interface QuickAddSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: NavTab | 'mark_today_milk' | 'manage_persons' | 'ai_assistant') => void;
}

export const QuickAddSheet: React.FC<QuickAddSheetProps> = ({
  isOpen,
  onClose,
  onSelectAction
}) => {
  if (!isOpen) return null;

  const quickActions = [
    {
      id: 'finance' as NavTab,
      label: 'Personal Finance',
      subtitle: 'Expense, Income & Transfer',
      icon: Sparkles,
      color: 'bg-[#102638] text-[#18E6BE] border-[rgba(24,230,190,0.3)] col-span-2 shadow-[0_0_15px_rgba(24,230,190,0.1)]',
      badge: '💰 Voice & Fast'
    },
    {
      id: 'ai_assistant' as const,
      label: 'AI Assistant',
      subtitle: 'Speak or type any command',
      icon: Sparkles,
      color: 'bg-[#102638] text-[#9B7BFF] border-[rgba(155,123,255,0.3)] col-span-2',
      badge: 'Smart Auto'
    },
    {
      id: 'utility' as NavTab,
      label: 'Utility Bill',
      subtitle: 'Electricity, Gas, Water',
      icon: Zap,
      color: 'bg-[#0B1D2C] text-[#F7B733] border-[rgba(247,183,51,0.25)]',
      badge: 'Bills'
    },
    {
      id: 'milk' as NavTab,
      label: 'Milk Delivery',
      subtitle: 'Daily log & quota',
      icon: Milk,
      color: 'bg-[#0B1D2C] text-[#18E6BE] border-[rgba(24,230,190,0.25)]',
      badge: 'Daily'
    },
    {
      id: 'petrol' as NavTab,
      label: 'Petrol Refill',
      subtitle: 'Fuel, Odometer & KM/L',
      icon: Fuel,
      color: 'bg-[#0B1D2C] text-[#FF627B] border-[rgba(255,98,123,0.25)]',
      badge: 'Mileage'
    },
    {
      id: 'rent' as NavTab,
      label: 'Rent Payment',
      subtitle: 'Portion rent & arrears',
      icon: Home,
      color: 'bg-[#0B1D2C] text-[#14E6AA] border-[rgba(20,230,170,0.25)]',
      badge: 'Due 10th'
    },
    {
      id: 'loans' as NavTab,
      label: 'Lease & Loans',
      subtitle: 'Given / Taken Ledger',
      icon: HandCoins,
      color: 'bg-[#0B1D2C] text-[#39AFFF] border-[rgba(57,175,255,0.25)]',
      badge: 'Ledgers'
    },
    {
      id: 'manage_persons' as const,
      label: 'Manage Persons',
      subtitle: 'Saleem, Tayyab & Quota',
      icon: User,
      color: 'bg-[#0B1D2C] text-[#A9BDCC] border-[rgba(70,150,180,0.2)]',
      badge: 'Profiles'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Sheet Content */}
      <div className="relative z-10 w-full max-w-lg bg-[#071724] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200 border border-[rgba(70,150,180,0.2)]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[rgba(70,150,180,0.14)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[rgba(24,230,190,0.12)] text-[#18E6BE] border border-[rgba(24,230,190,0.3)] flex items-center justify-center font-bold">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#F4F8FB]">
                Quick Add / Entry
              </h2>
              <p className="text-[11px] text-[#6F899B]">
                Select category to record entry or manage records
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#A9BDCC] hover:bg-[#0B1D2C] hover:text-[#F4F8FB] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {quickActions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                onClick={() => {
                  onSelectAction(act.id);
                  onClose();
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all hover:scale-[1.02] active:scale-[0.98] ${act.color}`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-2 rounded-xl bg-[#071724] border border-[rgba(70,150,180,0.18)]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-[#071724] text-[#A9BDCC] border border-[rgba(70,150,180,0.15)]">
                    {act.badge}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="font-bold text-[#F4F8FB] text-xs sm:text-sm">
                    {act.label}
                  </div>
                  <div className="text-[10px] text-[#6F899B] mt-0.5 line-clamp-1">
                    {act.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-center pt-1">
          <p className="text-[11px] text-[#6F899B]">
            One-tap quick access for one-handed mobile convenience
          </p>
        </div>
      </div>
    </div>
  );
};

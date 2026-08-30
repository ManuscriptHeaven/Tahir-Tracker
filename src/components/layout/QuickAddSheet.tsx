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
      id: 'ai_assistant' as const,
      label: 'AI Voice Assistant',
      subtitle: 'Speak or type any entry',
      icon: Sparkles,
      color: 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border-emerald-300 col-span-2 shadow-sm',
      badge: 'Smart Auto'
    },
    {
      id: 'utility' as NavTab,
      label: 'Utility Bill',
      subtitle: 'Electricity, Gas, Water',
      icon: Zap,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
      badge: 'Formula Share'
    },
    {
      id: 'milk' as NavTab,
      label: 'Milk Delivery',
      subtitle: 'Daily log & quota',
      icon: Milk,
      color: 'bg-teal-50 text-teal-700 border-teal-200',
      badge: 'Quick Grid'
    },
    {
      id: 'petrol' as NavTab,
      label: 'Petrol Refill',
      subtitle: 'Fuel, Odometer & KM/L',
      icon: Fuel,
      color: 'bg-orange-50 text-orange-600 border-orange-200',
      badge: 'Mileage'
    },
    {
      id: 'rent' as NavTab,
      label: 'Rent Payment',
      subtitle: 'Portion rent & arrears',
      icon: Home,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badge: 'Due 10th'
    },
    {
      id: 'loans' as NavTab,
      label: 'Loan / Udhaar',
      subtitle: 'Given / Taken Ledger',
      icon: HandCoins,
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      badge: 'Settlement'
    },
    {
      id: 'manage_persons' as const,
      label: 'Manage Persons',
      subtitle: 'Saleem, Tayyab & Contribution',
      icon: User,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      badge: 'Profiles'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Sheet Content */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800">
                Quick Add / Entry
              </h2>
              <p className="text-[11px] text-slate-500">
                Select category to record entry or manage records
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Grid (High frequency tiles) */}
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
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xs ${act.color}`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-2 rounded-xl bg-white/80 backdrop-blur shadow-xs">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-white/90 text-slate-700 shadow-2xs">
                    {act.badge}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="font-black text-slate-900 text-xs sm:text-sm">
                    {act.label}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5 line-clamp-1">
                    {act.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-center pt-1">
          <p className="text-[11px] text-slate-400">
            One-tap quick access for one-handed mobile convenience
          </p>
        </div>
      </div>
    </div>
  );
};

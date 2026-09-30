import React, { useState } from 'react';
import { 
  Sparkles, 
  Wallet, 
  Lightbulb, 
  Milk, 
  Fuel, 
  Home, 
  HandCoins, 
  ArrowRight, 
  Check, 
  Loader2, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { initializeUserWorkspace } from '../../db/db';

interface OnboardingWizardProps {
  userId: string;
  userEmail?: string;
  onComplete: () => void;
}

const CURRENCIES = [
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
];

const MODULE_OPTIONS = [
  {
    id: 'finance',
    name: 'Personal Finance',
    description: 'Accounts, incomes, expenses, categories, and monthly budget targets',
    icon: Wallet,
    color: 'emerald'
  },
  {
    id: 'utility',
    name: 'Utility Bills',
    description: 'Shared household electricity, gas, and internet bill tracking',
    icon: Lightbulb,
    color: 'amber'
  },
  {
    id: 'milk',
    name: 'Milk & Dairy',
    description: 'Daily morning/evening milk intake logs and monthly vendor bills',
    icon: Milk,
    color: 'cyan'
  },
  {
    id: 'petrol',
    name: 'Fuel & Mileage',
    description: 'Vehicle petrol refills, odometer tracking, and monthly fuel cost',
    icon: Fuel,
    color: 'rose'
  },
  {
    id: 'rent',
    name: 'Rent & Tenants',
    description: 'Property units, tenant portions, monthly collection, and arrears',
    icon: Home,
    color: 'indigo'
  },
  {
    id: 'loans',
    name: 'Loans & Debts',
    description: 'Track money you borrowed from others or lent to friends and family',
    icon: HandCoins,
    color: 'teal'
  }
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  userId,
  userEmail,
  onComplete
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCurrency, setSelectedCurrency] = useState('PKR');
  const [selectedModules, setSelectedModules] = useState<string[]>([
    'finance', 'utility', 'milk', 'petrol', 'rent', 'loans'
  ]);
  const [isInitializing, setIsInitializing] = useState(false);

  const toggleModule = (id: string) => {
    setSelectedModules((prev) => {
      if (prev.includes(id)) {
        // Keep at least one module enabled
        if (prev.length <= 1) return prev;
        return prev.filter((m) => m !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleFinish = async () => {
    setIsInitializing(true);
    try {
      await initializeUserWorkspace(userId, {
        currency: selectedCurrency,
        enabledModules: selectedModules
      });
      onComplete();
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      // Fallback
      onComplete();
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-lg bg-[#0B1D2C] border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        
        {/* Progress Bar & Header */}
        <div className="bg-[#071724] px-6 pt-6 pb-5 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#059669] to-[#18E6BE] flex items-center justify-center text-[#06131F] font-black text-sm shadow-[0_0_15px_rgba(24,230,190,0.3)]">
                TT
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">Workspace Setup</h1>
                <p className="text-[11px] text-slate-400">
                  {userEmail ? `Personalizing for ${userEmail}` : 'Setting up your private dashboard'}
                </p>
              </div>
            </div>

            {/* Step Counter */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
              <span className="text-[#18E6BE]">Step {step}</span>
              <span>/</span>
              <span>3</span>
            </div>
          </div>

          {/* Stepper Indicators */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-[#18E6BE]' : 'bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-[#18E6BE]' : 'bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 3 ? 'bg-[#18E6BE]' : 'bg-slate-800'}`} />
          </div>
        </div>

        {/* Wizard Steps */}
        <div className="p-6">
          {/* STEP 1: Select Currency */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-3 duration-200">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Select Primary Currency</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Choose the currency used for accounts, transactions, and monthly reports.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2">
                {CURRENCIES.map((curr) => {
                  const isSelected = selectedCurrency === curr.code;
                  return (
                    <button
                      key={curr.code}
                      type="button"
                      onClick={() => setSelectedCurrency(curr.code)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#18E6BE]/10 border-[#18E6BE] shadow-[0_0_12px_rgba(24,230,190,0.15)] ring-1 ring-[#18E6BE]'
                          : 'bg-[#071724] border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isSelected ? 'bg-[#18E6BE] text-[#06131F]' : 'bg-slate-800 text-white'
                      }`}>
                        {curr.symbol}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white flex items-center gap-1.5">
                          {curr.code}
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#18E6BE]" />}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{curr.name}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={isInitializing}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Skip with Defaults (PKR)
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-2.5 px-5 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Choose Modules */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Customize Your Modules</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enable the tracking tools relevant to you. You can change this anytime in Settings.
                </p>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {MODULE_OPTIONS.map((mod) => {
                  const isChecked = selectedModules.includes(mod.id);
                  const Icon = mod.icon;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => toggleModule(mod.id)}
                      className={`w-full flex items-start gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-[#18E6BE]/10 border-[#18E6BE]/60 text-white'
                          : 'bg-[#071724] border-slate-800/80 hover:border-slate-700 text-slate-400 opacity-60'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isChecked ? 'bg-[#18E6BE]/20 text-[#18E6BE]' : 'bg-slate-800 text-slate-500'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-white flex items-center justify-between">
                          <span>{mod.name}</span>
                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                            isChecked ? 'bg-[#18E6BE] border-[#18E6BE] text-[#06131F]' : 'border-slate-600'
                          }`}>
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          {mod.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="py-2.5 px-5 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Confirmation & Launch */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-3 duration-200">
              <div className="text-center space-y-2 py-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-[#18E6BE] text-[#06131F] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(24,230,190,0.35)]">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Your Workspace is Ready!
                </h2>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  We have prepared an isolated, end-to-end encrypted private workspace configured specifically for your account.
                </p>
              </div>

              {/* Summary Pill Box */}
              <div className="p-4 rounded-2xl bg-[#071724] border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Account</span>
                  <span className="font-semibold text-white truncate max-w-[200px]">{userEmail || userId}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Currency</span>
                  <span className="font-semibold text-[#18E6BE]">{selectedCurrency}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Enabled Modules</span>
                  <span className="font-semibold text-white">{selectedModules.length} selected</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Cloud Sync & Isolation</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Strict User RLS
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={isInitializing}
                  className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_20px_rgba(24,230,190,0.3)] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isInitializing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" />
                      <span>Creating your private workspace...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Launch Tahir Tracker</span>
                    </>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={isInitializing}
                    className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Adjust settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

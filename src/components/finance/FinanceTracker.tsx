import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ListOrdered, 
  Wallet, 
  Flame, 
  Tag, 
  Repeat, 
  Target, 
  PieChart, 
  Mic, 
  Plus, 
  Calendar, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import { FinanceOverview } from './FinanceOverview';
import { TransactionsView } from './TransactionsView';
import { AccountsView } from './AccountsView';
import { BudgetsView } from './BudgetsView';
import { CategoriesView } from './CategoriesView';
import { RecurringView } from './RecurringView';
import { GoalsView } from './GoalsView';
import { FinanceReportsView } from './FinanceReportsView';
import { SmartVoiceEntryModal } from './SmartVoiceEntryModal';
import { AddEditTransactionModal } from './AddEditTransactionModal';
import { FinanceTransaction, FinanceTransactionType } from '../../types';
import { getMonthYearFormatted } from '../../utils/formatters';

export type FinanceSubTab = 
  | 'overview'
  | 'transactions'
  | 'accounts'
  | 'budgets'
  | 'categories'
  | 'recurring'
  | 'goals'
  | 'reports';

interface FinanceTrackerProps {
  selectedMonth: string; // YYYY-MM
  setSelectedMonth: (month: string) => void;
}

export const FinanceTracker: React.FC<FinanceTrackerProps> = ({
  selectedMonth,
  setSelectedMonth
}) => {
  const [activeSubTab, setActiveSubTab] = useState<FinanceSubTab>('overview');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalType, setAddModalType] = useState<FinanceTransactionType>('expense');
  const [transactionToEdit, setTransactionToEdit] = useState<FinanceTransaction | null>(null);

  const subTabs = [
    { id: 'overview' as FinanceSubTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions' as FinanceSubTab, label: 'Transactions', icon: ListOrdered },
    { id: 'accounts' as FinanceSubTab, label: 'Accounts', icon: Wallet },
    { id: 'budgets' as FinanceSubTab, label: 'Budgets', icon: Flame },
    { id: 'categories' as FinanceSubTab, label: 'Categories', icon: Tag },
    { id: 'recurring' as FinanceSubTab, label: 'Recurring', icon: Repeat },
    { id: 'goals' as FinanceSubTab, label: 'Goals', icon: Target },
    { id: 'reports' as FinanceSubTab, label: 'Reports', icon: PieChart },
  ];

  const shiftMonth = (direction: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + direction, 1);
    const newY = date.getFullYear();
    const newM = (date.getMonth() + 1).toString().padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  const handleOpenAddModalWithType = (type: FinanceTransactionType = 'expense') => {
    setTransactionToEdit(null);
    setAddModalType(type);
    setIsAddModalOpen(true);
  };

  const handleSelectTransactionToEdit = (tx: FinanceTransaction) => {
    setTransactionToEdit(tx);
    setIsAddModalOpen(true);
  };

  const formattedMonth = getMonthYearFormatted(selectedMonth);

  return (
    <div className="space-y-6">
      {/* 1. MODULE HEADER & ACTIONS */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Title & Month Navigation */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-emerald-500/20">
              💰
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-none">
                  Personal Finance
                </h1>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Voice Enabled
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Track daily expenses, income, accounts & budgets
              </p>
            </div>
          </div>
        </div>

        {/* Month Switcher & Quick Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap">
          {/* Month Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-xs">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Previous Month"
              className="p-1.5 rounded-xl text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative flex items-center gap-1.5 px-2 py-1 text-slate-800 font-bold text-xs sm:text-sm">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>{formattedMonth}</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Select month"
              />
            </div>

            <button
              onClick={() => shiftMonth(1)}
              aria-label="Next Month"
              className="p-1.5 rounded-xl text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Voice Entry Button */}
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Mic className="w-4 h-4" />
            <span>🎙️ Voice Entry</span>
          </button>

          {/* Add Transaction Button */}
          <button
            onClick={() => handleOpenAddModalWithType('expense')}
            className="px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Transaction</span>
          </button>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TABS */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1 overflow-x-auto no-scrollbar">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex-1 min-w-[80px] py-2 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400 fill-emerald-400' : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. ACTIVE SUB-VIEW CONTENT */}
      {activeSubTab === 'overview' && (
        <FinanceOverview
          selectedMonth={selectedMonth}
          onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          onOpenAddModal={handleOpenAddModalWithType}
          onNavigateToSubTab={(tab) => setActiveSubTab(tab)}
          onSelectTransactionToEdit={handleSelectTransactionToEdit}
        />
      )}

      {activeSubTab === 'transactions' && (
        <TransactionsView
          selectedMonth={selectedMonth}
          onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          onOpenAddModal={handleOpenAddModalWithType}
          onSelectTransactionToEdit={handleSelectTransactionToEdit}
        />
      )}

      {activeSubTab === 'accounts' && (
        <AccountsView
          onOpenAddModal={handleOpenAddModalWithType}
        />
      )}

      {activeSubTab === 'budgets' && (
        <BudgetsView
          selectedMonth={selectedMonth}
          onOpenAddModal={() => handleOpenAddModalWithType('expense')}
        />
      )}

      {activeSubTab === 'categories' && (
        <CategoriesView />
      )}

      {activeSubTab === 'recurring' && (
        <RecurringView />
      )}

      {activeSubTab === 'goals' && (
        <GoalsView />
      )}

      {activeSubTab === 'reports' && (
        <FinanceReportsView
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
        />
      )}

      {/* 4. MODALS */}
      <SmartVoiceEntryModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        initialType={addModalType}
      />

      <AddEditTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setTransactionToEdit(null);
        }}
        transactionToEdit={transactionToEdit}
        defaultType={addModalType}
      />
    </div>
  );
};

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
  Plus, 
  WalletCards,
  Mic
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
import { PageHeader } from '../ui/PageHeader';

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

  const handleOpenAddModalWithType = (type: FinanceTransactionType = 'expense') => {
    setTransactionToEdit(null);
    setAddModalType(type);
    setIsAddModalOpen(true);
  };

  const handleSelectTransactionToEdit = (tx: FinanceTransaction) => {
    setTransactionToEdit(tx);
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. REUSABLE PAGE HEADER */}
      <PageHeader
        title="Personal Finance"
        subtitle="Manage your money, build a better tomorrow"
        icon={WalletCards}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        secondaryAction={{
          label: 'Voice Entry',
          icon: Mic,
          onClick: () => setIsVoiceModalOpen(true)
        }}
        primaryAction={{
          label: '+ Add Transaction',
          icon: Plus,
          onClick: () => handleOpenAddModalWithType('expense')
        }}
      />

      {/* 2. SUB-NAVIGATION TABS */}
      <nav aria-label="Finance sections" className="bg-[#0B1D2C] p-1.5 rounded-2xl border border-[rgba(70,150,180,0.18)] shadow-sm flex items-center gap-1 overflow-x-auto no-scrollbar">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 min-w-[85px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE] border border-[rgba(24,230,190,0.32)] shadow-[0_0_12px_rgba(24,230,190,0.2)]'
                  : 'text-[#A9BDCC] hover:bg-[#102638] hover:text-[#F4F8FB]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#18E6BE]' : 'text-[#6F899B]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

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

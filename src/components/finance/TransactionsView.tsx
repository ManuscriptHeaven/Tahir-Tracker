import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  Search, 
  Plus, 
  Copy, 
  Trash2, 
  FileText 
} from 'lucide-react';
import { FinanceTransaction, FinanceTransactionType } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { getTodayLocalDateStr, addDaysLocalDate } from '../../utils/dateTime';
import { SmartQuickEntryBar } from './SmartQuickEntryBar';

interface TransactionsViewProps {
  selectedMonth: string; // YYYY-MM
  onOpenVoiceModal: () => void;
  onOpenAddModal: (type?: FinanceTransactionType) => void;
  onSelectTransactionToEdit: (tx: FinanceTransaction) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  selectedMonth,
  onOpenVoiceModal,
  onOpenAddModal,
  onSelectTransactionToEdit
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | FinanceTransactionType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('month');

  const accounts = useLiveQuery(() => db.finance_accounts.toArray()) || [];
  const categories = useLiveQuery(() => db.finance_categories.toArray()) || [];
  const allTransactions = useLiveQuery(() => db.finance_transactions.toArray()) || [];

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      if (tx.status === 'cancelled') return false;

      // Month or Date filter
      if (dateFilter === 'month' && !tx.transactionDate.startsWith(selectedMonth)) {
        return false;
      } else if (dateFilter !== 'all' && dateFilter !== 'month' && tx.transactionDate !== dateFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && tx.transactionType !== typeFilter) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && tx.categoryId !== selectedCategory) {
        return false;
      }

      // Account filter
      if (selectedAccount !== 'all' && tx.accountId !== selectedAccount && tx.transferToAccountId !== selectedAccount) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesDesc = tx.description.toLowerCase().includes(q);
        const matchesCat = tx.categoryName?.toLowerCase().includes(q);
        const matchesAcc = tx.accountName?.toLowerCase().includes(q);
        const matchesAmount = tx.amount.toString().includes(q);
        if (!matchesDesc && !matchesCat && !matchesAcc && !matchesAmount) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime() || b.id.localeCompare(a.id));
  }, [allTransactions, selectedMonth, dateFilter, typeFilter, selectedCategory, selectedAccount, searchTerm]);

  // Group transactions by date relative labels
  const groupedTransactions = useMemo(() => {
    const today = getTodayLocalDateStr();
    const yesterday = addDaysLocalDate(today, -1);

    const groups: { label: string; date: string; transactions: FinanceTransaction[] }[] = [];
    const map = new Map<string, FinanceTransaction[]>();

    filteredTransactions.forEach(tx => {
      const list = map.get(tx.transactionDate) || [];
      list.push(tx);
      map.set(tx.transactionDate, list);
    });

    map.forEach((txList, dateStr) => {
      let label = dateStr;
      if (dateStr === today) label = 'TODAY';
      else if (dateStr === yesterday) label = 'YESTERDAY';
      else {
        const d = new Date(dateStr);
        label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      }

      groups.push({
        label,
        date: dateStr,
        transactions: txList
      });
    });

    return groups;
  }, [filteredTransactions]);

  const handleDelete = async (txId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this transaction?')) {
      await db.finance_transactions.delete(txId);
    }
  };

  const handleDuplicate = async (tx: FinanceTransaction, e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date().toISOString();
    const copy: FinanceTransaction = {
      ...tx,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      transactionDate: now.split('T')[0],
      source: 'manual',
      createdAt: now,
      updatedAt: now
    };
    await db.finance_transactions.add(copy);
  };

  const totalFilteredIncome = filteredTransactions
    .filter(t => t.transactionType === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalFilteredExpense = filteredTransactions
    .filter(t => t.transactionType === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-4">
      {/* 1. SMART QUICK ENTRY BAR */}
      <SmartQuickEntryBar
        onOpenVoiceModal={onOpenVoiceModal}
        onOpenAddModal={onOpenAddModal}
        onTransactionSaved={() => {}}
      />

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="bg-[#0B1D2C] rounded-2xl p-4 sm:p-5 border border-[rgba(70,150,180,0.18)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] space-y-3.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#6F899B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search description, category, amount..."
              className="w-full pl-9 pr-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs sm:text-sm font-semibold text-[#F4F8FB] placeholder-[#6F899B] focus:outline-none focus:border-[#18E6BE]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onOpenVoiceModal}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-[#102638] hover:bg-[#122B3E] text-[#18E6BE] border border-[rgba(24,230,190,0.25)] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <span>🎙️ Voice</span>
            </button>

            <button
              onClick={() => onOpenAddModal('expense')}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-[#18E6BE] hover:bg-[#23F2CB] text-[#06131F] font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Transaction</span>
            </button>
          </div>
        </div>

        {/* Filter Type Pills: All, Income, Expenses, Transfers */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all' as const, label: 'All Transactions' },
            { id: 'expense' as const, label: 'Expenses' },
            { id: 'income' as const, label: 'Income' },
            { id: 'transfer' as const, label: 'Transfers' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                typeFilter === tab.id
                  ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE] border border-[rgba(24,230,190,0.3)] shadow-[0_0_10px_rgba(24,230,190,0.2)]'
                  : 'bg-[#102638] text-[#A9BDCC] hover:bg-[#122B3E] hover:text-[#F4F8FB]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dropdown Filters: Category, Account, Date */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[rgba(70,150,180,0.12)] text-xs">
          <div>
            <label className="text-[10px] font-bold text-[#6F899B] uppercase">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl font-bold text-[#F4F8FB]"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[#6F899B] uppercase">Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl font-bold text-[#F4F8FB]"
            >
              <option value="all">All Accounts</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.icon || '💳'} {a.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] font-bold text-[#6F899B] uppercase">Time Range</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl font-bold text-[#F4F8FB]"
            >
              <option value="month">Current Month ({selectedMonth})</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Totals Banner */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-[rgba(70,150,180,0.12)] text-[#6F899B]">
          <span>Found {filteredTransactions.length} records</span>
          <div className="flex items-center gap-3">
            <span>Income: <strong className="text-[#14E6AA]">+{formatCurrency(totalFilteredIncome)}</strong></span>
            <span>Expense: <strong className="text-[#FF627B]">-{formatCurrency(totalFilteredExpense)}</strong></span>
          </div>
        </div>
      </div>

      {/* 3. GROUPED TRANSACTION LIST */}
      <div className="space-y-4">
        {groupedTransactions.length > 0 ? (
          groupedTransactions.map(group => (
            <div key={group.date} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6F899B]">
                  {group.label}
                </h4>
                <div className="flex-1 h-px bg-[rgba(70,150,180,0.15)]" />
                <span className="text-[10px] text-[#6F899B] font-bold">
                  {group.transactions.length} item{group.transactions.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] divide-y divide-[rgba(70,150,180,0.1)] overflow-hidden">
                {group.transactions.map(tx => {
                  const isIncome = tx.transactionType === 'income';
                  const isTransfer = tx.transactionType === 'transfer';
                  const category = categories.find(c => c.id === tx.categoryId);

                  return (
                    <div
                      key={tx.id}
                      onClick={() => onSelectTransactionToEdit(tx)}
                      className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-[#102638] cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 border ${
                          isIncome 
                            ? 'bg-[rgba(20,230,170,0.12)] text-[#14E6AA] border-[rgba(20,230,170,0.25)]' 
                            : isTransfer 
                            ? 'bg-[rgba(57,175,255,0.12)] text-[#39AFFF] border-[rgba(57,175,255,0.25)]' 
                            : 'bg-[rgba(255,98,123,0.12)] text-[#FF627B] border-[rgba(255,98,123,0.25)]'
                        }`}>
                          {category?.icon || (isIncome ? '💵' : isTransfer ? '⇄' : '🛍️')}
                        </div>

                        {/* Title & Subtitle */}
                        <div className="min-w-0">
                          <div className="font-bold text-[#F4F8FB] text-sm truncate group-hover:text-[#18E6BE] transition-colors">
                            {tx.description}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#6F899B] mt-0.5 flex-wrap">
                            <span className="font-semibold text-[#A9BDCC]">{tx.categoryName || 'General'}</span>
                            <span>•</span>
                            <span className="px-1.5 py-0.5 bg-[#091A28] border border-[rgba(70,150,180,0.15)] text-[#A9BDCC] rounded-md font-bold text-[10px]">
                              {tx.accountName || 'Cash'} {isTransfer && `→ ${tx.transferToAccountName || 'Bank'}`}
                            </span>
                            {tx.source === 'voice' && (
                              <span className="text-[10px] text-[#18E6BE] bg-[rgba(24,230,190,0.12)] border border-[rgba(24,230,190,0.25)] px-1.5 py-0.5 rounded font-bold">
                                🎙️ Voice
                              </span>
                            )}
                            {tx.attachmentNote && (
                              <span className="text-[10px] text-[#6F899B] flex items-center gap-0.5">
                                <FileText className="w-3 h-3" />
                                {tx.attachmentNote}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Amount & Actions */}
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <div className="text-right">
                          <div className={`text-sm sm:text-base font-extrabold tabular-nums ${
                            isIncome 
                              ? 'text-[#14E6AA]' 
                              : isTransfer 
                              ? 'text-[#39AFFF]' 
                              : 'text-[#FF627B]'
                          }`}>
                            {isIncome ? '+' : isTransfer ? '⇄ ' : '-'}
                            {formatCurrency(tx.amount)}
                          </div>
                          <div className="text-[10px] text-[#6F899B]">
                            {tx.transactionDate}
                          </div>
                        </div>

                        {/* Quick action icons */}
                        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleDuplicate(tx, e)}
                            className="p-1.5 rounded-lg text-[#6F899B] hover:text-[#F4F8FB] hover:bg-[#122B3E] transition-colors"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(tx.id, e)}
                            className="p-1.5 rounded-lg text-[#6F899B] hover:text-[#FF627B] hover:bg-[rgba(255,98,123,0.1)] transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-[#0B1D2C] rounded-2xl p-12 text-center border border-[rgba(70,150,180,0.18)] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#102638] text-[#6F899B] flex items-center justify-center mx-auto text-xl">
              🔍
            </div>
            <h3 className="font-bold text-[#F4F8FB] text-base">No Transactions Found</h3>
            <p className="text-xs text-[#6F899B] max-w-sm mx-auto">
              No transactions match your search or filters for this month.
            </p>
            <button
              onClick={() => onOpenAddModal('expense')}
              className="px-4 py-2 bg-[#18E6BE] hover:bg-[#23F2CB] text-[#06131F] rounded-xl text-xs font-bold shadow-[0_0_15px_rgba(24,230,190,0.25)] transition-all"
            >
              + Add Transaction Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

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
  const [dateFilter, setDateFilter] = useState<string>('month'); // 'month' | 'all' | custom date

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

  // Group transactions by date relative labels (TODAY, YESTERDAY, specific date)
  const groupedTransactions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

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
        // Format e.g. "Monday, 31 August 2026"
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
        onTransactionSaved={() => {}}
      />

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search description, category, amount..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onOpenVoiceModal}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
            >
              <span>🎙️ Voice</span>
            </button>

            <button
              onClick={() => onOpenAddModal('expense')}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
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
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dropdown Filters: Category, Account, Date */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
            >
              <option value="all">All Accounts</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.icon || '💳'} {a.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Time Range</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
            >
              <option value="month">Current Month ({selectedMonth})</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Totals Banner */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500">
          <span>Found {filteredTransactions.length} records</span>
          <div className="flex items-center gap-3">
            <span>Income: <strong className="text-teal-700">+{formatCurrency(totalFilteredIncome)}</strong></span>
            <span>Expense: <strong className="text-rose-600">-{formatCurrency(totalFilteredExpense)}</strong></span>
          </div>
        </div>
      </div>

      {/* 3. GROUPED TRANSACTION LIST */}
      <div className="space-y-4">
        {groupedTransactions.length > 0 ? (
          groupedTransactions.map(group => (
            <div key={group.date} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {group.label}
                </h4>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] text-slate-400 font-bold">
                  {group.transactions.length} item{group.transactions.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
                {group.transactions.map(tx => {
                  const isIncome = tx.transactionType === 'income';
                  const isTransfer = tx.transactionType === 'transfer';
                  const category = categories.find(c => c.id === tx.categoryId);

                  return (
                    <div
                      key={tx.id}
                      onClick={() => onSelectTransactionToEdit(tx)}
                      className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                          isIncome 
                            ? 'bg-teal-50 text-teal-700' 
                            : isTransfer 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {category?.icon || (isIncome ? '💵' : isTransfer ? '⇄' : '🛍️')}
                        </div>

                        {/* Title & Subtitle */}
                        <div className="min-w-0">
                          <div className="font-black text-slate-900 text-sm truncate group-hover:text-emerald-700 transition-colors">
                            {tx.description}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                            <span className="font-semibold">{tx.categoryName || 'General'}</span>
                            <span>•</span>
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">
                              {tx.accountName || 'Cash'} {isTransfer && `→ ${tx.transferToAccountName || 'Bank'}`}
                            </span>
                            {tx.source === 'voice' && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-bold">
                                🎙️ Voice
                              </span>
                            )}
                            {tx.attachmentNote && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
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
                          <div className={`text-sm sm:text-base font-black ${
                            isIncome 
                              ? 'text-teal-700' 
                              : isTransfer 
                              ? 'text-blue-700' 
                              : 'text-slate-900'
                          }`}>
                            {isIncome ? '+' : isTransfer ? '⇄ ' : '-'}
                            {formatCurrency(tx.amount)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {tx.transactionDate}
                          </div>
                        </div>

                        {/* Quick action icons */}
                        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleDuplicate(tx, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(tx.id, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
              🔍
            </div>
            <h3 className="font-black text-slate-800 text-base">No Transactions Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No transactions match your search or filters for this month.
            </p>
            <button
              onClick={() => onOpenAddModal('expense')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-2xl text-xs font-bold shadow-sm hover:bg-emerald-500 transition-all"
            >
              + Add Transaction Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

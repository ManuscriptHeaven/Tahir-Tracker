import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  Plus, 
  Clock, 
  Check, 
  X, 
  Edit3, 
  Trash2 
} from 'lucide-react';
import { FinanceRecurringTransaction, FinanceRecurringFrequency } from '../../types';
import { getDueRecurringTransactions, computeNextRunDate } from '../../services/financeService';
import { formatCurrency } from '../../utils/formatters';

export const RecurringView: React.FC = () => {
  const recurringRules = useLiveQuery(() => db.finance_recurring_transactions.toArray()) || [];
  const accounts = useLiveQuery(() => db.finance_accounts.toArray()) || [];
  const categories = useLiveQuery(() => db.finance_categories.toArray()) || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<FinanceRecurringTransaction | null>(null);

  const [title, setTitle] = useState('');
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [frequency, setFrequency] = useState<FinanceRecurringFrequency>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextRunDate, setNextRunDate] = useState(new Date().toISOString().split('T')[0]);
  const [autoProcess, setAutoProcess] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const dueTransactions = getDueRecurringTransactions(recurringRules, todayStr);

  const handleOpenAdd = () => {
    setRuleToEdit(null);
    setTitle('');
    setTransactionType('expense');
    setAmount('');
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setAccountId(accounts.length > 0 ? accounts[0].id : '');
    setFrequency('monthly');
    setStartDate(todayStr);
    setNextRunDate(todayStr);
    setAutoProcess(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: FinanceRecurringTransaction) => {
    setRuleToEdit(rule);
    setTitle(rule.title);
    setTransactionType(rule.transactionType === 'income' ? 'income' : 'expense');
    setAmount(rule.amount.toString());
    setCategoryId(rule.categoryId || '');
    setAccountId(rule.accountId);
    setFrequency(rule.frequency);
    setStartDate(rule.startDate);
    setNextRunDate(rule.nextRunDate);
    setAutoProcess(rule.autoProcess);
    setIsModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    const now = new Date().toISOString();

    try {
      if (ruleToEdit) {
        await db.finance_recurring_transactions.update(ruleToEdit.id, {
          title: title.trim(),
          transactionType,
          amount: numAmount,
          categoryId,
          accountId,
          frequency,
          startDate,
          nextRunDate,
          autoProcess,
          updatedAt: now
        });
      } else {
        const newRule: FinanceRecurringTransaction = {
          id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: title.trim(),
          transactionType,
          amount: numAmount,
          categoryId,
          accountId,
          frequency,
          startDate,
          nextRunDate,
          autoProcess,
          isActive: true,
          createdAt: now,
          updatedAt: now
        };
        await db.finance_recurring_transactions.add(newRule);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save recurring rule:', err);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (confirm('Are you sure you want to delete this recurring rule?')) {
      await db.finance_recurring_transactions.delete(ruleId);
    }
  };

  // 1-Click Execute Due Recurring Transaction
  const handleExecuteDue = async (rule: FinanceRecurringTransaction) => {
    const now = new Date().toISOString();
    const category = categories.find(c => c.id === rule.categoryId);
    const account = accounts.find(a => a.id === rule.accountId);

    try {
      // 1. Insert transaction
      const newTx = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        transactionType: rule.transactionType,
        amount: rule.amount,
        currency: 'PKR',
        categoryId: rule.categoryId,
        categoryName: category?.name,
        accountId: rule.accountId,
        accountName: account?.name,
        transactionDate: rule.nextRunDate,
        description: rule.title,
        source: 'recurring' as const,
        status: 'completed' as const,
        createdAt: now,
        updatedAt: now
      };
      await db.finance_transactions.add(newTx);

      // 2. Advance next run date
      const newNextRun = computeNextRunDate(rule.nextRunDate, rule.frequency);
      await db.finance_recurring_transactions.update(rule.id, {
        nextRunDate: newNextRun,
        updatedAt: now
      });
    } catch (err) {
      console.error('Failed to execute recurring transaction:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. DUE NOTIFICATIONS BANNER */}
      {dueTransactions.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
            <Clock className="w-5 h-5 text-amber-600" />
            <span>{dueTransactions.length} Recurring Transaction{dueTransactions.length > 1 ? 's' : ''} Due for Recording</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {dueTransactions.map(rule => (
              <div
                key={rule.id}
                className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm">
                    {rule.title}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Due: <strong className="text-amber-700">{rule.nextRunDate}</strong> • {formatCurrency(rule.amount)}
                  </div>
                </div>

                <button
                  onClick={() => handleExecuteDue(rule)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 shrink-0"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Record Now</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. RECURRING RULES HEADER */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="font-black text-slate-900 text-base">
            Recurring Bills & Subscriptions
          </h3>
          <p className="text-xs text-slate-500">
            Automate monthly rent, salary, utilities, gym, and subscriptions
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Recurring</span>
        </button>
      </div>

      {/* 3. RECURRING CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recurringRules.map(rule => {
          const category = categories.find(c => c.id === rule.categoryId);
          const account = accounts.find(a => a.id === rule.accountId);
          const isIncome = rule.transactionType === 'income';

          return (
            <div
              key={rule.id}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-inner ${
                      isIncome ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {category?.icon || (isIncome ? '💵' : '📅')}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm sm:text-base group-hover:text-emerald-700 transition-colors">
                        {rule.title}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400 capitalize">
                        {rule.frequency} • {rule.transactionType}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(rule)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className={`text-2xl font-black ${isIncome ? 'text-teal-700' : 'text-slate-900'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(rule.amount)}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1.5">
                    <span>Account: <strong className="text-slate-800">{account?.name || 'Cash'}</strong></span>
                    <span>Category: <strong className="text-slate-800">{category?.name || 'General'}</strong></span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Next Due: <strong className="text-slate-800">{rule.nextRunDate}</strong>
                </span>

                <button
                  onClick={() => handleExecuteDue(rule)}
                  className="text-emerald-700 font-bold hover:underline"
                >
                  Record Now →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. ADD / EDIT RECURRING MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {ruleToEdit ? 'Edit Recurring Rule' : 'Add Recurring Transaction'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. House Rent, StormFiber Internet, Netflix..."
                  className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Type</label>
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">Amount (PKR) *</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold"
                  >
                    {categories.filter(c => c.type === transactionType).map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">Account</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.icon || '💳'} {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">Next Due Date</label>
                  <input
                    type="date"
                    required
                    value={nextRunDate}
                    onChange={(e) => setNextRunDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-2xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs shadow-md"
                >
                  Save Recurring Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

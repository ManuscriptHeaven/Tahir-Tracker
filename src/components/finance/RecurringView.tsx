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
import { getTodayLocalDateStr } from '../../utils/dateTime';

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
  const [startDate, setStartDate] = useState(getTodayLocalDateStr());
  const [nextRunDate, setNextRunDate] = useState(getTodayLocalDateStr());
  const [autoProcess, setAutoProcess] = useState(false);

  const todayStr = getTodayLocalDateStr();
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
          categoryId: categoryId || undefined,
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
          categoryId: categoryId || undefined,
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
        <div className="bg-[rgba(247,183,51,0.1)] border border-[rgba(247,183,51,0.28)] rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#F7B733] font-bold text-sm">
            <Clock className="w-5 h-5 text-[#F7B733]" />
            <span>{dueTransactions.length} Recurring Transaction{dueTransactions.length > 1 ? 's' : ''} Due for Recording</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {dueTransactions.map(rule => (
              <div
                key={rule.id}
                className="bg-[#0B1D2C] p-3.5 rounded-xl border border-[rgba(70,150,180,0.18)] flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-[#F4F8FB] text-xs sm:text-sm">
                    {rule.title}
                  </div>
                  <div className="text-[11px] text-[#6F899B]">
                    Due: <strong className="text-[#F7B733]">{rule.nextRunDate}</strong> • {formatCurrency(rule.amount)}
                  </div>
                </div>

                <button
                  onClick={() => handleExecuteDue(rule)}
                  className="px-3 py-1.5 bg-[#18E6BE] hover:bg-[#23F2CB] active:scale-95 text-[#06131F] font-bold text-xs rounded-lg shadow-sm flex items-center gap-1 shrink-0"
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
      <div className="bg-[#0B1D2C] rounded-2xl p-4 sm:p-5 border border-[rgba(70,150,180,0.18)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-[#F4F8FB]">
            Recurring Bills & Subscriptions
          </h3>
          <p className="text-xs text-[#6F899B] mt-0.5">
            Automate monthly rent, salary, utilities, and subscriptions
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-[#18E6BE] hover:bg-[#23F2CB] text-[#06131F] font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Add Recurring</span>
        </button>
      </div>

      {/* 3. RECURRING CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recurringRules.map(rule => {
          const category = categories.find(c => c.id === rule.categoryId);
          const isIncome = rule.transactionType === 'income';

          return (
            <div
              key={rule.id}
              className="bg-[#0B1D2C] rounded-2xl p-5 border border-[rgba(70,150,180,0.18)] hover:border-[rgba(55,210,190,0.35)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${
                      isIncome 
                        ? 'bg-[rgba(20,230,170,0.12)] text-[#14E6AA] border-[rgba(20,230,170,0.25)]' 
                        : 'bg-[rgba(255,98,123,0.12)] text-[#FF627B] border-[rgba(255,98,123,0.25)]'
                    }`}>
                      {category?.icon || (isIncome ? '💵' : '📅')}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#F4F8FB] text-sm sm:text-base group-hover:text-[#18E6BE] transition-colors">
                        {rule.title}
                      </h4>
                      <span className="text-[10px] font-bold text-[#6F899B] capitalize">
                        {rule.frequency} • {rule.transactionType}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(rule)}
                      className="p-1.5 rounded-lg text-[#6F899B] hover:text-[#F4F8FB] hover:bg-[#102638]"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 rounded-lg text-[#6F899B] hover:text-[#FF627B] hover:bg-[rgba(255,98,123,0.1)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-[10px] font-bold text-[#6F899B] uppercase tracking-wider">Amount</span>
                  <div className={`text-2xl font-extrabold mt-0.5 tabular-nums ${isIncome ? 'text-[#14E6AA]' : 'text-[#FF627B]'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(rule.amount)}
                  </div>
                  <div className="text-[11px] text-[#6F899B] mt-1">
                    Next run: <strong className="text-[#F4F8FB]">{rule.nextRunDate}</strong>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[rgba(70,150,180,0.12)] flex items-center justify-between text-xs">
                <span className="text-[#6F899B] capitalize">{rule.frequency}</span>
                <button
                  onClick={() => handleExecuteDue(rule)}
                  className="text-[#18E6BE] font-bold hover:underline"
                >
                  Record now →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#071724] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-[rgba(70,150,180,0.2)] p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[rgba(70,150,180,0.14)] pb-3">
              <h3 className="text-base font-bold text-[#F4F8FB]">
                {ruleToEdit ? 'Edit Recurring Rule' : 'New Recurring Transaction'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-[#6F899B] hover:text-[#F4F8FB] hover:bg-[#0B1D2C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#A9BDCC]">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Netflix, Rent Payment, Office Internet"
                  className="w-full mt-1 px-3.5 py-2.5 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs sm:text-sm font-bold text-[#F4F8FB] placeholder-[#6F899B] focus:outline-none focus:border-[#18E6BE]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#A9BDCC]">Type</label>
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs font-bold text-[#F4F8FB]"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#A9BDCC]">Amount (PKR) *</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs font-bold text-[#F4F8FB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#A9BDCC]">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs font-bold text-[#F4F8FB]"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#A9BDCC]">Account</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs font-bold text-[#F4F8FB]"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.icon || '💳'} {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#A9BDCC]">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs font-bold text-[#F4F8FB]"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#A9BDCC]">Next Due Date</label>
                  <input
                    type="date"
                    value={nextRunDate}
                    onChange={(e) => setNextRunDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs text-[#F4F8FB]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-[#102638] text-[#A9BDCC] hover:text-[#F4F8FB] font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#18E6BE] hover:bg-[#23F2CB] text-[#06131F] font-bold rounded-xl text-xs shadow-[0_0_15px_rgba(24,230,190,0.25)] transition-all"
                >
                  Save Recurring
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

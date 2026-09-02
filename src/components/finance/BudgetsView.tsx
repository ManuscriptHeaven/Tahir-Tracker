import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  Plus, 
  Flame, 
  AlertTriangle, 
  AlertOctagon, 
  Edit3, 
  Trash2, 
  X 
} from 'lucide-react';
import { FinanceBudget } from '../../types';
import { getBudgetAdherence } from '../../services/financeService';
import { formatCurrency } from '../../utils/formatters';

interface BudgetsViewProps {
  selectedMonth: string; // YYYY-MM
  onOpenAddModal?: () => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({ selectedMonth }) => {
  const budgets = useLiveQuery(() => db.finance_budgets.toArray()) || [];
  const categories = useLiveQuery(() => db.finance_categories.filter(c => c.type === 'expense').toArray()) || [];
  const transactions = useLiveQuery(() => db.finance_transactions.toArray()) || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [budgetToEdit, setBudgetToEdit] = useState<FinanceBudget | null>(null);

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('80');

  const budgetAdherence = getBudgetAdherence(budgets, transactions, categories, selectedMonth);

  const totalBudgetAmount = budgets.filter(b => b.isActive).reduce((sum, b) => sum + b.amount, 0);
  const totalSpentAmount = budgetAdherence.reduce((sum, b) => sum + b.spentAmount, 0);
  const totalRemaining = totalBudgetAmount - totalSpentAmount;
  const overallPercentage = totalBudgetAmount > 0 ? Math.round((totalSpentAmount / totalBudgetAmount) * 100) : 0;

  const handleOpenAdd = () => {
    setBudgetToEdit(null);
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setAmount('');
    setAlertThreshold('80');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b: FinanceBudget) => {
    setBudgetToEdit(b);
    setCategoryId(b.categoryId || '');
    setAmount(b.amount.toString());
    setAlertThreshold((b.alertThreshold || 80).toString());
    setIsModalOpen(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid budget amount.');
      return;
    }

    const now = new Date().toISOString();
    const selectedCat = categories.find(c => c.id === categoryId);

    try {
      if (budgetToEdit) {
        await db.finance_budgets.update(budgetToEdit.id, {
          categoryId: categoryId || undefined,
          categoryName: selectedCat?.name,
          amount: numAmount,
          alertThreshold: parseInt(alertThreshold, 10) || 80,
          updatedAt: now
        });
      } else {
        const newBudget: FinanceBudget = {
          id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          categoryId: categoryId || undefined,
          categoryName: selectedCat?.name,
          amount: numAmount,
          period: 'monthly',
          alertThreshold: parseInt(alertThreshold, 10) || 80,
          isActive: true,
          createdAt: now,
          updatedAt: now
        };
        await db.finance_budgets.add(newBudget);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save budget:', err);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (confirm('Are you sure you want to delete this budget rule?')) {
      await db.finance_budgets.delete(budgetId);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. OVERALL MONTHLY BUDGET BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="space-y-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-black uppercase tracking-wider">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Monthly Budget Summary ({selectedMonth})</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {formatCurrency(totalSpentAmount)}
            </span>
            <span className="text-slate-400 text-base font-bold">
              / {formatCurrency(totalBudgetAmount)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <span>Remaining: <strong className={totalRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatCurrency(totalRemaining)}</strong></span>
            <span>Consumed: <strong>{overallPercentage}%</strong></span>
          </div>
        </div>

        <div className="w-full sm:w-auto flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Category Budget</span>
          </button>
        </div>
      </div>

      {/* 2. CRITICAL / EXCEEDED ALERTS NOTIFICATIONS */}
      {budgetAdherence.some(b => b.status === 'exceeded' || b.status === 'critical') && (
        <div className="space-y-2">
          {budgetAdherence.filter(b => b.status === 'exceeded').map(b => (
            <div key={b.budget.id} className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-900 animate-in fade-in">
              <div className="flex items-center gap-2.5 font-bold">
                <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
                <span>🚨 Budget Exceeded: You have spent {formatCurrency(b.spentAmount)} ({b.percentage}%) on {b.categoryName}. Limit: {formatCurrency(b.budgetAmount)}.</span>
              </div>
            </div>
          ))}

          {budgetAdherence.filter(b => b.status === 'critical').map(b => (
            <div key={b.budget.id} className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in">
              <div className="flex items-center gap-2.5 font-bold">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>⚠️ Budget Warning: You have consumed {b.percentage}% of your {b.categoryName} budget. {formatCurrency(b.remainingAmount)} remaining.</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. CATEGORY BUDGET CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgetAdherence.map(item => {
          return (
            <div
              key={item.budget.id}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-xl shadow-inner border border-slate-100">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm sm:text-base">
                        {item.categoryName}
                      </h3>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.2 rounded-full ${
                        item.status === 'exceeded' 
                          ? 'bg-rose-100 text-rose-800' 
                          : item.status === 'critical' 
                          ? 'bg-amber-100 text-amber-800' 
                          : item.status === 'warning' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.status} ({item.percentage}%)
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(item.budget)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      title="Edit Budget"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBudget(item.budget.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Delete Budget"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Numbers */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-slate-900">
                      {formatCurrency(item.spentAmount)}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      Budget: {formatCurrency(item.budgetAmount)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-2.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.status === 'exceeded' 
                          ? 'bg-rose-500' 
                          : item.status === 'critical' 
                          ? 'bg-amber-500' 
                          : item.status === 'warning' 
                          ? 'bg-blue-500' 
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Footer Remaining */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {item.remainingAmount >= 0 ? 'Remaining' : 'Over Limit'}:
                </span>
                <span className={`font-black ${item.remainingAmount >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatCurrency(Math.abs(item.remainingAmount))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. ADD / EDIT BUDGET MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {budgetToEdit ? 'Edit Budget Rule' : 'Create Monthly Budget'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600">Category *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Monthly Spending Limit (PKR) *</label>
                <input
                  type="number"
                  required
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 25000"
                  className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Alert Warning Threshold (%)</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Trigger warning when expenses exceed this percentage of the budget (default 80%).
                </p>
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
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

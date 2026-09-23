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
      <div className="bg-[#0B1D2C] rounded-2xl p-5 sm:p-6 text-white border border-[rgba(70,150,180,0.18)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="space-y-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-[#F7B733] text-xs font-bold uppercase tracking-wider">
            <Flame className="w-4 h-4 text-[#F7B733]" />
            <span>Monthly Budget Summary ({selectedMonth})</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#F4F8FB] tracking-tight tabular-nums">
              {formatCurrency(totalSpentAmount)}
            </span>
            <span className="text-[#6F899B] text-base font-bold">
              / {formatCurrency(totalBudgetAmount)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#A9BDCC]">
            <span>Remaining: <strong className={totalRemaining >= 0 ? 'text-[#14E6AA]' : 'text-[#FF627B]'}>{formatCurrency(totalRemaining)}</strong></span>
            <span>Consumed: <strong className="text-[#F4F8FB]">{overallPercentage}%</strong></span>
          </div>
        </div>

        <div className="w-full sm:w-auto flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#18E6BE] hover:bg-[#23F2CB] active:scale-95 text-[#06131F] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(24,230,190,0.25)]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Create Category Budget</span>
          </button>
        </div>
      </div>

      {/* 2. CRITICAL / EXCEEDED ALERTS NOTIFICATIONS */}
      {budgetAdherence.some(b => b.status === 'exceeded' || b.status === 'critical') && (
        <div className="space-y-2">
          {budgetAdherence.filter(b => b.status === 'exceeded').map(b => (
            <div key={b.budget.id} className="p-3.5 bg-[rgba(255,98,123,0.1)] border border-[rgba(255,98,123,0.28)] rounded-xl flex items-center justify-between gap-3 text-xs text-[#FF627B] animate-in fade-in">
              <div className="flex items-center gap-2.5 font-bold">
                <AlertOctagon className="w-5 h-5 text-[#FF627B] shrink-0" />
                <span>🚨 Budget Exceeded: You have spent {formatCurrency(b.spentAmount)} ({b.percentage}%) on {b.categoryName}. Limit: {formatCurrency(b.budgetAmount)}.</span>
              </div>
            </div>
          ))}

          {budgetAdherence.filter(b => b.status === 'critical').map(b => (
            <div key={b.budget.id} className="p-3.5 bg-[rgba(247,183,51,0.1)] border border-[rgba(247,183,51,0.28)] rounded-xl flex items-center justify-between gap-3 text-xs text-[#F7B733] animate-in fade-in">
              <div className="flex items-center gap-2.5 font-bold">
                <AlertTriangle className="w-5 h-5 text-[#F7B733] shrink-0" />
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
              className="bg-[#0B1D2C] rounded-2xl p-5 border border-[rgba(70,150,180,0.18)] hover:border-[rgba(55,210,190,0.35)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#102638] flex items-center justify-center text-xl border border-[rgba(70,150,180,0.2)]">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#F4F8FB] text-sm sm:text-base">
                        {item.categoryName}
                      </h3>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        item.status === 'exceeded' 
                          ? 'bg-[rgba(255,98,123,0.12)] text-[#FF627B] border-[rgba(255,98,123,0.25)]' 
                          : item.status === 'critical' 
                          ? 'bg-[rgba(247,183,51,0.12)] text-[#F7B733] border-[rgba(247,183,51,0.25)]' 
                          : item.status === 'warning' 
                          ? 'bg-[rgba(57,175,255,0.12)] text-[#39AFFF] border-[rgba(57,175,255,0.25)]' 
                          : 'bg-[rgba(20,230,170,0.12)] text-[#14E6AA] border-[rgba(20,230,170,0.25)]'
                      }`}>
                        {item.status} ({item.percentage}%)
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(item.budget)}
                      className="p-1.5 rounded-lg text-[#6F899B] hover:text-[#F4F8FB] hover:bg-[#102638]"
                      title="Edit Budget"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBudget(item.budget.id)}
                      className="p-1.5 rounded-lg text-[#6F899B] hover:text-[#FF627B] hover:bg-[rgba(255,98,123,0.1)]"
                      title="Delete Budget"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Numbers */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-[#F4F8FB] tabular-nums">
                      {formatCurrency(item.spentAmount)}
                    </span>
                    <span className="text-xs font-bold text-[#6F899B]">
                      Budget: {formatCurrency(item.budgetAmount)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#091A28] h-2.5 rounded-full mt-2 overflow-hidden border border-[rgba(70,150,180,0.15)]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.status === 'exceeded' 
                          ? 'bg-[#FF627B]' 
                          : item.status === 'critical' 
                          ? 'bg-[#F7B733]' 
                          : item.status === 'warning' 
                          ? 'bg-[#39AFFF]' 
                          : 'bg-[#14E6AA]'
                      }`}
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Footer Remaining */}
              <div className="pt-3 border-t border-[rgba(70,150,180,0.12)] flex items-center justify-between text-xs">
                <span className="text-[#6F899B]">
                  {item.remainingAmount >= 0 ? 'Remaining' : 'Over Limit'}:
                </span>
                <span className={`font-extrabold tabular-nums ${item.remainingAmount >= 0 ? 'text-[#14E6AA]' : 'text-[#FF627B]'}`}>
                  {formatCurrency(Math.abs(item.remainingAmount))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. ADD / EDIT BUDGET MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#071724] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-[rgba(70,150,180,0.2)] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(70,150,180,0.14)] pb-3">
              <h3 className="text-base font-bold text-[#F4F8FB]">
                {budgetToEdit ? 'Edit Budget Rule' : 'Create Monthly Budget'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-[#6F899B] hover:text-[#F4F8FB] hover:bg-[#0B1D2C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#A9BDCC]">Category *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs sm:text-sm font-bold text-[#F4F8FB] focus:outline-none focus:border-[#18E6BE]"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#A9BDCC]">Monthly Spending Limit (PKR) *</label>
                <input
                  type="number"
                  required
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 25000"
                  className="w-full mt-1 px-3.5 py-2.5 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-sm font-bold text-[#F4F8FB] focus:outline-none focus:border-[#18E6BE]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#A9BDCC]">Alert Warning Threshold (%)</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs font-bold text-[#F4F8FB]"
                />
                <p className="text-[10px] text-[#6F899B] mt-1">
                  Trigger warning when expenses exceed this percentage of the budget (default 80%).
                </p>
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

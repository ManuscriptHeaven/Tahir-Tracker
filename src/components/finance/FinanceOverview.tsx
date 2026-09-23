import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  formatCurrency 
} from '../../utils/formatters';
import { 
  calculateAccountBalances, 
  getMonthlyFinanceSummary, 
  getCategorySpendingBreakdown, 
  getBudgetAdherence, 
  calculateFinancialHealthScore, 
  generateAIFinancialInsights 
} from '../../services/financeService';
import { 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  TrendingUp, 
  Sparkles, 
  Mic, 
  ArrowRight, 
  ShieldCheck, 
  PieChart, 
  Flame,
  CheckCircle2
} from 'lucide-react';
import { SmartQuickEntryBar } from './SmartQuickEntryBar';
import { FinanceTransaction } from '../../types';

interface FinanceOverviewProps {
  selectedMonth: string; // YYYY-MM
  onOpenVoiceModal: () => void;
  onOpenAddModal: (type?: 'expense' | 'income' | 'transfer') => void;
  onNavigateToSubTab: (tab: 'transactions' | 'accounts' | 'budgets' | 'categories' | 'recurring' | 'goals' | 'reports') => void;
  onSelectTransactionToEdit: (tx: FinanceTransaction) => void;
}

export const FinanceOverview: React.FC<FinanceOverviewProps> = ({
  selectedMonth,
  onOpenVoiceModal,
  onOpenAddModal,
  onNavigateToSubTab,
  onSelectTransactionToEdit
}) => {
  const accounts = useLiveQuery(() => db.finance_accounts.toArray()) || [];
  const categories = useLiveQuery(() => db.finance_categories.toArray()) || [];
  const transactions = useLiveQuery(() => db.finance_transactions.toArray()) || [];
  const budgets = useLiveQuery(() => db.finance_budgets.toArray()) || [];
  const goals = useLiveQuery(() => db.finance_goals.toArray()) || [];

  // Computed data
  const accountBalances = calculateAccountBalances(accounts, transactions);
  const summary = getMonthlyFinanceSummary(transactions, selectedMonth, accountBalances, accounts);
  const categorySpending = getCategorySpendingBreakdown(transactions, categories, selectedMonth);
  const budgetAdherence = getBudgetAdherence(budgets, transactions, categories, selectedMonth);
  const healthScore = calculateFinancialHealthScore(
    summary.monthlyIncome,
    summary.monthlyExpenses,
    summary.savingsRate,
    budgetAdherence,
    summary.totalLiquidBalance
  );
  const aiInsights = generateAIFinancialInsights(transactions, categories, budgetAdherence, selectedMonth);

  // Recent 6 transactions
  const recentTransactions = transactions
    .filter(tx => tx.transactionDate.startsWith(selectedMonth) && tx.status !== 'cancelled')
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime() || b.id.localeCompare(a.id))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Monthly cash flow is the primary result; account balance is a current snapshot. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="sm:col-span-2 xl:col-span-2 rounded-3xl p-6 bg-slate-900 text-white flex flex-col justify-between min-h-[220px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-300">Selected month's cash flow</p>
              <p className="mt-1 text-sm text-slate-300">Income minus expenses</p>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
          </div>
          <div className="my-5">
            <p className={`text-3xl sm:text-4xl font-bold tracking-tight break-words ${summary.netSavings < 0 ? 'text-rose-300' : 'text-white'}`}>
              {formatCurrency(summary.netSavings)}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {summary.netSavings < 0 ? 'Shortfall this month' : 'Remaining after expenses'}
              {summary.monthlyIncome > 0 && <span className="ml-2 text-slate-400">· {summary.savingsRate}% of income</span>}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/15 text-sm">
            <div><span className="block text-slate-400 text-xs">Income</span><span className="font-semibold">{formatCurrency(summary.monthlyIncome)}</span></div>
            <div><span className="block text-slate-400 text-xs">Expenses</span><span className="font-semibold">{formatCurrency(summary.monthlyExpenses)}</span></div>
          </div>
        </div>

        <button type="button" onClick={() => onNavigateToSubTab('accounts')}
          className="text-left bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:border-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 transition-colors flex flex-col justify-between min-h-[170px]">
          <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">Current liquid assets <Wallet className="w-4 h-4 text-emerald-600" aria-hidden="true" /></span>
          <span className="block text-2xl font-bold text-slate-900 tracking-tight break-words">{formatCurrency(summary.totalLiquidBalance)}</span>
          <span className="text-xs text-slate-500">{accounts.filter(a => a.isActive).length} active accounts · View accounts →</span>
        </button>

        <button type="button" onClick={() => onNavigateToSubTab('transactions')}
          className="text-left bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:border-teal-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 transition-colors flex flex-col justify-between min-h-[170px]">
          <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly income <ArrowDownLeft className="w-4 h-4 text-teal-600" aria-hidden="true" /></span>
          <span className="block text-2xl font-bold text-slate-900 tracking-tight break-words">{formatCurrency(summary.monthlyIncome)}</span>
          <span className="text-xs text-slate-500">View income transactions →</span>
        </button>

        <button type="button" onClick={() => onNavigateToSubTab('budgets')}
          className="text-left bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:border-rose-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-600 transition-colors flex flex-col justify-between min-h-[170px]">
          <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly expenses <ArrowUpRight className="w-4 h-4 text-rose-600" aria-hidden="true" /></span>
          <span className="block text-2xl font-bold text-slate-900 tracking-tight break-words">{formatCurrency(summary.monthlyExpenses)}</span>
          <span className="text-xs text-slate-500">{summary.monthlyIncome > 0 ? `${summary.expensePercentage}% of income` : 'No income recorded'} · View budgets →</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Record a transaction</h2>
            <p className="text-xs text-slate-500 mt-0.5">Use the form, speak, or type a short note.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onOpenAddModal('expense')} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700">+ Expense</button>
            <button type="button" onClick={() => onOpenAddModal('income')} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200">+ Income</button>
            <button type="button" onClick={() => onOpenAddModal('transfer')} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200">Transfer</button>
            <button type="button" onClick={onOpenVoiceModal} className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 inline-flex items-center gap-1.5"><Mic className="w-4 h-4" /> Voice entry</button>
          </div>
        </div>
        <SmartQuickEntryBar onOpenVoiceModal={onOpenVoiceModal} />
      </div>

      {/* 4. FINANCIAL HEALTH SCORE & AI INSIGHTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Health Score Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-slate-800 text-sm">Financial Health Score</h3>
            </div>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
              healthScore.grade === 'Excellent' 
                ? 'bg-emerald-100 text-emerald-800' 
                : healthScore.grade === 'Good' 
                ? 'bg-teal-100 text-teal-800' 
                : 'bg-amber-100 text-amber-800'
            }`}>
              {healthScore.grade}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full flex items-center justify-center shrink-0"
              role="progressbar" aria-label="Financial health score" aria-valuenow={healthScore.score} aria-valuemin={0} aria-valuemax={100}
              style={{ background: `conic-gradient(#059669 ${healthScore.score}%, #e2e8f0 0)` }}>
              <span className="w-[70px] h-[70px] rounded-full bg-white flex items-center justify-center text-2xl font-bold text-slate-900">{healthScore.score}</span>
            </div>

            <div className="flex-1 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Savings Rate:</span>
                <strong className={healthScore.savingsRate < 0 ? 'text-rose-700' : 'text-slate-800'}>{healthScore.savingsRate}%</strong>
              </div>
              <div className="flex justify-between">
                <span>Budget Adherence:</span>
                <strong className="text-slate-800">{healthScore.budgetAdherenceRate}%</strong>
              </div>
              <div className="flex justify-between">
                <span>Expense Ratio:</span>
                <strong className="text-slate-800">{healthScore.expenseToIncomeRatio}%</strong>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 text-[11px] text-slate-600">
            💡 {healthScore.recommendations[0]}
          </div>
        </div>

        {/* Spending insights */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="font-black text-slate-800 text-sm">Spending insights</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">
              Based on your transactions
            </span>
          </div>

          <div className="space-y-2.5 my-3">
            {aiInsights.length > 0 ? (
              aiInsights.slice(0, 3).map((insight) => (
                <div
                  key={insight.id}
                  className={`p-3 rounded-2xl border flex items-start gap-2.5 text-xs ${
                    insight.type === 'increase' 
                      ? 'bg-rose-50/70 border-rose-200 text-rose-900' 
                      : insight.type === 'achievement' 
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
                      : insight.type === 'budget_warning' 
                      ? 'bg-amber-50/70 border-amber-200 text-amber-900' 
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <span className="text-base shrink-0">{insight.icon || '💡'}</span>
                  <div className="flex-1">
                    <div className="font-black">{insight.title}</div>
                    <p className="text-[11px] mt-0.5 opacity-90">{insight.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Add transactions to see spending patterns and budget alerts.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400">Based on recorded activity</span>
            <button
              onClick={() => onNavigateToSubTab('reports')}
              className="text-emerald-700 font-bold hover:underline"
            >
              Full Reports & Trends →
            </button>
          </div>
        </div>
      </div>

      {/* 5. SPENDING BY CATEGORY & BUDGET STATUS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Spending Breakdown */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-800 text-sm">Spending by Category</h3>
              </div>
              <button
                onClick={() => onNavigateToSubTab('categories')}
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                Categories →
              </button>
            </div>

            <div className="space-y-3 mt-4">
              {categorySpending.length > 0 ? (
                categorySpending.slice(0, 5).map(cat => (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm gap-2">
                      <div className="flex items-center gap-2 font-bold text-slate-800">
                        <span>{cat.icon}</span>
                        <span>{cat.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-2 font-bold tabular-nums">
                        <span>{formatCurrency(cat.totalAmount)}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({cat.percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No expenses recorded for this month yet.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total Expense: {formatCurrency(summary.monthlyExpenses)}</span>
            <button
              onClick={() => onNavigateToSubTab('transactions')}
              className="text-emerald-700 font-bold hover:underline"
            >
              View Transactions →
            </button>
          </div>
        </div>

        {/* Monthly Budgets Adherence */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-slate-800 text-sm">Budget Adherence</h3>
              </div>
              <button
                onClick={() => onNavigateToSubTab('budgets')}
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                Budgets →
              </button>
            </div>

            <div className="space-y-3 mt-4">
              {budgetAdherence.length > 0 ? (
                budgetAdherence.slice(0, 4).map(b => (
                  <div key={b.budget.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span>{b.icon}</span>
                        <span>{b.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="font-bold text-slate-900">{formatCurrency(b.spentAmount)}</span>
                        <span className="text-slate-400">/ {formatCurrency(b.budgetAmount)}</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                          b.status === 'exceeded' 
                            ? 'bg-rose-100 text-rose-800' 
                            : b.status === 'critical' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {b.percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          b.status === 'exceeded' ? 'bg-rose-500' : b.status === 'critical' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, b.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No monthly budgets configured yet.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{budgetAdherence.filter(b => b.status === 'normal').length} on track</span>
            <button
              onClick={() => onNavigateToSubTab('budgets')}
              className="text-emerald-700 font-bold hover:underline"
            >
              Manage Budgets →
            </button>
          </div>
        </div>
      </div>

      {/* 6. SAVINGS GOALS & RECENT TRANSACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Goals Progress */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-800 text-sm">Savings Goals</h3>
              </div>
              <button
                onClick={() => onNavigateToSubTab('goals')}
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                Goals →
              </button>
            </div>

            <div className="space-y-3 mt-4">
              {goals.filter(g => g.status === 'in_progress').length === 0 && (
                <p className="text-sm text-slate-500 py-6">No savings goals yet. Add a target to track progress here.</p>
              )}
              {goals.filter(g => g.status === 'in_progress').map(goal => {
                const percent = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0;
                return (
                  <div key={goal.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>{goal.icon || '🎯'} {goal.name}</span>
                      <span className="text-emerald-700">{percent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Saved: {formatCurrency(goal.currentAmount)}</span>
                      <span>Target: {formatCurrency(goal.targetAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigateToSubTab('goals')}
              className="w-full py-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-xl text-xs font-bold transition-all text-center"
            >
              + Add Goal / Contribute
            </button>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-800 text-sm">Recent Transactions</h3>
              <button
                onClick={() => onNavigateToSubTab('transactions')}
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <span>View All ({summary.transactionCount})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {recentTransactions.length > 0 ? (
                recentTransactions.map(tx => {
                  const isIncome = tx.transactionType === 'income';
                  const isTransfer = tx.transactionType === 'transfer';

                  return (
                    <button
                      type="button"
                      key={tx.id}
                      onClick={() => onSelectTransactionToEdit(tx)}
                      className="w-full text-left py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-xl cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-base ${
                          isIncome 
                            ? 'bg-teal-50 text-teal-700' 
                            : isTransfer 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {isIncome ? '💵' : isTransfer ? '⇄' : '🛍️'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                            {tx.description || tx.categoryName}
                          </div>
                          <div className="flex items-center flex-wrap gap-x-1.5 text-[10px] text-slate-500">
                            <span>{tx.categoryName || 'General'}</span>
                            <span>•</span>
                            <span>{tx.accountName || 'Cash'}</span>
                            <span>•</span>
                            <span>{tx.transactionDate}</span>
                            {tx.source === 'voice' && (
                              <span className="text-emerald-600 font-bold">🎙️ Voice</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={`text-xs sm:text-sm font-bold shrink-0 tabular-nums ${
                        isIncome ? 'text-teal-700' : isTransfer ? 'text-blue-700' : 'text-slate-900'
                      }`}>
                        {isIncome ? '+' : isTransfer ? '⇄ ' : '-'}
                        {formatCurrency(tx.amount)}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No transactions recorded for this month yet.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">Click any transaction to edit</span>
            <button
              onClick={() => onOpenAddModal('expense')}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              + New Transaction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  ArrowRightLeft, 
  TrendingUp, 
  Sparkles, 
  Mic, 
  Plus, 
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
      {/* 1. TOP FINANCIAL SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Balance / Net Worth */}
        <div 
          onClick={() => onNavigateToSubTab('accounts')}
          className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Total Balance
              </span>
              <div className="p-2 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {formatCurrency(summary.totalLiquidBalance)}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {summary.incomeDifference >= 0 ? '+' : ''}{formatCurrency(summary.netSavings)} this month
                </span>
              </div>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{accounts.filter(a => a.isActive).length} Active Accounts</span>
            <span className="text-emerald-700 font-bold group-hover:underline">View All →</span>
          </div>
        </div>

        {/* Card 2: Monthly Income */}
        <div 
          onClick={() => onOpenAddModal('income')}
          className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:border-teal-500/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Monthly Income
              </span>
              <div className="p-2 rounded-2xl bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-teal-700 tracking-tight">
                {formatCurrency(summary.monthlyIncome)}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                {summary.selectedMonth} Incoming
              </div>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>+ Add Income</span>
            <span className="text-teal-700 font-bold group-hover:underline">+ Record →</span>
          </div>
        </div>

        {/* Card 3: Monthly Expenses */}
        <div 
          onClick={() => onOpenAddModal('expense')}
          className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:border-rose-500/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Monthly Expenses
              </span>
              <div className="p-2 rounded-2xl bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {formatCurrency(summary.monthlyExpenses)}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                <strong className="text-rose-600 font-bold">{summary.expensePercentage}%</strong> of monthly income
              </div>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>+ Add Expense</span>
            <span className="text-rose-600 font-bold group-hover:underline">+ Spend →</span>
          </div>
        </div>

        {/* Card 4: Net Savings & Savings Rate */}
        <div 
          onClick={() => onNavigateToSubTab('reports')}
          className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:border-indigo-500/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Net Savings
              </span>
              <div className="p-2 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-indigo-700 tracking-tight">
                {formatCurrency(summary.netSavings)}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                <strong className="text-emerald-700 font-bold">{summary.savingsRate}%</strong> Savings Rate
              </div>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Financial Target</span>
            <span className="text-indigo-700 font-bold group-hover:underline">Reports →</span>
          </div>
        </div>
      </div>

      {/* 2. PROMINENT QUICK ACTIONS BAR */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-4 sm:p-5 text-white shadow-lg shadow-emerald-700/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Voice Entry Button */}
        <button
          onClick={onOpenVoiceModal}
          className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-white text-emerald-800 font-black text-sm flex items-center justify-center gap-2.5 shadow-md hover:bg-emerald-50 active:scale-95 transition-all transform"
        >
          <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Mic className="w-4 h-4" />
          </div>
          <span>🎙️ Add by Voice (Urdu / English)</span>
        </button>

        {/* Quick Buttons: Expense, Income, Transfer */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => onOpenAddModal('expense')}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Expense</span>
          </button>

          <button
            onClick={() => onOpenAddModal('income')}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Income</span>
          </button>

          <button
            onClick={() => onOpenAddModal('transfer')}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transfer</span>
          </button>
        </div>
      </div>

      {/* 3. SMART QUICK TEXT ENTRY BAR */}
      <SmartQuickEntryBar 
        onOpenVoiceModal={onOpenVoiceModal}
        onTransactionSaved={() => {}}
      />

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
            <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-slate-50 border-4 border-emerald-500 shadow-inner">
              <span className="text-2xl font-black text-slate-900">{healthScore.score}</span>
              <span className="text-[10px] text-slate-400 absolute bottom-2">/ 100</span>
            </div>

            <div className="flex-1 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Savings Rate:</span>
                <strong className="text-slate-800">{healthScore.savingsRate}%</strong>
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

        {/* AI Financial Insights */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="font-black text-slate-800 text-sm">AI Financial Insights</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">
              Live Data Analysis
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
                Log a few more daily transactions to generate intelligent AI observations!
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400">Personalized to your spending habits</span>
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
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-slate-800">
                        <span>{cat.icon}</span>
                        <span>{cat.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-2 font-black">
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
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span>{b.icon}</span>
                        <span>{b.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-2">
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
                        style={{ width: `${Math.min(100, b.percentage)}%` }}
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
                    <div
                      key={tx.id}
                      onClick={() => onSelectTransactionToEdit(tx)}
                      className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-base ${
                          isIncome 
                            ? 'bg-teal-50 text-teal-700' 
                            : isTransfer 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {isIncome ? '💵' : isTransfer ? '⇄' : '🛍️'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">
                            {tx.description || tx.categoryName}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
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

                      <div className={`text-xs sm:text-sm font-black ${
                        isIncome ? 'text-teal-700' : isTransfer ? 'text-blue-700' : 'text-slate-900'
                      }`}>
                        {isIncome ? '+' : isTransfer ? '⇄ ' : '-'}
                        {formatCurrency(tx.amount)}
                      </div>
                    </div>
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

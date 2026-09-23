import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  formatCurrency, 
  formatDate 
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
  Sparkles, 
  TrendingUp, 
  TrendingDown,
  ArrowRight, 
  ShieldCheck, 
  PieChart, 
  Target
} from 'lucide-react';
import { SmartQuickEntryBar } from './SmartQuickEntryBar';
import { FinanceTransaction, FinanceTransactionType } from '../../types';

interface FinanceOverviewProps {
  selectedMonth: string; // YYYY-MM
  onOpenVoiceModal: () => void;
  onOpenAddModal: (type?: FinanceTransactionType) => void;
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

  const isNetPositive = summary.netSavings >= 0;

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-300">
      {/* 1. TOP OVERVIEW HERO METRICS (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Selected Month Cash Flow */}
        <div className="bg-[#0B1D2C] rounded-2xl p-5 border border-[rgba(70,150,180,0.18)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F899B]">
                This Month's Cash Flow
              </span>
              <div className={`p-1.5 rounded-xl border ${
                isNetPositive 
                  ? 'bg-[rgba(20,230,170,0.12)] text-[#14E6AA] border-[rgba(20,230,170,0.25)]' 
                  : 'bg-[rgba(255,98,123,0.12)] text-[#FF627B] border-[rgba(255,98,123,0.25)]'
              }`}>
                {isNetPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>

            <div className="mt-2.5">
              <div className={`text-2xl sm:text-[28px] font-extrabold tracking-tight tabular-nums ${
                isNetPositive ? 'text-[#14E6AA]' : 'text-[#FF627B]'
              }`}>
                {isNetPositive ? '+' : ''}{formatCurrency(summary.netSavings)}
              </div>
              <div className="flex items-center gap-1.5 text-xs mt-1 text-[#A9BDCC]">
                <span className={`font-semibold ${isNetPositive ? 'text-[#14E6AA]' : 'text-[#FF627B]'}`}>
                  {isNetPositive ? 'Surplus this month' : 'Shortfall this month'}
                </span>
                {summary.monthlyIncome > 0 && (
                  <span className="text-[#6F899B]">· {summary.savingsRate}% of income</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[rgba(70,150,180,0.12)] flex items-center justify-between text-xs text-[#6F899B]">
            <span>Income: <strong className="text-[#14E6AA]">{formatCurrency(summary.monthlyIncome)}</strong></span>
            <span>Expenses: <strong className="text-[#FF627B]">{formatCurrency(summary.monthlyExpenses)}</strong></span>
          </div>
        </div>

        {/* Card 2: Current Liquid Assets / Balance */}
        <button 
          type="button"
          onClick={() => onNavigateToSubTab('accounts')}
          className="text-left bg-[#0B1D2C] rounded-2xl p-5 border border-[rgba(70,150,180,0.18)] hover:border-[rgba(55,210,190,0.35)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#18E6BE]"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F899B]">
                Current Balance
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#102638] border border-[rgba(70,150,180,0.2)] flex items-center justify-center text-[#18E6BE] group-hover:bg-[#18E6BE] group-hover:text-[#06131F] transition-colors">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl sm:text-[28px] font-extrabold text-[#F4F8FB] tracking-tight tabular-nums">
                {formatCurrency(summary.totalLiquidBalance)}
              </div>
              <div className="text-xs text-[#6F899B] mt-1">
                {accounts.filter(a => a.isActive).length} active accounts
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[rgba(70,150,180,0.12)] flex items-center justify-between text-xs text-[#18E6BE] font-bold group-hover:underline">
            <span>View accounts</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Card 3: Monthly Income */}
        <button 
          type="button"
          onClick={() => onOpenAddModal('income')}
          className="text-left bg-[#0B1D2C] rounded-2xl p-5 border border-[rgba(70,150,180,0.18)] hover:border-[rgba(20,230,170,0.35)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14E6AA]"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F899B]">
                Monthly Income
              </span>
              <div className="w-8 h-8 rounded-xl bg-[rgba(20,230,170,0.12)] border border-[rgba(20,230,170,0.25)] flex items-center justify-center text-[#14E6AA]">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl sm:text-[28px] font-extrabold text-[#14E6AA] tracking-tight tabular-nums">
                {formatCurrency(summary.monthlyIncome)}
              </div>
              <div className="text-xs text-[#6F899B] mt-1">
                {summary.selectedMonth} incoming
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[rgba(70,150,180,0.12)] flex items-center justify-between text-xs text-[#14E6AA] font-bold group-hover:underline">
            <span>Add income</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Card 4: Monthly Expenses */}
        <button 
          type="button"
          onClick={() => onNavigateToSubTab('budgets')}
          className="text-left bg-[#0B1D2C] rounded-2xl p-5 border border-[rgba(70,150,180,0.18)] hover:border-[rgba(255,98,123,0.35)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF627B]"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F899B]">
                Monthly Expenses
              </span>
              <div className="w-8 h-8 rounded-xl bg-[rgba(255,98,123,0.12)] border border-[rgba(255,98,123,0.25)] flex items-center justify-center text-[#FF627B]">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl sm:text-[28px] font-extrabold text-[#FF627B] tracking-tight tabular-nums">
                {formatCurrency(summary.monthlyExpenses)}
              </div>
              <div className="text-xs text-[#6F899B] mt-1">
                <strong className="text-[#FF627B] font-bold">{summary.expensePercentage}%</strong> of income
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[rgba(70,150,180,0.12)] flex items-center justify-between text-xs text-[#FF627B] font-bold group-hover:underline">
            <span>View budgets</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>

      {/* 2. RECORD A TRANSACTION (Quick Entry Bar) */}
      <SmartQuickEntryBar 
        onOpenVoiceModal={onOpenVoiceModal}
        onOpenAddModal={onOpenAddModal}
        onTransactionSaved={() => {}}
      />

      {/* 3. FINANCIAL HEALTH, INSIGHTS & SAVINGS GOALS ROW (3 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Column 1: Financial Health Score (4 cols) */}
        <div className="lg:col-span-4 bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] p-5 flex flex-col justify-between shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between border-b border-[rgba(70,150,180,0.12)] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#18E6BE]" />
              <h3 className="font-bold text-sm sm:text-base text-[#F4F8FB]">
                Financial Health Score
              </h3>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
              healthScore.grade === 'Excellent'
                ? 'bg-[rgba(20,230,170,0.12)] text-[#14E6AA] border-[rgba(20,230,170,0.28)]'
                : healthScore.grade === 'Good'
                ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE] border-[rgba(24,230,190,0.28)]'
                : 'bg-[rgba(247,183,51,0.12)] text-[#F7B733] border-[rgba(247,183,51,0.28)]'
            }`}>
              {healthScore.grade}
            </span>
          </div>

          <div className="flex items-center gap-5 my-2">
            {/* Circular Gauge */}
            <div 
              className="relative w-20 h-20 shrink-0 flex items-center justify-center"
              role="progressbar" 
              aria-label="Financial health score" 
              aria-valuenow={healthScore.score} 
              aria-valuemin={0} 
              aria-valuemax={100}
            >
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#102638"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#18E6BE"
                  strokeWidth="10"
                  strokeDasharray={`${(healthScore.score / 100) * 251.2} 251.2`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-[#F4F8FB] tracking-tight">{healthScore.score}</span>
              </div>
            </div>

            {/* Metrics List */}
            <div className="flex-1 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-[#A9BDCC]">
                <span>Savings Rate:</span>
                <strong className={`font-bold ${healthScore.savingsRate < 0 ? 'text-[#FF627B]' : 'text-[#14E6AA]'}`}>
                  {healthScore.savingsRate}%
                </strong>
              </div>
              <div className="flex justify-between items-center text-[#A9BDCC]">
                <span>Budget Adherence:</span>
                <strong className="text-[#F4F8FB] font-bold">{healthScore.budgetAdherenceRate}%</strong>
              </div>
              <div className="flex justify-between items-center text-[#A9BDCC]">
                <span>Expense Ratio:</span>
                <strong className={healthScore.expenseToIncomeRatio > 100 ? 'text-[#FF627B]' : 'text-[#F4F8FB]'}>
                  {healthScore.expenseToIncomeRatio}%
                </strong>
              </div>
            </div>
          </div>

          <div className="mt-3 bg-[#091A28] p-2.5 rounded-xl border border-[rgba(70,150,180,0.15)] text-[11px] text-[#A9BDCC] leading-relaxed">
            💡 {healthScore.recommendations[0] || "You're doing well! Try to save at least 20% of your income."}
          </div>
        </div>

        {/* Column 2: Spending Insights (4 cols) */}
        <div className="lg:col-span-4 bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] p-5 flex flex-col justify-between shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between border-b border-[rgba(70,150,180,0.12)] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#F7B733]" />
              <h3 className="font-bold text-sm sm:text-base text-[#F4F8FB]">
                Spending Insights
              </h3>
            </div>
            <button
              onClick={() => onNavigateToSubTab('reports')}
              className="text-xs font-semibold text-[#18E6BE] hover:underline"
            >
              View All
            </button>
          </div>

          <div className="space-y-2.5 my-auto py-1">
            {aiInsights.length > 0 ? (
              aiInsights.slice(0, 2).map((insight) => (
                <div
                  key={insight.id}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    insight.type === 'increase' || insight.type === 'budget_warning'
                      ? 'bg-[rgba(255,98,123,0.08)] border-[rgba(255,98,123,0.25)] text-[#F4F8FB]'
                      : insight.type === 'achievement'
                      ? 'bg-[rgba(20,230,170,0.08)] border-[rgba(20,230,170,0.25)] text-[#F4F8FB]'
                      : 'bg-[#102638] border-[rgba(70,150,180,0.2)] text-[#F4F8FB]'
                  }`}
                >
                  <span className="text-base shrink-0">{insight.icon || '💡'}</span>
                  <div className="flex-1">
                    <div className="font-bold">{insight.title}</div>
                    <p className="text-[11px] text-[#A9BDCC] mt-0.5 leading-snug">{insight.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-[#6F899B] bg-[#091A28] rounded-xl border border-[rgba(70,150,180,0.14)]">
                Spending habits are currently within standard targets.
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-[rgba(70,150,180,0.12)] flex items-center justify-between text-xs text-[#6F899B]">
            <span>Personalized from real data</span>
            <button
              onClick={() => onNavigateToSubTab('reports')}
              className="text-[#18E6BE] font-bold hover:underline"
            >
              Reports →
            </button>
          </div>
        </div>

        {/* Column 3: Savings Goals (4 cols) */}
        <div className="lg:col-span-4 bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] p-5 flex flex-col justify-between shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between border-b border-[rgba(70,150,180,0.12)] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#18E6BE]" />
              <h3 className="font-bold text-sm sm:text-base text-[#F4F8FB]">
                Savings Goals
              </h3>
            </div>
            <button
              onClick={() => onNavigateToSubTab('goals')}
              className="text-xs font-semibold text-[#18E6BE] hover:underline"
            >
              See All →
            </button>
          </div>

          <div className="space-y-3 my-auto py-1">
            {goals.filter(g => g.status === 'in_progress').length > 0 ? (
              goals.filter(g => g.status === 'in_progress').slice(0, 2).map(goal => {
                const percent = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0;
                return (
                  <div key={goal.id} className="p-3 bg-[#102638] rounded-xl border border-[rgba(70,150,180,0.18)] space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-[#F4F8FB]">
                      <span>{goal.icon || '🎯'} {goal.name}</span>
                      <span className="text-[#18E6BE]">{percent}%</span>
                    </div>
                    <div className="w-full bg-[#091A28] h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#059669] to-[#18E6BE] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#6F899B]">
                      <span>{formatCurrency(goal.currentAmount)}</span>
                      <span>Target: {formatCurrency(goal.targetAmount)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-[#6F899B] bg-[#091A28] rounded-xl border border-[rgba(70,150,180,0.14)]">
                No active savings goals yet.
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-[rgba(70,150,180,0.12)]">
            <button
              onClick={() => onNavigateToSubTab('goals')}
              className="w-full py-2 bg-[#102638] hover:bg-[#122B3E] text-[#18E6BE] border border-[rgba(24,230,190,0.2)] rounded-xl text-xs font-bold transition-all text-center"
            >
              + Add Goal / Contribute
            </button>
          </div>
        </div>
      </div>

      {/* 4. LOWER ROW: SPENDING BY CATEGORY & RECENT TRANSACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Spending by Category (6 cols) */}
        <div className="lg:col-span-6 bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] p-5 flex flex-col justify-between shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div>
            <div className="flex items-center justify-between border-b border-[rgba(70,150,180,0.12)] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-[#18E6BE]" />
                <h3 className="font-bold text-sm sm:text-base text-[#F4F8FB]">
                  Spending by Category
                </h3>
              </div>
              <button
                onClick={() => onNavigateToSubTab('categories')}
                className="text-xs font-semibold text-[#18E6BE] hover:underline"
              >
                Categories →
              </button>
            </div>

            <div className="space-y-3.5">
              {categorySpending.length > 0 ? (
                categorySpending.slice(0, 5).map(cat => (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-[#F4F8FB]">
                        <span>{cat.icon}</span>
                        <span>{cat.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-2 font-extrabold tabular-nums">
                        <span className="text-[#F4F8FB]">{formatCurrency(cat.totalAmount)}</span>
                        <span className="text-[10px] text-[#6F899B] font-normal">({cat.percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-[#091A28] h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${cat.percentage}%`, backgroundColor: cat.color || '#18E6BE' }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#6F899B]">
                  No expenses recorded for this month yet.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-[rgba(70,150,180,0.12)] flex items-center justify-between text-xs text-[#6F899B]">
            <span>Total Expense: <strong className="text-[#FF627B]">{formatCurrency(summary.monthlyExpenses)}</strong></span>
            <button
              onClick={() => onNavigateToSubTab('transactions')}
              className="text-[#18E6BE] font-bold hover:underline"
            >
              View Transactions →
            </button>
          </div>
        </div>

        {/* Recent Transactions (6 cols) */}
        <div className="lg:col-span-6 bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] p-5 flex flex-col justify-between shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div>
            <div className="flex items-center justify-between border-b border-[rgba(70,150,180,0.12)] pb-3 mb-3">
              <h3 className="font-bold text-sm sm:text-base text-[#F4F8FB]">
                Recent Transactions
              </h3>
              <button
                onClick={() => onNavigateToSubTab('transactions')}
                className="text-xs font-semibold text-[#18E6BE] hover:underline flex items-center gap-1"
              >
                <span>View All ({summary.transactionCount})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-[rgba(70,150,180,0.1)]">
              {recentTransactions.length > 0 ? (
                recentTransactions.map(tx => {
                  const isIncome = tx.transactionType === 'income';
                  const isTransfer = tx.transactionType === 'transfer';

                  return (
                    <button
                      type="button"
                      key={tx.id}
                      onClick={() => onSelectTransactionToEdit(tx)}
                      className="w-full text-left py-2.5 flex items-center justify-between gap-3 hover:bg-[#102638] px-2 rounded-xl cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#18E6BE]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-sm border ${
                          isIncome 
                            ? 'bg-[rgba(20,230,170,0.12)] text-[#14E6AA] border-[rgba(20,230,170,0.25)]' 
                            : isTransfer 
                            ? 'bg-[rgba(57,175,255,0.12)] text-[#39AFFF] border-[rgba(57,175,255,0.25)]' 
                            : 'bg-[rgba(255,98,123,0.12)] text-[#FF627B] border-[rgba(255,98,123,0.25)]'
                        }`}>
                          {isIncome ? '💵' : isTransfer ? '⇄' : '🛍️'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-[#F4F8FB] truncate">
                            {tx.description || tx.categoryName}
                          </div>
                          <div className="flex items-center flex-wrap gap-x-1.5 text-[10px] text-[#6F899B]">
                            <span>{tx.categoryName || 'General'}</span>
                            <span>•</span>
                            <span>{tx.accountName || 'Cash'}</span>
                            <span>•</span>
                            <span>{formatDate(tx.transactionDate, 'short')}</span>
                            {tx.source === 'voice' && (
                              <span className="text-[#18E6BE] font-bold">🎙️ Voice</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={`text-xs sm:text-sm font-extrabold shrink-0 tabular-nums ${
                        isIncome ? 'text-[#14E6AA]' : isTransfer ? 'text-[#39AFFF]' : 'text-[#FF627B]'
                      }`}>
                        {isIncome ? '+' : isTransfer ? '⇄ ' : '-'}{formatCurrency(tx.amount)}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-[#6F899B]">
                  No transactions recorded for this month yet.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-[rgba(70,150,180,0.12)] flex items-center justify-between">
            <span className="text-xs text-[#6F899B]">Click any transaction to edit</span>
            <button
              onClick={() => onOpenAddModal('expense')}
              className="text-xs font-bold text-[#18E6BE] hover:underline"
            >
              + New Transaction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

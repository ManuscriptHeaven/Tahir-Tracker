import { 
  FinanceAccount, 
  FinanceTransaction, 
  FinanceCategory, 
  FinanceBudget, 
  FinanceRecurringTransaction, 
  FinancialInsight, 
  FinancialHealthScore 
} from '../types';

/**
 * Calculates current balance for all accounts based on their opening balance
 * plus/minus all executed transactions.
 * Formula: Opening Balance + Total Income - Total Expenses + Incoming Transfers - Outgoing Transfers
 */
export function calculateAccountBalances(
  accounts: FinanceAccount[],
  transactions: FinanceTransaction[]
): Map<string, number> {
  const balanceMap = new Map<string, number>();

  // Initialize with opening balance
  accounts.forEach(acc => {
    balanceMap.set(acc.id, acc.openingBalance || 0);
  });

  // Apply all completed transactions
  transactions.forEach(tx => {
    if (tx.status === 'cancelled') return;

    const amount = Number(tx.amount) || 0;

    if (tx.transactionType === 'income') {
      const current = balanceMap.get(tx.accountId) ?? 0;
      balanceMap.set(tx.accountId, current + amount);
    } else if (tx.transactionType === 'expense') {
      const current = balanceMap.get(tx.accountId) ?? 0;
      if (accounts.find(a => a.id === tx.accountId)?.accountType === 'credit_card') {
        // For credit card, an expense increases outstanding balance (or decreases negative balance)
        balanceMap.set(tx.accountId, current - amount);
      } else {
        balanceMap.set(tx.accountId, current - amount);
      }
    } else if (tx.transactionType === 'transfer') {
      // Source account loses money
      const sourceBal = balanceMap.get(tx.accountId) ?? 0;
      balanceMap.set(tx.accountId, sourceBal - amount);

      // Destination account gains money
      if (tx.transferToAccountId) {
        const destBal = balanceMap.get(tx.transferToAccountId) ?? 0;
        balanceMap.set(tx.transferToAccountId, destBal + amount);
      }
    }
  });

  return balanceMap;
}

/**
 * Computes monthly financial totals, savings rate, and month-over-month comparisons
 */
export function getMonthlyFinanceSummary(
  transactions: FinanceTransaction[],
  selectedMonth: string, // YYYY-MM
  accountBalances: Map<string, number>,
  accounts: FinanceAccount[]
) {
  // Current month transactions
  const currentMonthTx = transactions.filter(
    tx => tx.transactionDate.startsWith(selectedMonth) && tx.status !== 'cancelled'
  );

  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let transferVolume = 0;

  currentMonthTx.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    if (tx.transactionType === 'income') {
      monthlyIncome += amt;
    } else if (tx.transactionType === 'expense') {
      monthlyExpenses += amt;
    } else if (tx.transactionType === 'transfer') {
      transferVolume += amt;
    }
  });

  const netSavings = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? Math.round((netSavings / monthlyIncome) * 100) : 0;
  const expensePercentage = monthlyIncome > 0 ? Math.round((monthlyExpenses / monthlyIncome) * 100) : 0;

  // Total balance: sum of liquid assets (Cash, Bank, Wallet, Savings minus Credit card debt)
  let totalLiquidBalance = 0;
  let totalNetWorth = 0;

  accounts.forEach(acc => {
    const bal = accountBalances.get(acc.id) ?? acc.openingBalance ?? 0;
    totalNetWorth += bal;
    if (acc.accountType !== 'credit_card') {
      totalLiquidBalance += Math.max(0, bal);
    }
  });

  // Calculate previous month comparison
  const [year, month] = selectedMonth.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
  
  const prevMonthTx = transactions.filter(
    tx => tx.transactionDate.startsWith(prevMonthStr) && tx.status !== 'cancelled'
  );

  let prevIncome = 0;
  let prevExpenses = 0;
  prevMonthTx.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    if (tx.transactionType === 'income') prevIncome += amt;
    if (tx.transactionType === 'expense') prevExpenses += amt;
  });

  const incomeDifference = monthlyIncome - prevIncome;
  const expenseDifference = monthlyExpenses - prevExpenses;
  const prevSavingsRate = prevIncome > 0 ? Math.round(((prevIncome - prevExpenses) / prevIncome) * 100) : 0;
  const savingsRateDifference = savingsRate - prevSavingsRate;

  return {
    selectedMonth,
    monthlyIncome,
    monthlyExpenses,
    netSavings,
    savingsRate,
    expensePercentage,
    totalLiquidBalance,
    totalNetWorth,
    transferVolume,
    transactionCount: currentMonthTx.length,
    prevMonthStr,
    prevIncome,
    prevExpenses,
    incomeDifference,
    expenseDifference,
    savingsRateDifference
  };
}

/**
 * Breakdown of monthly spending grouped by Category with percentage
 */
export interface CategorySpendingItem {
  categoryId: string;
  categoryName: string;
  icon: string;
  color: string;
  totalAmount: number;
  percentage: number;
  transactionCount: number;
}

export function getCategorySpendingBreakdown(
  transactions: FinanceTransaction[],
  categories: FinanceCategory[],
  selectedMonth: string
): CategorySpendingItem[] {
  const categoryMap = new Map<string, FinanceCategory>();
  categories.forEach(c => categoryMap.set(c.id, c));

  const monthExpenses = transactions.filter(
    tx => tx.transactionDate.startsWith(selectedMonth) && 
          tx.transactionType === 'expense' && 
          tx.status !== 'cancelled'
  );

  const totalExpense = monthExpenses.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const spendingByCat = new Map<string, { amount: number; count: number }>();

  monthExpenses.forEach(tx => {
    const catId = tx.categoryId || 'cat_other_exp';
    const current = spendingByCat.get(catId) || { amount: 0, count: 0 };
    spendingByCat.set(catId, {
      amount: current.amount + (Number(tx.amount) || 0),
      count: current.count + 1
    });
  });

  const results: CategorySpendingItem[] = [];

  spendingByCat.forEach((data, catId) => {
    const category = categoryMap.get(catId);
    const categoryName = category?.name || txCategoryFallbackName(catId);
    const icon = category?.icon || '📦';
    const color = category?.color || '#64748b';
    const percentage = totalExpense > 0 ? Math.round((data.amount / totalExpense) * 100) : 0;

    results.push({
      categoryId: catId,
      categoryName,
      icon,
      color,
      totalAmount: data.amount,
      percentage,
      transactionCount: data.count
    });
  });

  // Sort descending by amount
  return results.sort((a, b) => b.totalAmount - a.totalAmount);
}

function txCategoryFallbackName(catId: string): string {
  if (catId === 'cat_food') return 'Food & Dining';
  if (catId === 'cat_groceries') return 'Groceries';
  if (catId === 'cat_transport') return 'Transportation';
  if (catId === 'cat_home') return 'Home & Housing';
  if (catId === 'cat_utilities') return 'Bills & Utilities';
  if (catId === 'cat_shopping') return 'Shopping';
  if (catId === 'cat_entertainment') return 'Entertainment';
  if (catId === 'cat_health') return 'Health & Fitness';
  return 'Other Expense';
}

/**
 * Budget Progress and Status for each active budget
 */
export interface BudgetProgressItem {
  budget: FinanceBudget;
  categoryName: string;
  icon: string;
  color: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  status: 'normal' | 'warning' | 'critical' | 'exceeded';
}

export function getBudgetAdherence(
  budgets: FinanceBudget[],
  transactions: FinanceTransaction[],
  categories: FinanceCategory[],
  selectedMonth: string
): BudgetProgressItem[] {
  const categorySpending = getCategorySpendingBreakdown(transactions, categories, selectedMonth);
  const spendingMap = new Map<string, number>();
  categorySpending.forEach(item => spendingMap.set(item.categoryId, item.totalAmount));

  const totalExpense = transactions
    .filter(tx => tx.transactionDate.startsWith(selectedMonth) && tx.transactionType === 'expense' && tx.status !== 'cancelled')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const categoryMap = new Map<string, FinanceCategory>();
  categories.forEach(c => categoryMap.set(c.id, c));

  return budgets
    .filter(b => b.isActive)
    .map(budget => {
      const isOverall = !budget.categoryId;
      const spent = isOverall ? totalExpense : (spendingMap.get(budget.categoryId!) || 0);
      const category = budget.categoryId ? categoryMap.get(budget.categoryId) : undefined;
      const categoryName = budget.categoryName || category?.name || (isOverall ? 'Total Monthly Budget' : 'General Budget');
      const icon = category?.icon || (isOverall ? '🎯' : '📊');
      const color = category?.color || '#10b981';

      const percentage = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
      const remainingAmount = budget.amount - spent;

      let status: 'normal' | 'warning' | 'critical' | 'exceeded' = 'normal';
      if (percentage >= 100) {
        status = 'exceeded';
      } else if (percentage >= (budget.alertThreshold || 90)) {
        status = 'critical';
      } else if (percentage >= 70) {
        status = 'warning';
      }

      return {
        budget,
        categoryName,
        icon,
        color,
        budgetAmount: budget.amount,
        spentAmount: spent,
        remainingAmount,
        percentage,
        status
      };
    });
}

/**
 * Calculates a comprehensive Financial Health Score (0 - 100)
 */
export function calculateFinancialHealthScore(
  monthlyIncome: number,
  monthlyExpenses: number,
  savingsRate: number,
  budgets: BudgetProgressItem[],
  totalLiquidSavings: number
): FinancialHealthScore {
  let score = 0;
  const factors: FinancialHealthScore['factors'] = [];
  const recommendations: string[] = [];

  // Factor 1: Savings Rate (Max 35 points)
  let savingsScore = 0;
  if (savingsRate >= 50) savingsScore = 35;
  else if (savingsRate >= 30) savingsScore = 28;
  else if (savingsRate >= 20) savingsScore = 20;
  else if (savingsRate >= 10) savingsScore = 12;
  else if (savingsRate > 0) savingsScore = 5;
  else savingsScore = 0;

  score += savingsScore;
  factors.push({
    label: 'Savings Rate',
    score: savingsScore,
    maxScore: 35,
    impact: savingsScore >= 20 ? 'positive' : savingsScore >= 10 ? 'neutral' : 'negative',
    description: `Current savings rate is ${savingsRate}%. Target standard is >20% for strong financial stability.`
  });

  if (savingsRate < 20) {
    recommendations.push('Try to save at least 20% of your total monthly income.');
  }

  // Factor 2: Budget Discipline (Max 25 points)
  let budgetScore = 25;
  const exceededCount = budgets.filter(b => b.status === 'exceeded').length;
  const criticalCount = budgets.filter(b => b.status === 'critical').length;

  if (exceededCount > 0) {
    budgetScore = Math.max(5, 25 - exceededCount * 8 - criticalCount * 4);
  } else if (criticalCount > 0) {
    budgetScore = Math.max(15, 25 - criticalCount * 5);
  }

  score += budgetScore;
  factors.push({
    label: 'Budget Discipline',
    score: budgetScore,
    maxScore: 25,
    impact: budgetScore >= 20 ? 'positive' : budgetScore >= 15 ? 'neutral' : 'negative',
    description: exceededCount > 0 
      ? `${exceededCount} categories exceeded their monthly budget limit.` 
      : 'All spending categories are operating within planned limits.'
  });

  if (exceededCount > 0) {
    recommendations.push(`Review the ${exceededCount} exceeded budget categories to prevent cashflow drain.`);
  }

  // Factor 3: Expense to Income Ratio (Max 25 points)
  const expenseRatio = monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 100;
  let ratioScore = 0;
  if (expenseRatio <= 50) ratioScore = 25;
  else if (expenseRatio <= 70) ratioScore = 20;
  else if (expenseRatio <= 85) ratioScore = 12;
  else if (expenseRatio <= 95) ratioScore = 6;
  else ratioScore = 0;

  score += ratioScore;
  factors.push({
    label: 'Expense to Income Ratio',
    score: ratioScore,
    maxScore: 25,
    impact: ratioScore >= 20 ? 'positive' : ratioScore >= 12 ? 'neutral' : 'negative',
    description: `Spending accounts for ${Math.round(expenseRatio)}% of incoming revenue.`
  });

  // Factor 4: Emergency Reserve (Max 15 points)
  const monthlyBurn = monthlyExpenses || 50000;
  const emergencyMonths = monthlyBurn > 0 ? totalLiquidSavings / monthlyBurn : 0;
  let reserveScore = 0;
  if (emergencyMonths >= 6) reserveScore = 15;
  else if (emergencyMonths >= 3) reserveScore = 12;
  else if (emergencyMonths >= 1) reserveScore = 7;
  else reserveScore = 2;

  score += reserveScore;
  factors.push({
    label: 'Emergency Buffer',
    score: reserveScore,
    maxScore: 15,
    impact: reserveScore >= 12 ? 'positive' : reserveScore >= 7 ? 'neutral' : 'negative',
    description: `Liquid savings cover approximately ${emergencyMonths.toFixed(1)} months of living expenses.`
  });

  if (emergencyMonths < 3) {
    recommendations.push('Build at least a 3-month emergency reserve for unforeseen expenses.');
  }

  // Final Grade
  let grade: FinancialHealthScore['grade'] = 'Excellent';
  if (score >= 80) grade = 'Excellent';
  else if (score >= 65) grade = 'Good';
  else if (score >= 50) grade = 'Fair';
  else grade = 'Needs Attention';

  if (recommendations.length === 0) {
    recommendations.push('Great job! Maintain your balanced cash flow and consistent savings rate.');
  }

  return {
    score,
    grade,
    savingsRate,
    budgetAdherenceRate: budgets.length > 0 ? Math.round(((budgets.length - exceededCount) / budgets.length) * 100) : 100,
    expenseToIncomeRatio: Math.round(expenseRatio),
    factors,
    recommendations
  };
}

/**
 * Intelligent AI Financial Insights derived from transaction history
 */
export function generateAIFinancialInsights(
  transactions: FinanceTransaction[],
  categories: FinanceCategory[],
  budgets: BudgetProgressItem[],
  selectedMonth: string
): FinancialInsight[] {
  const insights: FinancialInsight[] = [];
  const currentCategoryBreakdown = getCategorySpendingBreakdown(transactions, categories, selectedMonth);

  // Month-over-month category surge detector
  const [year, month] = selectedMonth.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const prevCategoryBreakdown = getCategorySpendingBreakdown(transactions, categories, prevMonthStr);
  const prevMap = new Map<string, number>();
  prevCategoryBreakdown.forEach(item => prevMap.set(item.categoryId, item.totalAmount));

  currentCategoryBreakdown.forEach(item => {
    const prevAmt = prevMap.get(item.categoryId);
    if (prevAmt && prevAmt > 1000) {
      const diffPercent = Math.round(((item.totalAmount - prevAmt) / prevAmt) * 100);
      if (diffPercent >= 25) {
        insights.push({
          id: `surge_${item.categoryId}`,
          type: 'increase',
          title: `${item.categoryName} Expense Increased`,
          message: `Your ${item.categoryName.toLowerCase()} expenses increased by ${diffPercent}% compared to last month (Rs. ${item.totalAmount.toLocaleString()} vs Rs. ${prevAmt.toLocaleString()}).`,
          changePercent: diffPercent,
          category: item.categoryName,
          icon: '📈'
        });
      } else if (diffPercent <= -20) {
        insights.push({
          id: `drop_${item.categoryId}`,
          type: 'decrease',
          title: `Reduced ${item.categoryName} Spending`,
          message: `Great discipline! You reduced spending on ${item.categoryName.toLowerCase()} by ${Math.abs(diffPercent)}% this month.`,
          changePercent: diffPercent,
          category: item.categoryName,
          icon: '📉'
        });
      }
    }
  });

  // Top spending category observation
  if (currentCategoryBreakdown.length > 0) {
    const top = currentCategoryBreakdown[0];
    if (top.percentage >= 25) {
      insights.push({
        id: 'top_category',
        type: 'neutral',
        title: `Primary Expense: ${top.categoryName}`,
        message: `${top.categoryName} is your largest expense category this month, making up ${top.percentage}% (Rs. ${top.totalAmount.toLocaleString()}) of total spending.`,
        category: top.categoryName,
        icon: top.icon
      });
    }
  }

  // Budget warnings from adherence engine
  budgets.forEach(b => {
    if (b.status === 'exceeded') {
      insights.push({
        id: `budget_exceeded_${b.categoryName}`,
        type: 'budget_warning',
        title: `Budget Exceeded: ${b.categoryName}`,
        message: `Your ${b.categoryName} spending (Rs. ${b.spentAmount.toLocaleString()}) has exceeded the allocated monthly budget of Rs. ${b.budgetAmount.toLocaleString()}.`,
        category: b.categoryName,
        icon: '🚨'
      });
    } else if (b.status === 'critical') {
      insights.push({
        id: `budget_crit_${b.categoryName}`,
        type: 'budget_warning',
        title: `Budget Warning: ${b.categoryName}`,
        message: `You have consumed ${b.percentage}% of your ${b.categoryName} budget. Rs. ${b.remainingAmount.toLocaleString()} remaining.`,
        category: b.categoryName,
        icon: '⚠️'
      });
    }
  });

  // Savings rate achievement
  const currentMonthTx = transactions.filter(
    tx => tx.transactionDate.startsWith(selectedMonth) && tx.status !== 'cancelled'
  );
  let income = 0;
  let expenses = 0;
  currentMonthTx.forEach(tx => {
    if (tx.transactionType === 'income') income += Number(tx.amount) || 0;
    if (tx.transactionType === 'expense') expenses += Number(tx.amount) || 0;
  });

  if (income > 0) {
    const savingsRate = Math.round(((income - expenses) / income) * 100);
    if (savingsRate >= 40) {
      insights.push({
        id: 'savings_achievement',
        type: 'achievement',
        title: `Outstanding ${savingsRate}% Savings Rate!`,
        message: `You saved Rs. ${(income - expenses).toLocaleString()} out of Rs. ${income.toLocaleString()} income this month. Excellent financial health!`,
        icon: '🏆'
      });
    }
  }

  return insights;
}

/**
 * Checks which recurring transactions are currently due for execution
 */
export function getDueRecurringTransactions(
  recurringRules: FinanceRecurringTransaction[],
  referenceDate = new Date().toISOString().split('T')[0]
): FinanceRecurringTransaction[] {
  return recurringRules.filter(rule => {
    if (!rule.isActive) return false;
    return rule.nextRunDate <= referenceDate;
  });
}

/**
 * Calculates next run date based on frequency
 */
export function computeNextRunDate(currentDateStr: string, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'): string {
  const date = new Date(currentDateStr);
  if (frequency === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (frequency === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (frequency === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date.toISOString().split('T')[0];
}

/**
 * User categorization learning mechanism stored in localStorage
 */
const STORAGE_CATEGORY_LEARNING = 'tahir_tracker_category_learning';

export function saveLearnedCategoryKeyword(keyword: string, categoryId: string) {
  try {
    const normalized = keyword.toLowerCase().trim();
    if (!normalized || normalized.length < 3) return;
    const existing = JSON.parse(localStorage.getItem(STORAGE_CATEGORY_LEARNING) || '{}');
    existing[normalized] = categoryId;
    localStorage.setItem(STORAGE_CATEGORY_LEARNING, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed to save category learning:', e);
  }
}

export function getLearnedCategoryKeyword(query: string): string | undefined {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_CATEGORY_LEARNING) || '{}');
    const lowerQuery = query.toLowerCase();
    for (const [kw, catId] of Object.entries(existing)) {
      if (lowerQuery.includes(kw)) {
        return catId as string;
      }
    }
  } catch (e) {
    console.warn('Failed to get learned category:', e);
  }
  return undefined;
}

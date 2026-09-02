export type FinanceAccountType =
  | 'cash'
  | 'bank'
  | 'digital_wallet'
  | 'credit_card'
  | 'savings'
  | 'investment'
  | 'other';

export type FinanceTransactionType = 'expense' | 'income' | 'transfer';

export type FinanceTransactionSource = 'manual' | 'voice' | 'text_ai' | 'recurring' | 'import';

export type FinanceBudgetPeriod = 'monthly' | 'yearly';

export type FinanceRecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface FinanceAccount {
  id: string;
  name: string;
  accountType: FinanceAccountType;
  openingBalance: number;
  currentBalance?: number; // Computed or cached
  currency: string; // e.g. 'PKR'
  isActive: boolean;
  notes?: string;
  accountNumber?: string;
  institution?: string; // e.g. 'HBL', 'Meezan', 'Easypaisa', 'JazzCash'
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceCategory {
  id: string;
  name: string;
  type: 'expense' | 'income';
  parentCategoryId?: string; // For subcategories e.g. Restaurants under Food & Dining
  icon: string; // Emoji or Lucide icon name
  color?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceTransaction {
  id: string;
  transactionType: FinanceTransactionType;
  amount: number;
  currency: string; // 'PKR'
  categoryId?: string;
  categoryName?: string;
  accountId: string; // Source account (or from-account for transfer)
  accountName?: string;
  transferToAccountId?: string; // Destination account for transfer
  transferToAccountName?: string;
  transactionDate: string; // YYYY-MM-DD
  description: string;
  source: FinanceTransactionSource;
  status: 'completed' | 'pending' | 'cancelled';
  attachmentNote?: string;
  rawVoiceTranscript?: string;
  confidenceScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceBudget {
  id: string;
  categoryId?: string; // undefined means overall total budget
  categoryName?: string;
  amount: number;
  period: FinanceBudgetPeriod;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  alertThreshold: number; // e.g. 80 (80%)
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceRecurringTransaction {
  id: string;
  title: string;
  transactionType: FinanceTransactionType;
  amount: number;
  categoryId?: string;
  accountId: string;
  transferToAccountId?: string;
  description?: string;
  frequency: FinanceRecurringFrequency;
  startDate: string; // YYYY-MM-DD
  nextRunDate: string; // YYYY-MM-DD
  endDate?: string;
  autoProcess: boolean; // if true auto-executes, if false prompts user for confirmation
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string; // YYYY-MM-DD
  status: 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceVoiceEntry {
  id: string;
  audioUrl?: string;
  transcript: string;
  parsedData: Record<string, any>;
  confidenceScore: number;
  status: 'processing' | 'pending_confirmation' | 'confirmed' | 'cancelled' | 'failed';
  transactionId?: string;
  createdAt: string;
}

export interface ParsedVoiceTransaction {
  transaction_type: FinanceTransactionType;
  amount: number;
  currency: string;
  category: string;
  categoryId?: string;
  subcategory?: string;
  account: string;
  accountId?: string;
  transfer_to_account?: string;
  transfer_to_account_id?: string;
  transaction_date: string; // YYYY-MM-DD
  description: string;
  confidence: number;
  notes?: string;
  matchedFields?: {
    amount: boolean;
    category: boolean;
    account: boolean;
    date: boolean;
    type: boolean;
  };
}

export interface FinancialInsight {
  id: string;
  type: 'increase' | 'decrease' | 'saving_tip' | 'budget_warning' | 'achievement' | 'neutral';
  title: string;
  message: string;
  metric?: string;
  changePercent?: number;
  category?: string;
  icon?: string;
}

export interface FinancialHealthScore {
  score: number; // 0 - 100
  grade: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
  savingsRate: number; // percentage
  budgetAdherenceRate: number; // percentage
  expenseToIncomeRatio: number; // percentage
  factors: {
    label: string;
    score: number;
    maxScore: number;
    impact: 'positive' | 'neutral' | 'negative';
    description: string;
  }[];
  recommendations: string[];
}

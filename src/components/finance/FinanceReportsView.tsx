import React, { useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  Download,
  Printer,
  PieChart, 
  TrendingUp, 
  Sparkles 
} from 'lucide-react';
import { 
  calculateAccountBalances, 
  getMonthlyFinanceSummary, 
  getCategorySpendingBreakdown, 
  getBudgetAdherence, 
  generateAIFinancialInsights 
} from '../../services/financeService';
import { formatCurrency } from '../../utils/formatters';
import { exportElementAsPng } from '../../utils/exportImage';

interface FinanceReportsViewProps {
  selectedMonth: string; // YYYY-MM
  setSelectedMonth: (m: string) => void;
}

export const FinanceReportsView: React.FC<FinanceReportsViewProps> = ({
  selectedMonth,
  setSelectedMonth
}) => {
  const accounts = useLiveQuery(() => db.finance_accounts.toArray()) || [];
  const categories = useLiveQuery(() => db.finance_categories.toArray()) || [];
  const transactions = useLiveQuery(() => db.finance_transactions.toArray()) || [];
  const budgets = useLiveQuery(() => db.finance_budgets.toArray()) || [];

  const reportRef = useRef<HTMLDivElement>(null);

  const accountBalances = calculateAccountBalances(accounts, transactions);
  const summary = getMonthlyFinanceSummary(transactions, selectedMonth, accountBalances, accounts);
  const categorySpending = getCategorySpendingBreakdown(transactions, categories, selectedMonth);
  const budgetAdherence = getBudgetAdherence(budgets, transactions, categories, selectedMonth);
  const aiInsights = generateAIFinancialInsights(transactions, categories, budgetAdherence, selectedMonth);

  // 6-Month Trend Data
  const trendMonths = (() => {
    const list: string[] = [];
    const [year, month] = selectedMonth.split('-').map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const mStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      list.push(mStr);
    }
    return list;
  })();

  const trendData = trendMonths.map(mStr => {
    const mTx = transactions.filter(tx => tx.transactionDate.startsWith(mStr) && tx.status !== 'cancelled');
    let inc = 0;
    let exp = 0;
    mTx.forEach(tx => {
      if (tx.transactionType === 'income') inc += Number(tx.amount) || 0;
      if (tx.transactionType === 'expense') exp += Number(tx.amount) || 0;
    });
    return {
      monthStr: mStr,
      income: inc,
      expense: exp,
      savings: inc - exp
    };
  });

  const maxTrendAmount = Math.max(...trendData.map(d => Math.max(d.income, d.expense)), 100000);

  const handleExportReport = async () => {
    if (!reportRef.current) return;
    await exportElementAsPng(reportRef.current, `Finance_Report_${selectedMonth}`);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="finance-reports-root space-y-6">
      {/* 1. REPORT CONTROLS HEADER */}
      <div className="bg-[#0B1D2C] rounded-2xl p-4 sm:p-5 border border-slate-700/50 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#102638] text-cyan-400 border border-cyan-500/20">
            <PieChart className="w-5 h-5 text-[#18E6BE]" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">
              Personal Financial Statement
            </h3>
            <p className="text-xs text-slate-400">
              Income, expense trends, category breakdown & insights for {selectedMonth}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
          <button
            onClick={handlePrintReport}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#102638] hover:bg-[#16344d] text-slate-100 border border-cyan-500/20 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleExportReport}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#18E6BE] hover:bg-[#23F2CB] active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-[#18E6BE]/20 transition-all"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Export Image Statement</span>
          </button>
        </div>
      </div>

      {/* 2. PRINTABLE REPORT CONTAINER */}
      <div ref={reportRef} className="finance-print-page report-document print-page space-y-6 bg-[#071724] p-3 sm:p-4 rounded-2xl border border-slate-800">
        {/* Monthly Summary Cards Banner */}
        <div className="bg-[#0B1D2C] rounded-2xl p-5 sm:p-6 border border-slate-700/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Statement Period</span>
              <h2 className="text-lg font-bold text-slate-100">{selectedMonth} Financial Summary</h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Savings Rate</span>
              <div className="text-lg font-bold text-[#18E6BE]">{summary.savingsRate}%</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-[#102638] rounded-xl border border-slate-700/40">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Income</span>
              <div className="text-base sm:text-lg font-bold text-teal-400 mt-1">
                {formatCurrency(summary.monthlyIncome)}
              </div>
            </div>

            <div className="p-3.5 bg-[#102638] rounded-xl border border-slate-700/40">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Expenses</span>
              <div className="text-base sm:text-lg font-bold text-rose-400 mt-1">
                {formatCurrency(summary.monthlyExpenses)}
              </div>
            </div>

            <div className="p-3.5 bg-[#102638] rounded-xl border border-slate-700/40">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Net Savings</span>
              <div className="text-base sm:text-lg font-bold text-cyan-400 mt-1">
                {formatCurrency(summary.netSavings)}
              </div>
            </div>

            <div className="p-3.5 bg-[#102638] rounded-xl border border-slate-700/40">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Liquidity</span>
              <div className="text-base sm:text-lg font-bold text-slate-100 mt-1">
                {formatCurrency(summary.totalLiquidBalance)}
              </div>
            </div>
          </div>
        </div>

        {/* 6-Month Spending & Income Trend Bar Visualization */}
        <div className="bg-[#0B1D2C] rounded-2xl p-5 sm:p-6 border border-slate-700/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                6-Month Financial Trend
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-teal-400"><span className="w-2.5 h-2.5 rounded-xs bg-teal-400 inline-block" /> Income</span>
              <span className="flex items-center gap-1.5 text-rose-400"><span className="w-2.5 h-2.5 rounded-xs bg-rose-400 inline-block" /> Expenses</span>
            </div>
          </div>

          <div className="pt-4 grid grid-cols-6 gap-2 sm:gap-4 items-end h-52">
            {trendData.map(d => {
              const incHeight = Math.max(8, (d.income / maxTrendAmount) * 100);
              const expHeight = Math.max(8, (d.expense / maxTrendAmount) * 100);
              const isSelected = d.monthStr === selectedMonth;

              return (
                <div key={d.monthStr} className="flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="flex items-end gap-1 sm:gap-2 h-full w-full justify-center">
                    {/* Income Bar */}
                    <div
                      style={{ height: `${incHeight}%` }}
                      className="w-3 sm:w-6 bg-teal-400/90 rounded-t-md transition-all group-hover:bg-teal-300 relative shadow-sm"
                      title={`Income: ${formatCurrency(d.income)}`}
                    />
                    {/* Expense Bar */}
                    <div
                      style={{ height: `${expHeight}%` }}
                      className="w-3 sm:w-6 bg-rose-400/90 rounded-t-md transition-all group-hover:bg-rose-300 relative shadow-sm"
                      title={`Expense: ${formatCurrency(d.expense)}`}
                    />
                  </div>
                  <button
                    onClick={() => setSelectedMonth(d.monthStr)}
                    className={`text-[10px] sm:text-xs font-semibold transition-all ${
                      isSelected ? 'text-cyan-400 underline font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d.monthStr.split('-')[1]}/{d.monthStr.split('-')[0].slice(2)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Spending Details Table */}
        <div className="bg-[#0B1D2C] rounded-2xl p-5 sm:p-6 border border-slate-700/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-slate-100 text-sm sm:text-base">
              Category Spending Breakdown
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {categorySpending.length} Categories
            </span>
          </div>

          <div className="divide-y divide-slate-800">
            {categorySpending.map(cat => (
              <div key={cat.categoryId} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#102638] flex items-center justify-center text-lg border border-slate-700/60">
                    {cat.icon}
                  </div>
                  <div>
                    <div className="font-bold text-slate-100 text-xs sm:text-sm">
                      {cat.categoryName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {cat.transactionCount} transactions • {cat.percentage}% of total
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-slate-100 text-xs sm:text-sm">
                    {formatCurrency(cat.totalAmount)}
                  </div>
                  <div className="w-20 sm:w-28 bg-[#071724] h-1.5 rounded-full mt-1.5 overflow-hidden ml-auto border border-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Financial Insights Section */}
        {aiInsights.length > 0 && (
          <div className="bg-[#0B1D2C] rounded-2xl p-5 sm:p-6 border border-slate-700/50 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                AI Observations & Strategic Recommendations
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {aiInsights.map(insight => (
                <div
                  key={insight.id}
                  className="p-3.5 rounded-xl bg-[#102638] border border-slate-700/60 space-y-1 text-xs"
                >
                  <div className="flex items-center gap-2 font-bold text-slate-100">
                    <span>{insight.icon || '💡'}</span>
                    <span>{insight.title}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">{insight.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

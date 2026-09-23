import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { NavTab } from '../../types';
import { 
  formatCurrency, 
  getGreeting, 
  formatDate 
} from '../../utils/formatters';
import { getTodayLocalDateStr } from '../../utils/dateTime';
import { addMoney, subtractMoney } from '../../utils/money';
import { calculateMonthlyPetrolStats } from '../../utils/petrolCalculations';
import { 
  Home, 
  Milk, 
  Fuel, 
  HandCoins, 
  Zap,
  TrendingUp,
  ArrowUpRight,
  Plus, 
  Layers,
  AlertCircle,
  WalletCards,
  ArrowRight
} from 'lucide-react';
import { MetricCard } from '../ui/MetricCard';

interface DashboardProps {
  selectedMonth: string; // YYYY-MM
  setActiveTab: (tab: NavTab) => void;
  onOpenReportWithCategory?: (category: 'milk' | 'rent' | 'petrol' | 'loans' | 'master') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  selectedMonth,
  setActiveTab,
}) => {
  const financeTransactions = useLiveQuery(() => db.finance_transactions.toArray()) || [];
  const loans = useLiveQuery(() => db.loans.toArray()) || [];
  const milkConsumers = useLiveQuery(() => db.milk_consumers.filter(c => c.active).toArray()) || [];
  const milkLogs = useLiveQuery(
    () => db.milk_logs.filter(l => l.date.startsWith(selectedMonth)).toArray(),
    [selectedMonth]
  ) || [];
  const petrolRefills = useLiveQuery(
    () => db.petrol_refills.orderBy('odometerReading').toArray()
  ) || [];
  const rentPortions = useLiveQuery(() => db.rent_portions.filter(p => p.active).toArray()) || [];
  const rentRecords = useLiveQuery(
    () => db.rent_records.filter(r => r.monthYear === selectedMonth).toArray(),
    [selectedMonth]
  ) || [];
  const utilityBills = useLiveQuery(() => db.utility_bills.toArray()) || [];
  const utilityPayments = useLiveQuery(() => db.utility_payments.toArray()) || [];
  const settingsList = useLiveQuery(() => db.settings.toArray());
  const currentSettings = settingsList?.[0];
  const milkRate = currentSettings?.milkDefaultRate || 260;

  // 1. CURRENT MONTH FINANCE
  const currentMonthFinanceTx = financeTransactions.filter(
    tx => tx.transactionDate.startsWith(selectedMonth) && tx.status !== 'cancelled'
  );
  let financeIncome = 0;
  let financeExpenses = 0;
  currentMonthFinanceTx.forEach(tx => {
    if (tx.transactionType === 'income') financeIncome += tx.amount;
    if (tx.transactionType === 'expense') financeExpenses += tx.amount;
  });

  // PREVIOUS MONTH FINANCE FOR TRENDS
  const [curYear, curMonth] = selectedMonth.split('-').map(Number);
  const prevDate = new Date(curYear, curMonth - 2, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const prevMonthFinanceTx = financeTransactions.filter(
    tx => tx.transactionDate.startsWith(prevMonthStr) && tx.status !== 'cancelled'
  );
  let prevIncome = 0;
  let prevExpenses = 0;
  prevMonthFinanceTx.forEach(tx => {
    if (tx.transactionType === 'income') prevIncome += tx.amount;
    if (tx.transactionType === 'expense') prevExpenses += tx.amount;
  });

  const incomeChange = prevIncome > 0 ? Math.round(((financeIncome - prevIncome) / prevIncome) * 100) : 0;
  const expenseChange = prevExpenses > 0 ? Math.round(((financeExpenses - prevExpenses) / prevExpenses) * 100) : 0;

  // 2. UTILITY BILLS
  const selectedMonthUtilityBill = utilityBills.find(b => b.monthYear === selectedMonth);
  const selectedMonthPayments = utilityPayments.filter(p => {
    return (selectedMonthUtilityBill && p.utilityBillId === selectedMonthUtilityBill.id) || p.paymentDate.startsWith(selectedMonth);
  });
  const utilityPaid = selectedMonthPayments.reduce((s, p) => s + p.amount, 0);
  const utilityTotalBill = selectedMonthUtilityBill ? Math.round(selectedMonthUtilityBill.totalBill) : 0;
  const utilityPending = Math.max(0, utilityTotalBill - utilityPaid);

  // 3. RENT STATS
  const rentRecordMap = new Map<string, typeof rentRecords[0]>();
  rentRecords.forEach(r => rentRecordMap.set(r.portionId, r));

  let rentExpected = 0;
  let rentCollected = 0;
  let rentPendingPortionsCount = 0;
  rentPortions.forEach(p => {
    const rec = rentRecordMap.get(p.id);
    const exp = rec ? rec.expectedAmount : p.expectedRent;
    const paid = rec ? rec.paidAmount : 0;
    rentExpected += exp;
    rentCollected += paid;
    if (paid < exp) rentPendingPortionsCount++;
  });

  // 4. LOAN STATS
  const totalGiven = loans.filter(l => l.type === 'given').reduce((sum, l) => addMoney(sum, l.principalAmount), 0);
  const totalReceived = loans.filter(l => l.type === 'given').reduce((sum, l) => {
    const paid = (l.payments || []).reduce((pSum, p) => addMoney(pSum, p.amount), 0);
    return addMoney(sum, paid);
  }, 0);
  const outstandingLoans = Math.max(0, subtractMoney(totalGiven, totalReceived));
  const activeLoansCount = loans.filter(l => l.status === 'active').length;

  // 5. MILK STATS
  let totalMilkKg = 0;
  milkLogs.forEach(l => {
    if (l.status !== 'missed') totalMilkKg += l.actualKg;
  });
  const totalMilkCost = totalMilkKg * milkRate;

  // 6. PETROL STATS
  const monthlyPetrolStats = calculateMonthlyPetrolStats(petrolRefills, selectedMonth);
  const monthlyPetrol = petrolRefills.filter(r => r.date.startsWith(selectedMonth));

  // TOTAL ACTIVE RECORDS & PENDING ACTIONS
  const totalActiveRecords = 
    rentPortions.length + 
    milkConsumers.length + 
    activeLoansCount + 
    monthlyPetrol.length + 
    currentMonthFinanceTx.length;

  const totalPendingActions = 
    rentPendingPortionsCount + 
    (utilityPending > 0 ? 1 : 0) + 
    (activeLoansCount > 0 ? 1 : 0);

  // 7. MULTI-MONTH CASH FLOW (Last 9 Months)
  const cashFlowMonths = (() => {
    const list: string[] = [];
    for (let i = 8; i >= 0; i--) {
      const d = new Date(curYear, curMonth - 1 - i, 1);
      list.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
    }
    return list;
  })();

  const cashFlowData = cashFlowMonths.map(mStr => {
    const [y, m] = mStr.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    const label = date.toLocaleDateString('en-US', { month: 'short' });

    let inc = 0;
    let exp = 0;
    financeTransactions.forEach(tx => {
      if (tx.transactionDate.startsWith(mStr) && tx.status !== 'cancelled') {
        if (tx.transactionType === 'income') inc += tx.amount;
        if (tx.transactionType === 'expense') exp += tx.amount;
      }
    });

    return { month: mStr, label, income: inc, expenses: exp };
  });

  const maxCashFlow = Math.max(
    ...cashFlowData.map(d => Math.max(d.income, d.expenses)),
    10000
  );

  // 8. COMBINED RECENT ACTIVITY
  interface ActivityItem {
    id: string;
    title: string;
    subtitle: string;
    amount?: number;
    isIncome?: boolean;
    date: string;
    icon: any;
    color: string;
  }

  const activities: ActivityItem[] = [];

  // Finance Transactions
  currentMonthFinanceTx.slice(-5).forEach(tx => {
    activities.push({
      id: tx.id,
      title: tx.description || tx.categoryName || 'Transaction',
      subtitle: `${tx.categoryName || 'Finance'} • ${formatDate(tx.transactionDate, 'short')}`,
      amount: tx.amount,
      isIncome: tx.transactionType === 'income',
      date: tx.transactionDate,
      icon: WalletCards,
      color: tx.transactionType === 'income' ? 'text-[#14E6AA]' : 'text-[#FF627B]'
    });
  });

  // Rent Records
  rentRecords.filter(r => r.paidAmount > 0).slice(-3).forEach(r => {
    activities.push({
      id: r.id,
      title: `Rent: ${r.portionName}`,
      subtitle: `${r.tenantName} • ${r.paymentDate ? formatDate(r.paymentDate, 'short') : selectedMonth}`,
      amount: r.paidAmount,
      isIncome: true,
      date: r.paymentDate || `${selectedMonth}-10`,
      icon: Home,
      color: 'text-[#14E6AA]'
    });
  });

  // Utility Payments
  selectedMonthPayments.slice(-2).forEach(p => {
    activities.push({
      id: p.id,
      title: 'Electricity / Utility Bill',
      subtitle: `Payment • ${formatDate(p.paymentDate, 'short')}`,
      amount: p.amount,
      isIncome: false,
      date: p.paymentDate,
      icon: Zap,
      color: 'text-[#FF627B]'
    });
  });

  // Petrol Refills
  monthlyPetrol.slice(-2).forEach(p => {
    activities.push({
      id: p.id,
      title: 'Petrol Refill',
      subtitle: `${p.litres}L • ${formatDate(p.date, 'short')}`,
      amount: p.totalCost,
      isIncome: false,
      date: p.date,
      icon: Fuel,
      color: 'text-[#FF627B]'
    });
  });

  // Sort activities by date descending
  activities.sort((a, b) => b.date.localeCompare(a.date));
  const recentActivities = activities.slice(0, 5);

  // 9. EXPENSE BREAKDOWN (Categories)
  const categoryTotals: Record<string, number> = {};
  currentMonthFinanceTx
    .filter(tx => tx.transactionType === 'expense')
    .forEach(tx => {
      const cat = tx.categoryName || 'Others';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + tx.amount;
    });

  // Also include household module totals if not already categorized
  if (totalMilkCost > 0 && !categoryTotals['Milk']) categoryTotals['Milk'] = totalMilkCost;
  if (monthlyPetrolStats.monthlyCost > 0 && !categoryTotals['Petrol']) categoryTotals['Petrol'] = monthlyPetrolStats.monthlyCost;
  if (utilityTotalBill > 0 && !categoryTotals['Utilities']) categoryTotals['Utilities'] = utilityTotalBill;

  const totalHouseholdExpense = Object.values(categoryTotals).reduce((a, b) => a + b, 0) || financeExpenses || 1;

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([name, amount], index) => {
      const colors = ['#18E6BE', '#39AFFF', '#9B7BFF', '#FF627B', '#F7B733', '#14E6AA', '#00D2D3'];
      return {
        name,
        amount,
        percent: Math.round((amount / totalHouseholdExpense) * 100),
        color: colors[index % colors.length]
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  // Quick Action Handler: Mark today's milk delivered
  const handleMarkMilkToday = async () => {
    const today = getTodayLocalDateStr();
    for (const c of milkConsumers) {
      const key = `${today}_${c.id}`;
      await db.milk_logs.put({
        id: key,
        date: today,
        consumerId: c.id,
        consumerName: c.name,
        status: 'supplied',
        actualKg: c.defaultDailyKg,
        ratePerKg: milkRate
      });
    }
    alert("Today's milk delivery recorded for all active consumers!");
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* 1. GREETING HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F4F8FB] tracking-tight">
            {getGreeting()}, Tahir!
          </h2>
          <p className="text-xs sm:text-sm text-[#6F899B] mt-0.5 font-medium">
            Here's what's happening with your household today.
          </p>
        </div>
      </div>

      {/* 2. TOP METRIC CARDS (4 across) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Income"
          value={formatCurrency(financeIncome)}
          trend={prevIncome > 0 ? {
            direction: incomeChange >= 0 ? 'up' : 'down',
            text: `${incomeChange >= 0 ? '+' : ''}${incomeChange}% from last month`,
            isPositive: incomeChange >= 0
          } : undefined}
          subtitle={prevIncome === 0 ? 'Current month inflow' : undefined}
          variant="success"
          icon={TrendingUp}
          onClick={() => setActiveTab('finance')}
        />

        <MetricCard
          title="Total Expenses"
          value={formatCurrency(totalHouseholdExpense)}
          trend={prevExpenses > 0 ? {
            direction: expenseChange >= 0 ? 'up' : 'down',
            text: `${expenseChange >= 0 ? '+' : ''}${expenseChange}% from last month`,
            isPositive: expenseChange <= 0
          } : undefined}
          subtitle={prevExpenses === 0 ? 'Across all categories' : undefined}
          variant="danger"
          icon={ArrowUpRight}
          onClick={() => setActiveTab('finance')}
        />

        <MetricCard
          title="Active Records"
          value={totalActiveRecords}
          badge={{ text: 'All modules', variant: 'accent' }}
          subtitle="Household tracking active"
          variant="accent"
          icon={Layers}
        />

        <MetricCard
          title="Pending Items"
          value={totalPendingActions}
          badge={{ 
            text: totalPendingActions > 0 ? 'Needs attention' : 'All clear!', 
            variant: totalPendingActions > 0 ? 'warning' : 'success' 
          }}
          subtitle={totalPendingActions > 0 ? `${totalPendingActions} dues & actions` : 'No pending balances'}
          variant={totalPendingActions > 0 ? 'warning' : 'success'}
          icon={AlertCircle}
        />
      </div>

      {/* 3. MIDDLE SECTION: MONTHLY CASH FLOW & QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Monthly Cash Flow Chart (8 cols) */}
        <div className="lg:col-span-8 bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] p-5 flex flex-col justify-between shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(70,150,180,0.12)] pb-3 mb-4">
            <div>
              <h3 className="font-bold text-base text-[#F4F8FB]">
                Monthly Cash Flow
              </h3>
              <p className="text-xs text-[#6F899B] mt-0.5">
                Income vs Expenses comparison
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-[#14E6AA]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#14E6AA] inline-block shadow-[0_0_8px_#14E6AA]" />
                <span>Income</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#FF627B]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#FF627B] inline-block shadow-[0_0_8px_#FF627B]" />
                <span>Expenses</span>
              </div>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="pt-4 h-56 flex items-end justify-between gap-2 sm:gap-4 px-1 sm:px-2">
            {cashFlowData.map((d) => {
              const incHeight = Math.max(6, Math.round((d.income / maxCashFlow) * 100));
              const expHeight = Math.max(6, Math.round((d.expenses / maxCashFlow) * 100));
              const isSelected = d.month === selectedMonth;

              return (
                <div key={d.month} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="flex items-end gap-1 sm:gap-1.5 h-full w-full justify-center">
                    {/* Income Bar */}
                    <div
                      style={{ height: `${incHeight}%` }}
                      className={`w-2.5 sm:w-4 rounded-t transition-all ${
                        isSelected 
                          ? 'bg-[#18E6BE] shadow-[0_0_10px_rgba(24,230,190,0.4)]' 
                          : 'bg-[#14E6AA]/80 group-hover:bg-[#14E6AA]'
                      }`}
                      title={`${d.label} Income: ${formatCurrency(d.income)}`}
                    />
                    {/* Expense Bar */}
                    <div
                      style={{ height: `${expHeight}%` }}
                      className={`w-2.5 sm:w-4 rounded-t transition-all ${
                        isSelected 
                          ? 'bg-[#FF627B] shadow-[0_0_10px_rgba(255,98,123,0.4)]' 
                          : 'bg-[#FF627B]/80 group-hover:bg-[#FF627B]'
                      }`}
                      title={`${d.label} Expenses: ${formatCurrency(d.expenses)}`}
                    />
                  </div>
                  <div className={`text-[10px] sm:text-xs font-bold mt-2.5 truncate ${
                    isSelected ? 'text-[#18E6BE]' : 'text-[#6F899B]'
                  }`}>
                    {d.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions Grid (4 cols) */}
        <div className="lg:col-span-4 bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] p-5 flex flex-col justify-between shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="border-b border-[rgba(70,150,180,0.12)] pb-3 mb-3">
            <h3 className="font-bold text-base text-[#F4F8FB]">
              Quick Actions
            </h3>
            <p className="text-xs text-[#6F899B] mt-0.5">
              Instant entry shortcuts
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setActiveTab('finance')}
              className="p-3 bg-[#102638] hover:bg-[#122B3E] rounded-xl border border-[rgba(24,230,190,0.25)] text-left transition-all active:scale-95 group shadow-sm"
            >
              <div className="w-7 h-7 rounded-lg bg-[rgba(24,230,190,0.12)] text-[#18E6BE] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="font-bold text-xs text-[#F4F8FB]">Add Transaction</div>
              <div className="text-[10px] text-[#6F899B] mt-0.5">Finance entry</div>
            </button>

            <button
              onClick={() => setActiveTab('utility')}
              className="p-3 bg-[#102638] hover:bg-[#122B3E] rounded-xl border border-[rgba(247,183,51,0.2)] text-left transition-all active:scale-95 group shadow-sm"
            >
              <div className="w-7 h-7 rounded-lg bg-[rgba(247,183,51,0.12)] text-[#F7B733] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Zap className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="font-bold text-xs text-[#F4F8FB]">Pay Utility Bill</div>
              <div className="text-[10px] text-[#6F899B] mt-0.5">Electricity & Gas</div>
            </button>

            <button
              onClick={() => setActiveTab('loans')}
              className="p-3 bg-[#102638] hover:bg-[#122B3E] rounded-xl border border-[rgba(57,175,255,0.2)] text-left transition-all active:scale-95 group shadow-sm"
            >
              <div className="w-7 h-7 rounded-lg bg-[rgba(57,175,255,0.12)] text-[#39AFFF] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <HandCoins className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="font-bold text-xs text-[#F4F8FB]">Add Lease / Loan</div>
              <div className="text-[10px] text-[#6F899B] mt-0.5">
                {outstandingLoans > 0 ? `${formatCurrency(outstandingLoans)} balance` : 'Udhaar & Ledgers'}
              </div>
            </button>

            <button
              onClick={handleMarkMilkToday}
              className="p-3 bg-[#102638] hover:bg-[#122B3E] rounded-xl border border-[rgba(24,230,190,0.2)] text-left transition-all active:scale-95 group shadow-sm"
            >
              <div className="w-7 h-7 rounded-lg bg-[rgba(24,230,190,0.12)] text-[#18E6BE] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Milk className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="font-bold text-xs text-[#F4F8FB]">Log Milk Delivery</div>
              <div className="text-[10px] text-[#6F899B] mt-0.5">Mark today delivered</div>
            </button>

            <button
              onClick={() => setActiveTab('petrol')}
              className="p-3 bg-[#102638] hover:bg-[#122B3E] rounded-xl border border-[rgba(255,98,123,0.2)] text-left transition-all active:scale-95 group shadow-sm"
            >
              <div className="w-7 h-7 rounded-lg bg-[rgba(255,98,123,0.12)] text-[#FF627B] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Fuel className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="font-bold text-xs text-[#F4F8FB]">Add Petrol Entry</div>
              <div className="text-[10px] text-[#6F899B] mt-0.5">Bike fuel & KM</div>
            </button>

            <button
              onClick={() => setActiveTab('rent')}
              className="p-3 bg-[#102638] hover:bg-[#122B3E] rounded-xl border border-[rgba(20,230,170,0.2)] text-left transition-all active:scale-95 group shadow-sm"
            >
              <div className="w-7 h-7 rounded-lg bg-[rgba(20,230,170,0.12)] text-[#14E6AA] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Home className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="font-bold text-xs text-[#F4F8FB]">Record Rent</div>
              <div className="text-[10px] text-[#6F899B] mt-0.5">Portion collection</div>
            </button>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM SECTION: RECENT ACTIVITY & EXPENSE BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Activity (7 cols) */}
        <div className="lg:col-span-7 bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] p-5 flex flex-col justify-between shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between border-b border-[rgba(70,150,180,0.12)] pb-3 mb-3">
            <div>
              <h3 className="font-bold text-base text-[#F4F8FB]">
                Recent Activity
              </h3>
              <p className="text-xs text-[#6F899B] mt-0.5">
                Latest transactions & module logs
              </p>
            </div>
            <button
              onClick={() => setActiveTab('finance')}
              className="text-xs font-semibold text-[#18E6BE] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[rgba(70,150,180,0.1)]">
            {recentActivities.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#6F899B]">
                No recent activity recorded yet for {selectedMonth}.
              </div>
            ) : (
              recentActivities.map((act) => {
                const Icon = act.icon;
                return (
                  <div key={act.id} className="py-3 flex items-center justify-between gap-3 hover:bg-[#102638]/50 px-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#102638] border border-[rgba(70,150,180,0.2)] flex items-center justify-center text-[#18E6BE] shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="truncate max-w-[200px] sm:max-w-xs">
                        <div className="font-bold text-xs sm:text-sm text-[#F4F8FB] truncate">
                          {act.title}
                        </div>
                        <div className="text-[11px] text-[#6F899B] truncate">
                          {act.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {act.amount !== undefined && (
                        <div className={`text-xs sm:text-sm font-extrabold tabular-nums ${act.color}`}>
                          {act.isIncome ? '+' : '-'}{formatCurrency(act.amount)}
                        </div>
                      )}
                      <div className="text-[10px] text-[#6F899B]">
                        {formatDate(act.date, 'short')}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Expense Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] p-5 flex flex-col justify-between shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="border-b border-[rgba(70,150,180,0.12)] pb-3 mb-3">
            <h3 className="font-bold text-base text-[#F4F8FB]">
              Expense Breakdown
            </h3>
            <p className="text-xs text-[#6F899B] mt-0.5">
              Category distribution for {selectedMonth}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 my-auto py-2">
            {/* Donut Chart with central total */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#102638"
                  strokeWidth="12"
                />
                {/* Segments */}
                {categoryBreakdown.map((cat, i) => {
                  const circumference = 2 * Math.PI * 38;
                  const strokeDasharray = `${(cat.percent / 100) * circumference} ${circumference}`;
                  // Calculate stroke dash offset
                  const prevPercents = categoryBreakdown.slice(0, i).reduce((sum, c) => sum + c.percent, 0);
                  const strokeDashoffset = -((prevPercents / 100) * circumference);

                  return (
                    <circle
                      key={cat.name}
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke={cat.color}
                      strokeWidth="12"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-500"
                    />
                  );
                })}
              </svg>

              {/* Center Total Value */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                <span className="text-[9px] uppercase font-bold text-[#6F899B]">Total</span>
                <span className="text-sm font-extrabold text-[#F4F8FB] tracking-tight leading-tight">
                  {formatCurrency(totalHouseholdExpense)}
                </span>
              </div>
            </div>

            {/* Category Percent Legend */}
            <div className="flex-1 w-full space-y-2">
              {categoryBreakdown.length === 0 ? (
                <div className="text-xs text-[#6F899B] text-center py-4">
                  No expense records yet.
                </div>
              ) : (
                categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-[#A9BDCC] font-medium truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-[#F4F8FB]">{cat.percent}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

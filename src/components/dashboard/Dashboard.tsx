import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { NavTab } from '../../types';
import { 
  formatCurrency, 
  formatNumber, 
  getDaysInMonth 
} from '../../utils/formatters';
import { 
  Home, 
  Milk, 
  Fuel, 
  HandCoins, 
  Zap,
  ArrowRight, 
  Plus, 
  Check 
} from 'lucide-react';

interface DashboardProps {
  selectedMonth: string; // YYYY-MM
  setActiveTab: (tab: NavTab) => void;
  onOpenReportWithCategory?: (category: 'milk' | 'rent' | 'petrol' | 'loans' | 'master') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  selectedMonth,
  setActiveTab,
  onOpenReportWithCategory: _onOpenReportWithCategory
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

  // 0. PERSONAL FINANCE STATS
  const currentMonthFinanceTx = financeTransactions.filter(
    tx => tx.transactionDate.startsWith(selectedMonth) && tx.status !== 'cancelled'
  );
  let financeIncome = 0;
  let financeExpenses = 0;
  currentMonthFinanceTx.forEach(tx => {
    if (tx.transactionType === 'income') financeIncome += tx.amount;
    if (tx.transactionType === 'expense') financeExpenses += tx.amount;
  });
  const financeSavings = financeIncome - financeExpenses;
  const financeSavingsRate = financeIncome > 0 ? Math.round((financeSavings / financeIncome) * 100) : 0;

  const monthDays = getDaysInMonth(selectedMonth);

  // 5. UTILITY BILLS STATS
  const selectedMonthUtilityBill = utilityBills.find(b => b.monthYear === selectedMonth);
  const selectedMonthPayments = utilityPayments.filter(p => {
    return (selectedMonthUtilityBill && p.utilityBillId === selectedMonthUtilityBill.id) || p.paymentDate.startsWith(selectedMonth);
  });
  const utilityPaid = selectedMonthPayments.reduce((s, p) => s + p.amount, 0);
  const utilityTotalBill = selectedMonthUtilityBill ? Math.round(selectedMonthUtilityBill.totalBill) : 0;

  // 1. RENT STATS
  const rentRecordMap = new Map<string, typeof rentRecords[0]>();
  rentRecords.forEach(r => rentRecordMap.set(r.portionId, r));

  let rentExpected = 0;
  let rentCollected = 0;
  rentPortions.forEach(p => {
    const rec = rentRecordMap.get(p.id);
    const exp = rec ? rec.expectedAmount : p.expectedRent;
    const paid = rec ? rec.paidAmount : 0;
    rentExpected += exp;
    rentCollected += paid;
  });
  const rentRatePercent = rentExpected > 0 ? Math.round((rentCollected / rentExpected) * 100) : 0;

  // 2. MILK STATS
  const milkLogMap = new Map<string, typeof milkLogs[0]>();
  milkLogs.forEach(l => milkLogMap.set(`${l.date}_${l.consumerId}`, l));

  let totalMilkKg = 0;
  let totalMissedDays = 0;
  monthDays.forEach(day => {
    milkConsumers.forEach(c => {
      const key = `${day.dateStr}_${c.id}`;
      const log = milkLogMap.get(key);
      let actualKg = c.defaultDailyKg;
      let status = 'supplied';

      if (log) {
        status = log.status;
        actualKg = log.actualKg;
      }

      if (status === 'missed' || (status !== 'custom' && actualKg === 0)) {
        totalMissedDays += 1;
      } else {
        totalMilkKg += actualKg;
      }
    });
  });
  const totalMilkCost = totalMilkKg * milkRate;

  // 3. PETROL STATS
  const monthlyPetrol = petrolRefills.filter(r => r.date.startsWith(selectedMonth));
  const totalPetrolCost = monthlyPetrol.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const totalPetrolKm = monthlyPetrol.reduce((sum, r) => sum + (r.distanceTravelled || 0), 0);
  const totalPetrolLitres = monthlyPetrol.reduce((sum, r) => sum + (r.litres || 0), 0);
  const avgMileage = totalPetrolLitres > 0 && totalPetrolKm > 0 ? totalPetrolKm / totalPetrolLitres : 0;

  // 4. LOAN STATS
  const totalGiven = loans.filter(l => l.type === 'given').reduce((sum, l) => sum + l.principalAmount, 0);
  const totalReceived = loans.filter(l => l.type === 'given').reduce((sum, l) => {
    const paid = (l.payments || []).reduce((pSum, p) => pSum + p.amount, 0);
    return sum + paid;
  }, 0);
  const outstandingLoans = Math.max(0, totalGiven - totalReceived);

  // Quick Action: Mark today's milk delivered
  const handleMarkMilkToday = async () => {
    const today = new Date().toISOString().split('T')[0];
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
    alert("Today's milk delivery marked for all active consumers!");
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 0. PERSONAL FINANCE CARD */}
        <div 
          onClick={() => setActiveTab('finance')}
          className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between border border-emerald-500/30 sm:col-span-2 lg:col-span-1"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-emerald-500/30">
                  💰
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black text-white text-base group-hover:text-emerald-300 transition-colors">Personal Finance</h3>
                    <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-300">Voice</span>
                  </div>
                  <p className="text-xs text-emerald-200/70">Income, Expenses & Budget</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {formatCurrency(financeExpenses)} <span className="text-xs text-emerald-300/80 font-bold">Spent this month</span>
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-100/80 mt-2">
                <span>Income: <strong>{formatCurrency(financeIncome)}</strong></span>
                <span className="font-bold text-emerald-300">{financeSavingsRate}% Saved</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 mt-4 border-t border-white/10 text-xs">
            <span className="text-emerald-200/70">
              🎙️ Fast Urdu / English Voice Entry
            </span>
            <span className="text-emerald-300 font-bold group-hover:underline">Open Finance →</span>
          </div>
        </div>

        {/* UTILITY BILLS CARD */}
        <div 
          onClick={() => setActiveTab('utility')}
          className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5 fill-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-600 transition-colors">Utility Bills</h3>
                  <p className="text-xs text-slate-500">Electricity, Gas & Water</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {formatCurrency(utilityTotalBill)} <span className="text-xs text-slate-500 font-semibold">Saleem Bill</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                <span>Received: <strong className="text-emerald-700">{formatCurrency(utilityPaid)}</strong></span>
                {utilityTotalBill > utilityPaid ? (
                  <span className="text-rose-700 font-bold">Saleem Owes: {formatCurrency(utilityTotalBill - utilityPaid)}</span>
                ) : utilityPaid > utilityTotalBill ? (
                  <span className="text-teal-700 font-bold">Tahir Owes: {formatCurrency(utilityPaid - utilityTotalBill)}</span>
                ) : (
                  <span className="text-emerald-700 font-bold">Settled (0 PKR)</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Electricity + 1/3 (Gas+Water)
            </span>
            <span className="text-emerald-700 font-bold group-hover:underline">Open Utility Tracker →</span>
          </div>
        </div>
        {/* 1. RENT CARD */}
        <div 
          onClick={() => setActiveTab('rent')}
          className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-600 transition-colors">Rent</h3>
                  <p className="text-xs text-slate-500">Due: 10th Every Month</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {formatNumber(rentCollected, 0)} <span className="text-slate-400 font-semibold text-xl">/ {formatNumber(rentExpected, 0)} PKR</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                <span>{rentPortions.length} Portions</span>
                <span className="font-bold text-emerald-600">{rentRatePercent}% Collected</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${rentRatePercent}%` }} 
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Outstanding: <strong className="text-amber-700">{formatCurrency(Math.max(0, rentExpected - rentCollected))}</strong>
            </span>
            <span className="text-emerald-700 font-bold group-hover:underline">Manage Portions →</span>
          </div>
        </div>

        {/* 2. MILK CARD */}
        <div 
          onClick={() => setActiveTab('milk')}
          className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Milk className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-600 transition-colors">Milk</h3>
                  <p className="text-xs text-slate-500">@ {milkRate} PKR / KG</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {formatCurrency(totalMilkCost)}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                <span>Supplied: <strong className="text-slate-800">{totalMilkKg} KG</strong></span>
                <span className="text-amber-700 font-medium">{totalMissedDays} Missed Days</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              {milkConsumers.length} People Active ({milkConsumers.map(c => c.name).join(', ')})
            </span>
            <span className="text-emerald-700 font-bold group-hover:underline">Daily Grid →</span>
          </div>
        </div>

        {/* 3. PETROL CARD */}
        <div 
          onClick={() => setActiveTab('petrol')}
          className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-600 transition-colors">Petrol</h3>
                  <p className="text-xs text-slate-500">Bike Fuel & Mileage</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {formatCurrency(totalPetrolCost)}
                </div>
                {avgMileage > 0 && (
                  <div className="text-base sm:text-lg font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-xl">
                    {formatNumber(avgMileage, 2)} KM/L
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                <span>Total Travel: <strong className="text-slate-800">{formatNumber(totalPetrolKm, 0)} KM</strong></span>
                <span>Fuel: <strong className="text-slate-800">{formatNumber(totalPetrolLitres, 1)} L</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              {monthlyPetrol.length} Refills logged this month
            </span>
            <span className="text-emerald-700 font-bold group-hover:underline">Mileage Logs →</span>
          </div>
        </div>

        {/* 4. LOANS CARD */}
        <div 
          onClick={() => setActiveTab('loans')}
          className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                  <HandCoins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-600 transition-colors">Loans</h3>
                  <p className="text-xs text-slate-500">Udhaar & Borrowings</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {formatCurrency(outstandingLoans)} <span className="text-sm font-semibold text-slate-500">Outstanding</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                <span>Total Given: {formatCurrency(totalGiven)}</span>
                <span>Received: {formatCurrency(totalReceived)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              {loans.filter(l => l.status === 'active').length} Active loan ledgers
            </span>
            <span className="text-emerald-700 font-bold group-hover:underline">View Ledgers →</span>
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => setActiveTab('petrol')}
            className="p-3 bg-slate-50 hover:bg-emerald-50 rounded-2xl text-left border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center gap-2.5"
          >
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-xs">Add Refill</div>
              <div className="text-[10px] text-slate-500">Log bike fuel</div>
            </div>
          </button>

          <button
            onClick={handleMarkMilkToday}
            className="p-3 bg-slate-50 hover:bg-emerald-50 rounded-2xl text-left border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center gap-2.5"
          >
            <div className="p-2 rounded-xl bg-teal-100 text-teal-800">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-xs">Milk Today</div>
              <div className="text-[10px] text-slate-500">Mark all delivered</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('rent')}
            className="p-3 bg-slate-50 hover:bg-emerald-50 rounded-2xl text-left border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center gap-2.5"
          >
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-xs">Collect Rent</div>
              <div className="text-[10px] text-slate-500">Log portion payment</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('loans')}
            className="p-3 bg-slate-50 hover:bg-emerald-50 rounded-2xl text-left border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center gap-2.5"
          >
            <div className="p-2 rounded-xl bg-rose-100 text-rose-800">
              <HandCoins className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-xs">New Loan</div>
              <div className="text-[10px] text-slate-500">Given / Taken</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

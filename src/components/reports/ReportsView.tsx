import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { UtilityBill, UtilityPayment } from '../../types';
import { 
  formatCurrency, 
  formatDate, 
  formatNumber, 
  getDaysInMonth, 
  getMonthYearFormatted 
} from '../../utils/formatters';
import { exportElementAsJpg } from '../../utils/exportImage';
import { 
  Printer, 
  Download, 
  FileText, 
  Milk, 
  Home, 
  Fuel, 
  HandCoins, 
  Layers,
  Zap
} from 'lucide-react';

export type ReportCategory = 'master' | 'utility' | 'milk' | 'rent' | 'petrol' | 'loans';

interface ReportsViewProps {
  selectedMonth: string; // YYYY-MM
  setSelectedMonth: (m: string) => void;
  initialCategory?: ReportCategory;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  selectedMonth,
  setSelectedMonth,
  initialCategory = 'milk'
}) => {
  const [activeCategory, setActiveCategory] = useState<ReportCategory>(initialCategory);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Queries
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
  const rentRecords = useLiveQuery(() => db.rent_records.toArray()) || [];
  const utilityPersons = useLiveQuery(() => db.utility_persons.toArray()) || [];
  const utilityBills = useLiveQuery(() => db.utility_bills.toArray()) || [];
  const utilityPayments = useLiveQuery(() => db.utility_payments.toArray()) || [];
  const settingsList = useLiveQuery(() => db.settings.toArray());
  const currentSettings = settingsList?.[0];
  const milkRate = currentSettings?.milkDefaultRate || 260;

  // Month metadata
  const formattedMonthName = getMonthYearFormatted(selectedMonth);
  const monthDays = getDaysInMonth(selectedMonth);
  const generatedTimestamp = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Safe Filename Formatter e.g. "Milk_Report_August_2026.jpg"
  const getExportFilename = (type: string) => {
    const cleanMonthStr = formattedMonthName.replace(/\s+/g, '_');
    return `${type}_Report_${cleanMonthStr}.jpg`;
  };

  // 1. LOANS CALCULATIONS (Grouped by Person for Clean Ledger Report)
  const totalGiven = loans.filter(l => l.type === 'given').reduce((sum, l) => sum + l.principalAmount, 0);
  const totalReceived = loans.filter(l => l.type === 'given').reduce((sum, l) => {
    const paid = (l.payments || []).reduce((pSum, p) => pSum + p.amount, 0);
    return sum + paid;
  }, 0);
  const outstandingLoans = Math.max(0, totalGiven - totalReceived);

  // 2. MILK CALCULATIONS
  const milkLogMap = new Map<string, typeof milkLogs[0]>();
  milkLogs.forEach(l => milkLogMap.set(`${l.date}_${l.consumerId}`, l));

  let totalSuppliedKg = 0;
  let totalMissedDays = 0;
  let totalMissedKg = 0;

  const milkPersonStats: { [id: string]: { name: string; quota: number; suppliedKg: number; missedDays: number; cost: number } } = {};
  milkConsumers.forEach(c => {
    milkPersonStats[c.id] = { name: c.name, quota: c.defaultDailyKg, suppliedKg: 0, missedDays: 0, cost: 0 };
  });

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
        totalMissedKg += c.defaultDailyKg;
        if (milkPersonStats[c.id]) milkPersonStats[c.id].missedDays += 1;
      } else {
        totalSuppliedKg += actualKg;
        if (milkPersonStats[c.id]) milkPersonStats[c.id].suppliedKg += actualKg;
      }
    });
  });

  Object.keys(milkPersonStats).forEach(id => {
    milkPersonStats[id].cost = milkPersonStats[id].suppliedKg * milkRate;
  });
  const totalMilkCost = totalSuppliedKg * milkRate;

  // 3. PETROL CALCULATIONS
  const monthlyPetrolRefills = petrolRefills.filter(r => r.date.startsWith(selectedMonth));
  const totalPetrolKm = monthlyPetrolRefills.reduce((sum, r) => sum + (r.distanceTravelled || 0), 0);
  const totalPetrolLitres = monthlyPetrolRefills.reduce((sum, r) => sum + (r.litres || 0), 0);
  const totalPetrolCost = monthlyPetrolRefills.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const averageMileage = totalPetrolLitres > 0 && totalPetrolKm > 0 ? totalPetrolKm / totalPetrolLitres : 0;
  const costPerKm = totalPetrolKm > 0 ? totalPetrolCost / totalPetrolKm : 0;

  // 4. RENT CALCULATIONS WITH PREVIOUS ARREARS
  const rentRecordMap = new Map<string, typeof rentRecords[0]>();
  rentRecords.forEach(r => rentRecordMap.set(r.portionId, r));

  // Helper to calculate previous arrears for a portion
  const calculatePreviousArrears = (portionId: string, creationDateStr?: string, portionInitialArrears?: number): number => {
    let arrears = portionInitialArrears || 0;
    const previousRecords = rentRecords
      .filter(r => r.portionId === portionId && r.monthYear < selectedMonth)
      .sort((a, b) => a.monthYear.localeCompare(b.monthYear));

    const recordedMonths = new Set(previousRecords.map(r => r.monthYear));

    previousRecords.forEach(r => {
      const monthArrears = r.arrearsAmount !== undefined ? r.arrearsAmount : 0;
      const monthDue = r.expectedAmount + monthArrears;
      const rem = Math.max(0, monthDue - r.paidAmount);
      arrears = rem;
    });

    if (creationDateStr) {
      try {
        const createdDate = new Date(creationDateStr);
        const startY = createdDate.getFullYear();
        const startM = createdDate.getMonth() + 1;
        const [targetY, targetM] = selectedMonth.split('-').map(Number);

        let curY = startY;
        let curM = startM;

        while (curY < targetY || (curY === targetY && curM < targetM)) {
          const mStr = `${curY}-${curM.toString().padStart(2, '0')}`;
          if (!recordedMonths.has(mStr)) {
            const p = rentPortions.find(p => p.id === portionId);
            if (p) arrears += p.expectedRent;
          }
          curM++;
          if (curM > 12) {
            curM = 1;
            curY++;
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    return arrears;
  };

  let totalRentCurrentExpected = 0;
  let totalRentArrears = 0;
  let totalRentCollected = 0;

  const rentPortionList = rentPortions.map(portion => {
    const rec = rentRecordMap.get(portion.id);
    const expected = rec ? rec.expectedAmount : portion.expectedRent;
    const arrears = rec?.arrearsAmount !== undefined 
      ? rec.arrearsAmount 
      : calculatePreviousArrears(portion.id, portion.createdAt, portion.initialArrears);
    const totalDue = expected + arrears;
    const paid = rec ? rec.paidAmount : 0;
    const balance = Math.max(0, totalDue - paid);
    const status = paid >= totalDue && totalDue > 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING';

    totalRentCurrentExpected += expected;
    totalRentArrears += arrears;
    totalRentCollected += paid;

    return {
      portion,
      expected,
      arrears,
      totalDue,
      paid,
      balance,
      status
    };
  });

  const totalRentOverallPayable = totalRentCurrentExpected + totalRentArrears;
  const totalRentOutstanding = Math.max(0, totalRentOverallPayable - totalRentCollected);

  // Handle Export JPG
  const handleSaveJpg = async () => {
    setIsExporting(true);
    try {
      const typeLabel = 
        activeCategory === 'milk' ? 'Milk' :
        activeCategory === 'rent' ? 'Rent' :
        activeCategory === 'petrol' ? 'Petrol' :
        activeCategory === 'loans' ? 'Loan' : 'Household_Master';

      const filename = getExportFilename(typeLabel);
      await exportElementAsJpg('printable-report-card', filename);
    } catch (err) {
      alert('Failed to generate JPG image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Toolbar (Hidden in Print) */}
      <div className="no-print space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-emerald-600" />
              Monthly Statements & Reports
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Mobile-responsive layout with instant Print and high-resolution Save as JPG options
            </p>
          </div>

          {/* Month Selector & Export Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-sm text-xs font-bold text-slate-700">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>

            <button
              onClick={handleSaveJpg}
              disabled={isExporting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Generating JPG...' : 'Save as JPG'}
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          {[
            { id: 'utility' as ReportCategory, label: 'Utility Report', icon: Zap },
            { id: 'milk' as ReportCategory, label: 'Milk Report', icon: Milk },
            { id: 'rent' as ReportCategory, label: 'Rent Report', icon: Home },
            { id: 'petrol' as ReportCategory, label: 'Petrol Report', icon: Fuel },
            { id: 'loans' as ReportCategory, label: 'Loan Report', icon: HandCoins },
            { id: 'master' as ReportCategory, label: 'Household Master', icon: Layers },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* A4 REPORT PREVIEW CARD (Mobile responsive preview + crisp print/JPG capture) */}
      <div 
        id="printable-report-card" 
        ref={reportRef}
        className="bg-white rounded-3xl p-3.5 sm:p-6 border border-slate-200/90 shadow-md max-w-4xl mx-auto text-slate-900 font-sans print-page overflow-hidden"
      >
        {/* Report Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-2.5 mb-2.5 gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Personal Finance & Household Tracker
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 uppercase tracking-tight">
              {activeCategory === 'utility' && 'UTILITY BILL STATEMENT REPORT'}
              {activeCategory === 'milk' && 'MILK SUPPLY REPORT'}
              {activeCategory === 'rent' && 'RENT COLLECTION REPORT'}
              {activeCategory === 'petrol' && 'BIKE PETROL & MILEAGE REPORT'}
              {activeCategory === 'loans' && 'LOAN STATEMENT REPORT'}
              {activeCategory === 'master' && 'HOUSEHOLD MASTER STATEMENT'}
            </h1>
            <div className="text-xs font-extrabold text-emerald-600">
              {activeCategory === 'utility' ? 'Comprehensive All-Months Statement' : formattedMonthName}
            </div>
          </div>

          <div className="sm:text-right text-left">
            <div className="text-[9px] font-bold text-slate-400 uppercase">Generated</div>
            <div className="text-[11px] font-bold text-slate-700">{generatedTimestamp}</div>
            <div className="text-[9px] text-slate-500">Currency: <strong>PKR</strong></div>
          </div>
        </div>

        {/* REPORT CONTENT BODY */}

        {/* 0. UTILITY REPORT (ALL RECORDED MONTHS STATEMENT) */}
        {activeCategory === 'utility' && (() => {
          const activePerson = utilityPersons[0] || { name: 'Saleem', monthlyExpectedContribution: 9500 };
          
          // Sort all recorded utility bills chronologically
          const sortedBills = [...utilityBills].sort((a: UtilityBill, b: UtilityBill) => a.monthYear.localeCompare(b.monthYear));
          
          // Calculate statement rows for all recorded months
          const statementRows = sortedBills.map((bill: UtilityBill) => {
            const billPayments = utilityPayments.filter((p: UtilityPayment) => p.utilityBillId === bill.id);
            const paid = billPayments.reduce((s: number, p: UtilityPayment) => s + p.amount, 0);
            const elec = bill.electricity || 0;
            const gwShare = bill.saleemWaterGasShare || (bill.gas + bill.water) / 3;
            const totalBill = Math.round(bill.totalBill);
            const diff = Math.abs(totalBill - paid);
            const isOwedBySaleem = totalBill > paid;
            const isOwedByTahir = paid > totalBill;
            const isSettled = totalBill === paid;

            const [y, m] = bill.monthYear.split('-').map(Number);
            const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            return {
              id: bill.id,
              monthYear: bill.monthYear,
              monthLabel,
              elec,
              gwShare,
              totalBill,
              paid,
              diff,
              isOwedBySaleem,
              isOwedByTahir,
              isSettled
            };
          });

          // Overall totals across ALL recorded entries
          const totalElectricity = statementRows.reduce((s, r) => s + r.elec, 0);
          const totalWaterGas = statementRows.reduce((s, r) => s + r.gwShare, 0);
          const totalAllBills = statementRows.reduce((s, r) => s + r.totalBill, 0);
          const totalAllPaid = statementRows.reduce((s, r) => s + r.paid, 0);
          const overallDiff = Math.abs(totalAllBills - totalAllPaid);
          const isOverallOwedBySaleem = totalAllBills > totalAllPaid;
          const isOverallOwedByTahir = totalAllPaid > totalAllBills;

          return (
            <div className="space-y-3 mt-2">
              {/* Top Summary Cards (3 Focused Cards for All Recorded Entries) */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider">
                    {activePerson.name} Total Bills
                  </div>
                  <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                    {formatCurrency(totalAllBills)}
                  </div>
                  <div className="text-[9px] text-slate-500">Elec + 1/3 (Gas+Water)</div>
                </div>

                <div>
                  <div className="text-[9px] font-black uppercase text-emerald-800 tracking-wider">
                    Total Received
                  </div>
                  <div className="text-sm sm:text-base font-black text-emerald-700 mt-0.5">
                    {formatCurrency(totalAllPaid)}
                  </div>
                  <div className="text-[9px] text-emerald-600">9,500/mo + Extra</div>
                </div>

                <div>
                  <div className={`text-[9px] font-black uppercase tracking-wider ${
                    isOverallOwedBySaleem ? 'text-rose-700' : isOverallOwedByTahir ? 'text-teal-700' : 'text-emerald-700'
                  }`}>
                    {isOverallOwedBySaleem 
                      ? `${activePerson.name} Owes Tahir` 
                      : isOverallOwedByTahir 
                      ? `Tahir Owes ${activePerson.name}` 
                      : 'Net Balance'}
                  </div>
                  <div className={`text-sm sm:text-base font-black mt-0.5 ${
                    isOverallOwedBySaleem ? 'text-rose-700' : isOverallOwedByTahir ? 'text-teal-700' : 'text-emerald-700'
                  }`}>
                    {totalAllBills !== totalAllPaid ? formatCurrency(overallDiff) : '0 PKR'}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    {isOverallOwedBySaleem 
                      ? 'Bill exceeds payment' 
                      : isOverallOwedByTahir 
                      ? 'Advance / Excess' 
                      : 'Fully Settled'}
                  </div>
                </div>
              </div>

              {/* Comprehensive Statement Table for All Recorded Entries */}
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  All Recorded Months Statement ({activePerson.name})
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full table-fixed text-left border-collapse text-[10.5px] sm:text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-[9px] sm:text-[10px] font-black text-slate-600 uppercase">
                        <th className="py-1.5 px-2 w-[18%]">Month</th>
                        <th className="py-1.5 px-2 text-right w-[15%]">Electricity</th>
                        <th className="py-1.5 px-2 text-right w-[15%]">1/3 Gas+Water</th>
                        <th className="py-1.5 px-2 text-right font-black text-slate-900 w-[17%]">{activePerson.name} Bill</th>
                        <th className="py-1.5 px-2 text-right text-emerald-700 w-[16%]">Received</th>
                        <th className="py-1.5 px-2 text-right w-[19%]">Net Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {statementRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400 font-medium">
                            No utility bill entries recorded yet.
                          </td>
                        </tr>
                      ) : (
                        statementRows.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="py-1 px-2 font-bold text-slate-900 truncate">
                              {row.monthLabel}
                            </td>
                            <td className="py-1 px-2 text-right text-slate-700 truncate">
                              {formatCurrency(row.elec)}
                            </td>
                            <td className="py-1 px-2 text-right text-slate-700 truncate">
                              {formatCurrency(row.gwShare)}
                            </td>
                            <td className="py-1 px-2 text-right font-bold text-slate-900 truncate">
                              {formatCurrency(row.totalBill)}
                            </td>
                            <td className="py-1 px-2 text-right font-bold text-emerald-700 truncate">
                              {formatCurrency(row.paid)}
                            </td>
                            <td className="py-1 px-2 text-right truncate">
                              {row.isOwedBySaleem ? (
                                <span className="text-rose-700 font-bold">Saleem: {formatCurrency(row.diff)}</span>
                              ) : row.isOwedByTahir ? (
                                <span className="text-teal-700 font-bold">Tahir: {formatCurrency(row.diff)}</span>
                              ) : (
                                <span className="text-emerald-700 font-bold">Settled (0)</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-black border-t-2 border-slate-400 text-[10.5px] sm:text-xs">
                      <tr>
                        <td className="py-1.5 px-2 truncate">Total ({statementRows.length}M)</td>
                        <td className="py-1.5 px-2 text-right text-slate-800 truncate">{formatCurrency(totalElectricity)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-800 truncate">{formatCurrency(totalWaterGas)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-900 truncate">{formatCurrency(totalAllBills)}</td>
                        <td className="py-1.5 px-2 text-right text-emerald-800 truncate">{formatCurrency(totalAllPaid)}</td>
                        <td className="py-1.5 px-2 text-right truncate">
                          {isOverallOwedBySaleem ? (
                            <span className="text-rose-700 font-black">Saleem: {formatCurrency(overallDiff)}</span>
                          ) : isOverallOwedByTahir ? (
                            <span className="text-teal-700 font-black">Tahir: {formatCurrency(overallDiff)}</span>
                          ) : (
                            <span className="text-emerald-700 font-black">Settled (0)</span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 1. MILK REPORT */}
        {activeCategory === 'milk' && (
          <div className="space-y-3 mt-2">
            {/* Top Stat Boxes */}
            <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div>
                <div className="text-[9px] font-bold uppercase text-slate-500">Total Supplied</div>
                <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{totalSuppliedKg} KG</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-slate-500">Missed Deliveries</div>
                <div className="text-sm sm:text-base font-black text-amber-600 mt-0.5">{totalMissedDays} Days</div>
                <div className="text-[9px] text-slate-400">({totalMissedKg} KG Saved)</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-slate-500">Milk Rate</div>
                <div className="text-sm sm:text-base font-black text-slate-800 mt-0.5">{milkRate} <span className="text-[9px]">PKR/kg</span></div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-emerald-700">Total Bill</div>
                <div className="text-sm sm:text-base font-black text-emerald-700 mt-0.5">{formatCurrency(totalMilkCost)}</div>
              </div>
            </div>

            {/* Person-wise Breakdown Table */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Person-Wise Summary
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full table-fixed text-left border-collapse text-[10.5px] sm:text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-[9px] sm:text-[10px] font-black text-slate-600 uppercase">
                      <th className="py-1.5 px-2 w-[22%]">Person</th>
                      <th className="py-1.5 px-2 w-[18%]">Daily Quota</th>
                      <th className="py-1.5 px-2 text-center w-[16%]">Missed Days</th>
                      <th className="py-1.5 px-2 text-right w-[16%]">Supplied KG</th>
                      <th className="py-1.5 px-2 text-right w-[12%]">Rate</th>
                      <th className="py-1.5 px-2 text-right w-[16%]">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {milkConsumers.map(c => {
                      const stat = milkPersonStats[c.id];
                      return (
                        <tr key={c.id}>
                          <td className="py-1 px-2 font-bold text-slate-900 truncate">{c.name}</td>
                          <td className="py-1 px-2 text-slate-600 truncate">{c.defaultDailyKg} kg/day</td>
                          <td className="py-1 px-2 text-center font-medium text-amber-700 truncate">{stat?.missedDays || 0}</td>
                          <td className="py-1 px-2 text-right font-semibold truncate">{stat?.suppliedKg || 0} KG</td>
                          <td className="py-1 px-2 text-right text-slate-600 truncate">{milkRate}</td>
                          <td className="py-1 px-2 text-right font-black text-slate-900 truncate">{formatCurrency(stat?.cost || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-black border-t-2 border-slate-400 text-[10.5px] sm:text-xs">
                    <tr>
                      <td colSpan={3} className="py-1.5 px-2 text-slate-900">Total Monthly Milk Supply</td>
                      <td className="py-1.5 px-2 text-right">{totalSuppliedKg} KG</td>
                      <td className="py-1.5 px-2 text-right">-</td>
                      <td className="py-1.5 px-2 text-right text-emerald-800 font-black">{formatCurrency(totalMilkCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Daily Calendar Matrix */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Daily Attendance Matrix — {formattedMonthName}
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full table-fixed text-center border-collapse text-[9.5px] sm:text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[9px]">
                      <th className="py-1 px-1.5 text-left w-[20%]">Date</th>
                      {milkConsumers.map(c => (
                        <th key={c.id} className="py-1 px-1.5">{c.name}</th>
                      ))}
                      <th className="py-1 px-1.5 text-right w-[20%]">Daily Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthDays.map(d => {
                      let dayKg = 0;
                      return (
                        <tr key={d.dateStr} className="hover:bg-slate-50">
                          <td className="py-0.5 px-1.5 text-left font-medium text-slate-700 truncate">
                            {d.day} ({d.dayOfWeek.slice(0, 2)})
                          </td>
                          {milkConsumers.map(c => {
                            const key = `${d.dateStr}_${c.id}`;
                            const log = milkLogMap.get(key);
                            const isCustom = log?.status === 'custom';
                            const isMissed = log ? log.status === 'missed' || (!isCustom && log.actualKg === 0) : false;
                            const kg = log ? log.actualKg : c.defaultDailyKg;
                            if (!isMissed) dayKg += kg;

                            return (
                              <td key={c.id} className="py-0.5 px-1">
                                {isMissed ? (
                                  <span className="inline-block px-1 py-0 rounded bg-rose-50 text-rose-700 font-bold text-[8.5px]">✕ 0kg</span>
                                ) : isCustom ? (
                                  <span className="inline-block px-1 py-0 rounded bg-blue-50 text-blue-800 font-bold text-[8.5px]">★ {kg}k</span>
                                ) : (
                                  <span className="inline-block px-1 py-0 rounded bg-emerald-50 text-emerald-700 font-bold text-[8.5px]">✓ {kg}k</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-0.5 px-1.5 text-right font-bold text-slate-900 truncate">
                            {dayKg} KG
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. RENT REPORT (WITH PREVIOUS ARREARS BREAKDOWN) */}
        {activeCategory === 'rent' && (
          <div className="space-y-3 mt-2">
            {/* Top Stat Boxes */}
            <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div>
                <div className="text-[9px] font-bold uppercase text-slate-500">Current Month Rent</div>
                <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{formatCurrency(totalRentCurrentExpected)}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-rose-700">Previous Arrears</div>
                <div className="text-sm sm:text-base font-black text-rose-700 mt-0.5">{formatCurrency(totalRentArrears)}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-emerald-700">Collected</div>
                <div className="text-sm sm:text-base font-black text-emerald-700 mt-0.5">{formatCurrency(totalRentCollected)}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-amber-700">Net Outstanding</div>
                <div className="text-sm sm:text-base font-black text-amber-600 mt-0.5">{formatCurrency(totalRentOutstanding)}</div>
              </div>
            </div>

            {/* Portions Status Table */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Portion Rent Breakdown (Including Arrears)
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full table-fixed text-left border-collapse text-[10.5px] sm:text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-[9px] sm:text-[10px] font-black text-slate-600 uppercase">
                      <th className="py-1.5 px-2 w-[18%]">Portion</th>
                      <th className="py-1.5 px-2 w-[18%]">Tenant</th>
                      <th className="py-1.5 px-2 text-right w-[13%]">Current</th>
                      <th className="py-1.5 px-2 text-right text-rose-700 w-[12%]">Arrears</th>
                      <th className="py-1.5 px-2 text-right w-[13%]">Total Due</th>
                      <th className="py-1.5 px-2 text-right text-emerald-700 w-[13%]">Collected</th>
                      <th className="py-1.5 px-2 text-right w-[13%]">Balance</th>
                      <th className="py-1.5 px-2 text-center w-[10%]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rentPortionList.map(({ portion, expected, arrears, totalDue, paid, balance, status }) => (
                      <tr key={portion.id}>
                        <td className="py-1 px-2 font-bold text-slate-900 truncate">{portion.portionName}</td>
                        <td className="py-1 px-2 text-slate-700 truncate">{portion.tenantName}</td>
                        <td className="py-1 px-2 text-right truncate">{formatCurrency(expected)}</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700 truncate">{formatCurrency(arrears)}</td>
                        <td className="py-1 px-2 text-right font-bold text-slate-900 truncate">{formatCurrency(totalDue)}</td>
                        <td className="py-1 px-2 text-right font-bold text-emerald-600 truncate">{formatCurrency(paid)}</td>
                        <td className="py-1 px-2 text-right font-black text-slate-900 truncate">{formatCurrency(balance)}</td>
                        <td className="py-1 px-2 text-center truncate">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                            status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : status === 'PARTIAL'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-black border-t-2 border-slate-400 text-[10.5px] sm:text-xs">
                    <tr>
                      <td colSpan={2} className="py-1.5 px-2">Total Statement</td>
                      <td className="py-1.5 px-2 text-right truncate">{formatCurrency(totalRentCurrentExpected)}</td>
                      <td className="py-1.5 px-2 text-right text-rose-700 truncate">{formatCurrency(totalRentArrears)}</td>
                      <td className="py-1.5 px-2 text-right text-slate-900 truncate">{formatCurrency(totalRentOverallPayable)}</td>
                      <td className="py-1.5 px-2 text-right text-emerald-700 truncate">{formatCurrency(totalRentCollected)}</td>
                      <td className="py-1.5 px-2 text-right text-slate-900 truncate">{formatCurrency(totalRentOutstanding)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. PETROL REPORT */}
        {activeCategory === 'petrol' && (
          <div className="space-y-3 mt-2">
            {/* Top Stat Boxes */}
            <div className="grid grid-cols-5 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div>
                <div className="text-[9px] font-bold uppercase text-slate-500">Total KM</div>
                <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{formatNumber(totalPetrolKm, 0)} km</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-slate-500">Petrol Used</div>
                <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{formatNumber(totalPetrolLitres, 1)} L</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-emerald-700">Average Mileage</div>
                <div className="text-sm sm:text-base font-black text-emerald-700 mt-0.5">{formatNumber(averageMileage, 1)} <span className="text-[9px]">km/L</span></div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-slate-500">Petrol Cost</div>
                <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{formatCurrency(totalPetrolCost)}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-slate-500">Cost / KM</div>
                <div className="text-sm sm:text-base font-black text-slate-800 mt-0.5">{formatNumber(costPerKm, 2)} <span className="text-[9px]">PKR</span></div>
              </div>
            </div>

            {/* Refill Log Details */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Fuel Refill Logs — {formattedMonthName}
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full table-fixed text-left border-collapse text-[10.5px] sm:text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-[9px] sm:text-[10px] font-black text-slate-600 uppercase">
                      <th className="py-1.5 px-2 w-[14%]">Date</th>
                      <th className="py-1.5 px-2 w-[14%]">Odometer</th>
                      <th className="py-1.5 px-2 w-[12%]">Quantity</th>
                      <th className="py-1.5 px-2 w-[12%]">Rate/L</th>
                      <th className="py-1.5 px-2 text-right w-[14%]">Cost</th>
                      <th className="py-1.5 px-2 text-right w-[12%]">Distance</th>
                      <th className="py-1.5 px-2 text-right w-[11%]">Mileage</th>
                      <th className="py-1.5 px-2 text-right w-[11%]">Cost/KM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {monthlyPetrolRefills.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-4 text-center text-slate-400">No refill logs in this month.</td>
                      </tr>
                    ) : (
                      monthlyPetrolRefills.map(r => (
                        <tr key={r.id}>
                          <td className="py-1 px-2 font-semibold truncate">{formatDate(r.date, 'short')}</td>
                          <td className="py-1 px-2 font-mono truncate">{r.odometerReading} km</td>
                          <td className="py-1 px-2 truncate">{r.litres} L</td>
                          <td className="py-1 px-2 truncate">{r.pricePerLitre}</td>
                          <td className="py-1 px-2 text-right font-bold truncate">{formatCurrency(r.totalCost)}</td>
                          <td className="py-1 px-2 text-right font-semibold truncate">{r.distanceTravelled > 0 ? `${r.distanceTravelled} km` : '-'}</td>
                          <td className="py-1 px-2 text-right font-bold text-emerald-700 truncate">{r.mileageKmpl > 0 ? `${r.mileageKmpl}` : '-'}</td>
                          <td className="py-1 px-2 text-right truncate">{r.costPerKm > 0 ? `${r.costPerKm}` : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100 font-black border-t-2 border-slate-400 text-[10.5px] sm:text-xs">
                    <tr>
                      <td colSpan={4} className="py-1.5 px-2">Total Fuel Expense</td>
                      <td className="py-1.5 px-2 text-right text-emerald-800 truncate">{formatCurrency(totalPetrolCost)}</td>
                      <td className="py-1.5 px-2 text-right truncate">{formatNumber(totalPetrolKm, 0)} km</td>
                      <td className="py-1.5 px-2 text-right text-emerald-800 truncate">{formatNumber(averageMileage, 1)}</td>
                      <td className="py-1.5 px-2 text-right truncate">{formatNumber(costPerKm, 1)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. LOAN REPORT (PERSON GROUPED & ITEMIZED LEDGER) */}
        {activeCategory === 'loans' && (() => {
          const totalGivenPrincipal = loans.filter(l => l.type === 'given').reduce((sum, l) => sum + l.principalAmount, 0);
          const totalGivenRecovered = loans.filter(l => l.type === 'given').reduce((sum, l) => {
            return sum + (l.payments || []).reduce((pSum, p) => pSum + p.amount, 0);
          }, 0);
          const totalGivenPending = Math.max(0, totalGivenPrincipal - totalGivenRecovered);

          const totalTakenPrincipal = loans.filter(l => l.type === 'taken').reduce((sum, l) => sum + l.principalAmount, 0);
          const totalTakenRepaid = loans.filter(l => l.type === 'taken').reduce((sum, l) => {
            return sum + (l.payments || []).reduce((pSum, p) => pSum + p.amount, 0);
          }, 0);
          const totalTakenPending = Math.max(0, totalTakenPrincipal - totalTakenRepaid);

          return (
            <div className="space-y-3 mt-2">
              {/* Top Stat Boxes */}
              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <div className="text-[9px] font-bold uppercase text-slate-500">Total Udhaar Given</div>
                  <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{formatCurrency(totalGivenPrincipal)}</div>
                  <div className="text-[9px] text-slate-400">Total lent</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase text-emerald-700">Total Recovered</div>
                  <div className="text-sm sm:text-base font-black text-emerald-700 mt-0.5">{formatCurrency(totalGivenRecovered)}</div>
                  <div className="text-[9px] text-emerald-600">Received back</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase text-amber-700">Pending to Receive</div>
                  <div className="text-sm sm:text-base font-black text-amber-600 mt-0.5">{formatCurrency(totalGivenPending)}</div>
                  <div className="text-[9px] text-amber-600 font-medium">Others owe you</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase text-rose-700">You Owe (Borrowed)</div>
                  <div className="text-sm sm:text-base font-black text-rose-700 mt-0.5">{formatCurrency(totalTakenPending)}</div>
                  <div className="text-[9px] text-rose-600 font-medium">Payable to others</div>
                </div>
              </div>

              {/* Person-wise Loans Table */}
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Person-Wise Udhaar & Borrowing Balance Summary
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full table-fixed text-left border-collapse text-[10.5px] sm:text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-[9px] sm:text-[10px] font-black text-slate-600 uppercase">
                        <th className="py-1.5 px-2 w-[25%]">Person</th>
                        <th className="py-1.5 px-2 w-[18%]">Phone</th>
                        <th className="py-1.5 px-2 text-right w-[18%]">Given Rem</th>
                        <th className="py-1.5 px-2 text-right w-[18%]">Taken Rem</th>
                        <th className="py-1.5 px-2 text-right w-[21%]">Net Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Array.from(new Set(loans.map(l => l.personName.trim()))).map(name => {
                        const personLoans = loans.filter(l => l.personName.trim().toLowerCase() === name.toLowerCase());
                        const phone = personLoans.find(l => l.personPhone)?.personPhone || '-';

                        let givenRem = 0;
                        let takenRem = 0;

                        personLoans.forEach(l => {
                          const paid = (l.payments || []).reduce((s, p) => s + p.amount, 0);
                          const rem = Math.max(0, l.principalAmount - paid);
                          if (l.type === 'given') givenRem += rem;
                          else takenRem += rem;
                        });

                        const net = givenRem - takenRem;

                        return (
                          <tr key={name}>
                            <td className="py-1 px-2 font-bold text-slate-900 truncate">{name}</td>
                            <td className="py-1 px-2 text-slate-500 truncate">{phone}</td>
                            <td className="py-1 px-2 text-right font-medium text-emerald-700 truncate">{formatCurrency(givenRem)}</td>
                            <td className="py-1 px-2 text-right font-medium text-amber-700 truncate">{formatCurrency(takenRem)}</td>
                            <td className="py-1 px-2 text-right font-bold text-slate-900 truncate">
                              {net > 0 ? (
                                <span className="text-emerald-700">Owes: {formatCurrency(net)}</span>
                              ) : net < 0 ? (
                                <span className="text-rose-700">You Owe: {formatCurrency(Math.abs(net))}</span>
                              ) : (
                                <span className="text-slate-400">Settled (0)</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100 font-black border-t-2 border-slate-400 text-[10.5px] sm:text-xs">
                      <tr>
                        <td colSpan={2} className="py-1.5 px-2">Total Portfolio</td>
                        <td className="py-1.5 px-2 text-right text-emerald-700 truncate">{formatCurrency(totalGivenPending)}</td>
                        <td className="py-1.5 px-2 text-right text-rose-700 truncate">{formatCurrency(totalTakenPending)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-900 truncate">{formatCurrency(totalGivenPending - totalTakenPending)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 5. MASTER HOUSEHOLD REPORT */}
        {activeCategory === 'master' && (
          <div className="space-y-3 mt-2">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                Monthly Financial Snapshot — {formattedMonthName}
              </h3>
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Rent Collection</div>
                  <div className="text-sm sm:text-base font-black text-emerald-700 mt-0.5">{formatCurrency(totalRentCollected)}</div>
                  <div className="text-[9px] text-slate-500">of {formatCurrency(totalRentOverallPayable)}</div>
                </div>

                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Milk Expense</div>
                  <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{formatCurrency(totalMilkCost)}</div>
                  <div className="text-[9px] text-slate-500">{totalSuppliedKg} KG supplied</div>
                </div>

                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Bike Petrol</div>
                  <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{formatCurrency(totalPetrolCost)}</div>
                  <div className="text-[9px] text-slate-500">{formatNumber(averageMileage, 1)} km/L</div>
                </div>

                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Outstanding Udhaar</div>
                  <div className="text-sm sm:text-base font-black text-amber-700 mt-0.5">{formatCurrency(outstandingLoans)}</div>
                  <div className="text-[9px] text-slate-500">To recover</div>
                </div>
              </div>
            </div>

            {/* Combined Monthly Cashflow Table */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Household Revenue & Expenses Summary
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full table-fixed text-left border-collapse text-[10.5px] sm:text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-[9px] sm:text-[10px] font-black text-slate-600 uppercase">
                      <th className="py-1.5 px-2 w-[28%]">Tracker Category</th>
                      <th className="py-1.5 px-2 w-[24%]">Details / Units</th>
                      <th className="py-1.5 px-2 text-right w-[16%]">Inflow</th>
                      <th className="py-1.5 px-2 text-right w-[16%]">Outflow</th>
                      <th className="py-1.5 px-2 text-right w-[16%]">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-1 px-2 font-bold text-slate-900 truncate">🏠 Rent Management</td>
                      <td className="py-1 px-2 text-slate-600 truncate">{rentPortions.length} Portions ({rentPortions.filter(p => rentRecordMap.get(p.id)?.paidAmount === p.expectedRent).length} Paid)</td>
                      <td className="py-1 px-2 text-right font-bold text-emerald-700 truncate">{formatCurrency(totalRentCollected)}</td>
                      <td className="py-1 px-2 text-right text-slate-400 truncate">-</td>
                      <td className="py-1 px-2 text-right font-black text-emerald-700 truncate">+{formatCurrency(totalRentCollected)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-bold text-slate-900 truncate">🥛 Milk Management</td>
                      <td className="py-1 px-2 text-slate-600 truncate">{totalSuppliedKg} KG ({totalMissedDays} missed)</td>
                      <td className="py-1 px-2 text-right text-slate-400 truncate">-</td>
                      <td className="py-1 px-2 text-right font-bold text-rose-700 truncate">{formatCurrency(totalMilkCost)}</td>
                      <td className="py-1 px-2 text-right font-black text-rose-700 truncate">-{formatCurrency(totalMilkCost)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-bold text-slate-900 truncate">⛽ Bike Petrol & Fuel</td>
                      <td className="py-1 px-2 text-slate-600 truncate">{formatNumber(totalPetrolKm, 0)} km ({formatNumber(totalPetrolLitres, 1)} L)</td>
                      <td className="py-1 px-2 text-right text-slate-400 truncate">-</td>
                      <td className="py-1 px-2 text-right font-bold text-rose-700 truncate">{formatCurrency(totalPetrolCost)}</td>
                      <td className="py-1 px-2 text-right font-black text-rose-700 truncate">-{formatCurrency(totalPetrolCost)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-bold text-slate-900 truncate">💰 Loans & Udhaar</td>
                      <td className="py-1 px-2 text-slate-600 truncate">Pending recovery</td>
                      <td className="py-1 px-2 text-right font-semibold text-slate-700 truncate">{formatCurrency(totalReceived)}</td>
                      <td className="py-1 px-2 text-right text-slate-400 truncate">-</td>
                      <td className="py-1 px-2 text-right font-semibold text-amber-700 truncate">{formatCurrency(outstandingLoans)}</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-100 font-black border-t-2 border-slate-400 text-[10.5px] sm:text-xs">
                    <tr>
                      <td colSpan={2} className="py-1.5 px-2">Net Cashflow for {formattedMonthName}</td>
                      <td className="py-1.5 px-2 text-right text-emerald-800 truncate">{formatCurrency(totalRentCollected)}</td>
                      <td className="py-1.5 px-2 text-right text-rose-800 truncate">{formatCurrency(totalMilkCost + totalPetrolCost)}</td>
                      <td className="py-1.5 px-2 text-right text-slate-900 font-black truncate">
                        {formatCurrency(totalRentCollected - (totalMilkCost + totalPetrolCost))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Report Footer / Signature Block */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-xs text-slate-400 gap-2 print-avoid-break">
          <div>
            <span>Tahir Tracker • Personal Finance & Household System</span>
          </div>
          <div className="text-right">
            <span>Verified by: ________________________</span>
          </div>
        </div>
      </div>
    </div>
  );
};

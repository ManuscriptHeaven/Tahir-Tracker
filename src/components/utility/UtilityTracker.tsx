import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { UtilityBill } from '../../types';
import { 
  calculateUtilityNetBalance, 
  getUtilityPaymentStatus 
} from '../../utils/utilityCalculations';
import { formatCurrency, getMonthYearFormatted } from '../../utils/formatters';
import { 
  Zap, 
  User, 
  CreditCard, 
  Edit3, 
  Trash2, 
  Filter, 
  FileText,
  TrendingDown,
  CheckCircle2
} from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { MetricCard } from '../ui/MetricCard';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { AddEditUtilityBillModal } from './AddEditUtilityBillModal';
import { UtilityPaymentModal } from './UtilityPaymentModal';
import { PersonManagementModal } from './PersonManagementModal';

interface UtilityTrackerProps {
  onOpenReport?: () => void;
}

type DateFilterOption = 'all' | 'current_year' | 'previous_year' | 'custom';

export const UtilityTracker: React.FC<UtilityTrackerProps> = ({ onOpenReport }) => {
  const [selectedPersonId, setSelectedPersonId] = useState<string>('p_saleem');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [billToEdit, setBillToEdit] = useState<UtilityBill | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<UtilityBill | null>(null);

  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);

  // Dexie Queries
  const persons = useLiveQuery(() => db.utility_persons.toArray()) || [];
  const allBills = useLiveQuery(() => db.utility_bills.toArray()) || [];
  const allPayments = useLiveQuery(() => db.utility_payments.toArray()) || [];

  // Active Person
  const currentPerson = persons.find(p => p.id === selectedPersonId) || persons[0] || {
    id: 'p_saleem',
    name: 'Saleem',
    monthlyExpectedContribution: 9500,
    currency: 'PKR',
    createdAt: '',
    updatedAt: ''
  };

  // Filter bills by person
  const personBills = allBills.filter(b => b.personId === currentPerson.id);

  // Available years for dropdown
  const availableYears = Array.from(new Set(personBills.map(b => b.year))).sort((a, b) => b - a);
  if (availableYears.length === 0) availableYears.push(new Date().getFullYear());

  // Filter by Date
  const currentYear = new Date().getFullYear();
  const filteredBills = personBills.filter(b => {
    if (dateFilter === 'current_year') return b.year === currentYear;
    if (dateFilter === 'previous_year') return b.year === currentYear - 1;
    if (dateFilter === 'custom') return b.year === selectedYear;
    return true; // 'all'
  }).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  // Calculate Payments Map
  const paymentsByBillIdMap = new Map<string, number>();
  const paymentsListMap = new Map<string, typeof allPayments>();

  allPayments.forEach(p => {
    const curTotal = paymentsByBillIdMap.get(p.utilityBillId) || 0;
    paymentsByBillIdMap.set(p.utilityBillId, curTotal + p.amount);

    const list = paymentsListMap.get(p.utilityBillId) || [];
    list.push(p);
    paymentsListMap.set(p.utilityBillId, list);
  });

  // Financial Summary Cards calculation
  const personPayments = allPayments.filter(p => p.personId === currentPerson.id);
  const summary = calculateUtilityNetBalance(filteredBills, personPayments);

  // Actions
  const handleOpenAdd = () => {
    setBillToEdit(null);
    setIsAddEditModalOpen(true);
  };

  const handleOpenEdit = (bill: UtilityBill) => {
    setBillToEdit(bill);
    setIsAddEditModalOpen(true);
  };

  const handleOpenPayments = (bill: UtilityBill) => {
    setSelectedBillForPayment(bill);
    setIsPaymentModalOpen(true);
  };

  const handleDeleteBill = async (id: string) => {
    if (!confirm('Are you sure you want to delete this monthly utility bill record?')) return;
    try {
      await db.utility_bills.delete(id);
      const relatedPayments = allPayments.filter(p => p.utilityBillId === id);
      for (const p of relatedPayments) {
        await db.utility_payments.delete(p.id);
      }
    } catch (err) {
      console.error('Failed to delete bill:', err);
      alert('Failed to delete utility bill record');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP PAGE HEADER */}
      <PageHeader
        icon={Zap}
        title="Utility Tracking"
        subtitle={`Monitor, divide, and settle shared household and office utility expenses for ${currentPerson.name}.`}
        primaryAction={{
          label: "+ Add Utility Bill",
          onClick: handleOpenAdd
        }}
        secondaryAction={{
          label: `Person: ${currentPerson.name}`,
          icon: User,
          onClick: () => setIsPersonModalOpen(true)
        }}
      >
        {onOpenReport && (
          <button
            onClick={onOpenReport}
            className="px-3.5 py-2 bg-[#102638] hover:bg-[#16344d] text-cyan-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-cyan-500/20 transition-colors"
          >
            <FileText className="w-4 h-4 text-[#18E6BE]" />
            <span>Reports</span>
          </button>
        )}
      </PageHeader>

      {/* 2. TOP METRIC CARDS (4 METRIC CARDS MATCHING REFERENCE) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Bills */}
        <MetricCard
          title={`${currentPerson.name}'s Total Bills`}
          value={formatCurrency(summary.totalSaleemTotalBills)}
          subtitle="Electricity + 1/3 (Gas + Water)"
          icon={Zap}
          variant="default"
        />

        {/* Metric 2: Total Received / Paid */}
        <MetricCard
          title="Total Paid / Received"
          value={formatCurrency(summary.totalReceivedAmount)}
          subtitle="Monthly contributions & payments"
          icon={CheckCircle2}
          variant="success"
        />

        {/* Metric 3: Net Balance / Status */}
        <MetricCard
          title={summary.netStatus === 'saleem_owes_tahir' 
            ? `${currentPerson.name} Owes Tahir` 
            : summary.netStatus === 'tahir_owes_saleem' 
            ? `Tahir Owes ${currentPerson.name}` 
            : 'Net Balance'}
          value={formatCurrency(summary.netDifference)}
          subtitle={summary.netStatus === 'saleem_owes_tahir' 
            ? 'Bill exceeds payments received' 
            : summary.netStatus === 'tahir_owes_saleem' 
            ? 'Advance / excess payment' 
            : 'All monthly bills fully settled'}
          icon={TrendingDown}
          variant={summary.netStatus === 'saleem_owes_tahir' ? 'danger' : 'success'}
        />

        {/* Metric 4: Total Records */}
        <MetricCard
          title="Active Records"
          value={`${filteredBills.length} Months`}
          subtitle={`Avg: ${formatCurrency(filteredBills.length > 0 ? Math.round(summary.totalSaleemTotalBills / filteredBills.length) : 0)} / mo`}
          icon={Filter}
          variant="default"
        />
      </div>

      {/* 3. FILTER CONTROLS BAR */}
      <div className="bg-[#0B1D2C] p-3 rounded-2xl border border-slate-700/50 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Filter:
          </span>

          {[
            { id: 'all' as DateFilterOption, label: 'All Records' },
            { id: 'current_year' as DateFilterOption, label: `Current Year (${currentYear})` },
            { id: 'previous_year' as DateFilterOption, label: `Prev Year (${currentYear - 1})` },
            { id: 'custom' as DateFilterOption, label: 'By Year' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setDateFilter(opt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                dateFilter === opt.id
                  ? 'bg-[#18E6BE] text-slate-950 font-bold shadow-sm'
                  : 'bg-[#102638] text-slate-300 hover:text-white border border-slate-700/60'
              }`}
            >
              {opt.label}
            </button>
          ))}

          {dateFilter === 'custom' && (
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-2.5 py-1 bg-[#071724] border border-slate-700 rounded-xl text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>

        <div className="text-xs font-medium text-slate-400">
          Showing <strong className="text-slate-200">{filteredBills.length}</strong> monthly records
        </div>
      </div>

      {/* 4. MOBILE VIEW CARDS (hidden on desktop) */}
      <div className="block lg:hidden space-y-3">
        {filteredBills.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No Utility Bill Records Found"
            description="No monthly utility bills have been recorded yet for the selected filter."
            action={{
              label: "+ Record First Bill",
              onClick: handleOpenAdd
            }}
          />
        ) : (
          filteredBills.map(bill => {
            const paid = paymentsByBillIdMap.get(bill.id) || 0;
            const saleemBillRounded = Math.round(bill.totalBill);
            const outstanding = saleemBillRounded - paid;
            const status = getUtilityPaymentStatus(bill.totalBill, paid);
            const monthName = getMonthYearFormatted(bill.monthYear);

            return (
              <div
                key={bill.id}
                className="bg-[#0B1D2C] rounded-2xl p-4 border border-slate-700/50 shadow-sm space-y-3 hover:border-cyan-500/40 transition-all"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div>
                    <div className="text-sm font-bold text-slate-100">
                      {monthName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Expected: <strong className="text-slate-200">{formatCurrency(bill.expectedContribution)}</strong>
                    </div>
                  </div>

                  <StatusBadge status={status as any} />
                </div>

                {/* Values Grid */}
                <div className="grid grid-cols-3 gap-2 bg-[#071724] p-2.5 rounded-xl border border-slate-800 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">Water+Gas Share</div>
                    <div className="font-semibold text-slate-200 mt-0.5">
                      {formatCurrency(bill.saleemWaterGasShare)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-cyan-400 font-medium">{currentPerson.name} Total</div>
                    <div className="font-bold text-cyan-300 mt-0.5">
                      {formatCurrency(saleemBillRounded)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-teal-400 font-medium">Received</div>
                    <div className="font-bold text-teal-300 mt-0.5">
                      {formatCurrency(paid)}
                    </div>
                  </div>
                </div>

                {/* Balance Row */}
                <div className="flex items-center justify-between text-xs px-1 font-medium">
                  <span className="text-slate-400">
                    {outstanding > 0 ? `${currentPerson.name} Owes:` : outstanding < 0 ? `Tahir Owes:` : 'Status:'}
                  </span>
                  <span className={`font-bold text-sm ${outstanding > 0 ? 'text-rose-400' : outstanding < 0 ? 'text-teal-400' : 'text-emerald-400'}`}>
                    {outstanding > 0 ? formatCurrency(outstanding) : outstanding < 0 ? formatCurrency(Math.abs(outstanding)) : 'Fully Settled (0 PKR)'}
                  </span>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleOpenPayments(bill)}
                    className="px-3 py-1.5 bg-[#102638] hover:bg-[#16344d] text-cyan-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-cyan-500/20"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Payments ({paymentsListMap.get(bill.id)?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(bill)}
                    className="p-1.5 bg-[#102638] hover:bg-[#16344d] text-slate-300 hover:text-white rounded-xl border border-slate-700"
                    title="Edit Record"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteBill(bill.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. DESKTOP TABLE VIEW (visible on desktop lg+) */}
      <div className="hidden lg:block bg-[#0B1D2C] rounded-2xl border border-slate-700/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#102638] border-b border-slate-700/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Month / Period</th>
                <th className="py-3.5 px-3 text-right">Electricity</th>
                <th className="py-3.5 px-3 text-right">Gas</th>
                <th className="py-3.5 px-3 text-right">Water</th>
                <th className="py-3.5 px-3 text-right text-slate-300 bg-[#0c2030]">
                  Water+Gas Share (1/3)
                </th>
                <th className="py-3.5 px-3 text-right text-cyan-300 bg-[#071d2b] font-bold">
                  {currentPerson.name} Total Bill
                </th>
                <th className="py-3.5 px-3 text-right">Expected Cont.</th>
                <th className="py-3.5 px-3 text-right text-teal-400 font-bold">Received</th>
                <th className="py-3.5 px-3 text-right">Balance</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 text-xs">
                    No utility records found for the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredBills.map(bill => {
                  const paid = paymentsByBillIdMap.get(bill.id) || 0;
                  const saleemBillRounded = Math.round(bill.totalBill);
                  const outstanding = saleemBillRounded - paid;
                  const status = getUtilityPaymentStatus(bill.totalBill, paid);
                  const monthName = getMonthYearFormatted(bill.monthYear);

                  return (
                    <tr key={bill.id} className="hover:bg-[#102638]/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-100 whitespace-nowrap">
                        {monthName}
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-slate-300 whitespace-nowrap">
                        {formatCurrency(bill.electricity)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-slate-300 whitespace-nowrap">
                        {formatCurrency(bill.gas)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-slate-300 whitespace-nowrap">
                        {formatCurrency(bill.water)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-semibold text-slate-200 bg-[#071724]/40 whitespace-nowrap">
                        {formatCurrency(bill.saleemWaterGasShare)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold text-cyan-300 bg-[#071724]/60 whitespace-nowrap">
                        {formatCurrency(saleemBillRounded)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-slate-400 whitespace-nowrap">
                        {formatCurrency(bill.expectedContribution)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold text-teal-400 whitespace-nowrap">
                        {formatCurrency(paid)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold whitespace-nowrap">
                        {outstanding < 0 ? (
                          <span className="text-teal-400 text-xs">Tahir owes {currentPerson.name}: {formatCurrency(Math.abs(outstanding))}</span>
                        ) : outstanding === 0 ? (
                          <span className="text-emerald-400 text-xs">0 PKR (Settled)</span>
                        ) : (
                          <span className="text-rose-400 text-xs">{currentPerson.name} owes Tahir: {formatCurrency(outstanding)}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <StatusBadge status={status as any} />
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenPayments(bill)}
                            className="px-2.5 py-1 bg-[#102638] hover:bg-[#16344d] text-cyan-300 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all border border-cyan-500/20"
                            title="Manage Payment Entries"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Payments</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(bill)}
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#102638] rounded-lg transition-all"
                            title="Edit Record"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteBill(bill.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {filteredBills.length > 0 && (
              <tfoot className="bg-[#071724] font-bold border-t border-slate-700 text-xs sm:text-sm">
                <tr>
                  <td className="py-3 px-4 text-slate-200">Total Statement</td>
                  <td className="py-3 px-3 text-right text-slate-500">-</td>
                  <td className="py-3 px-3 text-right text-slate-500">-</td>
                  <td className="py-3 px-3 text-right text-slate-500">-</td>
                  <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(summary.totalSaleemShare)}</td>
                  <td className="py-3 px-3 text-right text-cyan-300">{formatCurrency(summary.totalSaleemTotalBills)}</td>
                  <td className="py-3 px-3 text-right text-slate-400">{formatCurrency(summary.totalExpectedContribution)}</td>
                  <td className="py-3 px-3 text-right text-teal-400">{formatCurrency(summary.totalReceivedAmount)}</td>
                  <td className="py-3 px-3 text-right">
                    {summary.netStatus === 'saleem_owes_tahir' ? (
                      <span className="text-rose-400 font-bold">{formatCurrency(summary.netDifference)}</span>
                    ) : summary.netStatus === 'tahir_owes_saleem' ? (
                      <span className="text-teal-400 font-bold">-{formatCurrency(summary.netDifference)}</span>
                    ) : (
                      <span className="text-emerald-400 font-bold">0 PKR</span>
                    )}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 6. MODALS */}
      <AddEditUtilityBillModal
        isOpen={isAddEditModalOpen}
        onClose={() => setIsAddEditModalOpen(false)}
        billToEdit={billToEdit}
        persons={persons}
        selectedPersonId={selectedPersonId}
      />

      <UtilityPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        bill={selectedBillForPayment}
        person={currentPerson}
        payments={selectedBillForPayment ? (paymentsListMap.get(selectedBillForPayment.id) || []) : []}
      />

      <PersonManagementModal
        isOpen={isPersonModalOpen}
        onClose={() => setIsPersonModalOpen(false)}
        persons={persons}
        selectedPersonId={selectedPersonId}
        onSelectPerson={(id) => {
          setSelectedPersonId(id);
          setIsPersonModalOpen(false);
        }}
      />
    </div>
  );
};

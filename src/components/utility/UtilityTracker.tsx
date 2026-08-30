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
  Plus, 
  User, 
  CreditCard, 
  Edit3, 
  Trash2, 
  Filter, 
  FileText
} from 'lucide-react';
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
    // Sort descending by year then month
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
      // Also delete associated payments
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
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-500 fill-amber-500" />
              Utility Bills Management
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
              PKR
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track household monthly utility bills, {currentPerson.name}'s calculated share, and payments history.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsPersonModalOpen(true)}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
          >
            <User className="w-4 h-4 text-emerald-600" />
            <span>Person: <strong>{currentPerson.name}</strong></span>
          </button>

          {onOpenReport && (
            <button
              onClick={onOpenReport}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Reports</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Record Utility Bill</span>
          </button>
        </div>
      </div>

      {/* DASHBOARD SUMMARY CARDS (3 FOCUSED CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        
        {/* 1. Saleem Total Bills */}
        <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-1.5 hover:border-emerald-500/40 transition-all">
          <div className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
            {currentPerson.name} Total Bills
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {formatCurrency(summary.totalSaleemTotalBills)}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Electricity + 1/3 (Gas + Water)
          </div>
        </div>

        {/* 2. Total Received */}
        <div className="p-4 sm:p-5 bg-white rounded-3xl border border-emerald-200/90 bg-emerald-50/30 shadow-sm space-y-1.5 hover:border-emerald-500/40 transition-all">
          <div className="text-[11px] font-black uppercase text-emerald-800 tracking-wider">
            Total Received
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
            {formatCurrency(summary.totalReceivedAmount)}
          </div>
          <div className="text-xs text-emerald-600 font-medium">
            9,500/mo + Extra Payments
          </div>
        </div>

        {/* 3. Net Balance */}
        <div className={`p-4 sm:p-5 rounded-3xl border shadow-sm space-y-1.5 transition-all ${
          summary.netStatus === 'saleem_owes_tahir'
            ? 'bg-gradient-to-br from-rose-950 via-slate-900 to-rose-950 text-white border-rose-800/80 shadow-rose-950/20'
            : summary.netStatus === 'tahir_owes_saleem'
            ? 'bg-gradient-to-br from-teal-950 via-slate-900 to-teal-950 text-white border-teal-800/80 shadow-teal-950/20'
            : 'bg-gradient-to-br from-slate-900 to-slate-950 text-white border-slate-800'
        }`}>
          <div className="text-[11px] font-black uppercase tracking-wider opacity-90 flex items-center justify-between">
            <span>
              {summary.netStatus === 'saleem_owes_tahir' 
                ? `${currentPerson.name} Owes Tahir` 
                : summary.netStatus === 'tahir_owes_saleem' 
                ? `Tahir Owes ${currentPerson.name}` 
                : 'Net Balance'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
              summary.netStatus === 'saleem_owes_tahir'
                ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                : summary.netStatus === 'tahir_owes_saleem'
                ? 'bg-teal-500/30 text-teal-300 border border-teal-500/40'
                : 'bg-emerald-500/30 text-emerald-300'
            }`}>
              {summary.netStatus === 'saleem_owes_tahir' ? 'Saleem Payable' : summary.netStatus === 'tahir_owes_saleem' ? 'Advance / Excess' : 'Settled'}
            </span>
          </div>

          <div className={`text-2xl sm:text-3xl font-black tracking-tight ${
            summary.netStatus === 'saleem_owes_tahir'
              ? 'text-rose-300'
              : summary.netStatus === 'tahir_owes_saleem'
              ? 'text-teal-300'
              : 'text-emerald-400'
          }`}>
            {formatCurrency(summary.netDifference)}
          </div>

          <div className="text-xs opacity-75 font-medium">
            {summary.netStatus === 'saleem_owes_tahir' 
              ? 'Bill amount exceeds total received' 
              : summary.netStatus === 'tahir_owes_saleem' 
              ? 'Payment exceeds total bills' 
              : 'All monthly bills fully settled'}
          </div>
        </div>

      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                dateFilter === opt.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}

          {dateFilter === 'custom' && (
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <strong>{filteredBills.length}</strong> monthly records
        </div>
      </div>

      {/* MOBILE VIEW CARDS (hidden on desktop) */}
      <div className="block lg:hidden space-y-3">
        {filteredBills.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl text-center border border-dashed border-slate-300 text-slate-400 space-y-2">
            <Zap className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold">No utility bill records found for this filter.</p>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Bill Record
            </button>
          </div>
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
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition-all"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <div className="text-sm font-black text-slate-900">
                      {monthName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Expected: <strong>{formatCurrency(bill.expectedContribution)}</strong>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : status === 'partially_paid'
                      ? 'bg-blue-100 text-blue-800'
                      : status === 'overpaid'
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {status === 'partially_paid' ? 'Partially Paid' : status}
                  </span>
                </div>

                {/* Values Grid */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold">Water+Gas Share</div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {formatCurrency(bill.saleemWaterGasShare)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-emerald-700 font-semibold">{currentPerson.name} Total Bill</div>
                    <div className="font-black text-emerald-700 mt-0.5">
                      {formatCurrency(saleemBillRounded)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold">{currentPerson.name} Sent</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {formatCurrency(paid)}
                    </div>
                  </div>
                </div>

                {/* Balance Row */}
                <div className="flex items-center justify-between text-xs font-semibold px-1">
                  <span className="text-slate-600">
                    {outstanding > 0 ? `${currentPerson.name} Owes Tahir:` : outstanding < 0 ? `Tahir Owes ${currentPerson.name}:` : 'Status:'}
                  </span>
                  <span className={`font-black text-sm ${outstanding > 0 ? 'text-rose-600' : outstanding < 0 ? 'text-teal-600' : 'text-emerald-600'}`}>
                    {outstanding > 0 ? formatCurrency(outstanding) : outstanding < 0 ? formatCurrency(Math.abs(outstanding)) : 'Fully Settled (0 PKR)'}
                  </span>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenPayments(bill)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-1"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Payments ({paymentsListMap.get(bill.id)?.length || 0})
                  </button>

                  <button
                    onClick={() => handleOpenEdit(bill)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>

                  <button
                    onClick={() => handleDeleteBill(bill.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
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

      {/* DESKTOP TABLE VIEW (visible on desktop lg+) */}
      <div className="hidden lg:block bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Month / Period</th>
                <th className="py-3.5 px-3 text-right">Electricity</th>
                <th className="py-3.5 px-3 text-right">Gas</th>
                <th className="py-3.5 px-3 text-right">Water</th>
                <th className="py-3.5 px-3 text-right text-slate-700 bg-slate-100/50">
                  {currentPerson.name} Water+Gas Share
                </th>
                <th className="py-3.5 px-3 text-right text-emerald-800 bg-emerald-50/50 font-extrabold">
                  {currentPerson.name} Total Bill
                </th>
                <th className="py-3.5 px-3 text-right">Expected Cont.</th>
                <th className="py-3.5 px-3 text-right text-emerald-700">{currentPerson.name} Sent</th>
                <th className="py-3.5 px-3 text-right">Balance</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400 text-xs">
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
                    <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {monthName}
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                        {formatCurrency(bill.electricity)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                        {formatCurrency(bill.gas)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                        {formatCurrency(bill.water)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold text-slate-800 bg-slate-50/50 whitespace-nowrap">
                        {formatCurrency(bill.saleemWaterGasShare)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-black text-emerald-700 bg-emerald-50/30 whitespace-nowrap">
                        {formatCurrency(saleemBillRounded)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-semibold text-slate-600 whitespace-nowrap">
                        {formatCurrency(bill.expectedContribution)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                        {formatCurrency(paid)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-black whitespace-nowrap">
                        {outstanding < 0 ? (
                          <span className="text-teal-600 text-xs">Tahir owes {currentPerson.name}: {formatCurrency(Math.abs(outstanding))}</span>
                        ) : outstanding === 0 ? (
                          <span className="text-emerald-600 text-xs">0 PKR (Settled)</span>
                        ) : (
                          <span className="text-rose-600 text-xs">{currentPerson.name} owes Tahir: {formatCurrency(outstanding)}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : status === 'partially_paid'
                            ? 'bg-blue-100 text-blue-800'
                            : status === 'overpaid'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {status === 'partially_paid' ? 'Partially Paid' : status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenPayments(bill)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1 transition-all"
                            title="Manage Payment Entries"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            Payments
                          </button>

                          <button
                            onClick={() => handleOpenEdit(bill)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                            title="Edit Record"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteBill(bill.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
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
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300 text-xs sm:text-sm">
                <tr>
                  <td className="py-3 px-4 text-slate-900">Total Statement</td>
                  <td className="py-3 px-3 text-right">-</td>
                  <td className="py-3 px-3 text-right">-</td>
                  <td className="py-3 px-3 text-right">-</td>
                  <td className="py-3 px-3 text-right text-slate-800">{formatCurrency(summary.totalSaleemShare)}</td>
                  <td className="py-3 px-3 text-right text-emerald-800">{formatCurrency(summary.totalSaleemTotalBills)}</td>
                  <td className="py-3 px-3 text-right text-slate-700">{formatCurrency(summary.totalExpectedContribution)}</td>
                  <td className="py-3 px-3 text-right">
                    {summary.netStatus === 'saleem_owes_tahir' ? (
                      <span className="text-rose-700">{formatCurrency(summary.netDifference)}</span>
                    ) : summary.netStatus === 'tahir_owes_saleem' ? (
                      <span className="text-teal-700">-{formatCurrency(summary.netDifference)}</span>
                    ) : (
                      <span className="text-emerald-700">0 PKR</span>
                    )}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* MODALS */}
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

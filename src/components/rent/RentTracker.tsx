import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { RentPortion, RentMonthlyRecord } from '../../types';
import { 
  formatCurrency, 
  formatDate, 
  getMonthYearFormatted 
} from '../../utils/formatters';
import { 
  Home, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  CreditCard, 
  Edit2, 
  Trash2, 
  User, 
  X,
  Building,
  History,
  MessageSquare
} from 'lucide-react';

interface RentTrackerProps {
  selectedMonth: string; // YYYY-MM
  onOpenReport?: () => void;
}

export const RentTracker: React.FC<RentTrackerProps> = ({
  selectedMonth,
  onOpenReport
}) => {
  const portions = useLiveQuery(() => db.rent_portions.filter(p => p.active).toArray()) || [];
  const allRecords = useLiveQuery(() => db.rent_records.toArray()) || [];
  
  const currentMonthRecords = allRecords.filter(r => r.monthYear === selectedMonth);

  // State
  const [isPortionModalOpen, setIsPortionModalOpen] = useState(false);
  const [editingPortion, setEditingPortion] = useState<RentPortion | null>(null);
  const [portionName, setPortionName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [expectedRent, setExpectedRent] = useState('10000');
  const [dueDay, setDueDay] = useState('10');
  const [initialArrears, setInitialArrears] = useState('0');

  // Collect Rent Modal
  const [collectModalData, setCollectModalData] = useState<{
    portion: RentPortion;
    record?: RentMonthlyRecord;
    previousArrears: number;
    currentExpected: number;
    totalDue: number;
  } | null>(null);
  const [arrearsInput, setArrearsInput] = useState('');
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payDateInput, setPayDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [payMethodInput, setPayMethodInput] = useState('Cash');
  const [payNotesInput, setPayNotesInput] = useState('');

  // Map record by portionId for selectedMonth
  const currentRecordMap = new Map<string, RentMonthlyRecord>();
  currentMonthRecords.forEach(r => currentRecordMap.set(r.portionId, r));

  // Determine current day for overdue calculation
  const today = new Date();
  const currentYearMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  const currentDayOfMonth = today.getDate();

  // Helper to calculate previous months unpaid arrears for a portion
  const calculatePreviousArrears = (portion: RentPortion, targetMonthYear: string): number => {
    // Start with portion's initial/opening arrears
    let arrears = portion.initialArrears || 0;

    // Get all records for this portion prior to targetMonthYear sorted chronologically
    const previousRecords = allRecords
      .filter(r => r.portionId === portion.id && r.monthYear < targetMonthYear)
      .sort((a, b) => a.monthYear.localeCompare(b.monthYear));

    const recordedMonths = new Set(previousRecords.map(r => r.monthYear));

    // Sum arrears from recorded previous months
    previousRecords.forEach(r => {
      const monthArrears = r.arrearsAmount !== undefined ? r.arrearsAmount : 0;
      const monthDue = r.expectedAmount + monthArrears;
      const rem = Math.max(0, monthDue - r.paidAmount);
      // Update cumulative unpaid
      arrears = rem;
    });

    // Check if there are unrecorded past months between portion creation and targetMonthYear
    if (portion.createdAt) {
      try {
        const createdDate = new Date(portion.createdAt);
        const startY = createdDate.getFullYear();
        const startM = createdDate.getMonth() + 1;

        const [targetY, targetM] = targetMonthYear.split('-').map(Number);

        let curY = startY;
        let curM = startM;

        while (curY < targetY || (curY === targetY && curM < targetM)) {
          const mStr = `${curY}-${curM.toString().padStart(2, '0')}`;
          if (!recordedMonths.has(mStr)) {
            arrears += portion.expectedRent;
          }
          curM++;
          if (curM > 12) {
            curM = 1;
            curY++;
          }
        }
      } catch (err) {
        console.error('Error calculating unrecorded arrears:', err);
      }
    }

    return arrears;
  };

  // Helper to compute live status of a portion record with arrears
  const getPortionFinancials = (portion: RentPortion, rec?: RentMonthlyRecord) => {
    const previousArrears = rec?.arrearsAmount !== undefined 
      ? rec.arrearsAmount 
      : calculatePreviousArrears(portion, selectedMonth);
    const currentExpected = rec ? rec.expectedAmount : portion.expectedRent;
    const totalDue = currentExpected + previousArrears;
    const paid = rec ? rec.paidAmount : 0;
    const netRemaining = Math.max(0, totalDue - paid);

    let status: 'paid' | 'pending' | 'partially_paid' | 'overdue' = 'pending';

    if (paid >= totalDue && totalDue > 0) {
      status = 'paid';
    } else if (paid > 0) {
      status = 'partially_paid';
    } else {
      const isPastMonth = selectedMonth < currentYearMonth;
      const isCurrentMonthPastDue = selectedMonth === currentYearMonth && currentDayOfMonth > portion.dueDay;
      if (isPastMonth || isCurrentMonthPastDue || previousArrears > 0) {
        status = 'overdue';
      } else {
        status = 'pending';
      }
    }

    return {
      status,
      paid,
      currentExpected,
      previousArrears,
      totalDue,
      netRemaining
    };
  };

  // Summary calculations
  let totalCurrentExpected = 0;
  let totalPreviousArrears = 0;
  let totalCollected = 0;

  portions.forEach(p => {
    const rec = currentRecordMap.get(p.id);
    const fin = getPortionFinancials(p, rec);
    totalCurrentExpected += fin.currentExpected;
    totalPreviousArrears += fin.previousArrears;
    totalCollected += fin.paid;
  });

  const totalOverallPayable = totalCurrentExpected + totalPreviousArrears;
  const totalNetOutstanding = Math.max(0, totalOverallPayable - totalCollected);
  const collectionRate = totalOverallPayable > 0 ? Math.round((totalCollected / totalOverallPayable) * 100) : 0;

  // Handle Save Portion
  const handleSavePortion = async (e: React.FormEvent) => {
    e.preventDefault();
    const rent = parseFloat(expectedRent);
    const day = parseInt(dueDay, 10);
    const initArr = parseFloat(initialArrears) || 0;
    if (!portionName.trim() || !tenantName.trim() || isNaN(rent) || rent <= 0) {
      alert('Please fill valid portion and tenant details.');
      return;
    }

    if (editingPortion) {
      await db.rent_portions.update(editingPortion.id, {
        portionName: portionName.trim(),
        tenantName: tenantName.trim(),
        tenantPhone: tenantPhone.trim() || undefined,
        expectedRent: rent,
        dueDay: day || 10,
        initialArrears: initArr
      });
      setEditingPortion(null);
    } else {
      const newP: RentPortion = {
        id: `p_${Date.now()}`,
        portionName: portionName.trim(),
        tenantName: tenantName.trim(),
        tenantPhone: tenantPhone.trim() || undefined,
        expectedRent: rent,
        dueDay: day || 10,
        initialArrears: initArr,
        active: true,
        createdAt: new Date().toISOString()
      };
      await db.rent_portions.add(newP);
    }

    resetPortionForm();
    setIsPortionModalOpen(false);
  };

  const resetPortionForm = () => {
    setEditingPortion(null);
    setPortionName('');
    setTenantName('');
    setTenantPhone('');
    setExpectedRent('10000');
    setDueDay('10');
    setInitialArrears('0');
  };

  const handleEditPortion = (portion: RentPortion) => {
    setEditingPortion(portion);
    setPortionName(portion.portionName);
    setTenantName(portion.tenantName);
    setTenantPhone(portion.tenantPhone || '');
    setExpectedRent(portion.expectedRent.toString());
    setDueDay(portion.dueDay.toString());
    setInitialArrears((portion.initialArrears || 0).toString());
    setIsPortionModalOpen(true);
  };

  // Open Collect Rent Modal
  const handleOpenCollect = (portion: RentPortion, record?: RentMonthlyRecord) => {
    const fin = getPortionFinancials(portion, record);
    setCollectModalData({
      portion,
      record,
      previousArrears: fin.previousArrears,
      currentExpected: fin.currentExpected,
      totalDue: fin.totalDue
    });
    setArrearsInput(fin.previousArrears.toString());
    setPayAmountInput(record ? record.paidAmount.toString() : fin.totalDue.toString());
    setPayDateInput(record?.paymentDate || new Date().toISOString().split('T')[0]);
    setPayMethodInput(record?.paymentMethod || 'Cash');
    setPayNotesInput(record?.notes || '');
  };

  // Handle Collect Rent
  const handleCollectRent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectModalData) return;
    const { portion, record } = collectModalData;
    const paid = parseFloat(payAmountInput);
    const parsedArrears = parseFloat(arrearsInput);
    const validArrears = isNaN(parsedArrears) ? 0 : parsedArrears;
    if (isNaN(paid) || paid < 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    const currentTotalDue = portion.expectedRent + validArrears;
    const computedStatus = paid >= currentTotalDue && currentTotalDue > 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'pending';
    const recordId = record ? record.id : `${selectedMonth}_${portion.id}`;

    const newRecord: RentMonthlyRecord = {
      id: recordId,
      portionId: portion.id,
      portionName: portion.portionName,
      tenantName: portion.tenantName,
      monthYear: selectedMonth,
      expectedAmount: portion.expectedRent,
      arrearsAmount: validArrears,
      paidAmount: paid,
      status: computedStatus,
      paymentDate: payDateInput,
      paymentMethod: payMethodInput,
      notes: payNotesInput.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    await db.rent_records.put(newRecord);
    setCollectModalData(null);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Home className="w-6 h-6 text-emerald-600" />
            Rent Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Portions, monthly dues, collection, and cumulative previous arrears tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenReport && (
            <button
              onClick={onOpenReport}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm"
            >
              <FileText className="w-4 h-4 text-slate-600" />
              Rent Report
            </button>
          )}
          <button
            onClick={() => {
              resetPortionForm();
              setIsPortionModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Manage Portions
          </button>
        </div>
      </div>

      {/* Monthly & Arrears Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-md">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
            Collected Rent
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold mt-1">
            {formatCurrency(totalCollected)}
          </div>
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-white/20 text-emerald-100 font-medium">
            <span>Total Payable: {formatCurrency(totalOverallPayable)}</span>
            <span>{collectionRate}%</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Total Outstanding
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">
            {formatCurrency(totalNetOutstanding)}
          </div>
          <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100 flex justify-between">
            <span>Current: {formatCurrency(Math.max(0, totalCurrentExpected - totalCollected))}</span>
            <span className="text-amber-700 font-bold">Arrears: {formatCurrency(totalPreviousArrears)}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Previous Arrears
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-700 mt-1">
            {formatCurrency(totalPreviousArrears)}
          </div>
          <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
            Accumulated from past months
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Collection Status
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{portions.filter(p => getPortionFinancials(p, currentRecordMap.get(p.id)).status === 'paid').length} Paid</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
              <Clock className="w-4 h-4" />
              <span>{portions.filter(p => getPortionFinancials(p, currentRecordMap.get(p.id)).status !== 'paid').length} Pending</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${collectionRate}%` }} />
          </div>
        </div>
      </div>

      {/* Portions Grid for Selected Month */}
      {portions.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-dashed border-slate-300 shadow-sm space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Building className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">No Rental Portions Added</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add your house portions or apartments along with tenant details to start tracking monthly rents and collections.
          </p>
          <button
            onClick={() => {
              resetPortionForm();
              setIsPortionModalOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add First Portion
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {portions.map(portion => {
            const record = currentRecordMap.get(portion.id);
          const fin = getPortionFinancials(portion, record);

          const isPaid = fin.status === 'paid';
          const isPartial = fin.status === 'partially_paid';
          const isOverdue = fin.status === 'overdue';

          return (
            <div
              key={portion.id}
              className={`bg-white rounded-3xl p-5 border transition-all shadow-sm flex flex-col justify-between gap-4 ${
                isPaid
                  ? 'border-emerald-200/80 hover:border-emerald-400'
                  : isOverdue
                  ? 'border-rose-200 hover:border-rose-400'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Top Row: Portion Name & Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
                      isPaid
                        ? 'bg-emerald-100 text-emerald-800'
                        : isOverdue
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">{portion.portionName}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{portion.tenantName}</span>
                        {portion.tenantPhone && (
                          <span className="text-slate-400">({portion.tenantPhone})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold uppercase tracking-wide flex items-center gap-1 ${
                    isPaid
                      ? 'bg-emerald-100 text-emerald-800'
                      : isOverdue
                      ? 'bg-rose-100 text-rose-800'
                      : isPartial
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {isPaid ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        PAID
                      </>
                    ) : isOverdue ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        OVERDUE
                      </>
                    ) : isPartial ? (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        PARTIAL
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        PENDING
                      </>
                    )}
                  </span>
                </div>

                {/* Amount Breakdown Matrix including Previous Arrears */}
                <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl mt-3.5 text-center border border-slate-100">
                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Current Rent</div>
                    <div className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5">
                      {formatCurrency(fin.currentExpected)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[9px] text-rose-700 font-bold uppercase flex items-center justify-center gap-0.5">
                      <History className="w-2.5 h-2.5" />
                      Arrears
                    </div>
                    <div className={`font-bold text-xs sm:text-sm mt-0.5 ${
                      fin.previousArrears > 0 ? 'text-rose-700 font-black' : 'text-slate-500'
                    }`}>
                      {formatCurrency(fin.previousArrears)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Collected</div>
                    <div className="font-bold text-emerald-600 text-xs sm:text-sm mt-0.5">
                      {formatCurrency(fin.paid)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Remaining</div>
                    <div className="font-extrabold text-slate-900 text-xs sm:text-sm mt-0.5">
                      {formatCurrency(fin.netRemaining)}
                    </div>
                  </div>
                </div>

                {/* Total Payable banner if Arrears exist */}
                {fin.previousArrears > 0 && (
                  <div className="bg-amber-50 p-2 rounded-xl border border-amber-200 mt-2 flex items-center justify-between text-xs text-amber-800">
                    <span className="font-semibold">Total Due (Current + Arrears):</span>
                    <strong className="font-black text-amber-900 text-sm">{formatCurrency(fin.totalDue)}</strong>
                  </div>
                )}

                {/* Payment Detail if recorded */}
                {record && (
                  <div className="text-xs text-slate-500 mt-2 flex items-center justify-between">
                    <span>
                      {record.paymentDate ? `Paid on ${formatDate(record.paymentDate, 'short')}` : 'No payment date'} 
                      {record.paymentMethod ? ` via ${record.paymentMethod}` : ''}
                    </span>
                    {record.notes && <span className="text-slate-400 font-medium">"{record.notes}"</span>}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditPortion(portion)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>

                  {portion.tenantPhone && (
                    <button
                      onClick={() => {
                        const cleanPhone = portion.tenantPhone?.replace(/[^0-9]/g, '') || '';
                        const phoneWithCountry = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;
                        const msg = isPaid
                          ? `Assalam-o-Alaikum ${portion.tenantName},\n\n${portion.portionName} ka ${getMonthYearFormatted(selectedMonth)} ka rent (${formatCurrency(record?.paidAmount || fin.totalDue)}) receive ho chuka hai.\nPayment Method: ${record?.paymentMethod || 'Cash'}\nDate: ${record?.paymentDate || ''}\n\nShukriya!`
                          : `Assalam-o-Alaikum ${portion.tenantName},\n\n${portion.portionName} ka ${getMonthYearFormatted(selectedMonth)} ka rent (${formatCurrency(fin.totalDue)}) payable hai.\nBaraye meherbani payment clear karein.\n\nShukriya!`;
                        window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Send WhatsApp Receipt / Reminder"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp
                    </button>
                  )}
                </div>

                <button
                  onClick={() => handleOpenCollect(portion, record)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                    isPaid
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  {isPaid ? 'Update Payment' : 'Collect Rent'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* MODAL: COLLECT RENT / UPDATE RECORD */}
      {collectModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Collect Rent — {collectModalData.portion.portionName}
                </h3>
                <p className="text-xs text-slate-500">
                  Tenant: <strong className="text-slate-800">{collectModalData.portion.tenantName}</strong> • {getMonthYearFormatted(selectedMonth)}
                </p>
              </div>
              <button
                onClick={() => setCollectModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCollectRent} className="space-y-4 mt-4">
              {/* Detailed Breakdown with Editable Arrears */}
              <div className="bg-slate-50 p-3.5 rounded-2xl space-y-2 text-xs border border-slate-200/80">
                <div className="flex justify-between text-slate-600">
                  <span>Current Month Rent ({getMonthYearFormatted(selectedMonth).split(' ')[0]}):</span>
                  <span className="font-bold text-slate-800">{formatCurrency(collectModalData.currentExpected)}</span>
                </div>
                
                {/* Editable Arrears Field */}
                <div className="pt-2 border-t border-slate-200/60">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-rose-700 flex items-center gap-1">
                      <History className="w-3 h-3" />
                      Arrears for this portion (PKR):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={arrearsInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setArrearsInput(val);
                        const arr = parseFloat(val) || 0;
                        const total = collectModalData.currentExpected + arr;
                        if (!payAmountInput || payAmountInput === collectModalData.totalDue.toString()) {
                          setPayAmountInput(total.toString());
                        }
                      }}
                      className="w-28 px-2 py-1 bg-white border border-rose-300 rounded-lg text-xs font-bold text-rose-800 text-right focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Adjust or override arrears balance for this month if needed.
                  </p>
                </div>

                <div className="flex justify-between text-slate-900 pt-2 border-t border-slate-200 font-extrabold text-sm">
                  <span>Total Amount Due:</span>
                  <span className="text-emerald-700">
                    {formatCurrency(collectModalData.currentExpected + (parseFloat(arrearsInput) || 0))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount Received (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={payDateInput}
                    onChange={(e) => setPayDateInput(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={payMethodInput}
                    onChange={(e) => setPayMethodInput(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="JazzCash">JazzCash</option>
                    <option value="EasyPaisa">EasyPaisa</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes / Receipt Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid arrears + current rent"
                  value={payNotesInput}
                  onChange={(e) => setPayNotesInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectModalData(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20"
                >
                  Save Payment Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE PORTIONS */}
      {isPortionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingPortion ? 'Edit Portion Details' : 'Add New Portion Unit'}
              </h3>
              <button
                onClick={() => {
                  setIsPortionModalOpen(false);
                  resetPortionForm();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePortion} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Portion Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Portion 1, Upper Flat, Ground Floor"
                  value={portionName}
                  onChange={(e) => setPortionName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tenant Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ali Khan"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tenant Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="0300-1234567"
                    value={tenantPhone}
                    onChange={(e) => setTenantPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Monthly Rent (PKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={expectedRent}
                    onChange={(e) => setExpectedRent(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Due Day of Month *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Opening / Previous Arrears (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={initialArrears}
                  onChange={(e) => setInitialArrears(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Initial arrears balance before tracking or carried forward.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                {editingPortion && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Are you sure you want to deactivate this portion?')) return;
                      await db.rent_portions.update(editingPortion.id, { active: false });
                      setIsPortionModalOpen(false);
                      resetPortionForm();
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Deactivate
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPortionModalOpen(false);
                      resetPortionForm();
                    }}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md"
                  >
                    {editingPortion ? 'Save Changes' : 'Add Portion'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

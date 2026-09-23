import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { MilkConsumer, MilkDailyLog, MilkMonthlyRecord } from '../../types';
import { 
  formatCurrency, 
  formatDate,
  getDaysInMonth, 
  getMonthYearFormatted 
} from '../../utils/formatters';
import { getTodayLocalDateStr } from '../../utils/dateTime';
import { 
  Milk, 
  Plus, 
  FileText, 
  Settings2, 
  Check, 
  X as XIcon, 
  CheckCheck,
  Edit2,
  Trash2,
  Calendar,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  Wallet,
  MessageSquare
} from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { MetricCard } from '../ui/MetricCard';

interface MilkTrackerProps {
  selectedMonth: string; // YYYY-MM
  onOpenReport?: () => void;
}

export const MilkTracker: React.FC<MilkTrackerProps> = ({
  selectedMonth,
  onOpenReport
}) => {
  const consumers = useLiveQuery(() => db.milk_consumers.filter(c => c.active).toArray()) || [];
  const logs = useLiveQuery(
    () => db.milk_logs.filter(l => l.date.startsWith(selectedMonth)).toArray(),
    [selectedMonth]
  ) || [];
  const settingsList = useLiveQuery(() => db.settings.toArray());
  const currentSettings = settingsList?.[0];
  const ratePerKg = currentSettings?.milkDefaultRate || 260;

  // Monthly records query for selectedMonth and previous month
  const monthlyRecords = useLiveQuery(() => db.milk_monthly_records.toArray()) || [];
  const currentMonthRecord = monthlyRecords.find(r => r.monthYear === selectedMonth);
  const [curY, curM] = selectedMonth.split('-').map(Number);
  const prevDate = new Date(curY, curM - 2, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  // Local states
  const [isConsumersModalOpen, setIsConsumersModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [newRateInput, setNewRateInput] = useState(ratePerKg.toString());

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    paidAmount: '',
    previousRemaining: '0',
    remainingAmount: '',
    paymentDate: getTodayLocalDateStr(),
    paymentMethod: 'Cash' as 'Cash' | 'Easypaisa' | 'JazzCash' | 'Bank Transfer',
    notes: ''
  });

  // Consumer management state
  const [newConsumerName, setNewConsumerName] = useState('');
  const [newConsumerQuota, setNewConsumerQuota] = useState('1');
  const [editingConsumer, setEditingConsumer] = useState<MilkConsumer | null>(null);

  // Day Delivery Modal State (Safe Sheet to edit specific date)
  const [selectedDayForEdit, setSelectedDayForEdit] = useState<{
    day: number;
    dateStr: string;
    dayOfWeek: string;
  } | null>(null);

  // Temporary edits within the modal before saving or immediate reactive update
  const [customInputs, setCustomInputs] = useState<{ [consumerId: string]: string }>({});

  // Days for the selected month
  const monthDays = getDaysInMonth(selectedMonth);

  // Quick lookup map: `${dateStr}_${consumerId}` -> MilkDailyLog
  const logMap = new Map<string, MilkDailyLog>();
  logs.forEach(log => {
    logMap.set(`${log.date}_${log.consumerId}`, log);
  });

  // Open day delivery sheet for a specific day
  const handleOpenDayModal = (day: { day: number; dateStr: string; dayOfWeek: string }) => {
    setSelectedDayForEdit(day);
    const initialInputs: { [id: string]: string } = {};
    consumers.forEach(c => {
      const key = `${day.dateStr}_${c.id}`;
      const log = logMap.get(key);
      initialInputs[c.id] = log ? log.actualKg.toString() : c.defaultDailyKg.toString();
    });
    setCustomInputs(initialInputs);
  };

  // Set status for a consumer in the day modal
  const handleSetStatusInModal = async (
    dateStr: string,
    consumer: MilkConsumer,
    status: 'supplied' | 'missed' | 'custom',
    customKgValue?: number
  ) => {
    const key = `${dateStr}_${consumer.id}`;
    let kg = Number(consumer.defaultDailyKg);

    if (status === 'missed') {
      kg = 0;
    } else if (status === 'custom') {
      if (customKgValue !== undefined && !isNaN(customKgValue)) {
        kg = Number(customKgValue);
      } else {
        const inputStr = customInputs[consumer.id];
        const parsed = inputStr !== undefined ? parseFloat(inputStr) : consumer.defaultDailyKg;
        kg = !isNaN(parsed) && parsed >= 0 ? Number(parsed) : Number(consumer.defaultDailyKg);
      }
    } else {
      kg = Number(consumer.defaultDailyKg);
    }

    const logEntry: MilkDailyLog = {
      id: key,
      date: dateStr,
      consumerId: consumer.id,
      consumerName: consumer.name,
      status: status,
      actualKg: Number(kg),
      ratePerKg: Number(ratePerKg)
    };

    await db.milk_logs.put(logEntry);
  };

  // Mark all consumers as supplied for the open day
  const handleMarkDayAllSupplied = async (dateStr: string) => {
    for (const c of consumers) {
      const key = `${dateStr}_${c.id}`;
      await db.milk_logs.put({
        id: key,
        date: dateStr,
        consumerId: c.id,
        consumerName: c.name,
        status: 'supplied',
        actualKg: c.defaultDailyKg,
        ratePerKg: ratePerKg
      });
    }
  };

  // Mark today supplied
  const handleMarkTodayAllSupplied = async () => {
    const today = getTodayLocalDateStr();
    for (const c of consumers) {
      const key = `${today}_${c.id}`;
      await db.milk_logs.put({
        id: key,
        date: today,
        consumerId: c.id,
        consumerName: c.name,
        status: 'supplied',
        actualKg: c.defaultDailyKg,
        ratePerKg: ratePerKg
      });
    }
    alert("Today's milk delivery marked for all active people!");
  };

  // Bulk fill month
  const handleMarkEntireMonthSupplied = async () => {
    if (!confirm(`Do you want to initialize all remaining days in ${getMonthYearFormatted(selectedMonth)} as Supplied?`)) {
      return;
    }

    const entries: MilkDailyLog[] = [];
    for (const d of monthDays) {
      for (const c of consumers) {
        const key = `${d.dateStr}_${c.id}`;
        if (!logMap.has(key)) {
          entries.push({
            id: key,
            date: d.dateStr,
            consumerId: c.id,
            consumerName: c.name,
            status: 'supplied',
            actualKg: c.defaultDailyKg,
            ratePerKg: ratePerKg
          });
        }
      }
    }
    if (entries.length > 0) {
      await db.milk_logs.bulkPut(entries);
    }
  };

  // Add / Edit Consumer
  const handleSaveConsumer = async (e: React.FormEvent) => {
    e.preventDefault();
    const quota = parseFloat(newConsumerQuota);
    if (!newConsumerName.trim() || isNaN(quota) || quota <= 0) {
      alert('Please enter valid consumer name and daily quota');
      return;
    }

    if (editingConsumer) {
      await db.milk_consumers.update(editingConsumer.id, {
        name: newConsumerName.trim(),
        defaultDailyKg: quota
      });
      setEditingConsumer(null);
    } else {
      const newC: MilkConsumer = {
        id: `c_${Date.now()}`,
        name: newConsumerName.trim(),
        defaultDailyKg: quota,
        active: true,
        createdAt: new Date().toISOString()
      };
      await db.milk_consumers.add(newC);
    }

    setNewConsumerName('');
    setNewConsumerQuota('1');
  };

  const handleDeleteConsumer = async (id: string) => {
    if (!confirm('Are you sure you want to remove this person from active tracking?')) return;
    await db.milk_consumers.update(id, { active: false });
  };

  // Update Rate
  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(newRateInput);
    if (isNaN(rate) || rate <= 0) {
      alert('Please enter a valid rate');
      return;
    }

    if (currentSettings?.id) {
      await db.settings.update(currentSettings.id, { milkDefaultRate: rate });
    } else {
      await db.settings.add({
        currency: 'PKR',
        milkDefaultRate: rate,
        rentDueDayDefault: 10,
        theme: 'dark'
      });
    }
    setIsRateModalOpen(false);
  };

  // Monthly totals & person breakdowns
  let totalSuppliedKg = 0;
  let totalMissedKg = 0;
  let totalMissedDays = 0;

  const consumerStats: { [consumerId: string]: { name: string; suppliedKg: number; missedDays: number; missedKg: number; cost: number } } = {};
  consumers.forEach(c => {
    consumerStats[c.id] = {
      name: c.name,
      suppliedKg: 0,
      missedDays: 0,
      missedKg: 0,
      cost: 0
    };
  });

  monthDays.forEach(day => {
    consumers.forEach(c => {
      const key = `${day.dateStr}_${c.id}`;
      const log = logMap.get(key);

      let actualKg = Number(c.defaultDailyKg);
      let status: 'supplied' | 'missed' | 'custom' = 'supplied';

      if (log) {
        status = log.status;
        actualKg = Number(log.actualKg);
      }

      if (status === 'missed' || (status !== 'custom' && actualKg === 0)) {
        totalMissedDays += 1;
        totalMissedKg += Number(c.defaultDailyKg);
        if (consumerStats[c.id]) {
          consumerStats[c.id].missedDays += 1;
          consumerStats[c.id].missedKg += Number(c.defaultDailyKg);
        }
      } else if (status === 'custom') {
        totalSuppliedKg += actualKg;
        const missedDiff = Math.max(0, Number(c.defaultDailyKg) - actualKg);
        totalMissedKg += missedDiff;
        if (consumerStats[c.id]) {
          consumerStats[c.id].suppliedKg += actualKg;
          consumerStats[c.id].missedKg += missedDiff;
        }
      } else {
        totalSuppliedKg += actualKg;
        if (consumerStats[c.id]) {
          consumerStats[c.id].suppliedKg += actualKg;
        }
      }
    });
  });

  Object.keys(consumerStats).forEach(id => {
    consumerStats[id].cost = consumerStats[id].suppliedKg * ratePerKg;
  });

  const totalMonthlyAmount = totalSuppliedKg * ratePerKg;

  // Previous remaining balance: searches for latest prior month record chronologically
  const latestPriorRecord = monthlyRecords
    .filter(r => r.monthYear < selectedMonth)
    .sort((a, b) => b.monthYear.localeCompare(a.monthYear))[0];

  const previousRemaining = currentMonthRecord?.previousRemaining !== undefined
    ? Number(currentMonthRecord.previousRemaining)
    : (latestPriorRecord ? Number(latestPriorRecord.remainingAmount || 0) : 0);

  const totalPayable = totalMonthlyAmount + previousRemaining;
  const paidAmount = currentMonthRecord ? Number(currentMonthRecord.paidAmount || 0) : 0;
  const remainingAmount = currentMonthRecord?.remainingAmount !== undefined
    ? Number(currentMonthRecord.remainingAmount)
    : Math.max(0, totalPayable - paidAmount);

  const paymentStatus: 'paid' | 'partial' | 'unpaid' = currentMonthRecord?.status || (
    remainingAmount <= 0 && (paidAmount > 0 || totalPayable === 0)
      ? 'paid'
      : paidAmount > 0
      ? 'partial'
      : 'unpaid'
  );

  const handleOpenPaymentModal = () => {
    setPaymentForm({
      paidAmount: currentMonthRecord ? String(currentMonthRecord.paidAmount) : '',
      previousRemaining: String(previousRemaining),
      remainingAmount: String(remainingAmount),
      paymentDate: currentMonthRecord?.paymentDate || getTodayLocalDateStr(),
      paymentMethod: (currentMonthRecord?.paymentMethod as any) || 'Cash',
      notes: currentMonthRecord?.notes || ''
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaidAmountChange = (newPaidStr: string) => {
    const paidVal = parseFloat(newPaidStr) || 0;
    const prevRem = parseFloat(paymentForm.previousRemaining) || 0;
    const due = totalMonthlyAmount + prevRem;
    const rem = Math.max(0, due - paidVal);
    setPaymentForm(prev => ({
      ...prev,
      paidAmount: newPaidStr,
      remainingAmount: String(rem)
    }));
  };

  const handlePrevRemainingChange = (newPrevStr: string) => {
    const prevRem = parseFloat(newPrevStr) || 0;
    const paidVal = parseFloat(paymentForm.paidAmount) || 0;
    const due = totalMonthlyAmount + prevRem;
    const rem = Math.max(0, due - paidVal);
    setPaymentForm(prev => ({
      ...prev,
      previousRemaining: newPrevStr,
      remainingAmount: String(rem)
    }));
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const paid = parseFloat(paymentForm.paidAmount) || 0;
    const prevRem = parseFloat(paymentForm.previousRemaining) || 0;
    const rem = parseFloat(paymentForm.remainingAmount);
    const calculatedRem = !isNaN(rem) ? rem : Math.max(0, (totalMonthlyAmount + prevRem) - paid);
    const status: 'paid' | 'partial' | 'unpaid' = calculatedRem <= 0 && (paid > 0 || (totalMonthlyAmount + prevRem) === 0)
      ? 'paid'
      : paid > 0
      ? 'partial'
      : 'unpaid';

    const recordToSave: MilkMonthlyRecord = {
      id: selectedMonth,
      monthYear: selectedMonth,
      totalKg: totalSuppliedKg,
      ratePerKg,
      totalBill: totalMonthlyAmount,
      previousRemaining: prevRem,
      totalPayable: totalMonthlyAmount + prevRem,
      paidAmount: paid,
      remainingAmount: calculatedRem,
      status,
      paymentDate: paymentForm.paymentDate,
      paymentMethod: paymentForm.paymentMethod,
      notes: paymentForm.notes.trim(),
      updatedAt: new Date().toISOString()
    };

    await db.milk_monthly_records.put(recordToSave);
    setIsPaymentModalOpen(false);
  };

  const handleMarkAsFullyPaid = async () => {
    const recordToSave: MilkMonthlyRecord = {
      id: selectedMonth,
      monthYear: selectedMonth,
      totalKg: totalSuppliedKg,
      ratePerKg,
      totalBill: totalMonthlyAmount,
      previousRemaining,
      totalPayable,
      paidAmount: totalPayable,
      remainingAmount: 0,
      status: 'paid',
      paymentDate: getTodayLocalDateStr(),
      paymentMethod: currentMonthRecord?.paymentMethod || 'Cash',
      notes: currentMonthRecord?.notes || 'Paid in full',
      updatedAt: new Date().toISOString()
    };
    await db.milk_monthly_records.put(recordToSave);
  };

  const handleSendWhatsAppReceipt = () => {
    const monthName = getMonthYearFormatted(selectedMonth);
    const msg = `Assalam-o-Alaikum,\n\nMilk Delivery Account (${monthName}):\n• Total Milk: ${totalSuppliedKg} KG (@ ${ratePerKg} PKR/kg)\n• Monthly Bill: ${formatCurrency(totalMonthlyAmount)}\n${previousRemaining > 0 ? `• Previous Arrears: ${formatCurrency(previousRemaining)}\n• Total Due: ${formatCurrency(totalPayable)}\n` : ''}• Paid: ${formatCurrency(paidAmount)}${currentMonthRecord?.paymentMethod ? ` (${currentMonthRecord.paymentMethod})` : ''}\n• Remaining Balance: ${formatCurrency(remainingAmount)}\n• Status: ${paymentStatus === 'paid' ? 'Paid / Settled ✅' : paymentStatus === 'partial' ? 'Partial Payment ⚠️' : 'Unpaid ⏳'}\n\nShukriya!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Today's date helper
  const todayStr = getTodayLocalDateStr();
  const isTodayInSelectedMonth = todayStr.startsWith(selectedMonth);

  return (
    <div className="space-y-6 pb-16">
      {/* 1. PAGE HEADER */}
      <PageHeader
        icon={Milk}
        title="Milk Tracking"
        subtitle="Safe tap-to-manage delivery calendar, missed logs, and monthly billing."
        primaryAction={{
          label: currentMonthRecord ? "Update Settlement" : "Record Settlement",
          onClick: handleOpenPaymentModal
        }}
        secondaryAction={{
          label: `Rate: ${ratePerKg} PKR/kg`,
          icon: Settings2,
          onClick: () => {
            setNewRateInput(ratePerKg.toString());
            setIsRateModalOpen(true);
          }
        }}
      >
        <button
          onClick={() => setIsConsumersModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-[#102638] hover:bg-[#16344d] text-cyan-300 font-semibold text-xs flex items-center gap-1.5 transition-all border border-cyan-500/20"
        >
          <Plus className="w-3.5 h-3.5 text-[#18E6BE]" />
          <span>Manage People</span>
        </button>

        {onOpenReport && (
          <button
            onClick={onOpenReport}
            className="px-3.5 py-2 rounded-xl bg-[#102638] hover:bg-[#16344d] text-cyan-300 font-semibold text-xs flex items-center gap-1.5 transition-all border border-cyan-500/20"
          >
            <FileText className="w-3.5 h-3.5 text-[#18E6BE]" />
            <span>Milk Report</span>
          </button>
        )}
      </PageHeader>

      {/* 2. MAIN MONTHLY STAT CARDS (4 CARDS MATCHING PANEL 5) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Bill */}
        <MetricCard
          title="Total Milk Bill"
          value={formatCurrency(totalMonthlyAmount)}
          subtitle={`@ ${ratePerKg} PKR / KG`}
          icon={Milk}
          variant="default"
        />

        {/* Card 2: Paid Amount */}
        <MetricCard
          title="Paid Amount"
          value={formatCurrency(paidAmount)}
          subtitle={currentMonthRecord?.paymentDate 
            ? `Paid on ${formatDate(currentMonthRecord.paymentDate, 'short')}` 
            : paidAmount > 0 
            ? 'Recorded' 
            : 'No payment yet'}
          icon={CheckCircle2}
          variant="success"
        />

        {/* Card 3: Remaining Balance */}
        <MetricCard
          title="Remaining Balance"
          value={formatCurrency(remainingAmount)}
          subtitle={remainingAmount === 0 ? 'All Cleared (Nil)' : paymentStatus === 'partial' ? 'Partial Balance Due' : 'Pending Full Payment'}
          icon={Wallet}
          variant={remainingAmount === 0 ? 'success' : 'danger'}
        />

        {/* Card 4: Supplied Milk */}
        <MetricCard
          title="Supplied Milk"
          value={`${totalSuppliedKg} KG`}
          subtitle={`Missed: ${totalMissedDays}d (${totalMissedKg}kg)`}
          icon={Calendar}
          variant="accent"
        />
      </div>

      {/* 3. MONTHLY SETTLEMENT & PAYMENT ACTION BANNER */}
      <div className="bg-[#0B1D2C] rounded-2xl p-4 sm:p-5 border border-slate-700/50 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              paymentStatus === 'paid' ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' :
              paymentStatus === 'partial' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
              'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}>
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                  Monthly Settlement & Milk Bill ({getMonthYearFormatted(selectedMonth)})
                </h3>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                  paymentStatus === 'paid' ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' :
                  paymentStatus === 'partial' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                  'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  {paymentStatus === 'paid' ? 'Paid / Cleared' : paymentStatus === 'partial' ? 'Partially Paid' : 'Unpaid'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentMonthRecord?.paymentDate 
                  ? `Last recorded on ${formatDate(currentMonthRecord.paymentDate, 'short')} via ${currentMonthRecord.paymentMethod || 'Cash'}`
                  : 'Record payments made to the milkman and track carryover remaining'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleOpenPaymentModal}
              className="px-3.5 py-2 rounded-xl bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#18E6BE]/20 transition-all active:scale-95"
            >
              <CreditCard className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{currentMonthRecord ? 'Update Payment' : 'Record Payment'}</span>
            </button>

            {paymentStatus !== 'paid' && totalPayable > 0 && (
              <button
                onClick={handleMarkAsFullyPaid}
                className="px-3 py-2 rounded-xl bg-[#102638] hover:bg-[#16344d] text-teal-300 border border-teal-500/30 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                title="Mark the entire bill as paid"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#18E6BE]" />
                <span>Mark Fully Paid</span>
              </button>
            )}

            <button
              onClick={handleSendWhatsAppReceipt}
              className="p-2 rounded-xl bg-[#102638] hover:bg-[#16344d] text-teal-300 border border-teal-500/30 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
              title="Share payment summary on WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#18E6BE]" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Financial Flow Breakdown Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 text-center">
          <div className="bg-[#071724] p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Month Milk Bill</div>
            <div className="text-sm sm:text-base font-bold text-slate-100 mt-0.5">
              {formatCurrency(totalMonthlyAmount)}
            </div>
            <div className="text-[10px] text-slate-500">{totalSuppliedKg} KG × {ratePerKg}</div>
          </div>

          <div className="bg-[#071724] p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Previous Remaining</div>
            <div className="text-sm sm:text-base font-bold text-slate-300 mt-0.5">
              {formatCurrency(previousRemaining)}
            </div>
            <div className="text-[10px] text-slate-500">Past arrears</div>
          </div>

          <div className="bg-[#071724] p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Total Payable</div>
            <div className="text-sm sm:text-base font-bold text-cyan-300 mt-0.5">
              {formatCurrency(totalPayable)}
            </div>
            <div className="text-[10px] text-slate-500">Bill + Arrears</div>
          </div>

          <div className="bg-[#071724] p-2.5 rounded-xl border border-teal-500/30">
            <div className="text-[10px] font-semibold text-teal-400 uppercase">Paid Amount</div>
            <div className="text-sm sm:text-base font-bold text-teal-300 mt-0.5">
              {formatCurrency(paidAmount)}
            </div>
            <div className="text-[10px] text-teal-500 font-medium truncate">
              {currentMonthRecord?.paymentMethod || (paidAmount > 0 ? 'Recorded' : 'Unpaid')}
            </div>
          </div>

          <div className={`p-2.5 rounded-xl border col-span-2 sm:col-span-1 ${
            remainingAmount === 0 
              ? 'bg-teal-950/30 text-teal-300 border-teal-500/40' 
              : 'bg-rose-950/30 text-rose-300 border-rose-500/40'
          }`}>
            <div className="text-[10px] font-bold uppercase tracking-wider">Remaining Balance</div>
            <div className="text-sm sm:text-base font-bold mt-0.5">
              {formatCurrency(remainingAmount)}
            </div>
            <div className="text-[10px] font-medium truncate">
              {remainingAmount === 0 ? 'Nil (Cleared)' : 'Baqaya to pay'}
            </div>
          </div>
        </div>

        {currentMonthRecord?.notes && (
          <div className="text-xs bg-[#071724] p-2.5 rounded-xl text-slate-300 border border-slate-800 flex items-center gap-1.5">
            <span className="font-semibold text-slate-400">Note:</span>
            <span>"{currentMonthRecord.notes}"</span>
          </div>
        )}
      </div>

      {/* 4. PERSON-WISE BREAKDOWN CARDS */}
      <div className="bg-[#0B1D2C] rounded-2xl p-4 sm:p-5 border border-slate-700/50 shadow-sm">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
          Person-Wise Quota & Monthly Bill ({getMonthYearFormatted(selectedMonth)})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {consumers.map(c => {
            const stat = consumerStats[c.id] || { suppliedKg: 0, missedDays: 0, missedKg: 0, cost: 0 };
            return (
              <div key={c.id} className="p-3.5 bg-[#071724] rounded-xl border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100 text-sm">{c.name}</span>
                    <span className="text-xs bg-[#102638] text-cyan-300 border border-cyan-500/30 font-bold px-2 py-0.5 rounded-md">
                      {c.defaultDailyKg} kg/day
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-100">
                    {formatCurrency(stat.cost)}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800">
                  <span>Supplied: <strong className="text-slate-200">{stat.suppliedKg} KG</strong></span>
                  <span className="text-rose-400 font-medium">Missed: {stat.missedDays}d ({stat.missedKg}kg)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. SAFE TAP PROTECTION & ACTION SHORTCUTS BANNER */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-[#0B1D2C] p-3.5 rounded-2xl border border-slate-700/50 shadow-sm">
        <div className="flex items-center gap-2.5 text-xs text-slate-300">
          <div className="w-7 h-7 rounded-lg bg-[#102638] text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4 text-[#18E6BE]" />
          </div>
          <div>
            <span className="font-bold text-slate-100">Safe Tap Protection Active</span>
            <span className="hidden sm:inline text-slate-400"> • Tap any day row below to open the Day Delivery Sheet and update records safely without accidental toggles.</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isTodayInSelectedMonth && (
            <button
              onClick={handleMarkTodayAllSupplied}
              className="px-3 py-1.5 rounded-xl bg-teal-950/60 hover:bg-teal-900/70 text-teal-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-teal-500/40"
            >
              <Check className="w-3.5 h-3.5 text-[#18E6BE]" />
              <span>Mark Today Done</span>
            </button>
          )}
          <button
            onClick={handleMarkEntireMonthSupplied}
            className="px-3 py-1.5 rounded-xl bg-[#102638] hover:bg-[#16344d] text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Fill Month</span>
          </button>
        </div>
      </div>

      {/* 6. DAILY ATTENDANCE & DELIVERY TABLE */}
      <div className="bg-[#0B1D2C] rounded-2xl border border-slate-700/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-slate-100 text-sm sm:text-base">
              Daily Delivery Log — {getMonthYearFormatted(selectedMonth)}
            </h3>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {monthDays.length} Days Total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#102638] text-slate-400 border-b border-slate-700/60 text-[11px] sm:text-xs uppercase font-semibold tracking-wider">
                <th className="py-3 px-3 sm:px-4 w-28">Date</th>
                {consumers.map(c => (
                  <th key={c.id} className="py-3 px-3 sm:px-4 text-center">
                    {c.name} ({c.defaultDailyKg}kg)
                  </th>
                ))}
                <th className="py-3 px-3 sm:px-4 text-right">Daily KG</th>
                <th className="py-3 px-3 sm:px-4 text-right">Daily Cost</th>
                <th className="py-3 px-2 sm:px-3 text-center w-12">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium text-slate-200">
              {monthDays.map(day => {
                let dayTotalKg = 0;
                const isToday = day.dateStr === todayStr;

                return (
                  <tr 
                    key={day.dateStr} 
                    onClick={() => handleOpenDayModal(day)}
                    className={`transition-colors cursor-pointer group ${
                      isToday 
                        ? 'bg-[#102638]/70 hover:bg-[#102638]' 
                        : 'hover:bg-[#102638]/40'
                    }`}
                  >
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-100">{day.day} {getMonthYearFormatted(selectedMonth).split(' ')[0]}</span>
                        {isToday && (
                          <span className="px-1.5 py-0.5 rounded bg-[#18E6BE] text-slate-950 text-[9px] font-black uppercase">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">{day.dayOfWeek}</div>
                    </td>

                    {consumers.map(c => {
                      const key = `${day.dateStr}_${c.id}`;
                      const log = logMap.get(key);
                      const status = log ? log.status : 'supplied';
                      const actualKg = log ? Number(log.actualKg) : Number(c.defaultDailyKg);

                      const isCustom = status === 'custom';
                      const isMissed = status === 'missed' || (!isCustom && actualKg === 0);

                      if (!isMissed) {
                        dayTotalKg += actualKg;
                      }

                      return (
                        <td key={c.id} className="py-3 px-2 sm:px-4 text-center">
                          <div className="inline-flex items-center justify-center">
                            {isMissed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-500/40">
                                <XIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Missed</span>
                              </span>
                            ) : isCustom ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 font-bold text-xs border border-cyan-500/40">
                                <span>{actualKg} KG</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-500/20 text-teal-300 font-bold text-xs border border-teal-500/40">
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>{actualKg} KG</span>
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-3 px-3 sm:px-4 text-right font-bold text-slate-100">
                      {dayTotalKg} KG
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-right font-bold text-teal-400">
                      {formatCurrency(dayTotalKg * ratePerKg)}
                    </td>

                    <td className="py-3 px-2 sm:px-3 text-center">
                      <div className="w-7 h-7 rounded-lg bg-[#071724] group-hover:bg-[#102638] group-hover:text-cyan-300 flex items-center justify-center text-slate-500 transition-colors mx-auto border border-slate-800">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-[#071724] font-bold text-slate-100 border-t border-slate-700">
              <tr>
                <td className="py-3.5 px-3 sm:px-4">Monthly Total</td>
                {consumers.map(c => {
                  const stat = consumerStats[c.id];
                  return (
                    <td key={c.id} className="py-3.5 px-3 sm:px-4 text-center">
                      <div className="text-sm font-bold text-slate-100">{stat?.suppliedKg || 0} KG</div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {formatCurrency(stat?.cost || 0)}
                      </div>
                    </td>
                  );
                })}
                <td className="py-3.5 px-3 sm:px-4 text-right text-base text-slate-100 font-bold">
                  {totalSuppliedKg} KG
                </td>
                <td className="py-3.5 px-3 sm:px-4 text-right text-base text-teal-400 font-bold">
                  {formatCurrency(totalMonthlyAmount)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 7. MODAL: SAFE DAY DELIVERY MANAGER SHEET */}
      {selectedDayForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0B1D2C] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-cyan-500/30 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#102638] text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5 text-[#18E6BE]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-base sm:text-lg leading-tight">
                    Delivery for {selectedDayForEdit.day} {getMonthYearFormatted(selectedMonth)}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {selectedDayForEdit.dayOfWeek} • Select delivery status for each person
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDayForEdit(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#102638]"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* List of Consumers for this day with Segmented Pill Controls */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1">
              {consumers.map(consumer => {
                const key = `${selectedDayForEdit.dateStr}_${consumer.id}`;
                const log = logMap.get(key);
                const currentStatus = log ? log.status : 'supplied';
                const currentKg = log ? log.actualKg : consumer.defaultDailyKg;

                const isCustom = currentStatus === 'custom';
                const isMissed = currentStatus === 'missed' || (!isCustom && currentKg === 0);
                const isSupplied = !isCustom && !isMissed;

                return (
                  <div 
                    key={consumer.id}
                    className="p-3.5 bg-[#071724] rounded-xl border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-100 text-sm">{consumer.name}</div>
                        <div className="text-[11px] text-slate-400">Default Quota: <strong className="text-slate-200">{consumer.defaultDailyKg} kg/day</strong></div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                          isMissed 
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                            : isCustom 
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                        }`}>
                          {isMissed ? '0 KG (Missed)' : `${currentKg} KG`}
                        </span>
                      </div>
                    </div>

                    {/* Segmented Selection Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 bg-[#0B1D2C] p-1 rounded-xl border border-slate-700">
                      {/* 1. SUPPLIED */}
                      <button
                        type="button"
                        onClick={() => handleSetStatusInModal(selectedDayForEdit.dateStr, consumer, 'supplied')}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                          isSupplied
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3] text-teal-400" />
                        <span>Full ({consumer.defaultDailyKg}kg)</span>
                      </button>

                      {/* 2. MISSED */}
                      <button
                        type="button"
                        onClick={() => handleSetStatusInModal(selectedDayForEdit.dateStr, consumer, 'missed')}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                          isMissed
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <XIcon className="w-3.5 h-3.5 stroke-[3] text-rose-400" />
                        <span>Missed (0kg)</span>
                      </button>

                      {/* 3. CUSTOM */}
                      <button
                        type="button"
                        onClick={() => {
                          const val = parseFloat(customInputs[consumer.id]) || consumer.defaultDailyKg;
                          handleSetStatusInModal(selectedDayForEdit.dateStr, consumer, 'custom', val);
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                          isCustom
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Custom KG</span>
                      </button>
                    </div>

                    {/* Inline Custom Input & Quick Steppers when Custom is selected */}
                    {isCustom && (
                      <div className="space-y-2 pt-2 bg-[#102638] p-3 rounded-xl border border-cyan-500/30">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-200 whitespace-nowrap">
                              Delivered Today (KG):
                            </label>
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={customInputs[consumer.id] !== undefined ? customInputs[consumer.id] : currentKg.toString()}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomInputs(prev => ({ ...prev, [consumer.id]: val }));
                                const num = parseFloat(val);
                                if (!isNaN(num) && num >= 0) {
                                  handleSetStatusInModal(selectedDayForEdit.dateStr, consumer, 'custom', num);
                                }
                              }}
                              onBlur={(e) => {
                                const val = e.target.value;
                                const num = parseFloat(val);
                                const validNum = !isNaN(num) && num >= 0 ? num : consumer.defaultDailyKg;
                                setCustomInputs(prev => ({ ...prev, [consumer.id]: validNum.toString() }));
                                handleSetStatusInModal(selectedDayForEdit.dateStr, consumer, 'custom', validNum);
                              }}
                              className="w-24 px-2.5 py-1.5 bg-[#071724] border border-cyan-500/40 rounded-lg text-sm font-bold text-slate-100 text-center focus:outline-none focus:border-cyan-400"
                            />
                          </div>

                          {/* Quick Stepper Buttons */}
                          <div className="flex items-center gap-1 ml-auto flex-wrap">
                            {[-1, -0.5, +0.5, +1].map(step => (
                              <button
                                key={step}
                                type="button"
                                onClick={() => {
                                  const currentVal = parseFloat(customInputs[consumer.id] !== undefined ? customInputs[consumer.id] : currentKg.toString()) || 0;
                                  const newVal = Math.max(0, parseFloat((currentVal + step).toFixed(2)));
                                  setCustomInputs(prev => ({ ...prev, [consumer.id]: newVal.toString() }));
                                  handleSetStatusInModal(selectedDayForEdit.dateStr, consumer, 'custom', newVal);
                                }}
                                className="px-2 py-1 bg-[#071724] hover:bg-[#0c2236] border border-slate-700 text-cyan-300 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                              >
                                {step > 0 ? `+${step}` : step} kg
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Live calculation explanation */}
                        <div className="flex items-center justify-between text-[11px] font-bold bg-[#071724] px-2.5 py-1.5 rounded-lg border border-slate-800">
                          <span className="text-teal-400">
                            ✓ Delivered: {currentKg} KG
                          </span>
                          <span className="text-rose-400">
                            ✕ Missed: {Math.max(0, parseFloat((consumer.defaultDailyKg - currentKg).toFixed(2)))} KG
                          </span>
                          <span className="text-slate-500">
                            (Quota: {consumer.defaultDailyKg}kg)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleMarkDayAllSupplied(selectedDayForEdit.dateStr)}
                className="px-3 py-2 text-xs font-bold text-teal-300 bg-teal-950/60 hover:bg-teal-900/70 rounded-xl border border-teal-500/30 transition-colors cursor-pointer"
              >
                Mark All Supplied (✓)
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (selectedDayForEdit) {
                    for (const consumer of consumers) {
                      const key = `${selectedDayForEdit.dateStr}_${consumer.id}`;
                      const log = logMap.get(key);
                      const currentStatus = log ? log.status : 'supplied';
                      if (currentStatus === 'custom') {
                        const raw = customInputs[consumer.id];
                        const parsed = raw !== undefined ? parseFloat(raw) : (log ? log.actualKg : consumer.defaultDailyKg);
                        const validKg = !isNaN(parsed) && parsed >= 0 ? Number(parsed) : Number(consumer.defaultDailyKg);
                        await db.milk_logs.put({
                          id: key,
                          date: selectedDayForEdit.dateStr,
                          consumerId: consumer.id,
                          consumerName: consumer.name,
                          status: 'custom',
                          actualKg: validKg,
                          ratePerKg: Number(ratePerKg)
                        });
                      }
                    }
                  }
                  setSelectedDayForEdit(null);
                }}
                className="px-5 py-2 bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 rounded-xl text-xs font-bold shadow-md shadow-[#18E6BE]/20 transition-all cursor-pointer"
              >
                Done & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: MANAGE CONSUMERS */}
      {isConsumersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0B1D2C] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-cyan-500/30 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-lg">
                Manage Milk Consumers
              </h3>
              <button
                onClick={() => {
                  setIsConsumersModalOpen(false);
                  setEditingConsumer(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#102638]"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Add / Edit Form */}
            <form onSubmit={handleSaveConsumer} className="bg-[#071724] p-3.5 rounded-xl my-3 border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-300">
                {editingConsumer ? `Edit ${editingConsumer.name}` : 'Add New Person'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Name (e.g. Saleem)"
                    value={newConsumerName}
                    onChange={(e) => setNewConsumerName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B1D2C] border border-slate-700 rounded-xl text-xs font-medium text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    placeholder="KG/day (e.g. 3)"
                    value={newConsumerQuota}
                    onChange={(e) => setNewConsumerQuota(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B1D2C] border border-slate-700 rounded-xl text-xs font-medium text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {editingConsumer && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingConsumer(null);
                      setNewConsumerName('');
                      setNewConsumerQuota('1');
                    }}
                    className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-[#102638] rounded-xl border border-slate-700"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 rounded-xl font-bold text-xs shadow-md shadow-[#18E6BE]/20"
                >
                  {editingConsumer ? 'Update Person' : '+ Add Person'}
                </button>
              </div>
            </form>

            {/* Active List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Current People ({consumers.length})
              </div>
              {consumers.map(c => (
                <div key={c.id} className="p-3 bg-[#071724] rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-100 text-sm">{c.name}</div>
                    <div className="text-xs text-teal-400 font-semibold">{c.defaultDailyKg} kg / day quota</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingConsumer(c);
                        setNewConsumerName(c.name);
                        setNewConsumerQuota(c.defaultDailyKg.toString());
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#102638] rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteConsumer(c.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsConsumersModalOpen(false)}
                className="px-4 py-1.5 bg-[#102638] hover:bg-[#16344d] text-slate-200 rounded-xl text-xs font-bold border border-slate-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL: SET RATE */}
      {isRateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0B1D2C] rounded-2xl max-w-xs w-full p-5 shadow-2xl border border-cyan-500/30">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-sm">
                Set Milk Rate (PKR / KG)
              </h3>
              <button
                onClick={() => setIsRateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#102638]"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRate} className="space-y-3 mt-3">
              <div>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={newRateInput}
                  onChange={(e) => setNewRateInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-lg font-bold text-slate-100 text-center focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[11px] text-slate-400 text-center block mt-1">
                  Default is 260 PKR / KG
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRateModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-[#102638] rounded-xl border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 rounded-xl font-bold text-xs shadow-md shadow-[#18E6BE]/20"
                >
                  Save Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. MODAL: RECORD / UPDATE MILK PAYMENT & REMAINING */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0B1D2C] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-cyan-500/30 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#102638] text-cyan-400 border border-cyan-500/30">
                  <CreditCard className="w-5 h-5 text-[#18E6BE]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                    Record Milk Payment
                  </h3>
                  <p className="text-xs text-slate-400">
                    {getMonthYearFormatted(selectedMonth)} Account
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#102638]"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4 mt-4">
              {/* Overview Summary Box */}
              <div className="bg-[#071724] p-3.5 rounded-xl border border-slate-800 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-400">Milk Bill</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-100 mt-0.5">
                    {formatCurrency(totalMonthlyAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-400">Past Arrears</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-300 mt-0.5">
                    {formatCurrency(parseFloat(paymentForm.previousRemaining) || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase text-teal-400">Total Due</div>
                  <div className="text-xs sm:text-sm font-bold text-teal-300 mt-0.5">
                    {formatCurrency(totalMonthlyAmount + (parseFloat(paymentForm.previousRemaining) || 0))}
                  </div>
                </div>
              </div>

              {/* Previous Remaining / Arrears Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Previous Remaining (Past Arrears)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-bold">PKR</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={paymentForm.previousRemaining}
                    onChange={(e) => handlePrevRemainingChange(e.target.value)}
                    className="w-full pl-12 pr-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-sm font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                    placeholder="0"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Defaults to remaining balance of previous month ({prevMonthStr})
                </span>
              </div>

              {/* Paid Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Paid Amount (This Month) *
                  </label>
                  <button
                    type="button"
                    onClick={() => handlePaidAmountChange(String(totalMonthlyAmount + (parseFloat(paymentForm.previousRemaining) || 0)))}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Set Full ({formatCurrency(totalMonthlyAmount + (parseFloat(paymentForm.previousRemaining) || 0))})
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-bold">PKR</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={paymentForm.paidAmount}
                    onChange={(e) => handlePaidAmountChange(e.target.value)}
                    className="w-full pl-12 pr-3 py-2 bg-[#071724] border border-cyan-500/40 rounded-xl text-base font-bold text-[#18E6BE] placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                    placeholder="e.g. 15000"
                    autoFocus
                  />
                </div>
              </div>

              {/* Remaining Balance (Calculated / Override) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Remaining Balance (Baqaya)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-bold">PKR</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={paymentForm.remainingAmount}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, remainingAmount: e.target.value }))}
                    className="w-full pl-12 pr-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-sm font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                    placeholder="0"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Automatically calculated as (Total Due - Paid). You can manually adjust if needed.
                </span>
              </div>

              {/* Payment Date & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Easypaisa">Easypaisa</option>
                    <option value="JazzCash">JazzCash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Paid to milkman Aslam in cash"
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#102638] rounded-xl border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#18E6BE] hover:bg-[#23F2CB] active:scale-95 text-slate-950 rounded-xl font-bold text-xs shadow-md shadow-[#18E6BE]/20 transition-all"
                >
                  Save Payment Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

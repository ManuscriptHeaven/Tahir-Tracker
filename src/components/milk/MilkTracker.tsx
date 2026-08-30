import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { MilkConsumer, MilkDailyLog } from '../../types';
import { 
  formatCurrency, 
  getDaysInMonth, 
  getMonthYearFormatted 
} from '../../utils/formatters';
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
  ShieldCheck
} from 'lucide-react';

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

  // Local states
  const [isConsumersModalOpen, setIsConsumersModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [newRateInput, setNewRateInput] = useState(ratePerKg.toString());

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
    const today = new Date().toISOString().split('T')[0];
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
        theme: 'light'
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

  // Today's date helper
  const todayStr = new Date().toISOString().split('T')[0];
  const isTodayInSelectedMonth = todayStr.startsWith(selectedMonth);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Milk className="w-6 h-6 text-emerald-600" />
            Milk Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Safe tap-to-manage delivery calendar, missed logs, and monthly billing
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setNewRateInput(ratePerKg.toString());
              setIsRateModalOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Rate: <strong className="text-emerald-700">{ratePerKg} PKR/kg</strong></span>
          </button>

          <button
            onClick={() => setIsConsumersModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Manage People
          </button>

          {onOpenReport && (
            <button
              onClick={onOpenReport}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
            >
              <FileText className="w-4 h-4" />
              Milk Report
            </button>
          )}
        </div>
      </div>

      {/* Main Monthly Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-md">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
            Total Milk Bill
          </div>
          <div className="text-xl sm:text-2xl font-extrabold mt-1">
            {formatCurrency(totalMonthlyAmount)}
          </div>
          <div className="text-[11px] text-emerald-100 mt-1">
            @ {ratePerKg} PKR / KG
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Supplied Milk
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-1">
            {totalSuppliedKg} <span className="text-sm font-semibold text-slate-500">KG</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            Active Deliveries
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Missed Days
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1">
            {totalMissedDays} <span className="text-sm font-semibold text-slate-500">Days</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Saved: {totalMissedKg} KG
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            People Count
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-1">
            {consumers.length} <span className="text-sm font-semibold text-slate-500">People</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {consumers.map(c => c.name).join(', ') || 'None'}
          </div>
        </div>
      </div>

      {/* Person-wise breakdown cards */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Person-Wise Quota & Monthly Bill ({getMonthYearFormatted(selectedMonth)})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {consumers.map(c => {
            const stat = consumerStats[c.id] || { suppliedKg: 0, missedDays: 0, missedKg: 0, cost: 0 };
            return (
              <div key={c.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{c.name}</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                      {c.defaultDailyKg} kg/day
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-extrabold text-slate-900">
                    {formatCurrency(stat.cost)}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200/60">
                  <span>Supplied: <strong className="text-slate-800">{stat.suppliedKg} KG</strong></span>
                  <span className="text-amber-700 font-medium">Missed: {stat.missedDays}d ({stat.missedKg}kg)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action shortcuts & Instructions Banner */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-800">Safe Tap Protection Active</span>
            <span className="hidden sm:inline text-slate-500"> • Tap any day row below to open the Day Delivery Sheet and update records safely without accidental toggles.</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isTodayInSelectedMonth && (
            <button
              onClick={handleMarkTodayAllSupplied}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-emerald-200"
            >
              <Check className="w-3.5 h-3.5" />
              Mark Today Done
            </button>
          )}
          <button
            onClick={handleMarkEntireMonthSupplied}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Fill Month
          </button>
        </div>
      </div>

      {/* Daily Attendance & Delivery Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              Daily Delivery Log — {getMonthYearFormatted(selectedMonth)}
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {monthDays.length} Days Total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] sm:text-xs uppercase font-bold tracking-wider">
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
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {monthDays.map(day => {
                let dayTotalKg = 0;
                const isToday = day.dateStr === todayStr;

                return (
                  <tr 
                    key={day.dateStr} 
                    onClick={() => handleOpenDayModal(day)}
                    className={`transition-colors cursor-pointer group ${
                      isToday 
                        ? 'bg-emerald-50/50 hover:bg-emerald-50' 
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{day.day} {getMonthYearFormatted(selectedMonth).split(' ')[0]}</span>
                        {isToday && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[9px] font-extrabold uppercase">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">{day.dayOfWeek}</div>
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
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200/80">
                                <XIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Missed</span>
                              </span>
                            ) : isCustom ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 font-bold text-xs border border-blue-200/80">
                                <span>{actualKg} KG</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200/80">
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>{actualKg} KG</span>
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-3 px-3 sm:px-4 text-right font-bold text-slate-900">
                      {dayTotalKg} KG
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-right font-bold text-emerald-700">
                      {formatCurrency(dayTotalKg * ratePerKg)}
                    </td>

                    <td className="py-3 px-2 sm:px-3 text-center">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-700 flex items-center justify-center text-slate-400 transition-colors mx-auto">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300">
              <tr>
                <td className="py-3.5 px-3 sm:px-4">Monthly Total</td>
                {consumers.map(c => {
                  const stat = consumerStats[c.id];
                  return (
                    <td key={c.id} className="py-3.5 px-3 sm:px-4 text-center">
                      <div className="text-sm font-black">{stat?.suppliedKg || 0} KG</div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        {formatCurrency(stat?.cost || 0)}
                      </div>
                    </td>
                  );
                })}
                <td className="py-3.5 px-3 sm:px-4 text-right text-base text-slate-900 font-black">
                  {totalSuppliedKg} KG
                </td>
                <td className="py-3.5 px-3 sm:px-4 text-right text-base text-emerald-700 font-black">
                  {formatCurrency(totalMonthlyAmount)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* MODAL: SAFE DAY DELIVERY MANAGER SHEET */}
      {selectedDayForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-tight">
                    Delivery for {selectedDayForEdit.day} {getMonthYearFormatted(selectedMonth)}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedDayForEdit.dayOfWeek} • Select delivery status for each person
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDayForEdit(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
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
                    className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{consumer.name}</div>
                        <div className="text-[11px] text-slate-500">Default Quota: <strong className="text-slate-700">{consumer.defaultDailyKg} kg/day</strong></div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${
                          isMissed 
                            ? 'bg-rose-100 text-rose-800' 
                            : isCustom 
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isMissed ? '0 KG (Missed)' : `${currentKg} KG`}
                        </span>
                      </div>
                    </div>

                    {/* Segmented Selection Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                      {/* 1. SUPPLIED */}
                      <button
                        type="button"
                        onClick={() => handleSetStatusInModal(selectedDayForEdit.dateStr, consumer, 'supplied')}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                          isSupplied
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Full ({consumer.defaultDailyKg}kg)</span>
                      </button>

                      {/* 2. MISSED */}
                      <button
                        type="button"
                        onClick={() => handleSetStatusInModal(selectedDayForEdit.dateStr, consumer, 'missed')}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                          isMissed
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <XIcon className="w-3.5 h-3.5 stroke-[3]" />
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
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Custom KG</span>
                      </button>
                    </div>

                    {/* Inline Custom Input & Quick Steppers when Custom is selected */}
                    {isCustom && (
                      <div className="space-y-2 pt-2 bg-blue-50/70 p-3 rounded-xl border border-blue-200/80">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-black text-slate-800 whitespace-nowrap">
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
                              className="w-24 px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-sm font-black text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center"
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
                                className="px-2 py-1 bg-white hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                              >
                                {step > 0 ? `+${step}` : step} kg
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Live calculation explanation */}
                        <div className="flex items-center justify-between text-[11px] font-bold bg-white/90 px-2.5 py-1.5 rounded-lg border border-blue-100">
                          <span className="text-emerald-700">
                            ✓ Delivered: {currentKg} KG
                          </span>
                          <span className="text-amber-700">
                            ✕ Missed / Cut: {Math.max(0, parseFloat((consumer.defaultDailyKg - currentKg).toFixed(2)))} KG
                          </span>
                          <span className="text-slate-400">
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
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleMarkDayAllSupplied(selectedDayForEdit.dateStr)}
                className="px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
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
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Done & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE CONSUMERS */}
      {isConsumersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">
                Manage Milk Consumers
              </h3>
              <button
                onClick={() => {
                  setIsConsumersModalOpen(false);
                  setEditingConsumer(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Add / Edit Form */}
            <form onSubmit={handleSaveConsumer} className="bg-slate-50 p-3.5 rounded-2xl my-3 border border-slate-200/60 space-y-3">
              <div className="text-xs font-bold text-slate-700">
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
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20"
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
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20"
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
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-sm hover:bg-emerald-700"
                >
                  {editingConsumer ? 'Update Person' : '+ Add Person'}
                </button>
              </div>
            </form>

            {/* Active List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Current People ({consumers.length})
              </div>
              {consumers.map(c => (
                <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                    <div className="text-xs text-emerald-700 font-semibold">{c.defaultDailyKg} kg / day quota</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingConsumer(c);
                        setNewConsumerName(c.name);
                        setNewConsumerQuota(c.defaultDailyKg.toString());
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteConsumer(c.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsConsumersModalOpen(false)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SET RATE */}
      {isRateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Set Milk Rate (PKR / KG)
              </h3>
              <button
                onClick={() => setIsRateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-lg font-extrabold text-slate-900 text-center focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="text-[11px] text-slate-400 text-center block mt-1">
                  Default is 260 PKR / KG
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRateModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  Save Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

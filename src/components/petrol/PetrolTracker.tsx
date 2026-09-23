import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { PetrolRefill } from '../../types';
import { 
  formatCurrency, 
  formatDate, 
  formatNumber, 
  getMonthYearFormatted 
} from '../../utils/formatters';
import { getTodayLocalDateStr } from '../../utils/dateTime';
import { multiplyMoney } from '../../utils/money';
import { 
  calculatePetrolIntervals,
  calculateMonthlyPetrolStats,
  validateRefillInput
} from '../../utils/petrolCalculations';
import { 
  Fuel, 
  FileText, 
  Gauge, 
  TrendingUp, 
  DollarSign, 
  Navigation, 
  Trash2, 
  Edit3, 
  X,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { MetricCard } from '../ui/MetricCard';
import { EmptyState } from '../ui/EmptyState';

interface PetrolTrackerProps {
  selectedMonth: string; // YYYY-MM
  onOpenReport?: () => void;
}

export const PetrolTracker: React.FC<PetrolTrackerProps> = ({
  selectedMonth,
  onOpenReport
}) => {
  // Fetch all refills sorted chronologically by odometer reading & date
  const allRefills = useLiveQuery(() => db.petrol_refills.orderBy('odometerReading').toArray()) || [];
  
  // Calculate deterministic full-tank intervals across all refills
  const allProcessedRefills = calculatePetrolIntervals(allRefills);

  // Filter for the selected month
  const monthlyRefills = allProcessedRefills.filter(r => r.date.startsWith(selectedMonth));

  // Monthly Aggregated Stats using full-tank methodology
  const monthlyStats = calculateMonthlyPetrolStats(allRefills, selectedMonth);

  // Modal & Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRefill, setEditingRefill] = useState<PetrolRefill | null>(null);

  const [date, setDate] = useState(getTodayLocalDateStr());
  const [odometerReading, setOdometerReading] = useState('');
  const [litres, setLitres] = useState('');
  const [pricePerLitre, setPricePerLitre] = useState('270');
  const [isFullTank, setIsFullTank] = useState(false);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Find latest recorded odometer reading across all records to prefill
  const latestRefill = allRefills.length > 0 ? allRefills[allRefills.length - 1] : null;
  const previousOdoSuggestion = latestRefill ? latestRefill.odometerReading : 0;

  // Helper to re-calculate distance & mileage for all refills sequentially using hybrid rules
  const recalculateAllRefills = async () => {
    const records = await db.petrol_refills.toArray();
    const processed = calculatePetrolIntervals(records);
    for (const p of processed) {
      await db.petrol_refills.update(p.id, {
        isFullTank: p.isFullTank ?? false,
        distanceTravelled: p.distanceUntilNextRefill ?? (p.calculationType === 'completed' ? p.intervalDistance : p.stepDistance),
        mileageKmpl: p.mileageKmpl || 0,
        costPerKm: p.refillCostPerKm ?? p.costPerKm ?? 0,
        updatedAt: new Date().toISOString()
      });
    }
  };

  // Handle Save Refill
  const handleSaveRefill = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const currentOdo = parseFloat(odometerReading);
    const qtyLitres = parseFloat(litres);
    const priceLtr = parseFloat(pricePerLitre);

    // Find preceding record's odometer reading
    const sortedOtherRefills = allRefills
      .filter(r => !editingRefill || r.id !== editingRefill.id)
      .sort((a, b) => a.odometerReading - b.odometerReading);

    let precedingOdo = 0;
    for (let i = sortedOtherRefills.length - 1; i >= 0; i--) {
      if (sortedOtherRefills[i].date <= date || sortedOtherRefills[i].odometerReading <= currentOdo) {
        precedingOdo = sortedOtherRefills[i].odometerReading;
        break;
      }
    }

    // Comprehensive validation check
    const validation = validateRefillInput(currentOdo, qtyLitres, priceLtr, precedingOdo);
    if (!validation.isValid) {
      setFormError(validation.error || 'Please enter valid refill data.');
      return;
    }

    const succeedingRecord = sortedOtherRefills.find(r => r.date > date && r.odometerReading < currentOdo);
    if (succeedingRecord) {
      setFormError(
        `Odometer reading (${currentOdo} km) is higher than subsequent record on ${succeedingRecord.date} (${succeedingRecord.odometerReading} km). Check your reading.`
      );
      return;
    }

    const calculatedTotalCost = multiplyMoney(qtyLitres, priceLtr);
    const nowIso = new Date().toISOString();

    if (editingRefill) {
      await db.petrol_refills.update(editingRefill.id, {
        date,
        odometerReading: currentOdo,
        litres: qtyLitres,
        pricePerLitre: priceLtr,
        totalCost: calculatedTotalCost,
        isFullTank,
        notes: notes.trim() || undefined,
        updatedAt: nowIso
      });
    } else {
      const newRefill: PetrolRefill = {
        id: `refill_${Date.now()}`,
        date,
        odometerReading: currentOdo,
        litres: qtyLitres,
        pricePerLitre: priceLtr,
        totalCost: calculatedTotalCost,
        isFullTank,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        notes: notes.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      await db.petrol_refills.add(newRefill);
    }

    await recalculateAllRefills();

    resetForm();
    setIsAddModalOpen(false);
  };

  const resetForm = () => {
    setEditingRefill(null);
    setOdometerReading('');
    setLitres('');
    setNotes('');
    setIsFullTank(false);
    setFormError(null);
  };

  const handleOpenEdit = (refill: PetrolRefill) => {
    setEditingRefill(refill);
    setDate(refill.date);
    setOdometerReading(refill.odometerReading.toString());
    setLitres(refill.litres.toString());
    setPricePerLitre(refill.pricePerLitre.toString());
    setIsFullTank(Boolean(refill.isFullTank));
    setNotes(refill.notes || '');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleDeleteRefill = async (id: string) => {
    if (!confirm('Are you sure you want to delete this refill record?')) return;
    await db.petrol_refills.delete(id);
    await recalculateAllRefills();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. PAGE HEADER */}
      <PageHeader
        icon={Fuel}
        title="Petrol & Mileage Tracking"
        subtitle="Monitor fuel consumption, vehicle odometer distance, and travel economy."
        primaryAction={{
          label: "+ Add Refill",
          onClick: () => {
            resetForm();
            setIsAddModalOpen(true);
          }
        }}
        secondaryAction={onOpenReport ? {
          label: "Petrol Reports",
          icon: FileText,
          onClick: onOpenReport
        } : undefined}
      />

      {/* 2. ACTIVE TRACKING STATUS BANNER */}
      {monthlyStats.latestRefill && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Latest Refill Card */}
          <div className="bg-[#0B1D2C] border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Latest Refill (Active)
              </span>
              <span className="text-xs font-semibold text-amber-200">
                {formatDate(monthlyStats.latestRefill.date, 'short')}
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <div>
                <span className="text-xl sm:text-2xl font-bold text-slate-100">
                  {formatCurrency(monthlyStats.latestRefill.totalCost)}
                </span>
                <span className="text-xs font-medium text-slate-400 ml-1.5">
                  ({monthlyStats.latestRefill.litres} L)
                </span>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/30 font-bold text-xs">
                  Distance: In Progress
                </span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Odometer: <strong className="font-mono text-slate-200">{formatNumber(monthlyStats.latestRefill.odometerReading, 0)} km</strong></span>
              <span className="text-[11px] text-slate-500">Completes when next refill is added</span>
            </div>
          </div>

          {/* Last Completed Refill Leg */}
          {monthlyStats.previousCompletedRefill ? (
            <div className="bg-[#0B1D2C] border border-teal-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#18E6BE]" />
                  Previous Completed Refill
                </span>
                <span className="text-xs font-semibold text-teal-200">
                  {formatDate(monthlyStats.previousCompletedRefill.date, 'short')}
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <div>
                  <span className="text-xl sm:text-2xl font-bold text-slate-100">
                    {monthlyStats.previousCompletedRefill.displayDistanceUntilNext}
                  </span>
                  <span className="text-xs font-medium text-slate-400 ml-1.5">
                    travelled before next refill
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base sm:text-lg font-bold text-teal-300 bg-teal-950/60 border border-teal-500/30 px-2.5 py-0.5 rounded-xl">
                    {monthlyStats.previousCompletedRefill.displayRefillCostPerKm}
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Refill: <strong className="text-slate-200">{formatCurrency(monthlyStats.previousCompletedRefill.totalCost)}</strong> ({monthlyStats.previousCompletedRefill.litres} L)</span>
                <span>Odometer: <strong className="font-mono text-slate-200">{formatNumber(monthlyStats.previousCompletedRefill.odometerReading, 0)} km</strong></span>
              </div>
            </div>
          ) : (
            <div className="bg-[#0B1D2C] border border-slate-700/50 rounded-2xl p-4 flex flex-col justify-center items-center text-center shadow-sm">
              <Fuel className="w-6 h-6 text-slate-500 mb-1" />
              <span className="text-xs font-semibold text-slate-300">No completed refill leg yet</span>
              <span className="text-[11px] text-slate-500">Enter a second refill to calculate completed distance and cost/KM</span>
            </div>
          )}
        </div>
      )}

      {/* 3. MONTHLY STATISTICS BANNER CARDS (MATCHING PANEL 6) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. Total Fuel Spend */}
        <MetricCard
          title="Total Fuel Spend"
          value={formatCurrency(monthlyStats.monthlyCost)}
          subtitle="Monthly Fuel Inflow"
          icon={DollarSign}
          variant="danger"
        />

        {/* 2. Petrol Purchased */}
        <MetricCard
          title="Fuel Purchased"
          value={`${formatNumber(monthlyStats.monthlyLitres, 1)} L`}
          subtitle="Total Litres Bought"
          icon={Fuel}
          variant="default"
        />

        {/* 3. Logged Distance */}
        <MetricCard
          title="Distance Logged"
          value={`${formatNumber(monthlyStats.loggedTravelKm, 0)} KM`}
          subtitle={`${monthlyRefills.length} Fill-up ${monthlyRefills.length === 1 ? 'record' : 'records'}`}
          icon={Navigation}
          variant="info"
        />

        {/* 4. Average Refill Cost/KM */}
        <MetricCard
          title="Avg Refill Rate"
          value={monthlyStats.avgRefillCostPerKm > 0 ? `${formatNumber(monthlyStats.avgRefillCostPerKm, 2)} PKR` : '—'}
          subtitle={monthlyStats.completedRefillsCount > 0 ? `${monthlyStats.completedRefillsCount} completed legs` : 'Leg in progress'}
          icon={Gauge}
          variant="default"
        />

        {/* 5. Verified Mileage */}
        <div className="col-span-2 sm:col-span-1">
          <MetricCard
            title="Verified Mileage"
            value={monthlyStats.avgMileage > 0 ? `${formatNumber(monthlyStats.avgMileage, 2)} KM/L` : '—'}
            subtitle={monthlyStats.completedIntervalsCount > 0 ? `${monthlyStats.completedIntervalsCount} Full-Tank Intervals` : 'Full-Tank Pending'}
            icon={TrendingUp}
            variant="accent"
          />
        </div>
      </div>

      {/* 4. REFILLS TABLE / TIMELINE */}
      <div className="bg-[#0B1D2C] rounded-2xl border border-slate-700/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-100 text-sm sm:text-base">
              Refill Log & Mileage Records — {getMonthYearFormatted(selectedMonth)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Refill-to-Refill daily tracking paired with Full-Tank verified fuel economy
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {monthlyRefills.length} Records
          </span>
        </div>

        {monthlyRefills.length === 0 ? (
          <EmptyState
            icon={Fuel}
            title="No Refill Records Found"
            description={`No petrol refills have been logged yet for ${getMonthYearFormatted(selectedMonth)}.`}
            action={{
              label: "+ Log First Refill",
              onClick: () => {
                resetForm();
                setIsAddModalOpen(true);
              }
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#102638] text-slate-400 border-b border-slate-700/60 text-[11px] sm:text-xs uppercase font-semibold tracking-wider">
                  <th className="py-3 px-3 sm:px-4">Date</th>
                  <th className="py-3 px-3 sm:px-4">Odometer</th>
                  <th className="py-3 px-3 sm:px-4">Fuel (L)</th>
                  <th className="py-3 px-3 sm:px-4">Rate (PKR)</th>
                  <th className="py-3 px-3 sm:px-4">Total Cost</th>
                  <th className="py-3 px-3 sm:px-4">Type</th>
                  <th className="py-3 px-3 sm:px-4 bg-[#0a1e2d]">Distance After Refill</th>
                  <th className="py-3 px-3 sm:px-4 bg-[#0a1e2d]">Refill Cost/KM</th>
                  <th className="py-3 px-3 sm:px-4 bg-[#072422]">Verified Mileage</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium text-slate-200">
                {monthlyRefills.map((refill) => (
                  <tr key={refill.id} className="hover:bg-[#102638]/50 transition-colors">
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-100">{formatDate(refill.date, 'short')}</div>
                      {refill.notes && (
                        <div className="text-[11px] text-slate-400 font-normal">{refill.notes}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 sm:px-4 font-mono font-bold text-slate-100">
                      {formatNumber(refill.odometerReading, 0)} km
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-slate-200">
                      {refill.litres} L
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-slate-400">
                      {refill.pricePerLitre}
                    </td>
                    <td className="py-3 px-3 sm:px-4 font-bold text-slate-100">
                      {formatCurrency(refill.totalCost)}
                    </td>
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      {refill.calculationType === 'completed' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-[#18E6BE]" /> Full Tank
                        </span>
                      ) : refill.calculationType === 'baseline' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold text-[11px]">
                          Baseline Full
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#102638] text-slate-300 border border-slate-700 font-medium text-[11px]">
                          Partial Refill
                        </span>
                      )}
                    </td>
                    {/* DAILY TRACKING: Distance After Refill */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap bg-[#071724]/40">
                      {refill.isRefillSegmentComplete ? (
                        <div>
                          <span className="font-bold text-slate-100">{refill.displayDistanceUntilNext}</span>
                          <span className="block text-[10px] text-slate-500 font-normal">until next refill</span>
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950/60 text-amber-300 border border-amber-500/30">
                            In Progress
                          </span>
                          <span className="block text-[10px] text-amber-400/80 font-normal">awaiting next refill</span>
                        </div>
                      )}
                    </td>
                    {/* DAILY TRACKING: Refill Cost/KM */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap bg-[#071724]/40">
                      {refill.refillCostPerKm !== null ? (
                        <div>
                          <span className="font-bold text-slate-100">{formatNumber(refill.refillCostPerKm, 2)} PKR</span>
                          <span className="block text-[10px] text-slate-500 font-normal">refill cost/km</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs font-medium">—</span>
                      )}
                    </td>
                    {/* ACCURATE FUEL ECONOMY: Verified Mileage */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap bg-[#071d2b]/30">
                      {refill.calculationType === 'completed' ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold text-xs">
                            {formatNumber(refill.mileageKmpl, 2)} km/L
                          </span>
                          <span className="block text-[10px] text-teal-400 font-medium">
                            {refill.intervalDistance} km / {refill.intervalFuel} L
                          </span>
                        </div>
                      ) : refill.calculationType === 'baseline' ? (
                        <div>
                          <span className="text-slate-500 text-xs font-medium">—</span>
                          <span className="block text-[10px] text-cyan-400 font-medium">Baseline (first full tank)</span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-slate-500 text-xs font-medium">—</span>
                          <span className="block text-[10px] text-slate-500 font-normal">At next full tank</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(refill)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#102638] rounded-lg transition-colors"
                          title="Edit Refill"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRefill(refill.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete Refill"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. MODAL: ADD / EDIT REFILL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0B1D2C] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-cyan-500/30 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-lg flex items-center gap-2">
                <Fuel className="w-5 h-5 text-[#18E6BE]" />
                <span>{editingRefill ? 'Edit Refill Entry' : 'Log New Fuel Refill'}</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#102638]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRefill} className="space-y-4 mt-4">
              {/* Validation Error Banner */}
              {formError && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="flex-1 font-semibold">{formError}</div>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Refill Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Meter Reading */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Odometer Meter Reading (KM) *
                  </label>
                  {previousOdoSuggestion > 0 && !editingRefill && (
                    <span className="text-[11px] text-cyan-400 font-semibold">
                      Previous: {previousOdoSuggestion} km
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Gauge className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder={previousOdoSuggestion ? `e.g. ${previousOdoSuggestion + 350}` : 'e.g. 12400'}
                    value={odometerReading}
                    onChange={(e) => {
                      setOdometerReading(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-base font-bold text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Petrol Litres & Price Per Litre */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Petrol Quantity (Litres) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    placeholder="e.g. 10.5"
                    value={litres}
                    onChange={(e) => {
                      setLitres(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-sm font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Price / Litre (PKR) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="e.g. 270"
                    value={pricePerLitre}
                    onChange={(e) => {
                      setPricePerLitre(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-sm font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Full Tank Toggle */}
              <div className="p-3 bg-[#102638] rounded-xl border border-cyan-500/30">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isFullTank}
                    onChange={(e) => setIsFullTank(e.target.checked)}
                    className="mt-1 w-4 h-4 text-cyan-500 rounded border-slate-700 focus:ring-cyan-400 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      Full Tank
                      {isFullTank ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#18E6BE] text-slate-950 font-bold">
                          Full Tank Checkpoint
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#071724] text-slate-400 font-semibold border border-slate-700">
                          Partial Refill
                        </span>
                      )}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Enable when the tank is filled completely. Accurate mileage is calculated between full-tank refills.
                    </p>
                  </div>
                </label>
              </div>

              {/* Total Cost Preview */}
              <div className="bg-[#071724] p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Calculated Total Cost
                  </div>
                  <div className="text-xs text-slate-500">
                    {parseFloat(litres) > 0 && parseFloat(pricePerLitre) > 0 ? (
                      `${litres} L × ${pricePerLitre} PKR`
                    ) : (
                      'Enter litres and price'
                    )}
                  </div>
                </div>
                <div className="text-lg font-bold text-[#18E6BE]">
                  {parseFloat(litres) > 0 && parseFloat(pricePerLitre) > 0
                    ? formatCurrency(parseFloat(litres) * parseFloat(pricePerLitre))
                    : '0 PKR'}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shell Petrol Pump, Highway trip"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#102638] border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-[#18E6BE]/20 transition-all"
                >
                  {editingRefill ? 'Save Changes' : 'Confirm Refill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

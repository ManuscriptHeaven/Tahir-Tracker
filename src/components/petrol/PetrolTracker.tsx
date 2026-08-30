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
import { 
  Fuel, 
  Plus, 
  FileText, 
  Gauge, 
  TrendingUp, 
  DollarSign, 
  Navigation, 
  Trash2, 
  Edit3, 
  X
} from 'lucide-react';

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
  
  // Filter for the selected month
  const monthlyRefills = allRefills.filter(r => r.date.startsWith(selectedMonth));

  // Modal & Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRefill, setEditingRefill] = useState<PetrolRefill | null>(null);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [odometerReading, setOdometerReading] = useState('');
  const [litres, setLitres] = useState('');
  const [pricePerLitre, setPricePerLitre] = useState('270');
  const [notes, setNotes] = useState('');

  // Find latest recorded odometer reading across all records to prefill
  const latestRefill = allRefills.length > 0 ? allRefills[allRefills.length - 1] : null;
  const previousOdoSuggestion = latestRefill ? latestRefill.odometerReading : 0;

  // Monthly Aggregated Stats
  const totalKm = monthlyRefills.reduce((sum, r) => sum + (r.distanceTravelled || 0), 0);
  const totalLitres = monthlyRefills.reduce((sum, r) => sum + (r.litres || 0), 0);
  const totalCost = monthlyRefills.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  
  const averageMileage = totalLitres > 0 && totalKm > 0 ? totalKm / totalLitres : 0;
  const costPerKm = totalKm > 0 ? totalCost / totalKm : 0;

  // Helper to re-calculate distance & mileage for all refills sequentially
  const recalculateAllRefills = async () => {
    const records = await db.petrol_refills.orderBy('odometerReading').toArray();
    for (let i = 0; i < records.length; i++) {
      const current = records[i];
      let distance = 0;
      let mileage = 0;
      let costKm = 0;

      if (i > 0) {
        const prev = records[i - 1];
        distance = Math.max(0, current.odometerReading - prev.odometerReading);
        if (current.litres > 0 && distance > 0) {
          mileage = distance / current.litres;
          costKm = current.totalCost / distance;
        }
      }

      await db.petrol_refills.update(current.id, {
        distanceTravelled: distance,
        mileageKmpl: parseFloat(mileage.toFixed(2)),
        costPerKm: parseFloat(costKm.toFixed(2))
      });
    }
  };

  // Handle Save Refill
  const handleSaveRefill = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentOdo = parseFloat(odometerReading);
    const qtyLitres = parseFloat(litres);
    const priceLtr = parseFloat(pricePerLitre);

    if (isNaN(currentOdo) || isNaN(qtyLitres) || isNaN(priceLtr) || currentOdo <= 0 || qtyLitres <= 0) {
      alert('Please enter valid numbers for Odometer reading, Litres, and Price per Litre.');
      return;
    }

    const calculatedTotalCost = Math.round(qtyLitres * priceLtr);

    if (editingRefill) {
      await db.petrol_refills.update(editingRefill.id, {
        date,
        odometerReading: currentOdo,
        litres: qtyLitres,
        pricePerLitre: priceLtr,
        totalCost: calculatedTotalCost,
        notes: notes.trim() || undefined
      });
    } else {
      const newRefill: PetrolRefill = {
        id: `refill_${Date.now()}`,
        date,
        odometerReading: currentOdo,
        litres: qtyLitres,
        pricePerLitre: priceLtr,
        totalCost: calculatedTotalCost,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString()
      };
      await db.petrol_refills.add(newRefill);
    }

    // Refresh chained calculations
    await recalculateAllRefills();

    resetForm();
    setIsAddModalOpen(false);
  };

  const resetForm = () => {
    setEditingRefill(null);
    setOdometerReading('');
    setLitres('');
    setNotes('');
  };

  const handleOpenEdit = (refill: PetrolRefill) => {
    setEditingRefill(refill);
    setDate(refill.date);
    setOdometerReading(refill.odometerReading.toString());
    setLitres(refill.litres.toString());
    setPricePerLitre(refill.pricePerLitre.toString());
    setNotes(refill.notes || '');
    setIsAddModalOpen(true);
  };

  const handleDeleteRefill = async (id: string) => {
    if (!confirm('Are you sure you want to delete this refill record?')) return;
    await db.petrol_refills.delete(id);
    await recalculateAllRefills();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Fuel className="w-6 h-6 text-emerald-600" />
            Bike Petrol & Mileage Tracker
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Log fuel refills, track odometer distance, fuel economy (KM/L), and travel costs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenReport && (
            <button
              onClick={onOpenReport}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm"
            >
              <FileText className="w-4 h-4 text-slate-600" />
              Petrol Report
            </button>
          )}
          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Add Refill
          </button>
        </div>
      </div>

      {/* Monthly Statistics Banner Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-md col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between opacity-90 text-[10px] font-bold uppercase tracking-wider">
            <span>Avg Mileage</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold mt-1">
            {formatNumber(averageMileage, 2)}
          </div>
          <div className="text-[11px] text-emerald-100 mt-1 font-semibold">
            KM / Litre
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Total Travelled</span>
            <Navigation className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-1">
            {formatNumber(totalKm, 0)} <span className="text-xs font-semibold text-slate-500">KM</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {monthlyRefills.length} Fill-ups
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Petrol Used</span>
            <Fuel className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-1">
            {formatNumber(totalLitres, 1)} <span className="text-xs font-semibold text-slate-500">L</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total Litres
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Total Cost</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-1">
            {formatCurrency(totalCost)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Monthly Fuel Bill
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Cost per KM</span>
            <Gauge className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-1">
            {formatNumber(costPerKm, 2)} <span className="text-xs font-semibold text-slate-500">PKR</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Expense per KM
          </div>
        </div>
      </div>

      {/* Refills Table / Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm sm:text-base">
            Refill Log & Mileage Records — {getMonthYearFormatted(selectedMonth)}
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            {monthlyRefills.length} Records
          </span>
        </div>

        {monthlyRefills.length === 0 ? (
          <div className="text-center py-12 p-6">
            <Fuel className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="font-bold text-slate-700 text-base">No refill records for {getMonthYearFormatted(selectedMonth)}</h4>
            <p className="text-xs text-slate-500 mt-1">
              Tap "Add Refill" above to log your odometer meter reading and fuel purchase.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] sm:text-xs uppercase font-bold tracking-wider">
                  <th className="py-3 px-3 sm:px-4">Date</th>
                  <th className="py-3 px-3 sm:px-4">Meter (KM)</th>
                  <th className="py-3 px-3 sm:px-4">Fuel (L)</th>
                  <th className="py-3 px-3 sm:px-4">Rate (PKR)</th>
                  <th className="py-3 px-3 sm:px-4">Total Cost</th>
                  <th className="py-3 px-3 sm:px-4">Distance</th>
                  <th className="py-3 px-3 sm:px-4">Mileage</th>
                  <th className="py-3 px-3 sm:px-4">Cost/KM</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {monthlyRefills.map((refill) => (
                  <tr key={refill.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{formatDate(refill.date, 'short')}</div>
                      {refill.notes && (
                        <div className="text-[11px] text-slate-400 font-normal">{refill.notes}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 sm:px-4 font-mono font-bold text-slate-900">
                      {formatNumber(refill.odometerReading, 0)} km
                    </td>
                    <td className="py-3 px-3 sm:px-4">
                      {refill.litres} L
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-slate-600">
                      {refill.pricePerLitre}
                    </td>
                    <td className="py-3 px-3 sm:px-4 font-bold text-slate-900">
                      {formatCurrency(refill.totalCost)}
                    </td>
                    <td className="py-3 px-3 sm:px-4">
                      {refill.distanceTravelled > 0 ? (
                        <span className="font-semibold text-slate-900">
                          +{refill.distanceTravelled} km
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">Initial base</span>
                      )}
                    </td>
                    <td className="py-3 px-3 sm:px-4">
                      {refill.mileageKmpl > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-xs">
                          {formatNumber(refill.mileageKmpl, 2)} km/L
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-slate-600">
                      {refill.costPerKm > 0 ? `${formatNumber(refill.costPerKm, 2)} PKR` : '-'}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(refill)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Refill"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRefill(refill.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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

      {/* MODAL: ADD / EDIT REFILL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Fuel className="w-5 h-5 text-emerald-600" />
                {editingRefill ? 'Edit Refill Entry' : 'Log New Fuel Refill'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRefill} className="space-y-4 mt-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Refill Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Meter Reading */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Odometer Meter Reading (KM) *
                  </label>
                  {previousOdoSuggestion > 0 && !editingRefill && (
                    <span className="text-[11px] text-emerald-600 font-semibold">
                      Previous: {previousOdoSuggestion} km
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Gauge className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder={previousOdoSuggestion ? `e.g. ${previousOdoSuggestion + 350}` : 'e.g. 12400'}
                    value={odometerReading}
                    onChange={(e) => setOdometerReading(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Petrol Litres & Price Per Litre */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Petrol Quantity (Litres) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    placeholder="e.g. 10.5"
                    value={litres}
                    onChange={(e) => setLitres(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Price / Litre (PKR) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    placeholder="e.g. 270"
                    value={pricePerLitre}
                    onChange={(e) => setPricePerLitre(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Total Cost Preview */}
              <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    Calculated Total Cost
                  </div>
                  <div className="text-xs text-emerald-600">
                    {parseFloat(litres) > 0 && parseFloat(pricePerLitre) > 0 ? (
                      `${litres} L × ${pricePerLitre} PKR`
                    ) : (
                      'Enter litres and price'
                    )}
                  </div>
                </div>
                <div className="text-lg font-extrabold text-emerald-800">
                  {parseFloat(litres) > 0 && parseFloat(pricePerLitre) > 0
                    ? formatCurrency(parseFloat(litres) * parseFloat(pricePerLitre))
                    : '0 PKR'}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shell Petrol Pump, Highway trip"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20"
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

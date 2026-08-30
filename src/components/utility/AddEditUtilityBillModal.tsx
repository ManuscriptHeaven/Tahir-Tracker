import React, { useState, useEffect } from 'react';
import { UtilityBill, UtilityPerson, UtilityPayment } from '../../types';
import { db } from '../../db/db';
import { calculateGasWaterShare, calculateSaleemTotalBill } from '../../utils/utilityCalculations';
import { X, Save, Calculator } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface AddEditUtilityBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  billToEdit?: UtilityBill | null;
  persons: UtilityPerson[];
  selectedPersonId: string;
}

export const AddEditUtilityBillModal: React.FC<AddEditUtilityBillModalProps> = ({
  isOpen,
  onClose,
  billToEdit,
  persons,
  selectedPersonId
}) => {
  const [personId, setPersonId] = useState<string>(selectedPersonId || 'p_saleem');
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  
  const [electricity, setElectricity] = useState<number | ''>('');
  const [gas, setGas] = useState<number | ''>('');
  const [water, setWater] = useState<number | ''>(1550);
  
  const [autoCalculate, setAutoCalculate] = useState<boolean>(true);
  const [customWaterGasShare, setCustomWaterGasShare] = useState<number | ''>('');
  const [customTotalBill, setCustomTotalBill] = useState<number | ''>('');
  
  const [expectedContribution, setExpectedContribution] = useState<number | ''>(9500);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (billToEdit) {
      setPersonId(billToEdit.personId);
      setMonth(billToEdit.month);
      setYear(billToEdit.year);
      setElectricity(billToEdit.electricity);
      setGas(billToEdit.gas);
      setWater(billToEdit.water);
      setCustomWaterGasShare(billToEdit.saleemWaterGasShare);
      setCustomTotalBill(billToEdit.totalBill);
      setExpectedContribution(billToEdit.expectedContribution);
      setNotes(billToEdit.notes || '');
      setAutoCalculate(true);
    } else {
      setPersonId(selectedPersonId || persons[0]?.id || 'p_saleem');
      const now = new Date();
      setMonth(now.getMonth() + 1);
      setYear(now.getFullYear());
      setElectricity('');
      setGas('');
      setWater(1550);
      setNotes('');
      setAutoCalculate(true);

      const p = persons.find(per => per.id === (selectedPersonId || persons[0]?.id));
      setExpectedContribution(p ? p.monthlyExpectedContribution : 9500);
    }
  }, [billToEdit, isOpen, selectedPersonId, persons]);

  // When person changes, update default expected contribution if adding new
  const handlePersonChange = (newPersonId: string) => {
    setPersonId(newPersonId);
    if (!billToEdit) {
      const p = persons.find(per => per.id === newPersonId);
      if (p) setExpectedContribution(p.monthlyExpectedContribution);
    }
  };

  if (!isOpen) return null;

  const elecNum = Number(electricity) || 0;
  const gasNum = Number(gas) || 0;
  const waterNum = Number(water) || 0;

  // Exact auto-calculated values
  const autoWaterGasShare = calculateGasWaterShare(gasNum, waterNum);
  const autoTotalBill = calculateSaleemTotalBill(elecNum, gasNum, waterNum);

  const finalWaterGasShare = autoCalculate ? autoWaterGasShare : (Number(customWaterGasShare) || 0);
  const finalTotalBill = autoCalculate ? autoTotalBill : (Number(customTotalBill) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!personId) {
      alert('Person is required');
      return;
    }
    if (!month || month < 1 || month > 12) {
      alert('Valid month (1-12) is required');
      return;
    }
    if (!year || year < 2000 || year > 2100) {
      alert('Valid year is required');
      return;
    }
    if (elecNum < 0 || gasNum < 0 || waterNum < 0) {
      alert('Utility bill amounts cannot be negative');
      return;
    }

    const monthYear = `${year}-${month.toString().padStart(2, '0')}`;
    const now = new Date().toISOString();

    const expectedNum = Number(expectedContribution) || 9500;

    try {
      if (billToEdit) {
        await db.utility_bills.update(billToEdit.id, {
          personId,
          month,
          year,
          monthYear,
          electricity: elecNum,
          gas: gasNum,
          water: waterNum,
          saleemWaterGasShare: finalWaterGasShare,
          totalBill: finalTotalBill,
          expectedContribution: expectedNum,
          notes: notes.trim() || undefined,
          updatedAt: now
        });
      } else {
        // Check if record for person and monthYear already exists
        const existing = await db.utility_bills
          .filter(b => b.personId === personId && b.monthYear === monthYear)
          .first();

        if (existing) {
          if (!confirm(`A bill record for ${monthYear} already exists for this person. Overwrite it?`)) {
            return;
          }
          await db.utility_bills.update(existing.id, {
            electricity: elecNum,
            gas: gasNum,
            water: waterNum,
            saleemWaterGasShare: finalWaterGasShare,
            totalBill: finalTotalBill,
            expectedContribution: expectedNum,
            notes: notes.trim() || undefined,
            updatedAt: now
          });
        } else {
          const newBill: UtilityBill = {
            id: `ub_${monthYear}_${personId}`,
            personId,
            month,
            year,
            monthYear,
            electricity: elecNum,
            gas: gasNum,
            water: waterNum,
            saleemWaterGasShare: finalWaterGasShare,
            totalBill: finalTotalBill,
            expectedContribution: expectedNum,
            notes: notes.trim() || undefined,
            createdAt: now,
            updatedAt: now
          };
          await db.utility_bills.add(newBill);

          // By default, add the monthly expected contribution (e.g. 9500 PKR) as initial payment
          if (expectedNum > 0) {
            const initialPayment: UtilityPayment = {
              id: `pay_${monthYear}_${personId}_def`,
              utilityBillId: newBill.id,
              personId,
              paymentDate: `${monthYear}-10`,
              amount: expectedNum,
              note: 'Default Monthly Contribution',
              createdAt: now,
              updatedAt: now
            };
            await db.utility_payments.add(initialPayment);
          }
        }
      }
      onClose();
    } catch (err) {
      console.error('Failed to save utility bill:', err);
      alert('Failed to save utility bill record');
    }
  };

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600" />
            {billToEdit ? 'Edit Utility Bill Record' : 'Record New Utility Bill'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Person & Period */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Person
              </label>
              <select
                value={personId}
                onChange={e => handlePersonChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                {persons.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Month
              </label>
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Year
              </label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                min="2020"
                max="2035"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          {/* Household Utility Inputs */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Household Utility Bills (PKR)
            </h3>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Electricity
                </label>
                <input
                  type="number"
                  value={electricity}
                  onChange={e => setElectricity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 16092"
                  min="0"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Gas
                </label>
                <input
                  type="number"
                  value={gas}
                  onChange={e => setGas(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 5220"
                  min="0"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Water
                </label>
                <input
                  type="number"
                  value={water}
                  onChange={e => setWater(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 1550"
                  min="0"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Auto Calculate Toggle & Breakdown Display */}
          <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                Calculated Share & Total Payable
              </span>
              
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-emerald-800">
                <input
                  type="checkbox"
                  checked={autoCalculate}
                  onChange={e => setAutoCalculate(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                Auto Formula
              </label>
            </div>

            {autoCalculate ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                  <div className="text-[10px] text-slate-500 font-semibold">Water + Gas Share (1/3)</div>
                  <div className="text-sm font-black text-slate-800 mt-0.5">
                    {formatCurrency(autoWaterGasShare)}
                  </div>
                  <div className="text-[9px] text-slate-400">({gasNum} + {waterNum}) / 3</div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-xs">
                  <div className="text-[10px] text-emerald-700 font-bold">Total Bill Payable</div>
                  <div className="text-sm font-black text-emerald-700 mt-0.5">
                    {formatCurrency(autoTotalBill)}
                  </div>
                  <div className="text-[9px] text-slate-400">{elecNum} + {Math.round(autoWaterGasShare)}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Custom Water + Gas Share
                  </label>
                  <input
                    type="number"
                    value={customWaterGasShare}
                    onChange={e => setCustomWaterGasShare(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Custom Total Bill
                  </label>
                  <input
                    type="number"
                    value={customTotalBill}
                    onChange={e => setCustomTotalBill(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Expected Contribution & Notes */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Expected Contribution (PKR)
              </label>
              <input
                type="number"
                value={expectedContribution}
                onChange={e => setExpectedContribution(e.target.value === '' ? '' : Number(e.target.value))}
                min="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Optional Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Paid via online app"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <Save className="w-4 h-4" />
              Save Utility Bill Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

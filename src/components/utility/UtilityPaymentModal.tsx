import React, { useState } from 'react';
import { UtilityBill, UtilityPayment, UtilityPerson } from '../../types';
import { db } from '../../db/db';
import { X, Plus, Trash2, Edit2, Check, CreditCard, ArrowDownRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDate, getMonthYearFormatted } from '../../utils/formatters';
import { getTodayLocalDateStr } from '../../utils/dateTime';
import { addMoney, subtractMoney } from '../../utils/money';

interface UtilityPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: UtilityBill | null;
  person: UtilityPerson | null;
  payments: UtilityPayment[];
}

export const UtilityPaymentModal: React.FC<UtilityPaymentModalProps> = ({
  isOpen,
  onClose,
  bill,
  person,
  payments
}) => {
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState<string>(getTodayLocalDateStr());
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState<string>('');
  const [isAdding, setIsAdding] = useState<boolean>(false);

  if (!isOpen || !bill) return null;

  const totalPaid = payments.reduce((sum, p) => addMoney(sum, p.amount), 0);
  const totalBillRounded = Math.round(bill.totalBill);
  const diff = subtractMoney(totalBillRounded, totalPaid);
  const personName = person?.name || 'Saleem';
  const monthFormatted = getMonthYearFormatted(bill.monthYear);

  const resetForm = () => {
    setPaymentDate(getTodayLocalDateStr());
    setAmount('');
    setNote('');
    setEditingPaymentId(null);
    setIsAdding(false);
  };

  const handleStartAdd = () => {
    setPaymentDate(getTodayLocalDateStr());
    setAmount(diff > 0 ? diff : '');
    setNote('Extra payment');
    setEditingPaymentId(null);
    setIsAdding(true);
  };

  const handleStartEdit = (p: UtilityPayment) => {
    setPaymentDate(p.paymentDate);
    setAmount(p.amount);
    setNote(p.note || '');
    setEditingPaymentId(p.id);
    setIsAdding(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Payment amount must be greater than 0');
      return;
    }
    if (!paymentDate) {
      alert('Payment date is required');
      return;
    }

    const now = new Date().toISOString();

    try {
      if (editingPaymentId) {
        await db.utility_payments.update(editingPaymentId, {
          paymentDate,
          amount: numAmount,
          note: note.trim() || undefined,
          updatedAt: now
        });
      } else {
        const newPayment: UtilityPayment = {
          id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          utilityBillId: bill.id,
          personId: bill.personId,
          paymentDate,
          amount: numAmount,
          note: note.trim() || undefined,
          createdAt: now,
          updatedAt: now
        };
        await db.utility_payments.add(newPayment);
      }
      resetForm();
    } catch (err) {
      console.error('Failed to save payment:', err);
      alert('Failed to save payment record');
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment record?')) return;
    try {
      await db.utility_payments.delete(id);
      if (editingPaymentId === id) resetForm();
    } catch (err) {
      console.error('Failed to delete payment:', err);
      alert('Failed to delete payment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0B1D2C] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200 border border-cyan-500/30">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#18E6BE] bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30 inline-block">
              {personName} PAYMENT HISTORY
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 mt-1">
              {monthFormatted}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-[#102638] hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Summary Badges */}
        <div className="grid grid-cols-3 gap-2 bg-[#071724] p-3 rounded-xl border border-slate-800 text-center">
          <div>
            <div className="text-[10px] font-medium text-slate-400 uppercase">
              {personName} Total Bill
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-100 mt-0.5">
              {formatCurrency(totalBillRounded)}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-medium text-teal-400 uppercase">
              Total Received
            </div>
            <div className="text-sm sm:text-base font-bold text-teal-300 mt-0.5">
              {formatCurrency(totalPaid)}
            </div>
          </div>

          <div>
            <div className={`text-[10px] font-bold uppercase ${diff > 0 ? 'text-rose-400' : diff < 0 ? 'text-teal-400' : 'text-slate-400'}`}>
              {diff > 0 ? `${personName} Owes` : diff < 0 ? `Tahir Owes` : 'Settled'}
            </div>
            <div className={`text-sm sm:text-base font-bold mt-0.5 ${diff > 0 ? 'text-rose-400' : diff < 0 ? 'text-teal-400' : 'text-slate-200'}`}>
              {diff !== 0 ? formatCurrency(Math.abs(diff)) : '0 PKR'}
            </div>
          </div>
        </div>

        {/* Clear Balance Status Alert Banner */}
        <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
          diff > 0
            ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
            : diff < 0
            ? 'bg-teal-950/30 border-teal-500/40 text-teal-200'
            : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
        }`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
            diff > 0
              ? 'bg-rose-500/20 text-rose-400'
              : diff < 0
              ? 'bg-teal-500/20 text-teal-400'
              : 'bg-emerald-500/20 text-[#18E6BE]'
          }`}>
            {diff > 0 ? <ArrowDownRight className="w-5 h-5" /> : diff < 0 ? <ArrowUpRight className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div className="text-xs">
            <div className="font-bold text-sm text-slate-100">
              {diff > 0 
                ? `${personName} Owes Tahir: ${formatCurrency(diff)}` 
                : diff < 0 
                ? `Tahir Owes ${personName}: ${formatCurrency(Math.abs(diff))}` 
                : 'Bill & Payments are fully settled!'}
            </div>
            <p className="text-[11px] opacity-80 mt-0.5 text-slate-300">
              {diff > 0 
                ? `Bill (${formatCurrency(totalBillRounded)}) is higher than received payment (${formatCurrency(totalPaid)}).` 
                : diff < 0 
                ? `Payment received (${formatCurrency(totalPaid)}) exceeds the total bill (${formatCurrency(totalBillRounded)}).` 
                : `Total payments received match the bill amount exactly.`}
            </p>
          </div>
        </div>

        {/* Payment History List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Payment Entries ({payments.length})
            </h3>
            {!isAdding && (
              <button
                onClick={handleStartAdd}
                className="px-3 py-1.5 bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Extra Payment</span>
              </button>
            )}
          </div>

          {payments.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs bg-[#071724] rounded-xl border border-dashed border-slate-700">
              No payments recorded yet for {monthFormatted}.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-[#071724] rounded-xl border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-all shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#102638] text-teal-400 border border-teal-500/20 flex items-center justify-center font-bold text-xs">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100">
                          {formatCurrency(p.amount)}
                        </span>
                        {p.note?.includes('Default') && (
                          <span className="text-[9px] bg-[#102638] text-cyan-300 font-semibold px-1.5 py-0.5 rounded border border-cyan-500/30">
                            Default 9,500
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatDate(p.paymentDate, 'medium')} {p.note && !p.note.includes('Default') && `• ${p.note}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(p)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#102638] rounded-lg transition-colors"
                      title="Edit Payment"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePayment(p.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Delete Payment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit Payment Inline Form */}
        {isAdding && (
          <form onSubmit={handleSavePayment} className="p-3.5 bg-[#102638] rounded-xl border border-cyan-500/30 space-y-3 animate-in fade-in">
            <div className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              {editingPaymentId ? 'Edit Payment Record' : 'Record Extra Payment'}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Amount (PKR) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-1.5 bg-[#071724] border border-slate-700 rounded-lg text-xs font-bold text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#071724] border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Note / Method (Optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Bank Transfer, Cash"
                className="w-full px-3 py-1.5 bg-[#071724] border border-slate-700 rounded-lg text-xs font-medium text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 bg-[#071724] hover:bg-[#0c2236] text-slate-300 rounded-lg text-xs font-semibold border border-slate-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-1.5 bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Save Entry</span>
              </button>
            </div>
          </form>
        )}

        {/* Modal Close Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#102638] hover:bg-[#16344d] text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

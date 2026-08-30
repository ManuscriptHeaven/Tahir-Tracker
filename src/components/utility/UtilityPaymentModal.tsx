import React, { useState } from 'react';
import { UtilityBill, UtilityPayment, UtilityPerson } from '../../types';
import { db } from '../../db/db';
import { X, Plus, Trash2, Edit2, Check, CreditCard, ArrowDownRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDate, getMonthYearFormatted } from '../../utils/formatters';

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
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState<string>('');
  const [isAdding, setIsAdding] = useState<boolean>(false);

  if (!isOpen || !bill) return null;

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalBillRounded = Math.round(bill.totalBill);
  const diff = totalBillRounded - totalPaid;
  const personName = person?.name || 'Saleem';
  const monthFormatted = getMonthYearFormatted(bill.monthYear);

  const resetForm = () => {
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setNote('');
    setEditingPaymentId(null);
    setIsAdding(false);
  };

  const handleStartAdd = () => {
    setPaymentDate(new Date().toISOString().split('T')[0]);
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-block">
              {personName} PAYMENT HISTORY
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              {monthFormatted}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Summary Badges */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase">
              {personName} Total Bill
            </div>
            <div className="text-sm sm:text-base font-black text-slate-800 mt-0.5">
              {formatCurrency(totalBillRounded)}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-emerald-600 uppercase">
              Total Received
            </div>
            <div className="text-sm sm:text-base font-black text-emerald-600 mt-0.5">
              {formatCurrency(totalPaid)}
            </div>
          </div>

          <div>
            <div className={`text-[10px] font-bold uppercase ${diff > 0 ? 'text-rose-600' : diff < 0 ? 'text-teal-600' : 'text-slate-500'}`}>
              {diff > 0 ? `${personName} Owes Tahir` : diff < 0 ? `Tahir Owes ${personName}` : 'Settled'}
            </div>
            <div className={`text-sm sm:text-base font-black mt-0.5 ${diff > 0 ? 'text-rose-600' : diff < 0 ? 'text-teal-600' : 'text-slate-700'}`}>
              {diff !== 0 ? formatCurrency(Math.abs(diff)) : '0 PKR'}
            </div>
          </div>
        </div>

        {/* Clear Balance Status Alert Banner */}
        <div className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
          diff > 0
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : diff < 0
            ? 'bg-teal-50 border-teal-200 text-teal-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 ${
            diff > 0
              ? 'bg-rose-100 text-rose-700'
              : diff < 0
              ? 'bg-teal-100 text-teal-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {diff > 0 ? <ArrowDownRight className="w-5 h-5" /> : diff < 0 ? <ArrowUpRight className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div className="text-xs">
            <div className="font-black text-sm">
              {diff > 0 
                ? `${personName} Owes Tahir: ${formatCurrency(diff)}` 
                : diff < 0 
                ? `Tahir Owes ${personName}: ${formatCurrency(Math.abs(diff))}` 
                : 'Bill & Payments are fully settled!'}
            </div>
            <p className="text-[11px] opacity-80 mt-0.5">
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Payment Entries ({payments.length})
            </h3>
            {!isAdding && (
              <button
                onClick={handleStartAdd}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Extra Payment
              </button>
            )}
          </div>

          {payments.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No payments recorded yet for {monthFormatted}.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3 hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {formatCurrency(p.amount)}
                        </span>
                        {p.note?.includes('Default') && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                            Default 9,500
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {formatDate(p.paymentDate, 'medium')} {p.note && !p.note.includes('Default') && `• ${p.note}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(p)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                      title="Edit Payment"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePayment(p.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
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

        {/* Add/Edit Payment Form */}
        {isAdding && (
          <form onSubmit={handleSavePayment} className="bg-slate-100/90 p-4 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in duration-150">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {editingPaymentId ? 'Edit Payment Entry' : 'Add Payment Entry'}
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Amount (PKR)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 9500 or 2000"
                  min="1"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Optional Note / Tag
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Extra payment / JazzCash / Cash"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                Save Payment
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

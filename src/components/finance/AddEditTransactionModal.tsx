import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowRightLeft, 
  Calendar, 
  Wallet, 
  Tag, 
  FileText, 
  Check 
} from 'lucide-react';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { FinanceTransaction, FinanceTransactionType } from '../../types';

interface AddEditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionToEdit?: FinanceTransaction | null;
  defaultType?: FinanceTransactionType;
  onTransactionSaved?: () => void;
}

export const AddEditTransactionModal: React.FC<AddEditTransactionModalProps> = ({
  isOpen,
  onClose,
  transactionToEdit,
  defaultType = 'expense',
  onTransactionSaved
}) => {
  const [type, setType] = useState<FinanceTransactionType>(defaultType);
  const [amount, setAmount] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [transferToAccountId, setTransferToAccountId] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [attachmentNote, setAttachmentNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const accounts = useLiveQuery(() => db.finance_accounts.filter(a => a.isActive).toArray()) || [];
  const categories = useLiveQuery(() => db.finance_categories.filter(c => c.isActive).toArray()) || [];

  const filteredCategories = categories.filter(c => 
    type === 'income' ? c.type === 'income' : c.type === 'expense'
  );

  useEffect(() => {
    if (transactionToEdit) {
      setType(transactionToEdit.transactionType);
      setAmount(transactionToEdit.amount.toString());
      setCategoryId(transactionToEdit.categoryId || '');
      setAccountId(transactionToEdit.accountId || '');
      setTransferToAccountId(transactionToEdit.transferToAccountId || '');
      setTransactionDate(transactionToEdit.transactionDate);
      setDescription(transactionToEdit.description);
      setAttachmentNote(transactionToEdit.attachmentNote || '');
    } else {
      setType(defaultType);
      setAmount('');
      setTransactionDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setAttachmentNote('');

      // Pick default account
      if (accounts.length > 0) {
        setAccountId(accounts[0].id);
        if (accounts.length > 1) {
          setTransferToAccountId(accounts[1].id);
        }
      }

      // Pick default category
      if (filteredCategories.length > 0) {
        setCategoryId(filteredCategories[0].id);
      }
    }
  }, [transactionToEdit, defaultType, isOpen, accounts.length, categories.length]);

  // Update default category when type changes
  const handleTypeChange = (newType: FinanceTransactionType) => {
    setType(newType);
    const newFiltered = categories.filter(c => 
      newType === 'income' ? c.type === 'income' : c.type === 'expense'
    );
    if (newFiltered.length > 0) {
      setCategoryId(newFiltered[0].id);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }

    if (!accountId) {
      alert('Please select an account.');
      return;
    }

    if (type === 'transfer' && (!transferToAccountId || transferToAccountId === accountId)) {
      alert('Please select a different destination account for the transfer.');
      return;
    }

    setIsSaving(true);
    const now = new Date().toISOString();

    const selectedCategory = categories.find(c => c.id === categoryId);
    const selectedAccount = accounts.find(a => a.id === accountId);
    const selectedTransferAccount = accounts.find(a => a.id === transferToAccountId);

    try {
      if (transactionToEdit) {
        await db.finance_transactions.update(transactionToEdit.id, {
          transactionType: type,
          amount: numAmount,
          categoryId: type !== 'transfer' ? categoryId : undefined,
          categoryName: type !== 'transfer' ? selectedCategory?.name : undefined,
          accountId,
          accountName: selectedAccount?.name,
          transferToAccountId: type === 'transfer' ? transferToAccountId : undefined,
          transferToAccountName: type === 'transfer' ? selectedTransferAccount?.name : undefined,
          transactionDate,
          description: description.trim() || `${selectedCategory?.name || 'General'} ${type}`,
          attachmentNote: attachmentNote.trim() || undefined,
          updatedAt: now
        });
      } else {
        const newRecord: FinanceTransaction = {
          id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          transactionType: type,
          amount: numAmount,
          currency: 'PKR',
          categoryId: type !== 'transfer' ? categoryId : undefined,
          categoryName: type !== 'transfer' ? selectedCategory?.name : undefined,
          accountId,
          accountName: selectedAccount?.name,
          transferToAccountId: type === 'transfer' ? transferToAccountId : undefined,
          transferToAccountName: type === 'transfer' ? selectedTransferAccount?.name : undefined,
          transactionDate,
          description: description.trim() || `${selectedCategory?.name || 'General'} ${type}`,
          source: 'manual',
          status: 'completed',
          attachmentNote: attachmentNote.trim() || undefined,
          createdAt: now,
          updatedAt: now
        };

        await db.finance_transactions.add(newRecord);
      }

      onTransactionSaved?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to save transaction:', err);
      alert(`Failed to save: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in slide-in-from-bottom duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              {transactionToEdit ? 'Edit Transaction' : 'Add Transaction'}
            </h2>
            <p className="text-[11px] text-slate-500">
              Record expense, income or account transfer
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Type Selector (Expense, Income, Transfer) */}
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                type === 'expense'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Expense</span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                type === 'income'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Income</span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange('transfer')}
              className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                type === 'transfer'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Transfer</span>
            </button>
          </div>

          {/* Amount Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Amount (PKR) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                Rs.
              </span>
              <input
                type="number"
                step="any"
                required
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-xl font-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Category Selector (If not transfer) */}
          {type !== 'transfer' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Category</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                {filteredCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Source Account Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-slate-400" />
              <span>{type === 'transfer' ? 'From Account (Source)' : 'Account / Payment Method'}</span>
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.icon || '💳'} {acc.name} ({acc.institution || acc.accountType})
                </option>
              ))}
            </select>
          </div>

          {/* Destination Account Selector (Transfer only) */}
          {type === 'transfer' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
                <span>To Account (Destination)</span>
              </label>
              <select
                value={transferToAccountId}
                onChange={(e) => setTransferToAccountId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                {accounts.filter(a => a.id !== accountId).map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.icon || '💳'} {acc.name} ({acc.institution || acc.accountType})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Date</span>
            </label>
            <input
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Description / Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Description / Note (Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Lunch at office, Petrol refill, Al-Fatah Grocery..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Attachment / Receipt Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Receipt / Ref ID (Optional)
            </label>
            <input
              type="text"
              value={attachmentNote}
              onChange={(e) => setAttachmentNote(e.target.value)}
              placeholder="e.g. Receipt #1042 or Bank Slip Ref"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Footer Save Buttons */}
          <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isSaving ? 'Saving...' : 'Save Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

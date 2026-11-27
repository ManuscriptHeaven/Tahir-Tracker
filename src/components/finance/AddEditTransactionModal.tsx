import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Calendar,
  ChevronDown,
  Check,
  Plus
} from 'lucide-react';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { FinanceTransaction, FinanceTransactionType } from '../../types';
import { getTodayLocalDateStr, addDaysLocalDate } from '../../utils/dateTime';
import { formatCurrency } from '../../utils/formatters';
import { getCurrentUserId } from '../../services/authService';
import {
  rankCategoriesByUsage,
  rankAccountsByUsage,
  pickDefaultCategoryId,
  pickDefaultAccountId,
  parseAmountInput,
  loadQuickEntryPrefs,
  saveQuickEntryPrefs
} from '../../utils/quickEntry';

interface AddEditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionToEdit?: FinanceTransaction | null;
  defaultType?: FinanceTransactionType;
  onTransactionSaved?: () => void;
}

const VISIBLE_CATEGORY_COUNT = 8;
const QUICK_AMOUNTS = [100, 500, 1000, 5000];

const TYPE_OPTIONS: { id: FinanceTransactionType; label: string; icon: typeof ArrowUpRight; active: string; iconColor: string }[] = [
  { id: 'expense', label: 'Expense', icon: ArrowUpRight, active: 'bg-rose-500/20 text-rose-300 border-rose-500/40', iconColor: 'text-rose-400' },
  { id: 'income', label: 'Income', icon: ArrowDownLeft, active: 'bg-teal-500/20 text-teal-300 border-teal-500/40', iconColor: 'text-teal-400' },
  { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft, active: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', iconColor: 'text-cyan-400' }
];

const chipClass = (selected: boolean) =>
  `shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
    selected
      ? 'bg-[rgba(24,230,190,0.14)] text-[#18E6BE] border-[rgba(24,230,190,0.45)]'
      : 'bg-[#071724] text-slate-300 border-slate-700 hover:border-slate-500'
  }`;

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
  const [transactionDate, setTransactionDate] = useState<string>(getTodayLocalDateStr());
  const [description, setDescription] = useState<string>('');
  const [attachmentNote, setAttachmentNote] = useState<string>('');
  const [isPending, setIsPending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [savedFlash, setSavedFlash] = useState('');
  const [initialized, setInitialized] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const accounts = useLiveQuery(() => db.finance_accounts.filter(a => a.isActive).toArray()) || [];
  const categories = useLiveQuery(() => db.finance_categories.filter(c => c.isActive).toArray()) || [];
  const transactions = useLiveQuery(() => db.finance_transactions.toArray()) || [];
  const dataReady = accounts.length > 0 && categories.length > 0;

  const today = getTodayLocalDateStr();
  const yesterday = addDaysLocalDate(today, -1);

  const rankedExpense = useMemo(
    () => rankCategoriesByUsage(categories, transactions, 'expense', today),
    [categories, transactions, today]
  );
  const rankedIncome = useMemo(
    () => rankCategoriesByUsage(categories, transactions, 'income', today),
    [categories, transactions, today]
  );
  const rankedAccounts = useMemo(
    () => rankAccountsByUsage(accounts, transactions, today),
    [accounts, transactions, today]
  );
  const rankedCategories = type === 'income' ? rankedIncome : rankedExpense;

  // Reset the form each time it opens. Defaults wait until accounts and
  // categories have loaded, then are set once so typing is never overwritten.
  useEffect(() => {
    if (!isOpen) {
      setInitialized(false);
      return;
    }
    if (initialized) return;

    setError('');
    setSavedCount(0);
    setSavedFlash('');
    setShowAllCategories(false);

    if (transactionToEdit) {
      setType(transactionToEdit.transactionType);
      setAmount(transactionToEdit.amount.toString());
      setCategoryId(transactionToEdit.categoryId || '');
      setAccountId(transactionToEdit.accountId || '');
      setTransferToAccountId(transactionToEdit.transferToAccountId || '');
      setTransactionDate(transactionToEdit.transactionDate);
      setDescription(transactionToEdit.description);
      setAttachmentNote(transactionToEdit.attachmentNote || '');
      setIsPending(transactionToEdit.status === 'pending');
      setShowMore(!!transactionToEdit.attachmentNote || transactionToEdit.status === 'pending');
      setInitialized(true);
      return;
    }

    setType(defaultType);
    setAmount('');
    setTransactionDate(today);
    setDescription('');
    setAttachmentNote('');
    setIsPending(false);
    setShowMore(false);

    if (!dataReady) return;
    const prefs = loadQuickEntryPrefs(getCurrentUserId());
    const source = pickDefaultAccountId(rankedAccounts, prefs);
    setAccountId(source);
    setTransferToAccountId(rankedAccounts.find(a => a.id !== source)?.id || '');
    if (defaultType !== 'transfer') {
      setCategoryId(pickDefaultCategoryId(defaultType === 'income' ? rankedIncome : rankedExpense, defaultType, prefs));
    }
    setInitialized(true);
  }, [isOpen, initialized, transactionToEdit, defaultType, dataReady, rankedAccounts, rankedExpense, rankedIncome, today]);

  const handleTypeChange = (newType: FinanceTransactionType) => {
    setType(newType);
    setError('');
    setShowAllCategories(false);
    if (newType === 'transfer') {
      if (!transferToAccountId || transferToAccountId === accountId) {
        setTransferToAccountId(rankedAccounts.find(a => a.id !== accountId)?.id || '');
      }
      return;
    }
    const prefs = loadQuickEntryPrefs(getCurrentUserId());
    setCategoryId(pickDefaultCategoryId(newType === 'income' ? rankedIncome : rankedExpense, newType, prefs));
  };

  const addToAmount = (value: number) => {
    const current = parseAmountInput(amount);
    setAmount(String((Number.isNaN(current) ? 0 : current) + value));
    setError('');
  };

  const saveTransaction = async (addAnother: boolean) => {
    const numAmount = parseAmountInput(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      setError('Enter an amount greater than 0.');
      amountRef.current?.focus();
      return;
    }
    if (!accountId) {
      setError('Choose an account.');
      return;
    }
    if (type !== 'transfer' && !categoryId) {
      setError('Choose a category.');
      return;
    }
    if (type === 'transfer' && (!transferToAccountId || transferToAccountId === accountId)) {
      setError('Choose a different account to transfer to.');
      return;
    }

    setIsSaving(true);
    setError('');
    const now = new Date().toISOString();

    const selectedCategory = categories.find(c => c.id === categoryId);
    const selectedAccount = accounts.find(a => a.id === accountId);
    const selectedTransferAccount = accounts.find(a => a.id === transferToAccountId);
    const fallbackDescription = type === 'transfer'
      ? `Transfer to ${selectedTransferAccount?.name || 'account'}`
      : `${selectedCategory?.name || 'General'} ${type}`;

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
          status: isPending ? 'pending' : 'completed',
          description: description.trim() || fallbackDescription,
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
          description: description.trim() || fallbackDescription,
          source: 'manual',
          status: isPending ? 'pending' : 'completed',
          attachmentNote: attachmentNote.trim() || undefined,
          createdAt: now,
          updatedAt: now
        };

        await db.finance_transactions.add(newRecord);
      }

      saveQuickEntryPrefs(getCurrentUserId(), {
        accountId,
        ...(type === 'expense' ? { expenseCategoryId: categoryId } : {}),
        ...(type === 'income' ? { incomeCategoryId: categoryId } : {})
      });

      onTransactionSaved?.();

      if (addAnother && !transactionToEdit) {
        // Keep type, category, account and date; clear what changes per entry.
        setSavedCount(count => count + 1);
        setSavedFlash(`Saved ${formatCurrency(numAmount)}${type !== 'transfer' && selectedCategory ? ` · ${selectedCategory.name}` : ''}`);
        setAmount('');
        setDescription('');
        setAttachmentNote('');
        setIsPending(false);
        amountRef.current?.focus();
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to save transaction:', err);
      setError(`Could not save: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveTransaction(false);
  };

  if (!isOpen) return null;

  // Show the most used categories; always include the selected one.
  let visibleCategories = showAllCategories ? rankedCategories : rankedCategories.slice(0, VISIBLE_CATEGORY_COUNT);
  if (!showAllCategories && categoryId && !visibleCategories.some(c => c.id === categoryId)) {
    const selected = rankedCategories.find(c => c.id === categoryId);
    if (selected) visibleCategories = [...visibleCategories.slice(0, VISIBLE_CATEGORY_COUNT - 1), selected];
  }
  const hiddenCategoryCount = rankedCategories.length - visibleCategories.length;

  const isOtherDate = transactionDate !== today && transactionDate !== yesterday;
  const typeLabel = type === 'income' ? 'Income' : type === 'transfer' ? 'Transfer' : 'Expense';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-[#0B1D2C] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-cyan-500/30 animate-in slide-in-from-bottom duration-200 max-h-[94vh] sm:max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 sm:px-5 flex items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-100">
            {transactionToEdit ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 -m-1 rounded-lg text-slate-400 hover:bg-[#102638] hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-4 sm:px-5 pb-4 overflow-y-auto flex-1 space-y-4">
            {/* Type */}
            <div className="grid grid-cols-3 gap-1.5 bg-[#071724] p-1 rounded-xl border border-slate-800" role="group" aria-label="Transaction type">
              {TYPE_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const selected = type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleTypeChange(opt.id)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      selected ? opt.active : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${opt.iconColor}`} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-base">Rs.</span>
                <input
                  ref={amountRef}
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  aria-label="Amount in PKR"
                  autoFocus
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value.replace(/[^\d.,]/g, '')); setError(''); }}
                  placeholder="0"
                  className="w-full pl-14 pr-4 py-3.5 bg-[#071724] border border-slate-700 rounded-xl text-slate-100 text-3xl font-black tabular-nums placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                {QUICK_AMOUNTS.map(value => (
                  <button key={value} type="button" onClick={() => addToAmount(value)} className={`${chipClass(false)} py-1.5 tabular-nums`}>
                    +{value.toLocaleString('en-US')}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            {type !== 'transfer' && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Category</div>
                <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Category">
                  {visibleCategories.map(cat => {
                    const selected = categoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => { setCategoryId(cat.id); setError(''); }}
                        className={`min-w-0 px-1 py-2 rounded-xl border flex flex-col items-center gap-0.5 transition-all active:scale-95 ${
                          selected
                            ? 'bg-[rgba(24,230,190,0.14)] border-[rgba(24,230,190,0.5)] text-[#18E6BE]'
                            : 'bg-[#071724] border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span className="text-lg leading-none">{cat.icon}</span>
                        <span className="text-[10px] font-bold leading-tight text-center line-clamp-2 w-full">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
                {(hiddenCategoryCount > 0 || showAllCategories) && rankedCategories.length > VISIBLE_CATEGORY_COUNT && (
                  <button
                    type="button"
                    onClick={() => setShowAllCategories(v => !v)}
                    className="w-full py-1.5 text-[11px] font-bold text-cyan-400 hover:text-cyan-300"
                  >
                    {showAllCategories ? 'Show fewer' : `Show all categories (${hiddenCategoryCount} more)`}
                  </button>
                )}
                {rankedCategories.length === 0 && (
                  <p className="text-[11px] text-slate-400">No {type} categories yet. Add one in the Categories tab.</p>
                )}
              </div>
            )}

            {/* Accounts */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {type === 'transfer' ? 'From account' : type === 'income' ? 'Received in' : 'Paid from'}
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5" role="group" aria-label="Account">
                {rankedAccounts.map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    aria-pressed={accountId === acc.id}
                    onClick={() => {
                      setAccountId(acc.id);
                      if (transferToAccountId === acc.id) {
                        setTransferToAccountId(rankedAccounts.find(a => a.id !== acc.id)?.id || '');
                      }
                    }}
                    className={chipClass(accountId === acc.id)}
                  >
                    {acc.icon || '💳'} {acc.name}
                  </button>
                ))}
              </div>
            </div>

            {type === 'transfer' && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">To account</div>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5" role="group" aria-label="Destination account">
                  {rankedAccounts.filter(a => a.id !== accountId).map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      aria-pressed={transferToAccountId === acc.id}
                      onClick={() => setTransferToAccountId(acc.id)}
                      className={chipClass(transferToAccountId === acc.id)}
                    >
                      {acc.icon || '💳'} {acc.name}
                    </button>
                  ))}
                </div>
                {accounts.length < 2 && (
                  <p className="text-[11px] text-slate-400">Add a second account in the Accounts tab to make transfers.</p>
                )}
              </div>
            )}

            {/* Date */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</div>
              <div className="flex gap-1.5 items-center" role="group" aria-label="Date">
                <button type="button" aria-pressed={transactionDate === today} onClick={() => setTransactionDate(today)} className={chipClass(transactionDate === today)}>
                  Today
                </button>
                <button type="button" aria-pressed={transactionDate === yesterday} onClick={() => setTransactionDate(yesterday)} className={chipClass(transactionDate === yesterday)}>
                  Yesterday
                </button>
                <label className={`${chipClass(isOtherDate)} relative flex items-center gap-1.5 cursor-pointer min-w-0`}>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{isOtherDate ? transactionDate : 'Other date'}</span>
                  <input
                    type="date"
                    aria-label="Pick another date"
                    value={transactionDate}
                    onChange={(e) => e.target.value && setTransactionDate(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  />
                </label>
              </div>
            </div>

            {/* Note */}
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Note (optional), e.g. lunch at office"
              aria-label="Note"
              className="w-full px-4 py-2.5 bg-[#071724] border border-slate-700 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all"
            />

            {/* More details */}
            <div>
              <button
                type="button"
                aria-expanded={showMore}
                onClick={() => setShowMore(v => !v)}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                More details {isPending ? '· Pending' : ''}
              </button>
              {showMore && (
                <div className="mt-2 space-y-3">
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="Transaction status">
                    <button
                      type="button"
                      aria-pressed={!isPending}
                      onClick={() => setIsPending(false)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${!isPending ? 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE] border-[rgba(24,230,190,0.32)]' : 'bg-[#071724] text-slate-400 border-slate-700'}`}
                    >
                      ✓ Completed
                    </button>
                    <button
                      type="button"
                      aria-pressed={isPending}
                      onClick={() => setIsPending(true)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${isPending ? 'bg-[rgba(247,183,51,0.12)] text-[#F7B733] border-[rgba(247,183,51,0.32)]' : 'bg-[#071724] text-slate-400 border-slate-700'}`}
                    >
                      ⏳ Pending
                    </button>
                  </div>
                  {isPending && (
                    <p className="text-[11px] text-[#F7B733]">Pending items are kept out of your balance until you mark them completed.</p>
                  )}
                  <input
                    type="text"
                    value={attachmentNote}
                    onChange={(e) => setAttachmentNote(e.target.value)}
                    placeholder="Receipt / Ref ID (optional)"
                    aria-label="Receipt or reference ID"
                    className="w-full px-4 py-2.5 bg-[#071724] border border-slate-700 rounded-xl text-slate-100 text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sticky footer: always visible, even with the keyboard open */}
          <div
            className="px-4 sm:px-5 pt-3 border-t border-slate-800 bg-[#0B1D2C] space-y-2"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {error && <p role="alert" className="text-xs font-semibold text-rose-400">{error}</p>}
            {!error && savedFlash && (
              <p role="status" className="text-xs font-semibold text-[#18E6BE] flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> {savedFlash}{savedCount > 1 ? ` (${savedCount} added)` : ''}
              </p>
            )}
            <div className="flex items-center gap-2">
              {!transactionToEdit && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => saveTransaction(true)}
                  className="flex-1 py-3 px-3 rounded-xl bg-[#102638] text-slate-200 font-bold text-xs sm:text-sm hover:text-white border border-slate-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save & add another</span>
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 px-3 rounded-xl bg-[#18E6BE] hover:bg-[#23F2CB] active:scale-95 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-md shadow-[#18E6BE]/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{isSaving ? 'Saving...' : transactionToEdit ? 'Save Changes' : `Save ${typeLabel}`}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

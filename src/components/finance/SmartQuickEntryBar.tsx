import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Mic, Check } from 'lucide-react';
import { parseVoiceTransactionInput } from '../../services/voiceParser';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ParsedVoiceTransaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface SmartQuickEntryBarProps {
  onOpenVoiceModal?: () => void;
  onTransactionSaved?: () => void;
}

export const SmartQuickEntryBar: React.FC<SmartQuickEntryBarProps> = ({
  onOpenVoiceModal,
  onTransactionSaved
}) => {
  const [inputText, setInputText] = useState('');
  const [parsed, setParsed] = useState<ParsedVoiceTransaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [saveError, setSaveError] = useState('');

  const accounts = useLiveQuery(() => db.finance_accounts.filter(a => a.isActive).toArray()) || [];
  const categories = useLiveQuery(() => db.finance_categories.filter(c => c.isActive).toArray()) || [];

  useEffect(() => {
    if (!inputText.trim() || accounts.length === 0 || categories.length === 0) {
      setParsed(null);
      return;
    }

    const list = parseVoiceTransactionInput(inputText, accounts, categories);
    if (list.length > 0 && list[0].amount > 0) {
      setParsed(list[0]);
    } else {
      setParsed(null);
    }
  }, [inputText, accounts, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed || parsed.amount <= 0 || isSaving) return;

    setIsSaving(true);
    setSaveError('');
    const now = new Date().toISOString();

    try {
      const newRecord = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        transactionType: parsed.transaction_type,
        amount: parsed.amount,
        currency: 'PKR',
        categoryId: parsed.categoryId || (parsed.transaction_type === 'income' ? 'cat_salary' : 'cat_food'),
        categoryName: parsed.category,
        accountId: parsed.accountId || 'acc_cash',
        accountName: parsed.account,
        transferToAccountId: parsed.transfer_to_account_id,
        transferToAccountName: parsed.transfer_to_account,
        transactionDate: parsed.transaction_date || now.split('T')[0],
        description: parsed.description || inputText.trim(),
        source: 'text_ai' as const,
        status: 'completed' as const,
        confidenceScore: parsed.confidence,
        createdAt: now,
        updatedAt: now
      };

      await db.finance_transactions.add(newRecord);

      setInputText('');
      setParsed(null);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 2000);
      onTransactionSaved?.();
    } catch (err) {
      console.error('Failed to quick save:', err);
      setSaveError('Could not save this transaction. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl transition-all p-1.5 sm:p-2 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500">
          <div className="p-2 text-emerald-600">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 fill-emerald-500" />
          </div>

          <input
            type="text"
            value={inputText}
            onChange={(e) => { setInputText(e.target.value); setSaveError(''); }}
            aria-label="Describe a transaction"
            placeholder="Try: 500 lunch or 3000 petrol yesterday"
            className="min-w-0 flex-1 bg-transparent border-none text-sm text-slate-800 placeholder-slate-500 focus:outline-none px-2"
          />

          {parsed && (
            <div className="hidden lg:flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-xl text-xs font-semibold border border-emerald-200 mr-1.5">
              <span>{formatCurrency(parsed.amount)}</span>
              <span>•</span>
              <span className="truncate max-w-[100px]">{parsed.category}</span>
            </div>
          )}

          {parsed ? (
            <button
              type="submit"
              disabled={isSaving}
              className="shrink-0 px-3 py-2 bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-emerald-800 transition-colors disabled:opacity-50"
            >
              <span>{isSaving ? 'Saving' : 'Save'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            onOpenVoiceModal && (
              <button
                type="button"
                onClick={onOpenVoiceModal}
                className="p-2 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                title="Open Voice Input"
              >
                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )
          )}
        </div>
        {parsed && (
          <p className="mt-2 text-xs text-slate-600" aria-live="polite">
            Ready to save: <strong>{formatCurrency(parsed.amount)}</strong> · {parsed.category} · {parsed.account}
          </p>
        )}
        {saveError && <p role="alert" className="mt-2 text-xs text-rose-700">{saveError}</p>}
      </form>

      {/* Instant Saved Toast */}
      {showSavedToast && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Transaction recorded!</span>
        </div>
      )}
    </div>
  );
};

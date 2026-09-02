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
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-emerald-500/50 transition-all p-1.5 sm:p-2 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500">
          <div className="p-2 text-emerald-600">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 fill-emerald-500" />
          </div>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Smart Text: e.g. '500 lunch', '3000 petrol yesterday', '50000 from client'..."
            className="flex-1 bg-transparent border-none text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none px-2"
          />

          {parsed && (
            <div className="hidden md:flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-xl text-xs font-bold border border-emerald-200 mr-1.5">
              <span>{formatCurrency(parsed.amount)}</span>
              <span>•</span>
              <span className="truncate max-w-[100px]">{parsed.category}</span>
            </div>
          )}

          {parsed ? (
            <button
              type="submit"
              disabled={isSaving}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all"
            >
              <span>Add</span>
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

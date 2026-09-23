import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Mic, Check, Plus, ArrowRightLeft } from 'lucide-react';
import { parseVoiceTransactionInput } from '../../services/voiceParser';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ParsedVoiceTransaction, FinanceTransactionType } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface SmartQuickEntryBarProps {
  onOpenVoiceModal?: () => void;
  onOpenAddModal?: (type: FinanceTransactionType) => void;
  onTransactionSaved?: () => void;
}

export const SmartQuickEntryBar: React.FC<SmartQuickEntryBarProps> = ({
  onOpenVoiceModal,
  onOpenAddModal,
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
    <div className="bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] p-4 sm:p-5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
      {/* Header & Type Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-[#F4F8FB]">
            Record a transaction
          </h3>
          <p className="text-xs text-[#6F899B] mt-0.5">
            Use the form, quick add, or voice entry to record your expenses or income.
          </p>
        </div>

        {/* Action Pills: Expense, Income, Transfer, Voice */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenAddModal && (
            <>
              <button
                type="button"
                onClick={() => onOpenAddModal('expense')}
                className="px-2.5 py-1.5 rounded-xl bg-[rgba(255,98,123,0.1)] hover:bg-[rgba(255,98,123,0.18)] text-[#FF627B] border border-[rgba(255,98,123,0.25)] text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
                <span>Expense</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAddModal('income')}
                className="px-2.5 py-1.5 rounded-xl bg-[rgba(20,230,170,0.1)] hover:bg-[rgba(20,230,170,0.18)] text-[#14E6AA] border border-[rgba(20,230,170,0.25)] text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
                <span>Income</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAddModal('transfer')}
                className="px-2.5 py-1.5 rounded-xl bg-[rgba(57,175,255,0.1)] hover:bg-[rgba(57,175,255,0.18)] text-[#39AFFF] border border-[rgba(57,175,255,0.25)] text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
              >
                <ArrowRightLeft className="w-3 h-3 stroke-[2.5]" />
                <span>Transfer</span>
              </button>
            </>
          )}

          {onOpenVoiceModal && (
            <button
              type="button"
              onClick={onOpenVoiceModal}
              className="px-2.5 py-1.5 rounded-xl bg-[rgba(24,230,190,0.12)] hover:bg-[rgba(24,230,190,0.22)] text-[#18E6BE] border border-[rgba(24,230,190,0.3)] text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
            >
              <Mic className="w-3 h-3 stroke-[2.5]" />
              <span>Voice</span>
            </button>
          )}
        </div>
      </div>

      {/* Input Field Form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl shadow-inner hover:border-[rgba(55,210,190,0.35)] transition-all p-1.5 sm:p-2 focus-within:ring-2 focus-within:ring-[#18E6BE]/20 focus-within:border-[#18E6BE]">
          <div className="p-2 text-[#18E6BE]">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g. 500 lunch or 3000 petrol yesterday or 50k salary"
            className="flex-1 bg-transparent border-none text-xs sm:text-sm font-semibold text-[#F4F8FB] placeholder-[#6F899B] focus:outline-none px-2"
          />

          {parsed && (
            <div className="hidden md:flex items-center gap-1.5 bg-[rgba(24,230,190,0.12)] text-[#18E6BE] px-2.5 py-1 rounded-lg text-xs font-bold border border-[rgba(24,230,190,0.25)] mr-1.5">
              <span>{formatCurrency(parsed.amount)}</span>
              <span>•</span>
              <span className="truncate max-w-[100px]">{parsed.category}</span>
            </div>
          )}

          {parsed ? (
            <button
              type="submit"
              disabled={isSaving}
              className="px-3 py-1.5 bg-[#18E6BE] hover:bg-[#23F2CB] text-[#06131F] rounded-lg text-xs font-bold flex items-center gap-1 shadow-[0_0_12px_rgba(24,230,190,0.3)] active:scale-95 transition-all"
            >
              <span>Add</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          ) : (
            onOpenVoiceModal && (
              <button
                type="button"
                onClick={onOpenVoiceModal}
                className="p-1.5 rounded-lg text-[#6F899B] hover:text-[#18E6BE] hover:bg-[#102638] transition-colors"
                title="Open Voice Input"
              >
                <Mic className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </form>

      {/* Instant Saved Toast */}
      {showSavedToast && (
        <div className="mt-2 text-center text-xs font-bold text-[#14E6AA] flex items-center justify-center gap-1.5 animate-in fade-in">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>Transaction recorded successfully!</span>
        </div>
      )}
    </div>
  );
};

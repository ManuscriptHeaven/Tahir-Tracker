import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  Sparkles, 
  Check, 
  ArrowRightLeft, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Calendar, 
  Wallet, 
  Tag, 
  Volume2, 
  VolumeX,
  AlertCircle
} from 'lucide-react';
import { speechService } from '../../services/speechService';
import { parseVoiceTransactionInput } from '../../services/voiceParser';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ParsedVoiceTransaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface SmartVoiceEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionSaved?: () => void;
  initialType?: 'expense' | 'income' | 'transfer';
}

export const SmartVoiceEntryModal: React.FC<SmartVoiceEntryModalProps> = ({
  isOpen,
  onClose,
  onTransactionSaved,
  initialType
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [language, setLanguage] = useState<'ur-PK' | 'en-US'>('ur-PK');
  const [audioFeedback, setAudioFeedback] = useState(true);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedVoiceTransaction[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const accounts = useLiveQuery(() => db.finance_accounts.filter(a => a.isActive).toArray()) || [];
  const categories = useLiveQuery(() => db.finance_categories.filter(c => c.isActive).toArray()) || [];

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input or start listening on open
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setInterimText('');
      setParsedTransactions([]);
      setSaveSuccessMessage(null);
      setSpeechError(null);
      setEditingIndex(null);

      // Try starting speech automatically if supported
      if (speechService.isSupported()) {
        startListening();
      }
    } else {
      stopListening();
    }
  }, [isOpen]);

  // Real-time NLP parsing whenever transcript changes
  useEffect(() => {
    if (!transcript.trim() || accounts.length === 0 || categories.length === 0) {
      setParsedTransactions([]);
      return;
    }

    const parsed = parseVoiceTransactionInput(transcript, accounts, categories);
    
    // Apply initialType preference if specified and not explicitly overridden
    if (initialType && parsed.length > 0 && parsed[0].transaction_type === 'expense' && !transcript.includes('spent') && !transcript.includes('kharch')) {
      parsed[0].transaction_type = initialType;
    }

    setParsedTransactions(parsed);
  }, [transcript, accounts, categories, initialType]);

  const startListening = () => {
    setSpeechError(null);
    speechService.setLanguage(language);
    speechService.startListening(
      (result) => {
        if (result.isFinal) {
          setTranscript(result.transcript);
          setInterimText('');
        } else {
          setInterimText(result.transcript);
        }
      },
      (listening) => {
        setIsListening(listening);
      },
      (err) => {
        setSpeechError(`Microphone error: ${err}. You can also type below.`);
        setIsListening(false);
      }
    );
  };

  const stopListening = () => {
    speechService.stopListening();
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleLanguageChange = (lang: 'ur-PK' | 'en-US') => {
    setLanguage(lang);
    speechService.setLanguage(lang);
    if (isListening) {
      stopListening();
      setTimeout(() => startListening(), 200);
    }
  };

  const handleConfirmAndSave = async () => {
    if (parsedTransactions.length === 0) return;

    const invalidTx = parsedTransactions.find(t => !t.amount || t.amount <= 0);
    if (invalidTx) {
      alert('Transaction amount must be greater than 0. Please tap the amount field to specify a valid value.');
      return;
    }

    setIsSaving(true);
    const now = new Date().toISOString();

    try {
      for (const tx of parsedTransactions) {
        if (tx.amount <= 0) continue;

        const newRecord = {
          id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          transactionType: tx.transaction_type,
          amount: tx.amount,
          currency: 'PKR',
          categoryId: tx.categoryId || (tx.transaction_type === 'income' ? 'cat_salary' : 'cat_food'),
          categoryName: tx.category,
          accountId: tx.accountId || 'acc_cash',
          accountName: tx.account,
          transferToAccountId: tx.transfer_to_account_id,
          transferToAccountName: tx.transfer_to_account,
          transactionDate: tx.transaction_date || now.split('T')[0],
          description: tx.description || `${tx.category} ${tx.transaction_type}`,
          source: 'voice' as const,
          status: 'completed' as const,
          rawVoiceTranscript: transcript,
          confidenceScore: tx.confidence,
          createdAt: now,
          updatedAt: now
        };

        await db.finance_transactions.add(newRecord);

        // Also record in voice entries table for history tracking
        await db.finance_voice_entries.add({
          id: `ve_${Date.now()}`,
          transcript,
          parsedData: tx,
          confidenceScore: tx.confidence,
          status: 'confirmed',
          transactionId: newRecord.id,
          createdAt: now
        });
      }

      // Audio Feedback
      if (audioFeedback) {
        const first = parsedTransactions[0];
        const speechMsg = `${first.amount} rupees ${first.category} saved`;
        speechService.speak(speechMsg, language);
      }

      setSaveSuccessMessage('Transaction confirmed and saved successfully!');
      setTimeout(() => {
        onTransactionSaved?.();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Failed to save transaction:', err);
      alert(`Error saving transaction: ${err.message || 'Unknown database error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (index: number, field: keyof ParsedVoiceTransaction, value: any) => {
    setParsedTransactions(prev => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };
      if (field === 'categoryId') {
        const matched = categories.find(c => c.id === value);
        if (matched) item.category = matched.name;
      }
      if (field === 'accountId') {
        const matched = accounts.find(a => a.id === value);
        if (matched) item.account = matched.name;
      }
      if (field === 'transfer_to_account_id') {
        const matched = accounts.find(a => a.id === value);
        if (matched) item.transfer_to_account = matched.name;
      }
      copy[index] = item;
      return copy;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-[#0B1D2C] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-cyan-500/30 animate-in slide-in-from-bottom duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#102638] p-4 sm:p-5 border-b border-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#071724] border border-cyan-500/30 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-[#18E6BE]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-100">
                Smart Voice Entry
              </h2>
              <p className="text-xs text-slate-400">
                Speak in Urdu, Roman Urdu or English
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Language Switch */}
            <div className="flex bg-[#071724] p-0.5 rounded-lg border border-slate-700 text-[11px] font-medium">
              <button
                onClick={() => handleLanguageChange('ur-PK')}
                className={`px-2 py-1 rounded-md transition-all ${language === 'ur-PK' ? 'bg-[#18E6BE] text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                اردو
              </button>
              <button
                onClick={() => handleLanguageChange('en-US')}
                className={`px-2 py-1 rounded-md transition-all ${language === 'en-US' ? 'bg-[#18E6BE] text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                EN
              </button>
            </div>

            <button
              onClick={() => setAudioFeedback(!audioFeedback)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#071724] transition-colors"
              title={audioFeedback ? 'Mute voice feedback' : 'Enable voice feedback'}
            >
              {audioFeedback ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#071724] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Prominent Microphone Visualizer */}
          <div className="text-center py-2">
            <div className="relative inline-block">
              {isListening && (
                <>
                  <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
                  <div className="absolute -inset-3 rounded-full bg-cyan-500/10 animate-pulse" />
                </>
              )}
              <button
                onClick={toggleListening}
                className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-xl border ${
                  isListening
                    ? 'bg-rose-500 text-white border-rose-400 shadow-rose-500/30'
                    : 'bg-gradient-to-tr from-[#18E6BE] to-teal-400 text-slate-950 border-cyan-400 shadow-[#18E6BE]/30 hover:scale-105'
                }`}
              >
                {isListening ? (
                  <Mic className="w-9 h-9 animate-bounce text-white" />
                ) : (
                  <Mic className="w-9 h-9" />
                )}
              </button>
            </div>

            <div className="mt-3">
              <p className="text-xs font-bold text-slate-200">
                {isListening ? '🎙️ Listening... Speak naturally now' : 'Tap microphone to start speaking'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                e.g. &ldquo;Aaj 500 rupees lunch pe kharch kiye&rdquo; or &ldquo;3000 petrol yesterday&rdquo;
              </p>
            </div>
          </div>

          {/* Speech Error Banner */}
          {speechError && (
            <div className="p-3 bg-amber-950/40 border border-amber-600/40 rounded-xl flex items-center gap-2 text-xs text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{speechError}</span>
            </div>
          )}

          {/* Live Transcript / Editable Input Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Heard / Spoken Input</span>
              {transcript && (
                <button
                  onClick={() => setTranscript('')}
                  className="text-[11px] text-rose-400 hover:underline lowercase font-normal"
                >
                  clear
                </button>
              )}
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={transcript || interimText}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Spoken words will appear here, or type naturally..."
                className="w-full px-4 py-3 bg-[#071724] border border-slate-700 rounded-xl text-slate-100 text-sm font-medium focus:outline-none focus:border-cyan-400 transition-all placeholder-slate-500 shadow-inner"
              />
              {isListening && interimText && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[10px] text-cyan-300 font-bold bg-[#102638] px-2 py-0.5 rounded-md border border-cyan-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  Live
                </div>
              )}
            </div>
          </div>

          {/* Parsed Structure Preview Cards */}
          {parsedTransactions.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#18E6BE]" />
                  AI Understood ({parsedTransactions.length} Transaction{parsedTransactions.length > 1 ? 's' : ''})
                </span>
                {parsedTransactions[0].confidence > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    {Math.round(parsedTransactions[0].confidence * 100)}% Confidence
                  </span>
                )}
              </div>

              {parsedTransactions.map((tx, idx) => {
                const isTransfer = tx.transaction_type === 'transfer';
                const isIncome = tx.transaction_type === 'income';
                const isEditing = editingIndex === idx;

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-700 bg-[#102638] transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      {/* Type Badge & Amount */}
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg text-white ${
                          isIncome ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : isTransfer ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}>
                          {isIncome ? (
                            <ArrowDownLeft className="w-5 h-5" />
                          ) : isTransfer ? (
                            <ArrowRightLeft className="w-5 h-5" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {tx.transaction_type}
                          </span>
                          <div className="text-xl sm:text-2xl font-bold text-slate-100">
                            {formatCurrency(tx.amount)}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setEditingIndex(isEditing ? null : idx)}
                        className="text-xs font-semibold text-cyan-300 hover:text-white bg-[#071724] px-2.5 py-1 rounded-lg border border-cyan-500/30 transition-colors"
                      >
                        {isEditing ? 'Done' : 'Edit'}
                      </button>
                    </div>

                    {/* Details Grid / Quick Edit */}
                    {!isEditing ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Tag className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="font-semibold truncate">{tx.category}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Wallet className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">{tx.account} {isTransfer && `→ ${tx.transfer_to_account || 'Bank'}`}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-300 col-span-2 sm:col-span-1">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>{tx.transaction_date}</span>
                        </div>
                      </div>
                    ) : (
                      /* Inline Edit Form */
                      <div className="space-y-2.5 mt-3 pt-3 border-t border-slate-800">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-medium text-slate-400">Amount (PKR)</label>
                            <input
                              type="number"
                              value={tx.amount}
                              onChange={(e) => handleFieldChange(idx, 'amount', Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 bg-[#071724] border border-slate-700 rounded-lg text-xs font-bold text-slate-100 focus:outline-none focus:border-cyan-400"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-medium text-slate-400">Type</label>
                            <select
                              value={tx.transaction_type}
                              onChange={(e) => handleFieldChange(idx, 'transaction_type', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[#071724] border border-slate-700 rounded-lg text-xs font-medium text-slate-100 focus:outline-none focus:border-cyan-400"
                            >
                              <option value="expense">Expense</option>
                              <option value="income">Income</option>
                              <option value="transfer">Transfer</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-medium text-slate-400">Category</label>
                            <select
                              value={tx.categoryId}
                              onChange={(e) => handleFieldChange(idx, 'categoryId', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[#071724] border border-slate-700 rounded-lg text-xs font-medium text-slate-100 focus:outline-none focus:border-cyan-400"
                            >
                              {categories
                                .filter(c => c.type === (tx.transaction_type === 'income' ? 'income' : 'expense'))
                                .map(c => (
                                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-medium text-slate-400">Account</label>
                            <select
                              value={tx.accountId}
                              onChange={(e) => handleFieldChange(idx, 'accountId', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[#071724] border border-slate-700 rounded-lg text-xs font-medium text-slate-100 focus:outline-none focus:border-cyan-400"
                            >
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.icon || '💳'} {a.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {isTransfer && (
                          <div>
                            <label className="text-[10px] font-medium text-slate-400">Transfer To Account</label>
                            <select
                              value={tx.transfer_to_account_id}
                              onChange={(e) => handleFieldChange(idx, 'transfer_to_account_id', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[#071724] border border-slate-700 rounded-lg text-xs font-medium text-slate-100 focus:outline-none focus:border-cyan-400"
                            >
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.icon || '💳'} {a.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="text-[10px] font-medium text-slate-400">Date</label>
                          <input
                            type="date"
                            value={tx.transaction_date}
                            onChange={(e) => handleFieldChange(idx, 'transaction_date', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-[#071724] border border-slate-700 rounded-lg text-xs font-medium text-slate-100 focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Helpful Voice Prompts Examples */
            <div className="bg-[#071724] rounded-xl p-4 border border-slate-800 space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Try Saying Any of These:
              </h4>
              <div className="space-y-1.5 text-xs text-slate-300">
                <p className="flex items-center gap-2 cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => setTranscript('Aaj 500 rupees lunch pe kharch kiye')}>
                  <span>🍔</span> &ldquo;Aaj 500 rupees lunch pe kharch kiye&rdquo;
                </p>
                <p className="flex items-center gap-2 cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => setTranscript('Kal petrol ke 3000 rupay diye')}>
                  <span>🚗</span> &ldquo;Kal petrol ke 3000 rupay diye&rdquo;
                </p>
                <p className="flex items-center gap-2 cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => setTranscript('Mujhe 50 hazar payment receive hui')}>
                  <span>💵</span> &ldquo;Mujhe 50 hazar payment receive hui&rdquo;
                </p>
                <p className="flex items-center gap-2 cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => setTranscript('Aaj 1200 ki grocery ki cash se')}>
                  <span>🛒</span> &ldquo;Aaj 1200 ki grocery ki cash se&rdquo;
                </p>
                <p className="flex items-center gap-2 cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => setTranscript('Spent 2500 rupees on dinner using my credit card')}>
                  <span>💳</span> &ldquo;Spent 2500 rupees on dinner using my credit card&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {saveSuccessMessage && (
            <div className="p-3 bg-teal-950/40 border border-teal-500/40 rounded-xl flex items-center gap-2 text-xs font-bold text-teal-200 animate-in fade-in">
              <Check className="w-4 h-4 text-[#18E6BE] shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-[#071724] border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#102638] border border-slate-700 text-slate-300 font-semibold text-xs sm:text-sm hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmAndSave}
            disabled={parsedTransactions.length === 0 || isSaving || parsedTransactions.every(t => t.amount <= 0)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#18E6BE] hover:bg-[#23F2CB] active:scale-95 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md shadow-[#18E6BE]/20 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Confirm & Save</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

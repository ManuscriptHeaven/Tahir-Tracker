import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  Plus, 
  ArrowRightLeft, 
  Edit3, 
  Trash2, 
  X, 
  Check, 
  Wallet, 
  CreditCard, 
  Building2, 
  Smartphone, 
  PiggyBank, 
  Coins 
} from 'lucide-react';
import { FinanceAccount, FinanceAccountType } from '../../types';
import { calculateAccountBalances } from '../../services/financeService';
import { formatCurrency } from '../../utils/formatters';

interface AccountsViewProps {
  onOpenAddModal: (type?: 'expense' | 'income' | 'transfer') => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({}) => {
  const accounts = useLiveQuery(() => db.finance_accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.finance_transactions.toArray()) || [];

  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<FinanceAccount | null>(null);

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Add / Edit Account State
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<FinanceAccountType>('bank');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [institution, setInstitution] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [icon, setIcon] = useState('🏦');
  const [color, setColor] = useState('blue');

  const balanceMap = calculateAccountBalances(accounts, transactions);

  // Calculate Net Worth / Total Liquid Balance
  let totalLiquid = 0;
  let totalCreditOutstanding = 0;

  accounts.forEach(acc => {
    const bal = balanceMap.get(acc.id) ?? acc.openingBalance;
    if (acc.accountType === 'credit_card') {
      if (bal < 0) totalCreditOutstanding += Math.abs(bal);
    } else {
      totalLiquid += bal;
    }
  });

  const netWorth = totalLiquid - totalCreditOutstanding;

  const handleOpenAdd = () => {
    setAccountToEdit(null);
    setName('');
    setAccountType('bank');
    setOpeningBalance('0');
    setInstitution('');
    setAccountNumber('');
    setNotes('');
    setIcon('🏦');
    setColor('blue');
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (acc: FinanceAccount) => {
    setAccountToEdit(acc);
    setName(acc.name);
    setAccountType(acc.accountType);
    setOpeningBalance(acc.openingBalance.toString());
    setInstitution(acc.institution || '');
    setAccountNumber(acc.accountNumber || '');
    setNotes(acc.notes || '');
    setIcon(acc.icon || '💳');
    setColor(acc.color || 'emerald');
    setIsAddEditOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const numOpening = parseFloat(openingBalance) || 0;
    const now = new Date().toISOString();

    try {
      if (accountToEdit) {
        await db.finance_accounts.update(accountToEdit.id, {
          name,
          accountType,
          openingBalance: numOpening,
          institution,
          accountNumber,
          notes,
          icon,
          color,
          updatedAt: now
        });
      } else {
        const newAcc: FinanceAccount = {
          id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name,
          accountType,
          openingBalance: numOpening,
          currency: 'PKR',
          institution,
          accountNumber,
          notes,
          icon,
          color,
          isActive: true,
          createdAt: now,
          updatedAt: now
        };
        await db.finance_accounts.add(newAcc);
      }
      setIsAddEditOpen(false);
    } catch (err) {
      console.error('Failed to save account:', err);
    }
  };

  const handleDeleteAccount = async (accId: string) => {
    if (confirm('Are you sure you want to delete this account? Transactions linked to it will remain.')) {
      await db.finance_accounts.delete(accId);
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid transfer amount.');
      return;
    }

    if (!transferFrom || !transferTo || transferFrom === transferTo) {
      alert('Please choose distinct Source and Destination accounts.');
      return;
    }

    setIsTransferring(true);
    const now = new Date().toISOString();
    const sourceAcc = accounts.find(a => a.id === transferFrom);
    const destAcc = accounts.find(a => a.id === transferTo);

    try {
      const transferRecord = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        transactionType: 'transfer' as const,
        amount,
        currency: 'PKR',
        accountId: transferFrom,
        accountName: sourceAcc?.name || 'Account',
        transferToAccountId: transferTo,
        transferToAccountName: destAcc?.name || 'Account',
        transactionDate: now.split('T')[0],
        description: transferNote.trim() || `Transfer from ${sourceAcc?.name} to ${destAcc?.name}`,
        source: 'manual' as const,
        status: 'completed' as const,
        createdAt: now,
        updatedAt: now
      };

      await db.finance_transactions.add(transferRecord);
      setIsTransferOpen(false);
      setTransferAmount('');
      setTransferNote('');
    } catch (err) {
      console.error('Failed to execute transfer:', err);
    } finally {
      setIsTransferring(false);
    }
  };

  const getAccountIconComponent = (accType: FinanceAccountType) => {
    switch (accType) {
      case 'cash': return Coins;
      case 'bank': return Building2;
      case 'digital_wallet': return Smartphone;
      case 'credit_card': return CreditCard;
      case 'savings': return PiggyBank;
      default: return Wallet;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. NET WORTH & LIQUID ASSETS BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
            Total Net Worth & Liquidity
          </span>
          <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
            {formatCurrency(netWorth)}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-300 mt-2">
            <span>Liquid Assets: <strong className="text-emerald-400">{formatCurrency(totalLiquid)}</strong></span>
            {totalCreditOutstanding > 0 && (
              <span>Credit Due: <strong className="text-rose-400">-{formatCurrency(totalCreditOutstanding)}</strong></span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              if (accounts.length >= 2) {
                setTransferFrom(accounts[0].id);
                setTransferTo(accounts[1].id);
                setIsTransferOpen(true);
              } else {
                alert('You need at least two accounts to transfer money.');
              }
            }}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-white/10"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transfer Funds</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-900 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Account</span>
          </button>
        </div>
      </div>

      {/* 2. ACCOUNTS CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(acc => {
          const currentBalance = balanceMap.get(acc.id) ?? acc.openingBalance;
          const IconComp = getAccountIconComponent(acc.accountType);
          const isCreditCard = acc.accountType === 'credit_card';

          return (
            <div
              key={acc.id}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-inner ${
                      acc.accountType === 'cash' 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : acc.accountType === 'credit_card' 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : acc.accountType === 'digital_wallet' 
                        ? 'bg-teal-50 text-teal-700' 
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {acc.icon || <IconComp className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-base group-hover:text-emerald-700 transition-colors">
                        {acc.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {acc.institution || acc.accountType} {acc.accountNumber && `• ${acc.accountNumber}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(acc)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Edit Account"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(acc.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {isCreditCard ? 'Outstanding Balance' : 'Current Balance'}
                  </span>
                  <div className={`text-2xl sm:text-3xl font-black mt-0.5 ${
                    isCreditCard && currentBalance < 0 
                      ? 'text-rose-600' 
                      : 'text-slate-900'
                  }`}>
                    {formatCurrency(Math.abs(currentBalance))}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Opening: {formatCurrency(acc.openingBalance)}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="capitalize">{acc.accountType.replace('_', ' ')}</span>
                <button
                  onClick={() => {
                    setTransferFrom(acc.id);
                    const dest = accounts.find(a => a.id !== acc.id);
                    if (dest) setTransferTo(dest.id);
                    setIsTransferOpen(true);
                  }}
                  className="text-emerald-700 font-bold hover:underline"
                >
                  Transfer →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. ADD / EDIT ACCOUNT MODAL */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsAddEditOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {accountToEdit ? 'Edit Account' : 'Add New Account'}
              </h3>
              <button
                onClick={() => setIsAddEditOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600">Account Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HBL Salary, Easypaisa, Cash Wallet"
                  className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Account Type</label>
                  <select
                    value={accountType}
                    onChange={(e) => {
                      const val = e.target.value as FinanceAccountType;
                      setAccountType(val);
                      if (val === 'cash') setIcon('💵');
                      else if (val === 'bank') setIcon('🏦');
                      else if (val === 'digital_wallet') setIcon('📱');
                      else if (val === 'credit_card') setIcon('💳');
                      else if (val === 'savings') setIcon('🐷');
                    }}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold"
                  >
                    <option value="cash">Cash Wallet</option>
                    <option value="bank">Bank Account</option>
                    <option value="digital_wallet">Digital Wallet</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="savings">Savings</option>
                    <option value="investment">Investment</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">Opening Balance (PKR)</label>
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Institution / Bank</label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g. HBL, Meezan"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">Account / Card No.</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. **** 1234"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Icon Emoji</label>
                <div className="flex items-center gap-2 mt-1">
                  {['💵', '🏦', '📱', '💳', '🐷', '📈', '🪙', '💰'].map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setIcon(em)}
                      className={`p-2 rounded-xl text-lg border transition-all ${icon === em ? 'bg-emerald-100 border-emerald-500 scale-110' : 'bg-slate-50 border-slate-200'}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes about this account..."
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-2xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs shadow-md"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. QUICK TRANSFER MODAL */}
      {isTransferOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsTransferOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-black text-slate-900">Transfer Funds</h3>
              </div>
              <button
                onClick={() => setIsTransferOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600">Amount (PKR) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="e.g. 20000"
                  className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-lg font-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">From Account</label>
                  <select
                    value={transferFrom}
                    onChange={(e) => setTransferFrom(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.icon || '💳'} {a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">To Account</label>
                  <select
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold"
                  >
                    {accounts.filter(a => a.id !== transferFrom).map(a => (
                      <option key={a.id} value={a.id}>{a.icon || '💳'} {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Note / Reason (Optional)</label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="e.g. ATM cash withdrawal, Salary transfer..."
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-2xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTransferring}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-xs shadow-md flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isTransferring ? 'Transferring...' : 'Execute Transfer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

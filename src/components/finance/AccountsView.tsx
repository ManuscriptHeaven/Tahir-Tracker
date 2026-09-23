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
  const [_color, setColor] = useState('blue');

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
    setIcon(acc.icon || '🏦');
    setColor(acc.color || 'blue');
    setIsAddEditOpen(true);
  };

  const handleDeleteAccount = async (accId: string) => {
    if (confirm('Are you sure you want to delete this account? Transactions linked to it may be affected.')) {
      await db.finance_accounts.delete(accId);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const opBal = parseFloat(openingBalance) || 0;
    const now = new Date().toISOString();

    if (accountToEdit) {
      await db.finance_accounts.update(accountToEdit.id, {
        name: name.trim(),
        accountType,
        openingBalance: opBal,
        institution: institution.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        icon,
        updatedAt: now
      });
    } else {
      const newAcc: FinanceAccount = {
        id: `acc_${Date.now()}`,
        name: name.trim(),
        accountType,
        openingBalance: opBal,
        currency: 'PKR',
        isActive: true,
        institution: institution.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        icon,
        color: 'emerald',
        createdAt: now,
        updatedAt: now
      };
      await db.finance_accounts.add(newAcc);
    }

    setIsAddEditOpen(false);
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
      <div className="bg-[#0B1D2C] rounded-2xl p-5 sm:p-6 border border-[rgba(70,150,180,0.18)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#18E6BE]">
            Total Net Worth & Liquidity
          </span>
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F4F8FB] mt-1 tabular-nums">
            {formatCurrency(netWorth)}
          </div>
          <div className="flex items-center gap-4 text-xs text-[#A9BDCC] mt-2">
            <span>Liquid Assets: <strong className="text-[#14E6AA]">{formatCurrency(totalLiquid)}</strong></span>
            {totalCreditOutstanding > 0 && (
              <span>Credit Due: <strong className="text-[#FF627B]">-{formatCurrency(totalCreditOutstanding)}</strong></span>
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
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#102638] hover:bg-[#122B3E] active:scale-95 text-[#A9BDCC] hover:text-[#F4F8FB] font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-[rgba(70,150,180,0.2)]"
          >
            <ArrowRightLeft className="w-4 h-4 text-[#18E6BE]" />
            <span>Transfer Funds</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#18E6BE] hover:bg-[#23F2CB] active:scale-95 text-[#06131F] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(24,230,190,0.25)]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
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
              className="bg-[#0B1D2C] rounded-2xl p-5 border border-[rgba(70,150,180,0.18)] hover:border-[rgba(55,210,190,0.35)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#102638] border border-[rgba(70,150,180,0.2)] flex items-center justify-center text-lg text-[#18E6BE]">
                      {acc.icon || <IconComp className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#F4F8FB] text-base group-hover:text-[#18E6BE] transition-colors">
                        {acc.name}
                      </h3>
                      <p className="text-[11px] text-[#6F899B]">
                        {acc.institution || acc.accountType} {acc.accountNumber && `• ${acc.accountNumber}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(acc)}
                      className="p-1.5 rounded-lg text-[#6F899B] hover:text-[#F4F8FB] hover:bg-[#102638] transition-colors"
                      title="Edit Account"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(acc.id)}
                      className="p-1.5 rounded-lg text-[#6F899B] hover:text-[#FF627B] hover:bg-[rgba(255,98,123,0.1)] transition-colors"
                      title="Delete Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-[10px] font-bold text-[#6F899B] uppercase tracking-wider">
                    {isCreditCard ? 'Outstanding Balance' : 'Current Balance'}
                  </span>
                  <div className={`text-2xl sm:text-[28px] font-extrabold mt-0.5 tabular-nums ${
                    isCreditCard && currentBalance < 0 
                      ? 'text-[#FF627B]' 
                      : 'text-[#F4F8FB]'
                  }`}>
                    {formatCurrency(Math.abs(currentBalance))}
                  </div>
                  <div className="text-[11px] text-[#6F899B] mt-1">
                    Opening: {formatCurrency(acc.openingBalance)}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[rgba(70,150,180,0.12)] flex items-center justify-between text-xs text-[#6F899B]">
                <span className="capitalize">{acc.accountType.replace('_', ' ')}</span>
                <button
                  onClick={() => {
                    setTransferFrom(acc.id);
                    const dest = accounts.find(a => a.id !== acc.id);
                    if (dest) setTransferTo(dest.id);
                    setIsTransferOpen(true);
                  }}
                  className="text-[#18E6BE] font-bold hover:underline"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsAddEditOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#071724] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-[rgba(70,150,180,0.2)] p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[rgba(70,150,180,0.14)] pb-3">
              <h3 className="text-base font-bold text-[#F4F8FB]">
                {accountToEdit ? 'Edit Account' : 'Add New Account'}
              </h3>
              <button
                onClick={() => setIsAddEditOpen(false)}
                className="p-1 rounded-lg text-[#6F899B] hover:text-[#F4F8FB] hover:bg-[#0B1D2C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#A9BDCC]">Account Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HBL Salary, Easypaisa, Cash Wallet"
                  className="w-full mt-1 px-3.5 py-2.5 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs sm:text-sm font-bold text-[#F4F8FB] placeholder-[#6F899B] focus:outline-none focus:border-[#18E6BE]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#A9BDCC]">Account Type</label>
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
                    className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs font-bold text-[#F4F8FB]"
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
                  <label className="text-xs font-bold text-[#A9BDCC]">Opening Balance (PKR)</label>
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs font-bold text-[#F4F8FB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#A9BDCC]">Institution / Bank</label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g. HBL, Meezan"
                    className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs text-[#F4F8FB]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#A9BDCC]">Account / Card No.</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. **** 1234"
                    className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs text-[#F4F8FB]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#A9BDCC]">Icon Emoji</label>
                <div className="flex items-center gap-2 mt-1">
                  {['💵', '🏦', '📱', '💳', '🐷', '📈', '🪙', '💰'].map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setIcon(em)}
                      className={`p-2 rounded-xl text-lg border transition-all ${icon === em ? 'bg-[rgba(24,230,190,0.15)] border-[#18E6BE] scale-110' : 'bg-[#091A28] border-[rgba(70,150,180,0.2)]'}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#A9BDCC]">Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes about this account..."
                  className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs text-[#F4F8FB]"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="flex-1 py-2.5 bg-[#102638] text-[#A9BDCC] hover:text-[#F4F8FB] font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#18E6BE] hover:bg-[#23F2CB] text-[#06131F] font-bold rounded-xl text-xs shadow-[0_0_15px_rgba(24,230,190,0.25)] transition-all"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsTransferOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#071724] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-[rgba(70,150,180,0.2)] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(70,150,180,0.14)] pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-[#39AFFF]" />
                <h3 className="text-base font-bold text-[#F4F8FB]">Transfer Funds</h3>
              </div>
              <button
                onClick={() => setIsTransferOpen(false)}
                className="p-1 rounded-lg text-[#6F899B] hover:text-[#F4F8FB] hover:bg-[#0B1D2C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#A9BDCC]">Amount (PKR) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="e.g. 20000"
                  className="w-full mt-1 px-4 py-3 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-[#F4F8FB] text-lg font-bold focus:outline-none focus:border-[#39AFFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#A9BDCC]">From Account</label>
                  <select
                    value={transferFrom}
                    onChange={(e) => setTransferFrom(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs font-bold text-[#F4F8FB]"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.icon || '💳'} {a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#A9BDCC]">To Account</label>
                  <select
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs font-bold text-[#F4F8FB]"
                  >
                    {accounts.filter(a => a.id !== transferFrom).map(a => (
                      <option key={a.id} value={a.id}>{a.icon || '💳'} {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#A9BDCC]">Note / Reason (Optional)</label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="e.g. ATM cash withdrawal, Salary transfer..."
                  className="w-full mt-1 px-3 py-2 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs text-[#F4F8FB]"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="flex-1 py-2.5 bg-[#102638] text-[#A9BDCC] hover:text-[#F4F8FB] font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTransferring}
                  className="flex-1 py-2.5 bg-[#39AFFF] hover:bg-[#2090e0] text-[#06131F] font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 transition-all"
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

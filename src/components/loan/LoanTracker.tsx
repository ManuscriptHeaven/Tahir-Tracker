import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { LoanTransaction, LoanPayment, PersonLoanGroup } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { addMoney, subtractMoney } from '../../utils/money';
import { getTodayLocalDateStr } from '../../utils/dateTime';
import { 
  HandCoins, 
  CheckCircle2, 
  User, 
  Phone, 
  FileText, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft,
  X,
  Search,
  Users
} from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { MetricCard } from '../ui/MetricCard';
import { EmptyState } from '../ui/EmptyState';

interface LoanTrackerProps {
  onOpenReport?: () => void;
}

export const LoanTracker: React.FC<LoanTrackerProps> = ({ onOpenReport }) => {
  const loans = useLiveQuery(() => db.loans.orderBy('date').reverse().toArray()) || [];
  
  // Local state
  const [filter, setFilter] = useState<'all' | 'owes_you' | 'you_owe' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPersonForLedger, setSelectedPersonForLedger] = useState<string | null>(null);
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState<LoanTransaction | null>(null);

  // Form states
  const [personNameInput, setPersonNameInput] = useState('');
  const [existingPersonSelect, setExistingPersonSelect] = useState<string>('__new__');
  const [personPhone, setPersonPhone] = useState('');
  const [loanType, setLoanType] = useState<'given' | 'taken'>('given');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayLocalDateStr());
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayLocalDateStr());
  const [paymentNote, setPaymentNote] = useState('');

  // Helper calculations
  const calculateTotalPaid = (loan: LoanTransaction) => {
    return (loan.payments || []).reduce((sum, p) => addMoney(sum, p.amount), 0);
  };

  const calculateBalance = (loan: LoanTransaction) => {
    const paid = calculateTotalPaid(loan);
    return Math.max(0, subtractMoney(loan.principalAmount, paid));
  };

  // Group all loans by Person Name
  const personMap = new Map<string, PersonLoanGroup>();

  loans.forEach((loan) => {
    const key = loan.personName.trim().toLowerCase();
    const displayName = loan.personName.trim();

    if (!personMap.has(key)) {
      personMap.set(key, {
        personName: displayName,
        personPhone: loan.personPhone,
        totalGiven: 0,
        totalGivenReceived: 0,
        totalGivenRemaining: 0,
        totalTaken: 0,
        totalTakenRepaid: 0,
        totalTakenRemaining: 0,
        netBalance: 0,
        transactions: []
      });
    }

    const group = personMap.get(key)!;
    group.transactions.push(loan);
    if (!group.personPhone && loan.personPhone) {
      group.personPhone = loan.personPhone;
    }

    const paid = calculateTotalPaid(loan);
    const rem = calculateBalance(loan);

    if (loan.type === 'given') {
      group.totalGiven = addMoney(group.totalGiven, loan.principalAmount);
      group.totalGivenReceived = addMoney(group.totalGivenReceived, paid);
      group.totalGivenRemaining = addMoney(group.totalGivenRemaining, rem);
    } else {
      group.totalTaken = addMoney(group.totalTaken, loan.principalAmount);
      group.totalTakenRepaid = addMoney(group.totalTakenRepaid, paid);
      group.totalTakenRemaining = addMoney(group.totalTakenRemaining, rem);
    }
  });

  // Calculate Net Balances for each person
  const personGroups: PersonLoanGroup[] = Array.from(personMap.values()).map((g) => {
    g.netBalance = subtractMoney(g.totalGivenRemaining, g.totalTakenRemaining);
    return g;
  });

  // Unique list of person names for dropdown selection
  const existingPeople = Array.from(new Set(loans.map((l) => l.personName.trim())));

  // Overall Statistics
  const totalGivenOverall = loans
    .filter((l) => l.type === 'given')
    .reduce((sum, l) => addMoney(sum, l.principalAmount), 0);

  const totalReceivedOverall = loans
    .filter((l) => l.type === 'given')
    .reduce((sum, l) => addMoney(sum, calculateTotalPaid(l)), 0);

  const outstandingGivenOverall = subtractMoney(totalGivenOverall, totalReceivedOverall);

  const totalTakenOverall = loans
    .filter((l) => l.type === 'taken')
    .reduce((sum, l) => addMoney(sum, l.principalAmount), 0);

  const totalRepaidOverall = loans
    .filter((l) => l.type === 'taken')
    .reduce((sum, l) => addMoney(sum, calculateTotalPaid(l)), 0);

  const outstandingTakenOverall = subtractMoney(totalTakenOverall, totalRepaidOverall);

  // Filtered Person Groups
  const filteredPersonGroups = personGroups.filter((group) => {
    if (filter === 'owes_you' && group.netBalance <= 0) return false;
    if (filter === 'you_owe' && group.netBalance >= 0) return false;
    if (filter === 'settled' && group.netBalance !== 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPerson = group.personName.toLowerCase().includes(q) || (group.personPhone && group.personPhone.includes(q));
      const matchNotes = group.transactions.some(t => t.notes && t.notes.toLowerCase().includes(q));
      return matchPerson || matchNotes;
    }
    return true;
  });

  // Handle Add Loan Transaction
  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = existingPersonSelect === '__new__' ? personNameInput.trim() : existingPersonSelect;
    const principal = parseFloat(amount);

    if (!finalName || isNaN(principal) || principal <= 0) {
      alert('Please provide a valid person name and loan amount');
      return;
    }

    const newLoan: LoanTransaction = {
      id: `loan_${Date.now()}`,
      personName: finalName,
      personPhone: personPhone.trim() || undefined,
      type: loanType,
      principalAmount: principal,
      date: date || getTodayLocalDateStr(),
      dueDate: dueDate || undefined,
      notes: notes.trim() || undefined,
      status: 'active',
      payments: [],
      createdAt: new Date().toISOString()
    };

    await db.loans.add(newLoan);
    resetForm();
    setIsAddModalOpen(false);
  };

  const resetForm = () => {
    setPersonNameInput('');
    setExistingPersonSelect('__new__');
    setPersonPhone('');
    setAmount('');
    setDueDate('');
    setNotes('');
  };

  // Open modal prefilled for a specific person
  const handleOpenAddForPerson = (name: string, type: 'given' | 'taken') => {
    setExistingPersonSelect(name);
    setLoanType(type);
    setIsAddModalOpen(true);
  };

  // Handle Add Payment
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForPayment) return;
    const pAmt = parseFloat(paymentAmount);
    if (isNaN(pAmt) || pAmt <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const newPayment: LoanPayment = {
      id: `pay_${Date.now()}`,
      amount: pAmt,
      date: paymentDate || getTodayLocalDateStr(),
      note: paymentNote.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const updatedPayments = [...(selectedLoanForPayment.payments || []), newPayment];
    const totalPaid = updatedPayments.reduce((s, p) => s + p.amount, 0);
    const newStatus = totalPaid >= selectedLoanForPayment.principalAmount ? 'completed' : 'active';

    await db.loans.update(selectedLoanForPayment.id, {
      payments: updatedPayments,
      status: newStatus
    });

    setPaymentAmount('');
    setPaymentNote('');
    setSelectedLoanForPayment(null);
  };

  // Delete Payment
  const handleDeletePayment = async (loanId: string, paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment record?')) return;
    const loan = await db.loans.get(loanId);
    if (!loan) return;

    const updatedPayments = (loan.payments || []).filter((p) => p.id !== paymentId);
    const totalPaid = updatedPayments.reduce((s, p) => s + p.amount, 0);
    const newStatus = totalPaid >= loan.principalAmount ? 'completed' : 'active';

    await db.loans.update(loanId, {
      payments: updatedPayments,
      status: newStatus
    });
  };

  // Delete Entire Loan
  const handleDeleteLoan = async (loanId: string) => {
    if (!confirm('Are you sure you want to permanently delete this transaction?')) return;
    await db.loans.delete(loanId);
  };

  // Currently selected person for full ledger modal
  const activePersonGroup = selectedPersonForLedger
    ? personGroups.find(g => g.personName.toLowerCase() === selectedPersonForLedger.toLowerCase())
    : null;

  return (
    <div className="space-y-6 pb-16">
      {/* 1. PAGE HEADER */}
      <PageHeader
        icon={HandCoins}
        title="Lease & Loan Management"
        subtitle="Person-centric profiles with combined Udhaar given, borrowings, and return ledgers."
        primaryAction={{
          label: "+ New Lease / Entry",
          onClick: () => {
            resetForm();
            setIsAddModalOpen(true);
          }
        }}
        secondaryAction={onOpenReport ? {
          label: "Loan Reports",
          icon: FileText,
          onClick: onOpenReport
        } : undefined}
      />

      {/* 2. TOP METRIC CARDS (4 across matching Panel 4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Money Given (Receivable) */}
        <MetricCard
          title="Money Given (Udhaar)"
          value={formatCurrency(outstandingGivenOverall)}
          subtitle={`Total Issued: ${formatCurrency(totalGivenOverall)}`}
          icon={ArrowUpRight}
          variant="success"
        />

        {/* Metric 2: Money Taken (Payable) */}
        <MetricCard
          title="Money Taken (Borrowed)"
          value={formatCurrency(outstandingTakenOverall)}
          subtitle={`Total Taken: ${formatCurrency(totalTakenOverall)}`}
          icon={ArrowDownLeft}
          variant="danger"
        />

        {/* Metric 3: Owes You Ledgers */}
        <MetricCard
          title="People Owing You"
          value={`${personGroups.filter(g => g.netBalance > 0).length} Profiles`}
          subtitle="Net positive receivables"
          icon={CheckCircle2}
          variant="accent"
        />

        {/* Metric 4: Total Profiles */}
        <MetricCard
          title="Total People / Ledgers"
          value={`${personGroups.length} Profiles`}
          subtitle={`${personGroups.filter(g => g.netBalance === 0).length} fully settled`}
          icon={Users}
          variant="default"
        />
      </div>

      {/* 3. FILTER & SEARCH TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#0B1D2C] p-3 rounded-2xl border border-slate-700/50 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All People' },
            { id: 'owes_you', label: 'Owes You' },
            { id: 'you_owe', label: 'You Owe' },
            { id: 'settled', label: 'Settled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filter === tab.id
                  ? 'bg-[#18E6BE] text-slate-950 font-bold shadow-sm'
                  : 'bg-[#102638] text-slate-300 hover:text-white border border-slate-700/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search person or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-3 py-1.5 bg-[#071724] border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* 4. PERSON CARDS GRID */}
      {filteredPersonGroups.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No Person Profiles Found"
          description={searchQuery ? 'Try matching a different keyword or clear your search query.' : 'Start by adding a person profile or loan record above.'}
          action={{
            label: "+ Add Person Entry",
            onClick: () => {
              resetForm();
              setIsAddModalOpen(true);
            }
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPersonGroups.map((group) => {
            const isOwesYou = group.netBalance > 0;
            const isYouOwe = group.netBalance < 0;

            return (
              <div
                key={group.personName}
                className="bg-[#0B1D2C] rounded-2xl p-5 border border-slate-700/50 hover:border-cyan-500/40 shadow-sm transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  {/* Top Row: Person Avatar, Name & Net Position Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm border ${
                        isOwesYou 
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' 
                          : isYouOwe 
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-[#102638] text-slate-300 border-slate-700'
                      }`}>
                        {group.personName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-100 text-base">{group.personName}</h3>
                        {group.personPhone ? (
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <Phone className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{group.personPhone}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 mt-0.5">{group.transactions.length} Transactions</div>
                        )}
                      </div>
                    </div>

                    {/* Net Position Badge */}
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1 border ${
                      isOwesYou
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                        : isYouOwe
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-[#102638] text-slate-300 border-slate-700'
                    }`}>
                      {isOwesYou ? (
                        <>
                          <ArrowUpRight className="w-3.5 h-3.5 text-teal-400" />
                          Owes You {formatCurrency(group.netBalance)}
                        </>
                      ) : isYouOwe ? (
                        <>
                          <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
                          You Owe {formatCurrency(Math.abs(group.netBalance))}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#18E6BE]" />
                          Settled
                        </>
                      )}
                    </span>
                  </div>

                  {/* Financial Matrix for Person */}
                  <div className="grid grid-cols-2 gap-2 bg-[#071724] p-3 rounded-xl mt-3.5 text-center border border-slate-800">
                    <div className="p-1">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Udhaar Given Balance</div>
                      <div className="font-bold text-teal-400 text-sm mt-0.5">
                        {formatCurrency(group.totalGivenRemaining)}
                      </div>
                      <div className="text-[10px] text-slate-500">Total: {formatCurrency(group.totalGiven)}</div>
                    </div>
                    <div className="p-1 border-l border-slate-800">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Borrowing Balance</div>
                      <div className="font-bold text-rose-400 text-sm mt-0.5">
                        {formatCurrency(group.totalTakenRemaining)}
                      </div>
                      <div className="text-[10px] text-slate-500">Total: {formatCurrency(group.totalTaken)}</div>
                    </div>
                  </div>
                </div>

                {/* Person Card Footer Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 flex-wrap">
                  <button
                    onClick={() => setSelectedPersonForLedger(group.personName)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#102638] hover:bg-[#16344d] text-cyan-300 text-xs font-semibold transition-all flex items-center gap-1.5 border border-cyan-500/20"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#18E6BE]" />
                    <span>Full Ledger ({group.transactions.length})</span>
                  </button>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={() => handleOpenAddForPerson(group.personName, 'given')}
                      className="px-2.5 py-1.5 rounded-xl bg-teal-950/50 hover:bg-teal-900/60 text-teal-300 text-[11px] font-bold transition-colors border border-teal-500/30"
                      title="Add Given Loan for this person"
                    >
                      + Udhaar
                    </button>
                    <button
                      onClick={() => handleOpenAddForPerson(group.personName, 'taken')}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 text-[11px] font-bold transition-colors border border-rose-500/30"
                      title="Add Borrowing for this person"
                    >
                      + Taken
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. MODAL: FULL PERSON PROFILE LEDGER */}
      {activePersonGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0B1D2C] rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-cyan-500/30 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#102638] text-cyan-400 border border-cyan-500/30 font-bold text-base flex items-center justify-center">
                  {activePersonGroup.personName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-lg leading-tight">
                    {activePersonGroup.personName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {activePersonGroup.personPhone ? `Phone: ${activePersonGroup.personPhone}` : 'Person Ledger Profile'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPersonForLedger(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#102638]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Net Position Summary Box */}
            <div className="grid grid-cols-3 gap-2 bg-[#071724] p-3 rounded-xl my-3 text-center border border-slate-800">
              <div>
                <div className="text-[10px] text-slate-400 font-medium uppercase">Udhaar Given</div>
                <div className="font-bold text-teal-400 text-sm mt-0.5">
                  {formatCurrency(activePersonGroup.totalGivenRemaining)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium uppercase">Borrowing Taken</div>
                <div className="font-bold text-rose-400 text-sm mt-0.5">
                  {formatCurrency(activePersonGroup.totalTakenRemaining)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium uppercase">Net Position</div>
                <div className={`font-bold text-sm mt-0.5 ${
                  activePersonGroup.netBalance > 0 
                    ? 'text-teal-400' 
                    : activePersonGroup.netBalance < 0 
                    ? 'text-rose-400' 
                    : 'text-slate-300'
                }`}>
                  {activePersonGroup.netBalance > 0 
                    ? `+${formatCurrency(activePersonGroup.netBalance)}`
                    : activePersonGroup.netBalance < 0
                    ? `-${formatCurrency(Math.abs(activePersonGroup.netBalance))}`
                    : 'Settled'}
                </div>
              </div>
            </div>

            {/* Transactions & Payment Timeline */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Transaction History ({activePersonGroup.transactions.length})
                </h4>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenAddForPerson(activePersonGroup.personName, 'given')}
                    className="px-2 py-1 bg-teal-950/60 text-teal-300 text-[10px] font-bold rounded-lg border border-teal-500/30"
                  >
                    + Given
                  </button>
                  <button
                    onClick={() => handleOpenAddForPerson(activePersonGroup.personName, 'taken')}
                    className="px-2 py-1 bg-rose-950/60 text-rose-300 text-[10px] font-bold rounded-lg border border-rose-500/30"
                  >
                    + Taken
                  </button>
                </div>
              </div>

              {activePersonGroup.transactions.map((tx) => {
                const balance = calculateBalance(tx);
                const isSettled = balance === 0;

                return (
                  <div key={tx.id} className="p-3.5 bg-[#071724] rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                            tx.type === 'given' 
                              ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' 
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}>
                            {tx.type === 'given' ? 'Money Given' : 'Borrowed'}
                          </span>
                          <span className="text-xs font-bold text-slate-100">{formatCurrency(tx.principalAmount)}</span>
                          <button
                            onClick={() => handleDeleteLoan(tx.id)}
                            className="text-slate-500 hover:text-rose-400 p-0.5 ml-1 transition-colors"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Date: {formatDate(tx.date, 'short')} {tx.dueDate && `• Due: ${formatDate(tx.dueDate, 'short')}`}
                        </div>
                        {tx.notes && <div className="text-xs text-slate-300 mt-0.5">"{tx.notes}"</div>}
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-100">
                          {formatCurrency(balance)} <span className="text-[10px] text-slate-400 font-normal">rem</span>
                        </div>
                        {!isSettled && (
                          <button
                            onClick={() => {
                              setSelectedLoanForPayment(tx);
                              setPaymentAmount(balance.toString());
                            }}
                            className="mt-1 px-2.5 py-1 bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 font-bold text-[10px] rounded-lg shadow-sm transition-colors"
                          >
                            + Log Return
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Payment History for this specific transaction */}
                    {tx.payments && tx.payments.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Repayments:</div>
                        {tx.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-[11px] bg-[#0B1D2C] px-2.5 py-1 rounded-lg border border-slate-800">
                            <span className="font-bold text-slate-200">{formatCurrency(p.amount)}</span>
                            <span className="text-slate-400">{formatDate(p.date, 'short')} {p.note && `• ${p.note}`}</span>
                            <button
                              onClick={() => handleDeletePayment(tx.id, p.id)}
                              className="text-slate-500 hover:text-rose-400 p-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedPersonForLedger(null)}
                className="px-5 py-2 bg-[#102638] hover:bg-[#16344d] text-slate-200 font-semibold rounded-xl text-xs border border-slate-700 transition-colors"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: ADD LOAN TRANSACTION / PERSON */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0B1D2C] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-cyan-500/30 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-lg flex items-center gap-2">
                <HandCoins className="w-5 h-5 text-[#18E6BE]" />
                <span>Add Lease / Loan Entry</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#102638]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLoan} className="space-y-4 mt-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Transaction Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLoanType('given')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      loanType === 'given'
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300 shadow-sm'
                        : 'bg-[#071724] border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-teal-400" />
                    Money Given (Udhaar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoanType('taken')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      loanType === 'taken'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm'
                        : 'bg-[#071724] border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4 text-rose-400" />
                    Money Taken (Borrowed)
                  </button>
                </div>
              </div>

              {/* Person Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Select or Add Person *
                </label>
                {existingPeople.length > 0 && (
                  <select
                    value={existingPersonSelect}
                    onChange={(e) => setExistingPersonSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 mb-2 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="__new__">+ Create New Person Profile</option>
                    {existingPeople.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}

                {existingPersonSelect === '__new__' && (
                  <div className="relative">
                    <User className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Saleem bhai, Ali, Ahmed"
                      value={personNameInput}
                      onChange={(e) => setPersonNameInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-medium"
                    />
                  </div>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    placeholder="e.g. 0300-1234567"
                    value={personPhone}
                    onChange={(e) => setPersonPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-medium"
                  />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Amount (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="e.g. 50000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-base font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes / Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#102638] border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-[#18E6BE]/20 transition-all"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: LOG REPAYMENT */}
      {selectedLoanForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0B1D2C] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-cyan-500/30 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-slate-100 text-lg">
                  Log Return / Payment
                </h3>
                <p className="text-xs text-slate-400">
                  Person: <strong className="text-slate-200">{selectedLoanForPayment.personName}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedLoanForPayment(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#102638]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="space-y-4 mt-4">
              <div className="bg-[#071724] p-3 rounded-xl flex justify-between items-center text-xs border border-slate-800">
                <span className="text-slate-400">Transaction Balance Remaining:</span>
                <span className="font-bold text-slate-100 text-sm">
                  {formatCurrency(calculateBalance(selectedLoanForPayment))}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Amount (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-base font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank transfer, Cash installment"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedLoanForPayment(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#102638] border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-[#18E6BE]/20 transition-all"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  Plus, 
  Target, 
  Edit3, 
  Trash2, 
  X, 
  Calendar, 
  ArrowRightLeft 
} from 'lucide-react';
import { FinanceGoal } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { EmptyState } from '../ui/EmptyState';

export const GoalsView: React.FC = () => {
  const goals = useLiveQuery(() => db.finance_goals.toArray()) || [];
  const accounts = useLiveQuery(() => db.finance_accounts.toArray()) || [];

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<FinanceGoal | null>(null);

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [targetDate, setTargetDate] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [notes, setNotes] = useState('');

  // Contribution Modal
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<FinanceGoal | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalPercentage = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  const handleOpenAdd = () => {
    setGoalToEdit(null);
    setName('');
    setTargetAmount('');
    setCurrentAmount('0');
    setTargetDate('');
    setIcon('🎯');
    setNotes('');
    setIsGoalModalOpen(true);
  };

  const handleOpenEdit = (g: FinanceGoal) => {
    setGoalToEdit(g);
    setName(g.name);
    setTargetAmount(g.targetAmount.toString());
    setCurrentAmount(g.currentAmount.toString());
    setTargetDate(g.targetDate || '');
    setIcon(g.icon || '🎯');
    setNotes(g.notes || '');
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const numTarget = parseFloat(targetAmount);
    const numCurrent = parseFloat(currentAmount) || 0;
    if (isNaN(numTarget) || numTarget <= 0) {
      alert('Please enter a valid target amount.');
      return;
    }

    const now = new Date().toISOString();

    try {
      if (goalToEdit) {
        await db.finance_goals.update(goalToEdit.id, {
          name: name.trim(),
          targetAmount: numTarget,
          currentAmount: numCurrent,
          targetDate: targetDate || undefined,
          icon,
          notes,
          updatedAt: now
        });
      } else {
        const newGoal: FinanceGoal = {
          id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: name.trim(),
          targetAmount: numTarget,
          currentAmount: numCurrent,
          targetDate: targetDate || undefined,
          status: 'in_progress',
          icon,
          notes,
          createdAt: now,
          updatedAt: now
        };
        await db.finance_goals.add(newGoal);
      }
      setIsGoalModalOpen(false);
    } catch (err) {
      console.error('Failed to save goal:', err);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (confirm('Are you sure you want to delete this savings goal?')) {
      await db.finance_goals.delete(goalId);
    }
  };

  const handleOpenContribute = (goal: FinanceGoal) => {
    setSelectedGoal(goal);
    setContributeAmount('');
    if (accounts.length > 0) {
      setSourceAccountId(accounts[0].id);
    }
    setIsContributeOpen(true);
  };

  const handleSaveContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;

    const amount = parseFloat(contributeAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid contribution amount.');
      return;
    }

    const now = new Date().toISOString();
    const sourceAcc = accounts.find(a => a.id === sourceAccountId);

    try {
      // 1. Update Goal Amount
      const newTotal = selectedGoal.currentAmount + amount;
      const isCompleted = newTotal >= selectedGoal.targetAmount;

      await db.finance_goals.update(selectedGoal.id, {
        currentAmount: newTotal,
        status: isCompleted ? 'completed' : 'in_progress',
        updatedAt: now
      });

      // 2. Add Transfer / Expense Transaction
      await db.finance_transactions.add({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        transactionType: 'transfer',
        amount,
        currency: 'PKR',
        accountId: sourceAccountId,
        accountName: sourceAcc?.name || 'Account',
        transactionDate: now.split('T')[0],
        description: `Savings Contribution → ${selectedGoal.name}`,
        source: 'manual',
        status: 'completed',
        createdAt: now,
        updatedAt: now
      });

      setIsContributeOpen(false);
    } catch (err) {
      console.error('Failed to contribute to goal:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. GOALS SUMMARY BANNER */}
      <div className="bg-gradient-to-r from-[#0B1D2C] via-[#0F283C] to-[#0B1D2C] rounded-2xl p-5 sm:p-6 text-white border border-cyan-500/20 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 w-full sm:w-auto relative z-10">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            <Target className="w-4 h-4 text-[#18E6BE]" />
            <span>Savings & Financial Goals</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-bold text-slate-100 tracking-tight">
              {formatCurrency(totalSaved)}
            </span>
            <span className="text-slate-400 text-base font-semibold">
              / {formatCurrency(totalTarget)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <span>Overall Progress: <strong className="text-[#18E6BE]">{totalPercentage}% Completed</strong></span>
            <span className="text-slate-500">•</span>
            <span>{goals.length} Active Target{goals.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#18E6BE] hover:bg-[#23F2CB] active:scale-95 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#18E6BE]/20 relative z-10"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Create New Goal</span>
        </button>
      </div>

      {/* 2. GOALS CARDS GRID */}
      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No Savings Goals Yet"
          description="Create your first financial target to track your progress towards dream purchases, emergencies, or milestones."
          action={{
            label: "+ Create First Goal",
            onClick: handleOpenAdd
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map(goal => {
            const percent = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0;
            const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

            return (
              <div
                key={goal.id}
                className="bg-[#0B1D2C] rounded-2xl p-5 border border-slate-700/50 hover:border-cyan-500/40 shadow-sm transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-xl bg-[#102638] text-cyan-400 flex items-center justify-center text-xl shadow-inner border border-cyan-500/20">
                        {goal.icon || '🎯'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm sm:text-base group-hover:text-cyan-300 transition-colors">
                          {goal.name}
                        </h4>
                        {goal.targetDate && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>Target: {goal.targetDate}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(goal)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#102638] transition-colors"
                        title="Edit Goal"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete Goal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-slate-100">
                        {formatCurrency(goal.currentAmount)}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        Target: {formatCurrency(goal.targetAmount)}
                      </span>
                    </div>

                    <div className="w-full bg-[#071724] h-2.5 rounded-full overflow-hidden border border-slate-700/40">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-[#18E6BE] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-medium text-cyan-300">{percent}% Completed</span>
                      <span>Remaining: <strong className="text-slate-200">{formatCurrency(remaining)}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <button
                    onClick={() => handleOpenContribute(goal)}
                    className="w-full py-2.5 bg-[#102638] hover:bg-[#16344d] active:scale-98 text-cyan-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-cyan-500/20"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-[#18E6BE]" />
                    <span>+ Add Savings Contribution</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. ADD / EDIT GOAL MODAL */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsGoalModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#0B1D2C] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-cyan-500/30 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">
                {goalToEdit ? 'Edit Goal' : 'Create Savings Goal'}
              </h3>
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#102638]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-slate-300">Goal Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Buy New Laptop, Hajj Fund, Car Downpayment"
                  className="w-full mt-1 px-3.5 py-2.5 bg-[#071724] border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-300">Target Amount (PKR) *</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="e.g. 300000"
                    className="w-full mt-1 px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Current Savings (PKR)</label>
                  <input
                    type="number"
                    step="any"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full mt-1 px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-300">Target Date (Optional)</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Emoji Icon</label>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs text-slate-100 text-center focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="flex-1 py-2.5 bg-[#102638] text-slate-300 hover:text-white font-semibold rounded-xl text-xs transition-colors border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 font-bold rounded-xl text-xs shadow-md transition-colors"
                >
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. CONTRIBUTE TO GOAL MODAL */}
      {isContributeOpen && selectedGoal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsContributeOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#0B1D2C] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-cyan-500/30 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedGoal.icon || '🎯'}</span>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Add to {selectedGoal.name}</h3>
                  <p className="text-[11px] text-slate-400">Transfer money towards this savings goal</p>
                </div>
              </div>
              <button
                onClick={() => setIsContributeOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#102638]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContribution} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-slate-300">Contribution Amount (PKR) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full mt-1 px-4 py-3 bg-[#071724] border border-slate-700 rounded-xl text-slate-100 text-lg font-bold placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Deduct from Account</label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 bg-[#071724] border border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-100 focus:outline-none focus:border-cyan-400"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.icon || '💳'} {a.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsContributeOpen(false)}
                  className="flex-1 py-2.5 bg-[#102638] text-slate-300 hover:text-white font-semibold rounded-xl text-xs transition-colors border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 font-bold rounded-xl text-xs shadow-md transition-colors"
                >
                  Confirm Contribution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { UtilityPerson } from '../../types';
import { db } from '../../db/db';
import { X, UserPlus, Save, User } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface PersonManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  persons: UtilityPerson[];
  selectedPersonId: string;
  onSelectPerson: (id: string) => void;
}

export const PersonManagementModal: React.FC<PersonManagementModalProps> = ({
  isOpen,
  onClose,
  persons,
  selectedPersonId,
  onSelectPerson
}) => {
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [expectedContribution, setExpectedContribution] = useState<number | ''>(9500);

  const [isAddingNew, setIsAddingNew] = useState(false);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setName('');
    setExpectedContribution(9500);
    setIsAddingNew(true);
    setEditingPersonId(null);
  };

  const handleStartEdit = (person: UtilityPerson) => {
    setName(person.name);
    setExpectedContribution(person.monthlyExpectedContribution);
    setEditingPersonId(person.id);
    setIsAddingNew(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Person name is required');
      return;
    }
    const contributionNum = Number(expectedContribution);
    if (isNaN(contributionNum) || contributionNum < 0) {
      alert('Monthly expected contribution cannot be negative');
      return;
    }

    const now = new Date().toISOString();

    try {
      if (isAddingNew) {
        const id = `p_${Date.now()}`;
        const newPerson: UtilityPerson = {
          id,
          name: name.trim(),
          monthlyExpectedContribution: contributionNum,
          currency: 'PKR',
          createdAt: now,
          updatedAt: now
        };
        await db.utility_persons.add(newPerson);
        onSelectPerson(id);
      } else if (editingPersonId) {
        await db.utility_persons.update(editingPersonId, {
          name: name.trim(),
          monthlyExpectedContribution: contributionNum,
          updatedAt: now
        });
      }
      setIsAddingNew(false);
      setEditingPersonId(null);
    } catch (err) {
      console.error('Failed to save person:', err);
      alert('Failed to save person details');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0B1D2C] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200 border border-cyan-500/30">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
            <User className="w-5 h-5 text-[#18E6BE]" />
            <span>Manage Persons & Monthly Contribution</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-[#102638] hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Persons */}
        <div className="space-y-2.5 max-h-60 overflow-y-auto">
          {persons.map(p => {
            const isSelected = p.id === selectedPersonId;

            return (
              <div
                key={p.id}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'border-cyan-400 bg-[#102638]'
                    : 'border-slate-800 bg-[#071724]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-sm">{p.name}</span>
                    {isSelected && (
                      <span className="text-[10px] bg-[#18E6BE] text-slate-950 font-bold px-2 py-0.5 rounded-full">
                        Active Selection
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Expected Contribution: <strong className="text-slate-200">{formatCurrency(p.monthlyExpectedContribution)}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSelectPerson(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isSelected
                        ? 'bg-[#18E6BE] text-slate-950 shadow-sm'
                        : 'bg-[#102638] border border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    Select
                  </button>

                  <button
                    onClick={() => handleStartEdit(p)}
                    className="p-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-[#102638] rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New Person Trigger */}
        {!isAddingNew && !editingPersonId && (
          <button
            onClick={handleStartAdd}
            className="w-full py-2.5 bg-[#102638] hover:bg-[#16344d] text-cyan-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-cyan-500/20 transition-colors"
          >
            <UserPlus className="w-4 h-4 text-[#18E6BE]" />
            <span>+ Add New Person Profile</span>
          </button>
        )}

        {/* Add/Edit Form */}
        {(isAddingNew || editingPersonId) && (
          <form onSubmit={handleSave} className="bg-[#071724] p-4 rounded-xl border border-cyan-500/30 space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              {isAddingNew ? 'Add New Person' : 'Edit Person & Default Expected Contribution'}
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Person Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Saleem, Tayyab"
                className="w-full px-3 py-2 bg-[#0B1D2C] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-cyan-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Expected Monthly Contribution (PKR)
              </label>
              <input
                type="number"
                value={expectedContribution}
                onChange={e => setExpectedContribution(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 9500"
                min="0"
                className="w-full px-3 py-2 bg-[#0B1D2C] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-cyan-400"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Note: Updating this default expected contribution will not alter historical monthly records.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsAddingNew(false);
                  setEditingPersonId(null);
                }}
                className="px-3.5 py-1.5 bg-[#102638] hover:bg-[#16344d] text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-1.5 bg-[#18E6BE] hover:bg-[#23F2CB] text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-[#18E6BE]/20"
              >
                <Save className="w-4 h-4 stroke-[2.5]" />
                <span>Save Profile</span>
              </button>
            </div>
          </form>
        )}

        <div className="flex items-center justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#102638] hover:bg-[#16344d] text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

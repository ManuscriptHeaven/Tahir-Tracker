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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600" />
            Manage Persons & Monthly Contribution
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Persons */}
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {persons.map(p => {
            const isSelected = p.id === selectedPersonId;

            return (
              <div
                key={p.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                    {isSelected && (
                      <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                        Active Selection
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Expected Monthly Contribution: <strong className="text-slate-700">{formatCurrency(p.monthlyExpectedContribution)}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSelectPerson(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Select
                  </button>

                  <button
                    onClick={() => handleStartEdit(p)}
                    className="p-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add/Edit Form */}
        {(isAddingNew || editingPersonId) ? (
          <form onSubmit={handleSave} className="bg-slate-100/80 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {isAddingNew ? 'Add New Person' : 'Edit Person & Default Expected Contribution'}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Person Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Saleem, Tayyab"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Expected Monthly Contribution (PKR)
              </label>
              <input
                type="number"
                value={expectedContribution}
                onChange={e => setExpectedContribution(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 9500"
                min="0"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
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
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                Save Details
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={handleStartAdd}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Add Person
          </button>
        )}
      </div>
    </div>
  );
};

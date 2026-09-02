import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  ArrowUpRight, 
  ArrowDownLeft 
} from 'lucide-react';
import { FinanceCategory } from '../../types';

export const CategoriesView: React.FC = () => {
  const categories = useLiveQuery(() => db.finance_categories.toArray()) || [];

  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<FinanceCategory | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [icon, setIcon] = useState('🍔');
  const [color, setColor] = useState('#10b981');

  const filteredCategories = categories.filter(c => c.type === activeTab);

  const popularEmojis = [
    '🍔', '🛒', '🚗', '🏠', '💡', '🛍️', '🎬', '🏥', '🎁', '✈️',
    '💼', '📚', '💵', '💻', '📈', '🪙', '🛡️', '📦', '☕', '👶'
  ];

  const handleOpenAdd = () => {
    setCategoryToEdit(null);
    setName('');
    setType(activeTab);
    setIcon(activeTab === 'income' ? '💵' : '🍔');
    setColor('#10b981');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: FinanceCategory) => {
    setCategoryToEdit(cat);
    setName(cat.name);
    setType(cat.type);
    setIcon(cat.icon || '📦');
    setColor(cat.color || '#10b981');
    setIsModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const now = new Date().toISOString();

    try {
      if (categoryToEdit) {
        await db.finance_categories.update(categoryToEdit.id, {
          name: name.trim(),
          type,
          icon,
          color,
          updatedAt: now
        });
      } else {
        const newCat: FinanceCategory = {
          id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: name.trim(),
          type,
          icon,
          color,
          isDefault: false,
          isActive: true,
          createdAt: now,
          updatedAt: now
        };
        await db.finance_categories.add(newCat);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save category:', err);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      await db.finance_categories.delete(catId);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER WITH TABS & CREATE BUTTON */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('expense')}
            className={`flex-1 sm:flex-initial py-2 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'expense'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Expense Categories ({categories.filter(c => c.type === 'expense').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('income')}
            className={`flex-1 sm:flex-initial py-2 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'income'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Income Categories ({categories.filter(c => c.type === 'income').length})</span>
          </button>
        </div>

        <button
          onClick={handleOpenAdd}
          className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Custom Category</span>
        </button>
      </div>

      {/* 2. CATEGORIES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredCategories.map(cat => (
          <div
            key={cat.id}
            className="p-4 bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-emerald-500/50 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-xl shadow-inner border border-slate-100">
                {cat.icon}
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm">
                  {cat.name}
                </h4>
                <span className="text-[10px] text-slate-400 capitalize">
                  {cat.isDefault ? 'Default' : 'Custom'} Category
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleOpenEdit(cat)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                title="Edit"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              {!cat.isDefault && (
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 3. ADD / EDIT CATEGORY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {categoryToEdit ? 'Edit Category' : 'Create Custom Category'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600">Category Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Gym & Protein, Online Courses..."
                  className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Category Type</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold ${
                      type === 'expense' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold ${
                      type === 'income' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Icon Emoji</label>
                <div className="grid grid-cols-5 gap-2 mt-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-100">
                  {popularEmojis.map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setIcon(em)}
                      className={`p-2 rounded-xl text-xl border transition-all ${
                        icon === em ? 'bg-emerald-100 border-emerald-500 scale-110' : 'bg-white border-slate-200'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-2xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs shadow-md"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

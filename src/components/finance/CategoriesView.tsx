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
  const [color, setColor] = useState('#18E6BE');

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
    setColor('#18E6BE');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: FinanceCategory) => {
    setCategoryToEdit(cat);
    setName(cat.name);
    setType(cat.type);
    setIcon(cat.icon || '📦');
    setColor(cat.color || '#18E6BE');
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
      <div className="bg-[#0B1D2C] rounded-2xl p-4 sm:p-5 border border-[rgba(70,150,180,0.18)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-[#091A28] p-1 rounded-xl w-full sm:w-auto border border-[rgba(70,150,180,0.18)]">
          <button
            onClick={() => setActiveTab('expense')}
            className={`flex-1 sm:flex-initial py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'expense'
                ? 'bg-[rgba(255,98,123,0.15)] text-[#FF627B] border border-[rgba(255,98,123,0.3)] shadow-sm'
                : 'text-[#6F899B] hover:text-[#F4F8FB]'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-[#FF627B]" />
            <span>Expense Categories ({categories.filter(c => c.type === 'expense').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('income')}
            className={`flex-1 sm:flex-initial py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'income'
                ? 'bg-[rgba(20,230,170,0.15)] text-[#14E6AA] border border-[rgba(20,230,170,0.3)] shadow-sm'
                : 'text-[#6F899B] hover:text-[#F4F8FB]'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-[#14E6AA]" />
            <span>Income Categories ({categories.filter(c => c.type === 'income').length})</span>
          </button>
        </div>

        <button
          onClick={handleOpenAdd}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#18E6BE] hover:bg-[#23F2CB] text-[#06131F] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Add Custom Category</span>
        </button>
      </div>

      {/* 2. CATEGORIES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredCategories.map(cat => (
          <div
            key={cat.id}
            className="p-4 bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] hover:border-[rgba(55,210,190,0.35)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#102638] flex items-center justify-center text-xl border border-[rgba(70,150,180,0.2)]">
                {cat.icon}
              </div>
              <div>
                <h4 className="font-bold text-[#F4F8FB] text-sm group-hover:text-[#18E6BE] transition-colors">
                  {cat.name}
                </h4>
                <span className="text-[10px] text-[#6F899B] capitalize">
                  {cat.isDefault ? 'Default' : 'Custom'} Category
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleOpenEdit(cat)}
                className="p-1.5 rounded-lg text-[#6F899B] hover:text-[#F4F8FB] hover:bg-[#102638]"
                title="Edit"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              {!cat.isDefault && (
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="p-1.5 rounded-lg text-[#6F899B] hover:text-[#FF627B] hover:bg-[rgba(255,98,123,0.1)]"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#071724] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-[rgba(70,150,180,0.2)] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(70,150,180,0.14)] pb-3">
              <h3 className="text-base font-bold text-[#F4F8FB]">
                {categoryToEdit ? 'Edit Category' : 'Create Custom Category'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-[#6F899B] hover:text-[#F4F8FB] hover:bg-[#0B1D2C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#A9BDCC]">Category Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Gym & Protein, Online Courses..."
                  className="w-full mt-1 px-3.5 py-2.5 bg-[#091A28] border border-[rgba(70,150,180,0.2)] rounded-xl text-xs sm:text-sm font-bold text-[#F4F8FB] placeholder-[#6F899B] focus:outline-none focus:border-[#18E6BE]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#A9BDCC]">Category Type</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      type === 'expense'
                        ? 'bg-[rgba(255,98,123,0.15)] text-[#FF627B] border-[rgba(255,98,123,0.35)] shadow-xs'
                        : 'bg-[#091A28] border-[rgba(70,150,180,0.2)] text-[#6F899B]'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      type === 'income'
                        ? 'bg-[rgba(20,230,170,0.15)] text-[#14E6AA] border-[rgba(20,230,170,0.35)] shadow-xs'
                        : 'bg-[#091A28] border-[rgba(70,150,180,0.2)] text-[#6F899B]'
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#A9BDCC]">Choose Icon</label>
                <div className="grid grid-cols-5 gap-2 mt-1 max-h-36 overflow-y-auto p-1 bg-[#091A28] rounded-xl border border-[rgba(70,150,180,0.18)]">
                  {popularEmojis.map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setIcon(em)}
                      className={`p-2 rounded-lg text-lg transition-all ${
                        icon === em ? 'bg-[rgba(24,230,190,0.18)] border border-[#18E6BE] scale-110' : 'hover:bg-[#102638]'
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
                  className="flex-1 py-2.5 bg-[#102638] text-[#A9BDCC] hover:text-[#F4F8FB] font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#18E6BE] hover:bg-[#23F2CB] text-[#06131F] font-bold rounded-xl text-xs shadow-[0_0_15px_rgba(24,230,190,0.25)] transition-all"
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

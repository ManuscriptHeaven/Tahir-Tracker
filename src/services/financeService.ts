export * from '../utils/financeCalculations';

import { getCurrentUserId } from './authService';

/**
 * User categorization learning mechanism stored in localStorage (namespaced per authenticated user)
 */
function getCategoryLearningKey(): string {
  const uid = getCurrentUserId();
  return uid ? `tahir_tracker_category_learning_${uid}` : 'tahir_tracker_category_learning';
}

export function saveLearnedCategoryKeyword(keyword: string, categoryId: string) {
  try {
    const normalized = keyword.toLowerCase().trim();
    if (!normalized || normalized.length < 3) return;
    const storageKey = getCategoryLearningKey();
    const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
    existing[normalized] = categoryId;
    localStorage.setItem(storageKey, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed to save category learning:', e);
  }
}

export function getLearnedCategoryKeyword(query: string): string | undefined {
  try {
    const storageKey = getCategoryLearningKey();
    const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const lowerQuery = query.toLowerCase();
    for (const [kw, catId] of Object.entries(existing)) {
      if (lowerQuery.includes(kw)) {
        return catId as string;
      }
    }
  } catch (e) {
    console.warn('Failed to get learned category:', e);
  }
  return undefined;
}

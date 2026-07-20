// Default categories, used only to seed a user's first-ever category list.
// The live, user-editable list lives in Supabase — see categoryStore.js.
export const DEFAULT_EXPENSE_CATEGORIES = [
  { key: 'Food', emoji: '🍔' }, { key: 'Groceries', emoji: '🛒' },
  { key: 'Transport', emoji: '🚗' }, { key: 'Rent', emoji: '🏠' },
  { key: 'Utilities', emoji: '💡' }, { key: 'Shopping', emoji: '🛍' },
  { key: 'Health', emoji: '💊' }, { key: 'Entertainment', emoji: '🎬' },
  { key: 'Subscriptions', emoji: '📱' }, { key: 'Travel', emoji: '✈️' },
  { key: 'Education', emoji: '📚' }, { key: 'Gifts', emoji: '🎁' },
  { key: 'Other', emoji: '🔧' },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { key: 'Salary', emoji: '💼' }, { key: 'Freelance', emoji: '💻' },
  { key: 'Interest', emoji: '🏦' }, { key: 'Investments', emoji: '📈' },
  { key: 'Gift', emoji: '🎁' }, { key: 'Other', emoji: '➕' },
];

const DEFAULTS_ALL = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];

// Look up the emoji for a category label. Checks the user's live category
// list first (shape: {label, emoji}), then falls back to the shipped
// defaults (for old rows whose category was later deleted from the list),
// then a generic icon.
export function emojiFor(label, categories) {
  if (categories && categories.length) {
    const hit = categories.find((c) => c.label === label);
    if (hit) return hit.emoji;
  }
  const fallback = DEFAULTS_ALL.find((c) => c.key === label);
  return fallback ? fallback.emoji : '❓';
}

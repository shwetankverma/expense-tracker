export const EXPENSE_CATEGORIES = [
  { key: 'Food', emoji: '🍔' }, { key: 'Groceries', emoji: '🛒' },
  { key: 'Transport', emoji: '🚗' }, { key: 'Rent', emoji: '🏠' },
  { key: 'Utilities', emoji: '💡' }, { key: 'Shopping', emoji: '🛍' },
  { key: 'Health', emoji: '💊' }, { key: 'Entertainment', emoji: '🎬' },
  { key: 'Subscriptions', emoji: '📱' }, { key: 'Travel', emoji: '✈️' },
  { key: 'Education', emoji: '📚' }, { key: 'Gifts', emoji: '🎁' },
  { key: 'Other', emoji: '🔧' },
];

export const INCOME_CATEGORIES = [
  { key: 'Salary', emoji: '💼' }, { key: 'Freelance', emoji: '💻' },
  { key: 'Interest', emoji: '🏦' }, { key: 'Investments', emoji: '📈' },
  { key: 'Gift', emoji: '🎁' }, { key: 'Other', emoji: '➕' },
];

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function emojiFor(category) {
  const hit = ALL.find((c) => c.key === category);
  return hit ? hit.emoji : '❓';
}

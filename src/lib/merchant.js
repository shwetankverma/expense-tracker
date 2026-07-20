// Free-text "Where" invites Swiggy / swiggy / SWIGGY as three different
// buckets in Expense-by-Where (pitfall P11). Normalize on save so the same
// place always collapses to one bucket.
export function normalizeMerchant(raw) {
  const s = (raw || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  return s
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

// Label used for entries with no merchant set (legacy rows from before this
// field existed, or a row someone deliberately leaves blank).
export const UNKNOWN_MERCHANT = 'Unknown';
export const UNCATEGORIZED = 'Uncategorized';

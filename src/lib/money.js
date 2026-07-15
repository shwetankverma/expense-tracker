export const formatINR = (n) => {
  const digits = Math.round(n * 100) % 100 !== 0 ? 2 : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
};

// Compact form for calendar cells: ₹1.2k, ₹15.0k, ₹1.5L
export function formatCompact(n) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${sign}₹${(a / 1e3).toFixed(1)}k`;
  return `${sign}₹${Math.round(a)}`;
}

export const round2 = (n) => Math.round(n * 100) / 100;

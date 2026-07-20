import { formatINR } from './money.js';
import { fmtShort, parseISO, dayCount, addDays } from './dates.js';
import { UNCATEGORIZED, UNKNOWN_MERCHANT } from './merchant.js';

const inRange = (r, a, b) => r.tx_date >= a && r.tx_date <= b;

function sumBy(rows, type) {
  return rows.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount), 0);
}

function byCategory(rows, type) {
  const map = {};
  rows.filter((r) => r.type === type).forEach((r) => {
    const key = r.category && r.category.trim() ? r.category : UNCATEGORIZED;
    map[key] = (map[key] || 0) + Number(r.amount);
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function byMerchant(rows, type) {
  const map = {};
  rows.filter((r) => r.type === type).forEach((r) => {
    const key = r.merchant && r.merchant.trim() ? r.merchant : UNKNOWN_MERCHANT;
    map[key] = (map[key] || 0) + Number(r.amount);
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function fmtLong(iso) {
  const d = parseISO(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function buildReport(allRows, startIso, endIso) {
  const rows = allRows.filter((r) => inRange(r, startIso, endIso));
  const days = dayCount(startIso, endIso);

  const income = sumBy(rows, 'income');
  const expense = sumBy(rows, 'expense');
  const net = income - expense;

  // Previous period of the same length, ending the day before startIso
  const prevEnd = addDays(startIso, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  const prevRows = allRows.filter((r) => inRange(r, prevStart, prevEnd));
  const prevExpense = sumBy(prevRows, 'expense');

  const lines = [];
  lines.push(`EXPENSE REPORT: ${fmtLong(startIso)} to ${fmtLong(endIso)} (${days} days)`);
  lines.push('Currency: INR');
  lines.push('');
  lines.push('TOTALS');
  lines.push(`Income:  ${formatINR(income)}`);
  lines.push(`Expense: ${formatINR(expense)}`);
  lines.push(`Net:     ${net >= 0 ? '+' : '-'}${formatINR(Math.abs(net))}`);
  lines.push(`Avg daily spend: ${formatINR(Math.round(expense / days))}`);
  lines.push('');

  lines.push('EXPENSES BY CATEGORY');
  const expCats = byCategory(rows, 'expense');
  if (expCats.length === 0) lines.push('(no expenses)');
  expCats.forEach(([cat, amt]) => {
    const pct = expense > 0 ? ((amt / expense) * 100).toFixed(1) : '0.0';
    lines.push(`${cat.padEnd(15)}${formatINR(amt).padEnd(12)}${pct}%`);
  });
  lines.push('');

  lines.push('VS PREVIOUS PERIOD');
  if (prevExpense > 0) {
    const delta = ((expense - prevExpense) / prevExpense) * 100;
    const sign = delta >= 0 ? '+' : '';
    lines.push(`Total spend: ${sign}${delta.toFixed(0)}% (${formatINR(prevExpense)} → ${formatINR(expense)})`);
    const prevMap = Object.fromEntries(byCategory(prevRows, 'expense'));
    const curMap = Object.fromEntries(expCats);
    const cats = [...new Set([...Object.keys(prevMap), ...Object.keys(curMap)])];
    const diffs = cats
      .map((c) => [c, (curMap[c] || 0) - (prevMap[c] || 0)])
      .filter(([, d]) => Math.round(d) !== 0)
      .sort((a, b) => b[1] - a[1]);
    const ups = diffs.filter(([, d]) => d > 0).slice(0, 3);
    const downs = diffs.filter(([, d]) => d < 0).slice(-3).reverse();
    if (ups.length) lines.push(`Biggest increases: ${ups.map(([c, d]) => `${c} +${formatINR(d)}`).join(', ')}`);
    if (downs.length) lines.push(`Biggest decreases: ${downs.map(([c, d]) => `${c} -${formatINR(Math.abs(d))}`).join(', ')}`);
  } else {
    lines.push('No data for the previous period.');
  }
  lines.push('');

  lines.push('10 LARGEST EXPENSES');
  const largest = rows
    .filter((r) => r.type === 'expense')
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 10);
  if (largest.length === 0) lines.push('(none)');
  largest.forEach((r, i) => {
    const note = r.note ? `  "${r.note}"` : '';
    const cat = r.category && r.category.trim() ? r.category : UNCATEGORIZED;
    lines.push(`${String(i + 1).padStart(2)}. ${formatINR(Number(r.amount)).padEnd(11)}${cat.padEnd(15)}${fmtShort(r.tx_date).padEnd(8)}${note}`);
  });
  lines.push('');

  lines.push('TOP MERCHANTS');
  const merchants = byMerchant(rows, 'expense').slice(0, 10);
  if (merchants.length === 0) lines.push('(no expenses)');
  merchants.forEach(([name, amt]) => {
    const pct = expense > 0 ? ((amt / expense) * 100).toFixed(1) : '0.0';
    lines.push(`${name.padEnd(15)}${formatINR(amt).padEnd(12)}${pct}%`);
  });
  lines.push('');

  lines.push('INCOME BY CATEGORY');
  const incCats = byCategory(rows, 'income');
  if (incCats.length === 0) lines.push('(no income)');
  incCats.forEach(([cat, amt]) => lines.push(`${cat.padEnd(15)}${formatINR(amt)}`));
  lines.push('');

  lines.push('---');
  lines.push('I am trying to reduce my spending. Based on this report:');
  lines.push('1. Which categories look high for a single person in Bengaluru, India?');
  lines.push('2. Give me 5 specific, realistic cuts with estimated monthly savings in INR.');
  lines.push('3. Point out any patterns I might not have noticed (frequency, small leaks, weekday vs weekend).');
  lines.push('Be direct. Do not pad the answer.');

  return lines.join('\n');
}

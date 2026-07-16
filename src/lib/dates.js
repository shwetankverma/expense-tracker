// Every function here works in LOCAL time. Never use toISOString() for dates:
// it shifts dates across midnight for IST users (pitfall P1).

const pad = (n) => String(n).padStart(2, '0');

function fmtISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayLocal() {
  return fmtISO(new Date());
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return fmtISO(new Date(y, m - 1, d + n));
}

export function monthKey(iso) {
  return iso.slice(0, 7); // '2026-07'
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // month is 1-12
}

export function firstOfMonth(year, month) {
  return `${year}-${pad(month)}-01`;
}

export function lastOfMonth(year, month) {
  return `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`;
}

// Shift a {y, m} pair by n months (m is 1-12).
export function addMonths(year, month, n) {
  const d = new Date(year, month - 1 + n, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

// Array of 4-6 week arrays, each 7 cells of 'YYYY-MM-DD' or null.
// weekStart: 'mon' (default) or 'sun'.
export function monthGrid(year, month, weekStart = 'mon') {
  const first = new Date(year, month - 1, 1);
  const offset = weekStart === 'sun' ? first.getDay() : (first.getDay() + 6) % 7;
  const total = daysInMonth(year, month);
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// 'Mon, 7 Jul 2026'
export function fmtHeader(iso) {
  const d = parseISO(iso);
  const wd = d.toLocaleDateString('en-IN', { weekday: 'short' });
  const rest = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${wd}, ${rest}`;
}

// '7 Jul' — for report lines
export function fmtShort(iso) {
  const d = parseISO(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// 'Jul 2026' — for month headers
export function fmtMonth(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

// Inclusive day count between two ISO dates
export function dayCount(startIso, endIso) {
  const ms = parseISO(endIso) - parseISO(startIso);
  return Math.round(ms / 86400000) + 1;
}

// Data layer for credit cards + card expenses. Same offline-first pattern
// as store.js: localStorage renders instantly, Supabase is durable truth,
// a FIFO queue reconciles them (client UUIDs + upsert = idempotent, P10).

import { supabase } from './supabase.js';
import { daysInMonth } from './dates.js';

const CARDS_KEY = 'et_cards';
const TXNS_KEY = 'et_cardtx';
const QUEUE_KEY = 'et_cardqueue';

let cards = [];
let txns = [];
let queue = [];
let listeners = new Set();
let flushing = false;

function loadLocal() {
  try { cards = JSON.parse(localStorage.getItem(CARDS_KEY)) || []; } catch { cards = []; }
  try { txns = JSON.parse(localStorage.getItem(TXNS_KEY)) || []; } catch { txns = []; }
  try { queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { queue = []; }
}

function persist() {
  localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
  localStorage.setItem(TXNS_KEY, JSON.stringify(txns));
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function notify() {
  const snap = { cards: [...cards], txns: [...txns] };
  listeners.forEach((fn) => fn(snap));
}

export function init() {
  loadLocal();
  notify();
  window.addEventListener('online', () => { flush().then(refresh); });
  flush().then(refresh);
}

export function getCards() { return [...cards]; }
export function getTxns() { return [...txns]; }
export function pendingCount() { return queue.length; }

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function saveCard(card) {
  const i = cards.findIndex((c) => c.id === card.id);
  if (i >= 0) cards[i] = card; else cards.push(card);
  queue.push({ op: 'upsert', table: 'cards', row: card, ts: Date.now() });
  persist();
  notify();
  flush();
}

export function removeCard(id) {
  cards = cards.filter((c) => c.id !== id);
  txns = txns.filter((t) => t.card_id !== id);
  // drop unsent ops belonging to this card, then queue one delete
  // (server cascades card_expenses via FK)
  queue = queue.filter(
    (q) =>
      !(q.op === 'upsert' && q.table === 'cards' && q.row.id === id) &&
      !(q.op === 'upsert' && q.table === 'card_expenses' && q.row.card_id === id)
  );
  queue.push({ op: 'delete', table: 'cards', id, ts: Date.now() });
  persist();
  notify();
  flush();
}

export function saveTxn(txn) {
  const i = txns.findIndex((t) => t.id === txn.id);
  if (i >= 0) txns[i] = txn; else txns.push(txn);
  queue.push({ op: 'upsert', table: 'card_expenses', row: txn, ts: Date.now() });
  persist();
  notify();
  flush();
}

export function removeTxn(id) {
  txns = txns.filter((t) => t.id !== id);
  const qi = queue.findIndex((q) => q.op === 'upsert' && q.table === 'card_expenses' && q.row.id === id);
  if (qi >= 0) {
    queue.splice(qi, 1);
    persist();
    notify();
    return;
  }
  queue.push({ op: 'delete', table: 'card_expenses', id, ts: Date.now() });
  persist();
  notify();
  flush();
}

export async function refresh() {
  if (!navigator.onLine) return;
  if (queue.length) await flush();
  if (queue.length) return; // still pending; don't clobber local writes
  const [c, t] = await Promise.all([
    supabase.from('cards').select('*'),
    supabase.from('card_expenses').select('*'),
  ]);
  if (c.error || t.error || !c.data || !t.data) return;
  cards = c.data;
  txns = t.data;
  persist();
  notify();
}

export function clearLocal() {
  cards = [];
  txns = [];
  queue = [];
  localStorage.removeItem(CARDS_KEY);
  localStorage.removeItem(TXNS_KEY);
  localStorage.removeItem(QUEUE_KEY);
  notify();
}

export async function flush() {
  if (flushing || !navigator.onLine || queue.length === 0) return;
  flushing = true;
  try {
    while (queue.length > 0) {
      const op = queue[0];
      let error;
      if (op.op === 'upsert') {
        ({ error } = await supabase.from(op.table).upsert(op.row));
      } else {
        ({ error } = await supabase.from(op.table).delete().eq('id', op.id));
      }
      if (error) break; // keep op, retry on next flush
      queue.shift();
      persist();
      notify();
    }
  } catch {
    // network hiccup: queue stays intact
  } finally {
    flushing = false;
  }
}

/* ============ billing-cycle math ============ */

// Statement closes on `cycleDay` of each month (clamped to short months).
// The current cycle runs from the day after the previous close, through
// the next close on/after today. Returns { start, end } as ISO dates.
const pad = (n) => String(n).padStart(2, '0');
const clampDay = (y, m, d) => Math.min(d, daysInMonth(y, m));
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export function cycleRange(cycleDay, todayIso, shift = 0) {
  const y = Number(todayIso.slice(0, 4));
  const m = Number(todayIso.slice(5, 7));
  const day = Number(todayIso.slice(8, 10));

  // find the close date of the current cycle
  let closeY = y;
  let closeM = m;
  if (day > clampDay(y, m, cycleDay)) {
    closeM += 1;
    if (closeM > 12) { closeM = 1; closeY += 1; }
  }
  // apply shift (0 = current cycle, -1 = previous, ...)
  closeM += shift;
  while (closeM > 12) { closeM -= 12; closeY += 1; }
  while (closeM < 1) { closeM += 12; closeY -= 1; }

  // start = day after previous close
  let prevY = closeY;
  let prevM = closeM - 1;
  if (prevM < 1) { prevM = 12; prevY -= 1; }
  const prevClose = clampDay(prevY, prevM, cycleDay);

  let startY = prevY;
  let startM = prevM;
  let startD = prevClose + 1;
  if (startD > daysInMonth(prevY, prevM)) {
    startD = 1;
    startM += 1;
    if (startM > 12) { startM = 1; startY += 1; }
  }

  return {
    start: iso(startY, startM, startD),
    end: iso(closeY, closeM, clampDay(closeY, closeM, cycleDay)),
  };
}

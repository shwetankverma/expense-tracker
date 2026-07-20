// Data layer for user-editable categories. Same offline-first pattern as
// store.js / cardstore.js: localStorage renders instantly, Supabase is
// durable truth, a FIFO queue reconciles them (client UUIDs + upsert =
// idempotent, P10).
//
// Deleting a category only removes it from the picker — transactions.category
// is a plain string snapshot, not a foreign key, so past entries keep their
// label untouched (no orphan risk).

import { supabase } from './supabase.js';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './categories.js';

const CACHE_KEY = 'et_categories';
const QUEUE_KEY = 'et_cat_queue';

let cache = [];
let queue = [];
let listeners = new Set();
let flushing = false;
let seeding = false;

function loadLocal() {
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || []; } catch { cache = []; }
  try { queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { queue = []; }
}

function persistCache() { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
function persistQueue() { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); }

function sorted() { return [...cache].sort((a, b) => a.sort_order - b.sort_order); }

function notify() {
  const snapshot = sorted();
  listeners.forEach((fn) => fn(snapshot));
}

export function init() {
  loadLocal();
  notify();
  window.addEventListener('online', () => { flush().then(refresh); });
  flush().then(refresh);
}

export function getAll() { return sorted(); }
export function getByType(type) { return sorted().filter((c) => c.type === type); }

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function pendingCount() { return queue.length; }

export function addOrUpdate(cat) {
  const i = cache.findIndex((c) => c.id === cat.id);
  if (i >= 0) cache[i] = cat; else cache.push(cat);
  persistCache();
  notify();
  queue.push({ op: 'upsert', row: cat, ts: Date.now() });
  persistQueue();
  flush();
}

export function remove(id) {
  cache = cache.filter((c) => c.id !== id);
  persistCache();
  notify();
  const qi = queue.findIndex((q) => q.op === 'upsert' && q.row.id === id);
  if (qi >= 0) {
    queue.splice(qi, 1);
    persistQueue();
    notify();
    return;
  }
  queue.push({ op: 'delete', id, ts: Date.now() });
  persistQueue();
  flush();
}

// One-time seed: if this user has never had a categories row, create the
// 13 expense + 6 income defaults so the picker isn't empty on first login.
async function seedIfEmpty() {
  if (seeding) return;
  seeding = true;
  try {
    const { count, error } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true });
    if (error || count > 0) return;
    const rows = [
      ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
        id: crypto.randomUUID(), type: 'expense', label: c.key, emoji: c.emoji, sort_order: i,
      })),
      ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({
        id: crypto.randomUUID(), type: 'income', label: c.key, emoji: c.emoji, sort_order: i,
      })),
    ];
    const { error: insErr } = await supabase.from('categories').upsert(rows);
    if (!insErr) {
      cache = rows;
      persistCache();
      notify();
    }
  } catch {
    // offline or transient error: refresh() will retry next time it runs
  } finally {
    seeding = false;
  }
}

export async function refresh() {
  if (!navigator.onLine) return;
  if (queue.length) await flush();
  if (queue.length) return; // still pending; don't clobber local writes
  const { data, error } = await supabase.from('categories').select('*');
  if (error) return;
  if (!data || data.length === 0) {
    await seedIfEmpty();
    return;
  }
  cache = data;
  persistCache();
  notify();
}

// Called on logout so the next account never sees or pushes this user's rows.
export function clearLocal() {
  cache = [];
  queue = [];
  localStorage.removeItem(CACHE_KEY);
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
        ({ error } = await supabase.from('categories').upsert(op.row));
      } else {
        ({ error } = await supabase.from('categories').delete().eq('id', op.id));
      }
      if (error) break; // keep op in queue, retry on next flush
      queue.shift();
      persistQueue();
      notify();
    }
  } catch {
    // network hiccup: queue stays intact
  } finally {
    flushing = false;
  }
}

// THE data layer. Components never call Supabase directly.
// localStorage is the instant source of truth for rendering;
// Supabase is the durable source of truth; the queue reconciles them.

import { supabase } from './supabase.js';

const CACHE_KEY = 'et_cache';
const QUEUE_KEY = 'et_queue';
const TS_KEY = 'et_cache_ts';

let cache = [];
let queue = [];
let listeners = new Set();
let flushing = false;

function loadLocal() {
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || []; } catch { cache = []; }
  try { queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { queue = []; }
}

function persistCache() { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
function persistQueue() { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); }

function notify() {
  const snapshot = [...cache];
  listeners.forEach((fn) => fn(snapshot));
}

export function init() {
  loadLocal();
  notify();
  window.addEventListener('online', () => { flush().then(refresh); });
  window.addEventListener('offline', () => notify());
  flush().then(refresh);
}

export function getAll() { return [...cache]; }

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isOnline() { return navigator.onLine; }
export function pendingCount() { return queue.length; }

export function addOrUpdate(tx) {
  const i = cache.findIndex((r) => r.id === tx.id);
  if (i >= 0) cache[i] = tx; else cache.push(tx);
  persistCache();
  notify();
  queue.push({ op: 'upsert', row: tx, ts: Date.now() });
  persistQueue();
  flush();
}

export function remove(id) {
  cache = cache.filter((r) => r.id !== id);
  persistCache();
  notify();
  // If this row is still an unsent upsert in the queue, just drop that op.
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

export async function refresh() {
  if (!navigator.onLine) return;
  if (queue.length) await flush();
  if (queue.length) return; // still pending; don't clobber local writes
  const { data, error } = await supabase.from('transactions').select('*');
  if (error || !data) return;
  cache = data;
  persistCache();
  localStorage.setItem(TS_KEY, String(Date.now()));
  notify();
}

// Called on logout so the next account never sees or pushes this user's rows.
export function clearLocal() {
  cache = [];
  queue = [];
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(QUEUE_KEY);
  localStorage.removeItem(TS_KEY);
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
        // upsert on a client-generated UUID is idempotent (pitfall P10)
        ({ error } = await supabase.from('transactions').upsert(op.row));
      } else {
        ({ error } = await supabase.from('transactions').delete().eq('id', op.id));
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

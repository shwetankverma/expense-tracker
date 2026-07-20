import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import * as store from '../lib/store.js';
import * as cardstore from '../lib/cardstore.js';
import * as categoryStore from '../lib/categoryStore.js';
import { todayLocal, addDays, monthKey } from '../lib/dates.js';
import { formatINR, formatCompact } from '../lib/money.js';
import { ACCENTS } from '../lib/prefs.js';
import AllEntries from './AllEntries.jsx';

const APP_VERSION = '2.0.0';

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function Profile({ rows, categories, session, theme, setTheme, prefs, setPrefs, onEdit, onManageCategories }) {
  const [showAll, setShowAll] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(session?.user?.user_metadata?.full_name || prefs.name);
  const [syncing, setSyncing] = useState(false);

  if (showAll) {
    return (
      <AllEntries rows={rows} categories={categories} onBack={() => setShowAll(false)} onEdit={onEdit} />
    );
  }

  const email = session?.user?.email || '';
  // Supabase auth metadata is the durable, cross-device source of truth.
  // prefs.name is only a local fallback for the instant/offline render.
  const name = session?.user?.user_metadata?.full_name || prefs.name || email.split('@')[0] || 'You';
  const initial = name.trim().charAt(0).toUpperCase() || '₹';
  const memberSince = session?.user?.created_at
    ? new Date(session.user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '';

  // ---- spending snapshot ----
  const today = todayLocal();
  const mk = monthKey(today);
  const monthSpend = rows
    .filter((r) => r.type === 'expense' && monthKey(r.tx_date) === mk)
    .reduce((s, r) => s + Number(r.amount), 0);

  const catTotals = {};
  rows.forEach((r) => {
    if (r.type !== 'expense' || monthKey(r.tx_date) !== mk) return;
    catTotals[r.category] = (catTotals[r.category] || 0) + Number(r.amount);
  });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  const daysWithRows = new Set(rows.map((r) => r.tx_date));
  let streak = 0;
  let d = daysWithRows.has(today) ? today : addDays(today, -1);
  while (daysWithRows.has(d)) {
    streak += 1;
    d = addDays(d, -1);
  }

  // ---- sync status ----
  const pending = store.pendingCount() + cardstore.pendingCount() + categoryStore.pendingCount();
  const online = store.isOnline();
  const syncMeta = !online ? 'Offline' : pending ? `${pending} pending` : 'Synced';

  async function saveName() {
    const trimmed = nameDraft.trim();
    setPrefs({ name: trimmed }); // instant local fallback, also covers offline
    setEditingName(false);
    // Durable, cross-device source of truth. onAuthStateChange (USER_UPDATED)
    // refreshes `session` app-wide once this resolves.
    await supabase.auth.updateUser({ data: { full_name: trimmed } });
  }

  function exportCsv() {
    const header = 'date,type,category,amount,note';
    const lines = [...rows]
      .sort((a, b) => a.tx_date.localeCompare(b.tx_date))
      .map((r) => [r.tx_date, r.type, r.category, r.amount, r.note].map(csvEscape).join(','));
    download(`expenses-${today}.csv`, [header, ...lines].join('\n'), 'text/csv');
  }

  function exportJson() {
    const payload = {
      exported_at: new Date().toISOString(),
      transactions: rows,
      cards: cardstore.getCards(),
      card_expenses: cardstore.getTxns(),
    };
    download(`expenses-backup-${today}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }

  async function syncNow() {
    setSyncing(true);
    await Promise.all([store.refresh(), cardstore.refresh(), categoryStore.refresh()]);
    setSyncing(false);
  }

  async function logout() {
    if (!window.confirm('Sign out?')) return;
    await supabase.auth.signOut();
    store.clearLocal();
    cardstore.clearLocal();
    categoryStore.clearLocal();
  }

  return (
    <>
      <div className="profile-hero">
        <div className="avatar">{initial}</div>
        {editingName ? (
          <input
            className="name-edit"
            value={nameDraft}
            autoFocus
            placeholder="Your name"
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
          />
        ) : (
          <h1
            onClick={() => {
              setNameDraft(session?.user?.user_metadata?.full_name || prefs.name || '');
              setEditingName(true);
            }}
          >
            {name}
          </h1>
        )}
        <div className="sub">
          {email}
          {memberSince && ` · since ${memberSince}`}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat" style={{ animationDelay: '40ms' }}>
          <div className="k">Spent this month</div>
          <div className="v">{formatINR(monthSpend)}</div>
        </div>
        <div className="stat" style={{ animationDelay: '90ms' }}>
          <div className="k">Top category</div>
          <div className="v">
            {topCat ? topCat[0] : '—'}{' '}
            {topCat && <small>{formatCompact(topCat[1])}</small>}
          </div>
        </div>
        <div className="stat" style={{ animationDelay: '140ms' }}>
          <div className="k">Logging streak</div>
          <div className="v">
            {streak} <small>day{streak === 1 ? '' : 's'}</small>
          </div>
        </div>
        <div className="stat" style={{ animationDelay: '190ms' }}>
          <div className="k">Total entries</div>
          <div className="v">{rows.length}</div>
        </div>
      </div>

      <div className="section-title">Personalise</div>
      <div className="plist">
        <div className="prow">
          <span className="grow">Theme</span>
          <div className="seg mini">
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>
              Light
            </button>
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>
              Dark
            </button>
          </div>
        </div>
        <div className="prow">
          <span className="grow">Accent</span>
          <div className="color-row" style={{ gap: 9 }}>
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                className={`color-dot${prefs.accent === a.key ? ' selected' : ''}`}
                style={{ width: 26, height: 26 }}
                data-color={a.key}
                onClick={() => setPrefs({ accent: a.key })}
                aria-label={a.label}
              />
            ))}
          </div>
        </div>
        <div className="prow">
          <span className="grow">Week starts on</span>
          <div className="seg mini">
            <button className={prefs.weekStart === 'mon' ? 'active' : ''} onClick={() => setPrefs({ weekStart: 'mon' })}>
              Mon
            </button>
            <button className={prefs.weekStart === 'sun' ? 'active' : ''} onClick={() => setPrefs({ weekStart: 'sun' })}>
              Sun
            </button>
          </div>
        </div>
      </div>

      <div className="section-title">Categories</div>
      <div className="plist">
        <button className="prow" onClick={onManageCategories}>
          <span className="grow">Manage categories</span>
          <span className="chev">›</span>
        </button>
      </div>

      <div className="section-title">Data</div>
      <div className="plist">
        <button className="prow" onClick={() => setShowAll(true)}>
          <span className="grow">All entries — edit & delete</span>
          <span className="meta">{rows.length}</span>
          <span className="chev">›</span>
        </button>
        <button className="prow" onClick={exportCsv}>
          <span className="grow">Export transactions (CSV)</span>
          <span className="chev">›</span>
        </button>
        <button className="prow" onClick={exportJson}>
          <span className="grow">Export everything (JSON)</span>
          <span className="chev">›</span>
        </button>
        <button className="prow" onClick={syncNow}>
          <span className="grow">{syncing ? 'Syncing…' : 'Sync now'}</span>
          <span className="meta">{syncMeta}</span>
          <span className={`sync-dot ${!online ? 'grey' : pending ? 'amber' : 'green'}`} />
        </button>
      </div>

      <div className="plist">
        <button className="prow danger-row" onClick={logout}>
          <span className="grow">Sign out</span>
        </button>
      </div>

      <div className="version">Kharcha v{APP_VERSION}</div>
    </>
  );
}

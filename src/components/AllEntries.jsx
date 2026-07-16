import { useMemo, useState } from 'react';
import { fmtShort, fmtMonth, monthKey } from '../lib/dates.js';
import { formatINR } from '../lib/money.js';
import { emojiFor } from '../lib/categories.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'expense', label: 'Expenses' },
  { id: 'income', label: 'Income' },
];

export default function AllEntries({ rows, onBack, onEdit }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = rows
      .filter((r) => filter === 'all' || r.type === filter)
      .filter(
        (r) =>
          !needle ||
          r.category.toLowerCase().includes(needle) ||
          (r.note || '').toLowerCase().includes(needle) ||
          String(r.amount).includes(needle)
      )
      .sort(
        (a, b) =>
          b.tx_date.localeCompare(a.tx_date) ||
          (b.created_at || '').localeCompare(a.created_at || '')
      );

    const out = [];
    filtered.forEach((r) => {
      const key = monthKey(r.tx_date);
      const g = out[out.length - 1];
      if (g && g.key === key) g.items.push(r);
      else {
        out.push({
          key,
          label: fmtMonth(Number(key.slice(0, 4)), Number(key.slice(5, 7))),
          items: [r],
        });
      }
    });
    return out;
  }, [rows, q, filter]);

  return (
    <>
      <div className="sub-header">
        <button className="nav-btn" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <h1>All entries</h1>
        <span style={{ width: 44 }} />
      </div>

      <input
        className="search"
        type="text"
        placeholder="Search category, note or amount…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="seg">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <span className="big">Nothing found</span>
          Try a different search or filter.
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.key}>
            <div className="list-date">{g.label}</div>
            {g.items.map((tx) => (
              <button key={tx.id} className="tx-row" onClick={() => onEdit(tx)}>
                <span className="emoji">{emojiFor(tx.category)}</span>
                <span className="mid">
                  <div className="cat">{tx.category}</div>
                  <div className="note">
                    {fmtShort(tx.tx_date)}
                    {tx.note ? ` · ${tx.note}` : ''}
                  </div>
                </span>
                <span className={`amt ${tx.type}`}>
                  {tx.type === 'expense' ? '-' : ''}
                  {formatINR(Number(tx.amount))}
                </span>
              </button>
            ))}
          </div>
        ))
      )}
    </>
  );
}

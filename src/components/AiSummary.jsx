import { useState, useMemo } from 'react';
import { buildReport } from '../lib/summary.js';
import { todayLocal, addMonths, firstOfMonth, lastOfMonth } from '../lib/dates.js';

const PERIODS = [
  { id: 'this', label: 'This month' },
  { id: 'last', label: 'Last month' },
  { id: 'three', label: 'Last 3 months' },
];

function periodBounds(id) {
  const today = todayLocal();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  if (id === 'this') return [firstOfMonth(y, m), lastOfMonth(y, m)];
  if (id === 'last') {
    const p = addMonths(y, m, -1);
    return [firstOfMonth(p.y, p.m), lastOfMonth(p.y, p.m)];
  }
  const s = addMonths(y, m, -2);
  return [firstOfMonth(s.y, s.m), lastOfMonth(y, m)];
}

export default function AiSummary({ rows }) {
  const [period, setPeriod] = useState('this');
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => {
    const [start, end] = periodBounds(period);
    return buildReport(rows, start, end);
  }, [rows, period]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: user can long-press the text instead
    }
  }

  function share() {
    navigator.share({ text: report }).catch(() => {});
  }

  return (
    <>
      <div className="seg">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            className={period === p.id ? 'active' : ''}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <textarea className="report" readOnly value={report} />

      <div className="btn-row">
        <button className="btn" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        {typeof navigator.share === 'function' && (
          <button className="btn secondary" onClick={share}>
            Share
          </button>
        )}
      </div>

      <p className="hint">Paste this into Claude or ChatGPT and ask it where to cut.</p>
    </>
  );
}

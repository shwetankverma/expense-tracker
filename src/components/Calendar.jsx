import { useState } from 'react';
import { monthGrid, todayLocal, monthKey, addMonths, fmtMonth } from '../lib/dates.js';
import { formatINR, formatCompact } from '../lib/money.js';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Calendar({ rows, selectedDate, onSelect }) {
  const [ym, setYm] = useState(() => ({
    y: Number(selectedDate.slice(0, 4)),
    m: Number(selectedDate.slice(5, 7)),
  }));

  const today = todayLocal();
  const grid = monthGrid(ym.y, ym.m);
  const mk = `${ym.y}-${String(ym.m).padStart(2, '0')}`;

  // net per day + month totals in one pass
  const nets = {};
  let mIncome = 0;
  let mExpense = 0;
  rows.forEach((r) => {
    if (monthKey(r.tx_date) !== mk) return;
    const amt = Number(r.amount);
    const signed = r.type === 'income' ? amt : -amt;
    nets[r.tx_date] = (nets[r.tx_date] || 0) + signed;
    if (r.type === 'income') mIncome += amt;
    else mExpense += amt;
  });
  const mNet = mIncome - mExpense;

  const goToCurrent = () => {
    setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  };

  return (
    <>
      <header className="cal-header">
        <button className="nav-btn" onClick={() => setYm(addMonths(ym.y, ym.m, -1))} aria-label="Previous month">
          ‹
        </button>
        <button className="title" onClick={goToCurrent}>
          {fmtMonth(ym.y, ym.m)}
        </button>
        <button className="nav-btn" onClick={() => setYm(addMonths(ym.y, ym.m, 1))} aria-label="Next month">
          ›
        </button>
      </header>

      <div className="cal-dow">
        {DOW.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="cal-grid">
        {grid.flat().map((iso, i) =>
          iso === null ? (
            <button key={i} className="cal-cell" disabled />
          ) : (
            <button
              key={i}
              className={`cal-cell${iso === today ? ' today' : ''}${iso === selectedDate ? ' selected' : ''}`}
              onClick={() => onSelect(iso)}
            >
              {Number(iso.slice(8, 10))}
              {nets[iso] !== undefined && (
                <span className={`net ${nets[iso] >= 0 ? 'green' : 'red'}`}>
                  {formatCompact(nets[iso])}
                </span>
              )}
            </button>
          )
        )}
      </div>

      <div className="month-strip summary-chips">
        <div className="chip">
          <div className="label">Month Income</div>
          <div className="value green">{formatINR(mIncome)}</div>
        </div>
        <div className="chip">
          <div className="label">Month Expense</div>
          <div className="value red">{formatINR(mExpense)}</div>
        </div>
        <div className="chip">
          <div className="label">Net</div>
          <div className={`value ${mNet >= 0 ? 'green' : 'red'}`}>
            {mNet < 0 ? '-' : ''}{formatINR(Math.abs(mNet))}
          </div>
        </div>
      </div>
    </>
  );
}

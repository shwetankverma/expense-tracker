import { todayLocal, addDays, fmtHeader } from '../lib/dates.js';
import { formatINR } from '../lib/money.js';
import { emojiFor } from '../lib/categories.js';

export default function DayDetail({ rows, date, setDate, onEdit }) {
  const dayRows = rows
    .filter((r) => r.tx_date === date)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  const income = dayRows.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
  const expense = dayRows.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
  const net = income - expense;
  const isToday = date === todayLocal();

  return (
    <>
      <header className="day-header">
        <button className="nav-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ‹
        </button>
        <div className="day-center">
          <h1>{fmtHeader(date)}</h1>
          {!isToday && (
            <button className="today-pill" onClick={() => setDate(todayLocal())}>
              Today
            </button>
          )}
        </div>
        <button className="nav-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
          ›
        </button>
      </header>

      <div className="summary-chips">
        <div className="chip">
          <div className="label">Income</div>
          <div className="value green">{formatINR(income)}</div>
        </div>
        <div className="chip">
          <div className="label">Expense</div>
          <div className="value red">{formatINR(expense)}</div>
        </div>
        <div className="chip">
          <div className="label">Net</div>
          <div className={`value ${net >= 0 ? 'green' : 'red'}`}>
            {net < 0 ? '-' : ''}{formatINR(Math.abs(net))}
          </div>
        </div>
      </div>

      {dayRows.length === 0 ? (
        <div className="empty">
          Nothing logged on this day.
          <br />
          Tap + to add an entry.
        </div>
      ) : (
        dayRows.map((tx) => (
          <button key={tx.id} className="tx-row" onClick={() => onEdit(tx)}>
            <span className="emoji">{emojiFor(tx.category)}</span>
            <span className="mid">
              <div className="cat">{tx.category}</div>
              {tx.note && <div className="note">{tx.note}</div>}
            </span>
            <span className={`amt ${tx.type}`}>
              {tx.type === 'expense' ? '-' : ''}
              {formatINR(Number(tx.amount))}
            </span>
          </button>
        ))
      )}
    </>
  );
}

import { todayLocal, addDays, fmtHeader } from '../lib/dates.js';
import { formatINR } from '../lib/money.js';
import { emojiFor } from '../lib/categories.js';
import { useCountUp } from '../lib/anim.js';

export default function DayDetail({ rows, categories, date, setDate, onEdit }) {
  const dayRows = rows
    .filter((r) => r.tx_date === date)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  const income = dayRows.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
  const expense = dayRows.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
  const net = income - expense;
  const isToday = date === todayLocal();
  const spent = useCountUp(expense);

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

      <section className="hero">
        <div className="eyebrow">{isToday ? 'Spent today' : 'Spent this day'}</div>
        <div className="big-num">{formatINR(Math.round(spent))}</div>
        <div className="hero-sub">
          <span className="pos">{formatINR(income)} in</span>
          <span className="sep">·</span>
          <span className={net >= 0 ? 'pos' : 'neg'}>
            net {net < 0 ? '-' : ''}{formatINR(Math.abs(net))}
          </span>
        </div>
      </section>

      {dayRows.length === 0 ? (
        <div className="empty">
          <span className="big">A quiet day</span>
          Nothing logged here yet. Tap + to add an entry.
        </div>
      ) : (
        dayRows.map((tx, i) => {
          // Where (merchant) is the primary line; category is now optional
          // and secondary, shown only as a small tag when both exist.
          const primary = tx.merchant || tx.category || 'Uncategorized';
          const showCatTag = Boolean(tx.category) && Boolean(tx.merchant);
          const avatarChar = (tx.merchant || tx.category || '?').trim().charAt(0).toUpperCase();
          return (
            <button
              key={tx.id}
              className="tx-row"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              onClick={() => onEdit(tx)}
            >
              <span className="avatar">{avatarChar}</span>
              <span className="mid">
                <div className="cat">{primary}</div>
                {showCatTag && (
                  <span className="cat-tag">
                    {emojiFor(tx.category, categories)} {tx.category}
                  </span>
                )}
                {tx.note && <div className="note">{tx.note}</div>}
              </span>
              <span className={`amt ${tx.type}`}>
                {tx.type === 'expense' ? '-' : ''}
                {formatINR(Number(tx.amount))}
              </span>
            </button>
          );
        })
      )}
    </>
  );
}

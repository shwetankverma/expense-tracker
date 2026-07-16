import { useState, useEffect } from 'react';
import * as cardstore from '../lib/cardstore.js';
import { cycleRange } from '../lib/cardstore.js';
import { todayLocal, fmtShort, fmtHeader, dayCount } from '../lib/dates.js';
import { formatINR } from '../lib/money.js';
import { IconPlus, IconCard } from './Icons.jsx';
import CardForm from './CardForm.jsx';

function useCardData() {
  const [data, setData] = useState({ cards: cardstore.getCards(), txns: cardstore.getTxns() });
  useEffect(() => cardstore.subscribe(setData), []);
  return data;
}

const RANGES = [
  { id: 'cur', label: 'This cycle' },
  { id: 'prev', label: 'Last cycle' },
  { id: 'all', label: 'All' },
];

export default function Cards({ onEditExpense }) {
  const { cards, txns } = useCardData();
  const [selectedId, setSelectedId] = useState(null);
  const [range, setRange] = useState('cur');
  const [cardForm, setCardForm] = useState(null); // null | 'new' | card object

  const today = todayLocal();
  const selected = cards.find((c) => c.id === selectedId) || cards[0];

  // spend in the current cycle, per card (for the tiles)
  const tileSpend = {};
  cards.forEach((c) => {
    const { start, end } = cycleRange(c.bill_cycle_day, today);
    tileSpend[c.id] = txns
      .filter((t) => t.card_id === c.id && t.tx_date >= start && t.tx_date <= end)
      .reduce((s, t) => s + Number(t.amount), 0);
  });

  // list for the selected card + range
  let list = [];
  let rangeLabel = '';
  if (selected) {
    if (range === 'all') {
      list = txns.filter((t) => t.card_id === selected.id);
      rangeLabel = 'All spends';
    } else {
      const { start, end } = cycleRange(selected.bill_cycle_day, today, range === 'prev' ? -1 : 0);
      list = txns.filter((t) => t.card_id === selected.id && t.tx_date >= start && t.tx_date <= end);
      rangeLabel = `${fmtShort(start)} – ${fmtShort(end)}`;
    }
  }
  list = [...list].sort(
    (a, b) => b.tx_date.localeCompare(a.tx_date) || (b.created_at || '').localeCompare(a.created_at || '')
  );
  const listTotal = list.reduce((s, t) => s + Number(t.amount), 0);

  // group by date
  const groups = [];
  list.forEach((t) => {
    const g = groups[groups.length - 1];
    if (g && g.date === t.tx_date) g.items.push(t);
    else groups.push({ date: t.tx_date, items: [t] });
  });

  return (
    <>
      <div className="cards-head">
        <h1 className="page-title">Cards</h1>
        <button className="add-mini" onClick={() => setCardForm('new')}>
          <IconPlus width={15} height={15} /> New card
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="empty">
          <span className="big">Track your credit cards</span>
          Add a card with its billing cycle, then log every
          swipe so statement day never surprises you.
          <div style={{ marginTop: 22 }}>
            <button className="btn" style={{ padding: '14px 28px' }} onClick={() => setCardForm('new')}>
              Add your first card
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card-rail">
            {cards.map((c) => {
              const { end } = cycleRange(c.bill_cycle_day, today);
              const daysLeft = dayCount(today, end) - 1;
              return (
                <button
                  key={c.id}
                  className={`ccard${selected && selected.id === c.id ? ' selected' : ''}`}
                  data-color={c.color || 'noir'}
                  onClick={() => setSelectedId(c.id)}
                >
                  <div className="ccard-top">
                    <span className="ccard-name">{c.name}</span>
                    <span
                      className="ccard-edit"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCardForm(c);
                      }}
                    >
                      ⋯
                    </span>
                  </div>
                  <div className="ccard-spend">
                    <div className="eyebrow">This cycle</div>
                    <div className="amt">{formatINR(tileSpend[c.id] || 0)}</div>
                  </div>
                  <div className="ccard-cycle">
                    Cycle closes {fmtShort(end)}
                    {daysLeft > 0 ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ' · today'}
                  </div>
                </button>
              );
            })}
            <button className="ccard-addtile" onClick={() => setCardForm('new')}>
              <IconCard />
              Add card
            </button>
          </div>

          <div className="seg">
            {RANGES.map((r) => (
              <button
                key={r.id}
                className={range === r.id ? 'active' : ''}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="cycle-total">
            <span className="label">{rangeLabel}</span>
            <span className="val">{formatINR(listTotal)}</span>
          </div>

          {list.length === 0 ? (
            <div className="empty">
              <span className="big">No spends here</span>
              Tap + to log a credit card spend.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.date}>
                <div className="list-date">{fmtHeader(g.date)}</div>
                {g.items.map((t, i) => (
                  <button
                    key={t.id}
                    className="tx-row"
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    onClick={() => onEditExpense(t)}
                  >
                    <span className="avatar">{(t.merchant || '?').trim().charAt(0).toUpperCase()}</span>
                    <span className="mid">
                      <div className="cat">{t.merchant || 'Somewhere'}</div>
                      {t.note && <div className="note">{t.note}</div>}
                    </span>
                    <span className="amt expense">-{formatINR(Number(t.amount))}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </>
      )}

      {cardForm && <CardForm initial={cardForm} onClose={() => setCardForm(null)} />}
    </>
  );
}

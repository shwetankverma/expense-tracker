import { useState } from 'react';
import * as cardstore from '../lib/cardstore.js';
import { round2 } from '../lib/money.js';
import { todayLocal } from '../lib/dates.js';
import { normalizeMerchant } from '../lib/merchant.js';

export default function CardExpenseForm({ initial, onClose }) {
  const editing = typeof initial === 'object' && initial !== null;
  const cards = cardstore.getCards();

  const [amount, setAmount] = useState(editing ? String(initial.amount) : '');
  const [cardId, setCardId] = useState(editing ? initial.card_id : cards[0]?.id || '');
  const [date, setDate] = useState(editing ? initial.tx_date : todayLocal());
  const [merchant, setMerchant] = useState(editing ? initial.merchant || '' : '');
  const [note, setNote] = useState(editing ? initial.note || '' : '');

  const amt = parseFloat(amount);
  const valid = !Number.isNaN(amt) && amt > 0 && cardId && date;

  function save() {
    if (!valid) return;
    cardstore.saveTxn({
      ...(editing ? initial : {}),
      id: editing ? initial.id : crypto.randomUUID(),
      card_id: cardId,
      tx_date: date,
      merchant: normalizeMerchant(merchant),
      note: note.trim(),
      amount: round2(amt),
      created_at: editing ? initial.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    onClose();
  }

  function del() {
    if (!window.confirm('Delete this card spend?')) return;
    cardstore.removeTxn(initial.id);
    onClose();
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-head">
          <h2>{editing ? 'Edit card spend' : 'Card spend'}</h2>
          <button className="close-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="empty">
            <span className="big">No cards yet</span>
            Add a credit card in the Cards tab first.
          </div>
        ) : (
          <>
            <div className="amount-wrap">
              <span className="rupee">₹</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                autoFocus={!editing}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              />
            </div>

            <div className="field">
              <label>Card</label>
              <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 0 }}>
                {cards.map((c) => (
                  <button
                    key={c.id}
                    className={`cat-chip${cardId === c.id ? ' selected' : ''}`}
                    onClick={() => setCardId(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>When</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="field">
              <label>Where — merchant</label>
              <input
                type="text"
                placeholder="e.g. Amazon, Swiggy"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </div>

            <div className="field">
              <label>What — optional</label>
              <input
                type="text"
                placeholder="e.g. running shoes"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <button className="btn" style={{ width: '100%' }} disabled={!valid} onClick={save}>
              Save
            </button>

            {editing && (
              <button className="danger" onClick={del}>
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

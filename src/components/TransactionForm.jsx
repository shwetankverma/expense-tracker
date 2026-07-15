import { useState } from 'react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/categories.js';
import { round2 } from '../lib/money.js';
import * as store from '../lib/store.js';

export default function TransactionForm({ initial, defaultDate, onClose }) {
  const editing = typeof initial === 'object' && initial !== null;

  const [type, setType] = useState(editing ? initial.type : initial === 'income' ? 'income' : 'expense');
  const [amount, setAmount] = useState(editing ? String(initial.amount) : '');
  const [category, setCategory] = useState(editing ? initial.category : '');
  const [date, setDate] = useState(editing ? initial.tx_date : defaultDate);
  const [note, setNote] = useState(editing ? initial.note || '' : '');

  const cats = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const amt = parseFloat(amount);
  const valid = !Number.isNaN(amt) && amt > 0 && category !== '' && date;

  function switchType(t) {
    if (t === type) return;
    setType(t);
    // keep the category only if it exists for the new type
    const nextCats = t === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    if (!nextCats.some((c) => c.key === category)) setCategory('');
  }

  function save() {
    if (!valid) return;
    const tx = {
      ...(editing ? initial : {}),
      id: editing ? initial.id : crypto.randomUUID(),
      tx_date: date,
      type,
      category,
      amount: round2(amt),
      note: note.trim(),
      created_at: editing ? initial.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.addOrUpdate(tx);
    onClose();
  }

  function del() {
    if (!window.confirm('Delete this entry?')) return;
    store.remove(initial.id);
    onClose();
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-head">
          <h2>{editing ? 'Edit entry' : 'Add entry'}</h2>
          <button className="close-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="type-toggle">
          <button
            className={type === 'expense' ? 'active expense' : ''}
            onClick={() => switchType('expense')}
          >
            Expense
          </button>
          <button
            className={type === 'income' ? 'active income' : ''}
            onClick={() => switchType('income')}
          >
            Income
          </button>
        </div>

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

        <div className="cat-grid">
          {cats.map((c) => (
            <button
              key={c.key}
              className={`cat-chip${category === c.key ? ' selected' : ''}`}
              onClick={() => setCategory(c.key)}
            >
              <span>{c.emoji}</span> {c.key}
            </button>
          ))}
        </div>

        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field">
          <label>Note (optional)</label>
          <input
            type="text"
            placeholder="e.g. July rent"
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
      </div>
    </>
  );
}

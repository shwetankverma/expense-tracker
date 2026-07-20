import { useMemo, useState } from 'react';
import { normalizeMerchant } from '../lib/merchant.js';
import { round2 } from '../lib/money.js';
import * as store from '../lib/store.js';

export default function TransactionForm({ initial, defaultDate, rows, categories, onClose }) {
  const editing = typeof initial === 'object' && initial !== null;

  const [type, setType] = useState(editing ? initial.type : initial === 'income' ? 'income' : 'expense');
  const [amount, setAmount] = useState(editing ? String(initial.amount) : '');
  const [merchant, setMerchant] = useState(editing ? initial.merchant || '' : '');
  const [note, setNote] = useState(editing ? initial.note || '' : '');
  const [date, setDate] = useState(editing ? initial.tx_date : defaultDate);
  const [category, setCategory] = useState(editing ? initial.category || '' : '');

  const cats = (categories || []).filter((c) => c.type === type);
  const amt = parseFloat(amount);
  const valid = !Number.isNaN(amt) && amt > 0 && merchant.trim() !== '' && date;

  // Previously-used merchants of this type, for the "Where" autocomplete
  // (pitfall P11 — helps the same place collapse to one string).
  const merchantSuggestions = useMemo(() => {
    const seen = new Set();
    (rows || []).forEach((r) => {
      if (r.type === type && r.merchant) seen.add(r.merchant);
    });
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [rows, type]);

  function switchType(t) {
    if (t === type) return;
    setType(t);
    // keep the category only if it exists for the new type
    const nextCats = (categories || []).filter((c) => c.type === t);
    if (!nextCats.some((c) => c.label === category)) setCategory('');
  }

  function toggleCategory(label) {
    setCategory((c) => (c === label ? '' : label));
  }

  function save() {
    if (!valid) return;
    const tx = {
      ...(editing ? initial : {}),
      id: editing ? initial.id : crypto.randomUUID(),
      tx_date: date,
      type,
      merchant: normalizeMerchant(merchant),
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

        <div className="field">
          <label>Where</label>
          <input
            type="text"
            placeholder="e.g. Amazon, Swiggy, Landlord"
            value={merchant}
            list="merchant-suggestions"
            onChange={(e) => setMerchant(e.target.value)}
          />
          <datalist id="merchant-suggestions">
            {merchantSuggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label>What (optional)</label>
          <input
            type="text"
            placeholder="e.g. running shoes"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field">
          <label>Category (optional)</label>
          <div className="cat-grid">
            {cats.map((c) => (
              <button
                key={c.id}
                className={`cat-chip${category === c.label ? ' selected' : ''}`}
                onClick={() => toggleCategory(c.label)}
              >
                <span>{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
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

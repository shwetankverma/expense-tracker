import { useState } from 'react';
import * as cardstore from '../lib/cardstore.js';

const COLORS = ['noir', 'gold', 'violet', 'ocean', 'rose', 'sage'];

export default function CardForm({ initial, onClose }) {
  const editing = typeof initial === 'object' && initial !== null;

  const [name, setName] = useState(editing ? initial.name : '');
  const [cycleDay, setCycleDay] = useState(editing ? String(initial.bill_cycle_day) : '1');
  const [color, setColor] = useState(editing ? initial.color || 'noir' : 'noir');

  const valid = name.trim().length > 0;

  function save() {
    if (!valid) return;
    cardstore.saveCard({
      ...(editing ? initial : {}),
      id: editing ? initial.id : crypto.randomUUID(),
      name: name.trim(),
      bill_cycle_day: Number(cycleDay),
      color,
      created_at: editing ? initial.created_at : new Date().toISOString(),
    });
    onClose();
  }

  function del() {
    if (!window.confirm('Delete this card and all its logged spends?')) return;
    cardstore.removeCard(initial.id);
    onClose();
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-head">
          <h2>{editing ? 'Edit card' : 'New card'}</h2>
          <button className="close-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="field">
          <label>Card name</label>
          <input
            type="text"
            placeholder="e.g. HDFC Regalia"
            value={name}
            autoFocus={!editing}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Bill cycle — statement day of month</label>
          <select value={cycleDay} onChange={(e) => setCycleDay(e.target.value)}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
                {d === 1 || d === 21 || d === 31 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th'}
                {' of every month'}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Card colour</label>
          <div className="color-row">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`color-dot${color === c ? ' selected' : ''}`}
                data-color={c}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <button className="btn" style={{ width: '100%' }} disabled={!valid} onClick={save}>
          Save card
        </button>

        {editing && (
          <button className="danger" onClick={del}>
            Delete card
          </button>
        )}
      </div>
    </>
  );
}

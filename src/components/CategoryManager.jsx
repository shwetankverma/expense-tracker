import { useState } from 'react';
import * as categoryStore from '../lib/categoryStore.js';

export default function CategoryManager({ categories, onClose }) {
  const [type, setType] = useState('expense');
  const [editing, setEditing] = useState(null); // null | 'new' | category object
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('🔧');

  const list = categories.filter((c) => c.type === type);
  const valid = label.trim().length > 0;

  function switchType(t) {
    setType(t);
    setEditing(null);
  }

  function openNew() {
    setEditing('new');
    setLabel('');
    setEmoji(type === 'income' ? '➕' : '🔧');
  }

  function openEdit(c) {
    setEditing(c);
    setLabel(c.label);
    setEmoji(c.emoji);
  }

  function save() {
    if (!valid) return;
    const isNew = editing === 'new';
    const sortOrder = isNew
      ? list.reduce((m, c) => Math.max(m, c.sort_order), -1) + 1
      : editing.sort_order;
    categoryStore.addOrUpdate({
      id: isNew ? crypto.randomUUID() : editing.id,
      type,
      label: label.trim(),
      emoji: emoji.trim() || '🔧',
      sort_order: sortOrder,
    });
    setEditing(null);
  }

  function del(c) {
    if (!window.confirm(`Delete "${c.label}"? Past entries keep this category name.`)) return;
    categoryStore.remove(c.id);
    if (editing && editing !== 'new' && editing.id === c.id) setEditing(null);
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-head">
          <h2>Manage categories</h2>
          <button className="close-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="type-toggle">
          <button className={type === 'expense' ? 'active expense' : ''} onClick={() => switchType('expense')}>
            Expense
          </button>
          <button className={type === 'income' ? 'active income' : ''} onClick={() => switchType('income')}>
            Income
          </button>
        </div>

        <div className="plist cat-manage-list">
          {list.length === 0 && <div className="empty">No categories yet — add one below.</div>}
          {list.map((c) => (
            <div className="prow" key={c.id}>
              <span className="cat-manage-emoji">{c.emoji}</span>
              <span className="grow">{c.label}</span>
              <button className="mini-icon-btn" onClick={() => openEdit(c)} aria-label={`Edit ${c.label}`}>
                ✎
              </button>
              <button className="mini-icon-btn danger" onClick={() => del(c)} aria-label={`Delete ${c.label}`}>
                ✕
              </button>
            </div>
          ))}
        </div>

        {editing ? (
          <>
            <div className="field" style={{ marginTop: 16 }}>
              <label>Emoji</label>
              <input
                type="text"
                value={emoji}
                maxLength={4}
                autoFocus
                onChange={(e) => setEmoji(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Label</label>
              <input
                type="text"
                placeholder="e.g. Pets"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <button className="btn" style={{ width: '100%' }} disabled={!valid} onClick={save}>
              {editing === 'new' ? 'Add category' : 'Save changes'}
            </button>
            <button className="danger" style={{ marginTop: 10 }} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="add-mini" style={{ marginTop: 14 }} onClick={openNew}>
            + Add category
          </button>
        )}
      </div>
    </>
  );
}

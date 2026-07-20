import { useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { todayLocal, monthKey, addMonths, fmtMonth, fmtShort, daysInMonth } from '../lib/dates.js';
import { formatINR, formatCompact } from '../lib/money.js';
import { UNCATEGORIZED, UNKNOWN_MERCHANT } from '../lib/merchant.js';
import { IconSpark } from './Icons.jsx';

const COLORS = [
  '#8b7cf6', '#5cbf9b', '#e08e8e', '#e0b56e', '#6fb3d9', '#d98cc0',
  '#a89bf0', '#84cf95', '#e0a06e', '#6ec4cc', '#c48ede', '#cfc06e', '#a3a0b8',
];

const normCat = (c) => (c && c.trim() ? c : UNCATEGORIZED);
const normWhere = (m) => (m && m.trim() ? m : UNKNOWN_MERCHANT);

export default function Analytics({ rows, categories, onOpenAi }) {
  const today = todayLocal();
  const [ym, setYm] = useState(() => ({
    y: Number(today.slice(0, 4)),
    m: Number(today.slice(5, 7)),
  }));
  const [showTrend, setShowTrend] = useState(true);
  const [groupBy, setGroupBy] = useState('category'); // 'category' | 'where'
  const [drill, setDrill] = useState([]); // breadcrumb path within the current groupBy mode

  const mk = `${ym.y}-${String(ym.m).padStart(2, '0')}`;
  const monthRows = rows.filter((r) => monthKey(r.tx_date) === mk);
  const expenses = monthRows.filter((r) => r.type === 'expense');

  function switchGroupBy(mode) {
    if (mode === groupBy) return;
    setGroupBy(mode);
    setDrill([]);
  }

  // --- scope the expense set down to whatever level of the drill we're at ---
  let scoped = expenses;
  if (groupBy === 'category') {
    if (drill[0]) scoped = scoped.filter((r) => normCat(r.category) === drill[0]);
    if (drill[1]) scoped = scoped.filter((r) => normWhere(r.merchant) === drill[1]);
  } else {
    if (drill[0]) scoped = scoped.filter((r) => normWhere(r.merchant) === drill[0]);
  }

  // category mode: Category -> Where -> What (2 drill levels before transactions)
  // where mode: Where -> What (1 drill level before transactions)
  const isDeepest =
    (groupBy === 'category' && drill.length >= 2) || (groupBy === 'where' && drill.length >= 1);

  const keyFn = groupBy === 'category'
    ? (drill.length === 0 ? (r) => normCat(r.category) : (r) => normWhere(r.merchant))
    : (r) => normWhere(r.merchant);

  const scopedTotal = scoped.reduce((s, r) => s + Number(r.amount), 0);

  // --- donut/list at the current (non-deepest) level ---
  const grouped = {};
  if (!isDeepest) {
    scoped.forEach((r) => {
      const k = keyFn(r);
      grouped[k] = (grouped[k] || 0) + Number(r.amount);
    });
  }
  const allEntries = Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const big = [];
  let small = 0;
  allEntries.forEach((c) => {
    if (scopedTotal > 0 && c.value / scopedTotal < 0.03) small += c.value;
    else big.push(c);
  });
  const donutData = small > 0 ? [...big, { name: 'Other small', value: small }] : big;

  // --- daily bars (whole month, unaffected by the drill) ---
  const nDays = daysInMonth(ym.y, ym.m);
  const daily = Array.from({ length: nDays }, (_, i) => ({ day: i + 1, spend: 0 }));
  expenses.forEach((r) => {
    daily[Number(r.tx_date.slice(8, 10)) - 1].spend += Number(r.amount);
  });

  // --- 6-month trend, ending at the selected month ---
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const { y, m } = addMonths(ym.y, ym.m, -i);
    const k = `${y}-${String(m).padStart(2, '0')}`;
    let inc = 0;
    let exp = 0;
    rows.forEach((r) => {
      if (monthKey(r.tx_date) !== k) return;
      if (r.type === 'income') inc += Number(r.amount);
      else exp += Number(r.amount);
    });
    trend.push({ label: fmtMonth(y, m).replace(' 20', " '"), income: inc, expense: exp });
  }

  const tooltipStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    color: 'var(--text)',
    fontSize: 12,
    boxShadow: 'var(--shadow-sm)',
  };
  const tick = { fill: 'var(--text-dim)', fontSize: 10 };

  const canDrillDeeper = !isDeepest; // clicking a (non-"Other small") row goes one level deeper
  function drillInto(name) {
    if (name === 'Other small' || !canDrillDeeper) return;
    setDrill([...drill, name]);
  }

  const deepestList = isDeepest
    ? [...scoped].sort(
        (a, b) => b.tx_date.localeCompare(a.tx_date) || (b.created_at || '').localeCompare(a.created_at || '')
      )
    : [];

  return (
    <>
      <div className="scope-bar">
        <button className="nav-btn" onClick={() => setYm(addMonths(ym.y, ym.m, -1))} aria-label="Previous month">
          ‹
        </button>
        <span className="title">{fmtMonth(ym.y, ym.m)}</span>
        <button className="nav-btn" onClick={() => setYm(addMonths(ym.y, ym.m, 1))} aria-label="Next month">
          ›
        </button>
      </div>

      <button className="ai-cta" onClick={onOpenAi}>
        <span className="spark"><IconSpark /></span>
        <span className="mid">
          <b>AI money report</b>
          <small>Generate a report to paste into Claude or ChatGPT</small>
        </span>
        <span className="chev">›</span>
      </button>

      <div className="card">
        <div className="section-title">
          {drill.length === 0 ? (
            groupBy === 'category' ? 'Expenses by category' : 'Expenses by where'
          ) : (
            <span className="breadcrumb">
              <button onClick={() => setDrill([])}>Expenses</button>
              {drill.map((seg, i) => (
                <span key={i}>
                  <span className="crumb-sep">›</span>
                  <button
                    className={i === drill.length - 1 ? 'current' : ''}
                    disabled={i === drill.length - 1}
                    onClick={() => setDrill(drill.slice(0, i + 1))}
                  >
                    {seg}
                  </button>
                </span>
              ))}
            </span>
          )}
        </div>

        {drill.length === 0 && (
          <div className="seg mini" style={{ marginBottom: 14, width: 'fit-content' }}>
            <button className={groupBy === 'category' ? 'active' : ''} onClick={() => switchGroupBy('category')}>
              Category
            </button>
            <button className={groupBy === 'where' ? 'active' : ''} onClick={() => switchGroupBy('where')}>
              Where
            </button>
          </div>
        )}

        {isDeepest ? (
          deepestList.length === 0 ? (
            <div className="empty">Nothing here</div>
          ) : (
            <div className="cat-list">
              {deepestList.map((r) => (
                <div className="cat-line" key={r.id}>
                  <span className="name">{r.note || 'No note'}</span>
                  <span className="when">{fmtShort(r.tx_date)}</span>
                  <span className="val">{formatINR(Number(r.amount))}</span>
                </div>
              ))}
            </div>
          )
        ) : donutData.length === 0 ? (
          <div className="empty">No expenses here</div>
        ) : (
          <>
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatINR(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <div className="big">{formatINR(scopedTotal)}</div>
                <div className="small">{drill.length === 0 ? 'total spent' : 'in this view'}</div>
              </div>
            </div>
            <div className="cat-list">
              {allEntries.map((c, i) => {
                const clickable = canDrillDeeper && c.name !== 'Other small';
                const Tag = clickable ? 'button' : 'div';
                return (
                  <Tag className="cat-line" key={c.name} onClick={clickable ? () => drillInto(c.name) : undefined}>
                    <span className="swatch" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="name">{c.name}</span>
                    <span className="val">{formatINR(c.value)}</span>
                    <span className="pct">{((c.value / scopedTotal) * 100).toFixed(1)}%</span>
                    {clickable && <span className="chev">›</span>}
                  </Tag>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="section-title">Daily spend</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={daily} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <XAxis
              dataKey="day"
              tick={tick}
              interval={4}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => formatINR(v)}
              labelFormatter={(d) => `Day ${d}`}
              cursor={{ fill: 'var(--accent-soft)' }}
            />
            <Bar dataKey="spend" fill="var(--red)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="toggle-row">
          <div className="section-title" style={{ margin: 0, flex: 1 }}>
            Income vs expense
          </div>
          <label>
            <input
              type="checkbox"
              checked={showTrend}
              onChange={(e) => setShowTrend(e.target.checked)}
            />{' '}
            Last 6 months
          </label>
        </div>
        {showTrend && (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={tick}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={tick}
                tickFormatter={formatCompact}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatINR(v)} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-dim)' }} />
              <Line type="monotone" dataKey="income" stroke="var(--green)" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="expense" stroke="var(--red)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}

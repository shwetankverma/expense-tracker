import { useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { todayLocal, monthKey, addMonths, fmtMonth, daysInMonth } from '../lib/dates.js';
import { formatINR, formatCompact } from '../lib/money.js';

const COLORS = [
  '#8b7cf6', '#5cbf9b', '#e08e8e', '#e0b56e', '#6fb3d9', '#d98cc0',
  '#a89bf0', '#84cf95', '#e0a06e', '#6ec4cc', '#c48ede', '#cfc06e', '#a3a0b8',
];

export default function Analytics({ rows }) {
  const today = todayLocal();
  const [ym, setYm] = useState(() => ({
    y: Number(today.slice(0, 4)),
    m: Number(today.slice(5, 7)),
  }));
  const [showTrend, setShowTrend] = useState(true);

  const mk = `${ym.y}-${String(ym.m).padStart(2, '0')}`;
  const monthRows = rows.filter((r) => monthKey(r.tx_date) === mk);
  const expenses = monthRows.filter((r) => r.type === 'expense');
  const totalSpent = expenses.reduce((s, r) => s + Number(r.amount), 0);

  // --- donut: split by category, <3% collapses into "Other small" ---
  const catMap = {};
  expenses.forEach((r) => {
    catMap[r.category] = (catMap[r.category] || 0) + Number(r.amount);
  });
  const allCats = Object.entries(catMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const big = [];
  let small = 0;
  allCats.forEach((c) => {
    if (totalSpent > 0 && c.value / totalSpent < 0.03) small += c.value;
    else big.push(c);
  });
  const donutData = small > 0 ? [...big, { name: 'Other small', value: small }] : big;

  // --- daily bars ---
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

      <div className="card">
        <div className="section-title">Expenses by category</div>
        {donutData.length === 0 ? (
          <div className="empty">No expenses this month</div>
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
                <div className="big">{formatINR(totalSpent)}</div>
                <div className="small">total spent</div>
              </div>
            </div>
            <div className="cat-list">
              {allCats.map((c, i) => (
                <div className="cat-line" key={c.name}>
                  <span className="swatch" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="name">{c.name}</span>
                  <span className="val">{formatINR(c.value)}</span>
                  <span className="pct">{((c.value / totalSpent) * 100).toFixed(1)}%</span>
                </div>
              ))}
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

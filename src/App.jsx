import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase.js';
import * as store from './lib/store.js';
import { todayLocal } from './lib/dates.js';
import Auth from './components/Auth.jsx';
import DayDetail from './components/DayDetail.jsx';
import Calendar from './components/Calendar.jsx';
import Analytics from './components/Analytics.jsx';
import AiSummary from './components/AiSummary.jsx';
import TransactionForm from './components/TransactionForm.jsx';

const THEME_COLORS = { light: '#f7f4ef', dark: '#15131c' };

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('et_theme') || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('et_theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
  }, [theme]);
  return [theme, setTheme];
}

function useTransactions(ready) {
  const [rows, setRows] = useState(store.getAll());
  useEffect(() => {
    if (!ready) return undefined;
    setRows(store.getAll());
    return store.subscribe(setRows);
  }, [ready]);
  return rows;
}

const TABS = [
  { id: 'day', ico: '📅', label: 'Day' },
  { id: 'calendar', ico: '🗓', label: 'Month' },
  { id: 'analytics', ico: '📊', label: 'Charts' },
  { id: 'ai', ico: '🤖', label: 'AI' },
];

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('day'); // 'day' | 'calendar' | 'analytics' | 'ai'
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [showForm, setShowForm] = useState(null); // null | 'income' | 'expense' | tx object
  const [theme, setTheme] = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    if (!ready) {
      store.init();
      setReady(true);
    } else {
      store.refresh(); // fresh login after a logout: repopulate
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useTransactions(ready);

  async function logout() {
    if (!window.confirm('Log out?')) return;
    await supabase.auth.signOut();
    store.clearLocal();
    setView('day');
  }

  if (session === undefined) return null; // brief blank while session loads
  if (!session) return <Auth />;

  const pending = store.pendingCount();
  const dotClass = !store.isOnline() ? 'grey' : pending > 0 ? 'amber' : 'green';

  const openDay = (iso) => {
    setSelectedDate(iso);
    setView('day');
  };

  return (
    <>
      <header className="topbar">
        <span className="brand">
          <span className="mark">₹</span>Expenses
        </span>
        <div className="top-actions">
          <span
            className={`sync-dot ${dotClass}`}
            title={!store.isOnline() ? 'Offline' : pending ? `${pending} pending` : 'Synced'}
          />
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button className="icon-btn" onClick={logout} aria-label="Log out">
            ⏻
          </button>
        </div>
      </header>

      <div className="app">
        {view === 'day' && (
          <DayDetail
            rows={rows}
            date={selectedDate}
            setDate={setSelectedDate}
            onEdit={(tx) => setShowForm(tx)}
          />
        )}
        {view === 'calendar' && (
          <Calendar rows={rows} selectedDate={selectedDate} onSelect={openDay} />
        )}
        {view === 'analytics' && <Analytics rows={rows} />}
        {view === 'ai' && <AiSummary rows={rows} />}
      </div>

      <button className="fab" onClick={() => setShowForm('expense')} aria-label="Add transaction">
        +
      </button>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={view === t.id ? 'active' : ''}
            onClick={() => setView(t.id)}
          >
            <span className="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {showForm && (
        <TransactionForm
          initial={showForm}
          defaultDate={selectedDate}
          onClose={() => setShowForm(null)}
        />
      )}
    </>
  );
}

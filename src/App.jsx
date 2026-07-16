import { useState, useEffect, useReducer } from 'react';
import { supabase } from './lib/supabase.js';
import * as store from './lib/store.js';
import * as cardstore from './lib/cardstore.js';
import { todayLocal } from './lib/dates.js';
import { loadPrefs, savePrefs } from './lib/prefs.js';
import Auth from './components/Auth.jsx';
import DayDetail from './components/DayDetail.jsx';
import Calendar from './components/Calendar.jsx';
import Analytics from './components/Analytics.jsx';
import AiSummary from './components/AiSummary.jsx';
import TransactionForm from './components/TransactionForm.jsx';
import Cards from './components/Cards.jsx';
import CardExpenseForm from './components/CardExpenseForm.jsx';
import Profile from './components/Profile.jsx';
import { IconHome, IconCalendar, IconChart, IconCard, IconUser } from './components/Icons.jsx';

const THEME_COLORS = { light: '#faf8f4', dark: '#121014' };

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
  { id: 'day', Icon: IconHome, label: 'Home' },
  { id: 'calendar', Icon: IconCalendar, label: 'Calendar' },
  { id: 'analytics', Icon: IconChart, label: 'Insights' },
  { id: 'cards', Icon: IconCard, label: 'Cards' },
  { id: 'profile', Icon: IconUser, label: 'Profile' },
];

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('day'); // day|calendar|analytics|ai|cards|profile
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [showForm, setShowForm] = useState(null); // null | 'income' | 'expense' | tx object
  const [showCardForm, setShowCardForm] = useState(null); // null | 'new' | card-expense object
  const [theme, setTheme] = useTheme();
  const [prefs, setPrefsState] = useState(loadPrefs);
  const [, bump] = useReducer((x) => x + 1, 0); // re-render on cardstore changes (sync dot)

  useEffect(() => {
    document.documentElement.dataset.accent = prefs.accent;
  }, [prefs.accent]);

  const setPrefs = (patch) => {
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    if (!ready) {
      store.init();
      cardstore.init();
      setReady(true);
    } else {
      store.refresh(); // fresh login after a logout: repopulate
      cardstore.refresh();
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useTransactions(ready);

  useEffect(() => {
    if (!ready) return undefined;
    return cardstore.subscribe(bump);
  }, [ready]);

  if (session === undefined) return null; // brief blank while session loads
  if (!session) return <Auth />;

  const pending = store.pendingCount() + cardstore.pendingCount();
  const dotClass = !store.isOnline() ? 'grey' : pending > 0 ? 'amber' : 'green';

  const openDay = (iso) => {
    setSelectedDate(iso);
    setView('day');
  };

  const showFab = ['day', 'calendar', 'analytics', 'cards'].includes(view);

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
        </div>
      </header>

      <div className="app">
        <div className="view" key={view}>
          {view === 'day' && (
            <DayDetail
              rows={rows}
              date={selectedDate}
              setDate={setSelectedDate}
              onEdit={(tx) => setShowForm(tx)}
            />
          )}
          {view === 'calendar' && (
            <Calendar
              rows={rows}
              selectedDate={selectedDate}
              onSelect={openDay}
              weekStart={prefs.weekStart}
            />
          )}
          {view === 'analytics' && <Analytics rows={rows} onOpenAi={() => setView('ai')} />}
          {view === 'ai' && <AiSummary rows={rows} onBack={() => setView('analytics')} />}
          {view === 'cards' && <Cards onEditExpense={(t) => setShowCardForm(t)} />}
          {view === 'profile' && (
            <Profile
              rows={rows}
              session={session}
              theme={theme}
              setTheme={setTheme}
              prefs={prefs}
              setPrefs={setPrefs}
              onEdit={(tx) => setShowForm(tx)}
            />
          )}
        </div>
      </div>

      {showFab && (
        <button
          className="fab"
          onClick={() => (view === 'cards' ? setShowCardForm('new') : setShowForm('expense'))}
          aria-label="Add"
        >
          +
        </button>
      )}

      <nav className="tabbar">
        {TABS.map(({ id, Icon, label }) => (
          <button
            key={id}
            className={view === id || (id === 'analytics' && view === 'ai') ? 'active' : ''}
            onClick={() => setView(id)}
          >
            <Icon />
            {label}
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

      {showCardForm && (
        <CardExpenseForm initial={showCardForm} onClose={() => setShowCardForm(null)} />
      )}
    </>
  );
}

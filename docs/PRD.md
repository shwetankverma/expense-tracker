# Personal Expense Tracker: PRD + Architecture + Build Spec

**Version 1.0 · July 2026 · Single user, personal use**

This document is written so that any competent AI coding model (or human) can build the entire app from it without asking questions. Every decision is already made. Every known pitfall has a prescribed fix. If you are the builder: do not substitute technologies, do not add features, do not skip the pitfalls section. Follow the build order in Section 14.

---

## 1. What this app is

A mobile-first expense tracker used by exactly one person, on an iPhone, installed as a PWA from Safari. It opens on today's date, shows what was earned and spent that day, and lets the user log income and expenses in a few taps. A calendar gives access to any past or future day. An analytics screen shows where money goes. An AI summary screen generates a text report the user copies and pastes into Claude or ChatGPT for advice on cutting costs.

Data lives in Supabase so it survives forever and works across devices. The app itself is static files on GitHub Pages, deployed automatically on every push to main.

### Non-goals (do not build these)

- No multi-user support, no sharing, no household accounts
- No budgets, alerts, or notifications (iOS PWA push is unreliable anyway)
- No receipt scanning, no bank sync, no CSV import
- No in-app AI API calls. The AI step is deliberately copy-paste
- No TypeScript. Plain JavaScript + JSX keeps the build simple

---

## 2. Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite, plain JSX | Well-trodden path, easy for any model to build |
| Routing | None. State-based view switching in App.jsx | Avoids GitHub Pages base-path and 404 routing pain entirely |
| Charts | Recharts | Declarative, works well in React |
| Storage | Supabase (Postgres) with Row Level Security | Free tier, persists forever, any device |
| Auth | Supabase **email OTP code** (6-digit), NOT magic link | Magic links open in Safari, not the installed PWA, so the session never reaches the app. OTP codes are typed in and work everywhere. This is a hard requirement |
| Offline | Service worker caches app shell; localStorage mirrors data; write queue flushes when back online | Simple, no IndexedDB needed at this data size |
| Deploy | GitHub Actions → GitHub Pages, SW version stamped with commit SHA | User's requirement |
| Currency | INR, formatted as ₹1,23,456.78 using `Intl.NumberFormat('en-IN')` | User is in India |
| Dates | Stored as `DATE` (YYYY-MM-DD) computed in **local time**, never from `toISOString()` | toISOString() shifts dates across midnight in IST. See pitfall P1 |
| Dependencies | react, react-dom, @supabase/supabase-js, recharts. Nothing else | Hand-roll date helpers; calendar math is 20 lines |

The Supabase URL and anon key are safe to hardcode in the client. RLS is the security boundary, not the key. Also turn off "Enable new user signups" in Supabase Auth settings after creating your own account, so nobody else can even register.

---

## 3. Screens and navigation

Four views, switched by a bottom tab bar plus one modal:

```
┌─────────────────────────────┐
│         (active view)       │
│                             │
│   Day │ Calendar │ Charts   │
│        │ AI                 │
│                        (+)  │  ← floating add button
├─────────────────────────────┤
│  📅 Day  🗓 Month  📊  🤖   │  ← tab bar, safe-area padded
└─────────────────────────────┘
```

App state that drives everything:

```js
const [view, setView] = useState('day');        // 'day' | 'calendar' | 'analytics' | 'ai'
const [selectedDate, setSelectedDate] = useState(todayLocal()); // 'YYYY-MM-DD'
const [showForm, setShowForm] = useState(null); // null | 'income' | 'expense' | txObjectBeingEdited
```

### 3.1 Day Detail (default view on launch)

- Header: "Mon, 7 Jul 2026" with ‹ › arrows to step one day back/forward, and a "Today" pill that appears only when not on today
- Two summary chips: Income total (green) and Expense total (red) for that day, plus Net
- List of that day's transactions, newest first. Each row: category emoji + name, note (if any), amount right-aligned, green for income, red with minus for expense
- Tap a row → opens the form pre-filled for editing, with a Delete button
- Empty state: "Nothing logged on this day" with a prompt to tap +
- The floating + opens the add form with `tx_date` preset to the selected day

### 3.2 Calendar (month view)

- Month header with ‹ › to change month, tap header to jump back to current month
- Standard 7-column grid, weeks start Monday
- Each day cell shows: the day number, and beneath it the day's net amount in tiny text if any transactions exist (green if net ≥ 0, red if negative). No dots, actual numbers, abbreviated: ₹1.2k, ₹15k, ₹1.5L (use the compact formatter in Section 10)
- Today's cell has an outlined ring. The selected date has a filled background
- Tapping any day sets `selectedDate` and switches to Day Detail
- Below the grid: a month summary strip showing Month Income / Month Expense / Net

### 3.3 Analytics

Scope selector at top: current month by default, ‹ › to move months, plus a "Last 6 months" toggle for the trend chart.

Three charts, stacked vertically:

1. **Donut chart** (Recharts PieChart with innerRadius): expense split by category for the selected month. Center label shows total spent. Legend below with category name, amount, and percent. Categories under 3% collapse into "Other small"
2. **Daily bar chart**: expenses per day across the selected month (BarChart, one bar per day, x-axis labels every 5 days)
3. **Trend line**: last 6 months, two lines, income vs expense per month (LineChart)

Under the donut, a plain list: every category, sorted by amount desc, with amount and % share. This list is also what feeds the AI summary.

### 3.4 AI Analysis

This screen builds a text report and hands it to the user. It never calls any AI API.

- Period selector: This month / Last month / Last 3 months
- A read-only `<textarea>` (or `<pre>`) showing the generated report (spec in Section 9)
- Two buttons: **Copy** (navigator.clipboard.writeText, then show "Copied ✓" for 2s) and **Share** (navigator.share if available, hide button otherwise)
- Short instruction text: "Paste this into Claude or ChatGPT and ask it where to cut."

### 3.5 Add/Edit Transaction form (modal sheet)

Slides up from the bottom, covers ~85% of screen, dark overlay behind, drag or ✕ to dismiss.

Fields, in order:

1. Type toggle: Expense | Income (two big segmented buttons, expense preselected when opened from +)
2. Amount: numeric input, `inputmode="decimal"`, autofocused, big font, ₹ prefix
3. Category: grid of chips (emoji + label), single select, categories switch when type switches
4. Date: defaults to `selectedDate`, native `<input type="date">`
5. Note: single-line optional text
6. Save button, full width. Disabled unless amount > 0 and a category is picked

Editing mode adds a red Delete button at the bottom. Delete asks for one confirm ("Delete this entry?").

On save: write goes through the data layer (Section 7), the modal closes, the day list updates instantly (optimistic).

### 3.6 Auth screen

Shown only when there is no Supabase session.

1. Email input + "Send code" button → calls `supabase.auth.signInWithOtp({ email })`
2. Screen switches to a 6-digit code input → calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`
3. On success the session persists (Supabase stores it in localStorage) and the app loads

Do NOT use magic links. See pitfall P2.

---

## 4. Categories (fixed list, hardcoded in a constants file)

Expense: 🍔 Food, 🛒 Groceries, 🚗 Transport, 🏠 Rent, 💡 Utilities, 🛍 Shopping, 💊 Health, 🎬 Entertainment, 📱 Subscriptions, ✈️ Travel, 📚 Education, 🎁 Gifts, 🔧 Other

Income: 💼 Salary, 💻 Freelance, 🏦 Interest, 📈 Investments, 🎁 Gift, ➕ Other

Stored in the DB as the plain label string ("Food", "Salary"). Emojis live only in the UI constants.

```js
// src/lib/categories.js
export const EXPENSE_CATEGORIES = [
  { key: 'Food', emoji: '🍔' }, { key: 'Groceries', emoji: '🛒' },
  { key: 'Transport', emoji: '🚗' }, { key: 'Rent', emoji: '🏠' },
  { key: 'Utilities', emoji: '💡' }, { key: 'Shopping', emoji: '🛍' },
  { key: 'Health', emoji: '💊' }, { key: 'Entertainment', emoji: '🎬' },
  { key: 'Subscriptions', emoji: '📱' }, { key: 'Travel', emoji: '✈️' },
  { key: 'Education', emoji: '📚' }, { key: 'Gifts', emoji: '🎁' },
  { key: 'Other', emoji: '🔧' },
];
export const INCOME_CATEGORIES = [
  { key: 'Salary', emoji: '💼' }, { key: 'Freelance', emoji: '💻' },
  { key: 'Interest', emoji: '🏦' }, { key: 'Investments', emoji: '📈' },
  { key: 'Gift', emoji: '🎁' }, { key: 'Other', emoji: '➕' },
];
```

---

## 5. Data model (Supabase)

Run this once in the Supabase SQL editor:

```sql
create table public.transactions (
  id uuid primary key,                          -- client-generated, see note
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tx_date date not null,
  type text not null check (type in ('income','expense')),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "own rows only" on public.transactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_tx_user_date on public.transactions (user_id, tx_date);
```

**Why the client generates the id:** offline writes go into a retry queue. If a retry fires twice, an `upsert` on a client-generated UUID is idempotent, so no duplicates. Every insert in the app is actually `supabase.from('transactions').upsert(row)` with `id: crypto.randomUUID()` set at creation time.

Amounts: always `Math.round(parseFloat(input) * 100) / 100` before saving. Signs are never stored; `type` carries the direction.

---

## 6. Project structure

```
expense-tracker/                  ← repo name matters, see vite base
├─ index.html
├─ vite.config.js
├─ package.json
├─ public/
│  ├─ manifest.webmanifest
│  ├─ sw.js                       ← copied as-is by Vite, version stamped by CI
│  └─ icons/
│     ├─ icon-192.png
│     ├─ icon-512.png
│     └─ apple-touch-icon.png     ← 180×180, iOS reads this, not the manifest
├─ src/
│  ├─ main.jsx                    ← renders App, registers SW
│  ├─ App.jsx                     ← auth gate, view switching, tab bar, FAB
│  ├─ styles.css                  ← single stylesheet, design tokens as CSS vars
│  ├─ lib/
│  │  ├─ supabase.js              ← createClient, URL + anon key constants
│  │  ├─ dates.js                 ← todayLocal, addDays, monthGrid, fmt helpers
│  │  ├─ money.js                 ← formatINR, formatCompact
│  │  ├─ categories.js
│  │  ├─ store.js                 ← THE data layer: cache, queue, CRUD, subscribe
│  │  └─ summary.js               ← builds the AI report text
│  └─ components/
│     ├─ Auth.jsx
│     ├─ DayDetail.jsx
│     ├─ Calendar.jsx
│     ├─ Analytics.jsx
│     ├─ AiSummary.jsx
│     └─ TransactionForm.jsx
└─ .github/workflows/deploy.yml
```

`vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/expense-tracker/',   // MUST equal the GitHub repo name, with slashes
});
```

---

## 7. Data layer (`src/lib/store.js`) — the heart of offline support

One module owns all data. Components never call Supabase directly. The model is: **localStorage is the instant source of truth for rendering; Supabase is the durable source of truth; a queue reconciles them.**

State kept in localStorage under three keys:

- `et_cache` → array of all transaction rows (personal use = small; thousands of rows is fine in localStorage)
- `et_queue` → array of pending ops: `{ op: 'upsert'|'delete', row|id, ts }`
- `et_cache_ts` → last successful full sync timestamp

Public API:

```js
init()                       // load cache, attach 'online' listener, then refresh()
getAll()                     // returns in-memory array (already parsed)
subscribe(fn)                // components re-render via this; returns unsubscribe
addOrUpdate(tx)              // 1) update cache + notify  2) queue upsert  3) flush()
remove(id)                   // 1) remove from cache + notify  2) queue delete  3) flush()
refresh()                    // if online: SELECT * for this user, replace cache, notify
flush()                      // if online: replay queue in order via upsert/delete,
                             //   drop each op on success, keep on failure
isOnline(), pendingCount()   // for the sync status dot in the UI
```

Rules:

1. Every mutation is optimistic. UI updates from the cache immediately; network happens after
2. `flush()` runs on: app start, `window 'online'` event, and after every mutation
3. Deletes of rows still in the queue as unsent upserts: just remove the queued upsert
4. If `refresh()` succeeds while the queue is non-empty, flush first, then refresh, so server truth doesn't clobber pending local writes
5. A small dot in the header shows sync state: green (synced), amber (N pending), grey (offline)

In React, wrap this in a tiny hook:

```js
function useTransactions() {
  const [rows, setRows] = useState(store.getAll());
  useEffect(() => store.subscribe(setRows), []);
  return rows;
}
```

All derived data (day totals, month totals, category splits) is computed in components with plain `filter`/`reduce` over this array. No extra state management library.

---

## 8. Date and money helpers (exact specs)

`src/lib/dates.js` — every function works in local time:

```js
export function todayLocal() {            // 'YYYY-MM-DD' in the device timezone
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function addDays(iso, n) { /* parse parts, new Date(y, m-1, d+n), re-format */ }
export function monthKey(iso) { return iso.slice(0, 7); }        // '2026-07'
export function monthGrid(year, month) {
  // returns array of 4-6 week arrays, each 7 cells of 'YYYY-MM-DD' or null,
  // weeks start Monday: offset = (firstDay.getDay() + 6) % 7
}
export function fmtHeader(iso) { /* 'Mon, 7 Jul 2026' via toLocaleDateString('en-IN', ...) */ }
```

**Never** build a date string with `new Date(...).toISOString()`. See pitfall P1.

`src/lib/money.js`:

```js
export const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR',
    maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
export function formatCompact(n) {       // for calendar cells
  const a = Math.abs(n);
  if (a >= 1e5) return `₹${(n/1e5).toFixed(1)}L`;
  if (a >= 1e3) return `₹${(n/1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}
```

---

## 9. AI report format (`src/lib/summary.js`)

`buildReport(rows, periodStart, periodEnd)` returns a plain-text block. Exact template:

```
EXPENSE REPORT: 1 Jul 2026 to 31 Jul 2026 (31 days)
Currency: INR

TOTALS
Income:  ₹1,20,000
Expense: ₹78,450
Net:     +₹41,550
Avg daily spend: ₹2,531

EXPENSES BY CATEGORY
Rent           ₹30,000   38.2%
Food           ₹14,200   18.1%
Groceries      ₹9,800    12.5%
... (all categories with spend, sorted desc)

VS PREVIOUS PERIOD
Total spend: +12% (₹70,050 → ₹78,450)
Biggest increases: Food +₹3,400, Shopping +₹2,100
Biggest decreases: Transport -₹900

10 LARGEST EXPENSES
1. ₹30,000  Rent       1 Jul   "July rent"
2. ₹4,500   Shopping   14 Jul  "shoes"
...

INCOME BY CATEGORY
Salary   ₹1,15,000
Freelance ₹5,000

---
I am trying to reduce my spending. Based on this report:
1. Which categories look high for a single person in Bengaluru, India?
2. Give me 5 specific, realistic cuts with estimated monthly savings in INR.
3. Point out any patterns I might not have noticed (frequency, small leaks, weekday vs weekend).
Be direct. Do not pad the answer.
```

The prompt at the bottom ships with the report so the user pastes one block and gets useful output immediately. Notes are included in the largest-expenses list because they carry the context an AI needs.

---

## 10. Design spec

Mobile-first, dark theme only (this is a personal iPhone app; one theme, done well).

**Tokens** (CSS variables in `styles.css`):

```css
:root {
  --bg: #0f1115;         --surface: #1a1d24;    --surface-2: #232733;
  --text: #e8eaf0;       --text-dim: #8a90a0;
  --green: #34d399;      --red: #f87171;        --accent: #818cf8;
  --radius: 14px;        --tab-h: 60px;
}
```

**Layout rules:**

- `index.html` must include `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- Body padding respects notch and home bar: `padding: env(safe-area-inset-top) 0 calc(var(--tab-h) + env(safe-area-inset-bottom)) 0`
- Tab bar: fixed bottom, `padding-bottom: env(safe-area-inset-bottom)`, 4 items, active item in accent color
- FAB: 56px circle, accent background, fixed at right: 16px, bottom: tab-h + safe-area + 16px
- Content max-width 480px, centered, so it also looks fine in a desktop browser
- Cards use `--surface` with `--radius`. Amount typography: 600 weight, tabular-nums
- All tap targets ≥ 44px. Transitions ≤ 150ms. No layout that depends on hover

**Modal sheet:** fixed, bottom 0, border-radius 20px 20px 0 0, transform-based slide-up, overlay `rgba(0,0,0,.5)`.

---

## 11. PWA spec

### 11.1 `public/manifest.webmanifest`

```json
{
  "name": "Expense Tracker",
  "short_name": "Expenses",
  "start_url": "/expense-tracker/",
  "scope": "/expense-tracker/",
  "display": "standalone",
  "background_color": "#0f1115",
  "theme_color": "#0f1115",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 11.2 `index.html` head additions (iOS reads these, not the manifest)

```html
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Expenses">
<meta name="theme-color" content="#0f1115">
```

Icons: flat dark background (#0f1115), a simple ₹ glyph, no transparency on the apple-touch-icon (iOS puts a white background behind transparent pixels).

### 11.3 `public/sw.js` (complete file)

```js
const VERSION = '__BUILD_VERSION__';           // CI replaces this with the commit SHA
const CACHE = `et-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(['./', './index.html', './manifest.webmanifest']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;   // never touch Supabase traffic

  if (e.request.mode === 'navigate') {
    // network-first so updates land; fall back to cached shell offline
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // hashed Vite assets: cache-first, populate on first fetch
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
    )
  );
});
```

Why this design: Vite fingerprints asset filenames, so a precache manifest is unnecessary. New deploy → new HTML → new asset URLs → fetched fresh. Old caches are deleted on activate because the cache name embeds the version. This delivers the "users get update on next load, no cache clearing" requirement.

### 11.4 Registration in `main.jsx`

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js');
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;      // guard against reload loops
      reloaded = true;
      window.location.reload();  // one clean reload when a new SW takes over
    });
  });
}
```

---

## 12. CI/CD: `.github/workflows/deploy.yml` (complete file)

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - name: Stamp service worker version
        run: sed -i "s/__BUILD_VERSION__/${GITHUB_SHA::7}/" dist/sw.js
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```

One-time repo setup: Settings → Pages → Source: **GitHub Actions**.

---

## 13. Supabase one-time setup checklist

1. Create project → copy Project URL and anon key into `src/lib/supabase.js`
2. SQL editor → run the schema from Section 5
3. Authentication → Providers → Email: enabled. **Confirm email: off** (OTP itself proves ownership)
4. Authentication → Email Templates → OTP template is default, fine as-is
5. Sign in once with your email from the deployed app
6. Authentication → Settings → **turn off "Allow new users to sign up"**
7. Authentication → URL Configuration → Site URL: `https://<username>.github.io/expense-tracker/`

`src/lib/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  'https://YOUR-PROJECT.supabase.co',
  'YOUR-ANON-KEY'
);
```

---

## 14. Build order (do these phases in sequence, verify each before moving on)

**Phase 1: Skeleton.** Vite + React scaffold, styles.css with tokens, App.jsx with tab bar, FAB, and four placeholder views. Verify: tab switching works, layout respects safe areas in iOS Safari responsive mode.

**Phase 2: Local-only data.** Build store.js with cache + subscribe but Supabase calls stubbed out. Build TransactionForm, DayDetail, dates.js, money.js, categories.js. Verify: can add, edit, delete entries on any day; survives page reload via localStorage.

**Phase 3: Calendar.** monthGrid helper, Calendar component with day nets, month summary strip. Verify: today ringed, tap-through to Day Detail, month navigation across year boundaries (Dec ↔ Jan).

**Phase 4: Supabase.** Schema, Auth.jsx with OTP flow, wire store.js upsert/delete/refresh/flush to Supabase. Verify: entries appear in the Supabase table editor; log in on a second browser and see the same data; RLS blocks reads without a session.

**Phase 5: Offline queue.** online/offline handling, queue flush, sync dot. Verify: DevTools → Network → Offline → add 3 entries → back online → rows land in Supabase, queue empties, no duplicates on double flush.

**Phase 6: Analytics.** Recharts donut, daily bars, 6-month trend, category list. Verify with seeded data across 3 months.

**Phase 7: AI summary.** summary.js exactly per Section 9, copy + share buttons. Verify: pasting the output into an AI chat produces sensible advice.

**Phase 8: PWA + deploy.** manifest, icons, sw.js, registration, workflow file, vite base path. Verify: deployed URL loads; Lighthouse PWA installable; Add to Home Screen on iPhone → opens fullscreen with no Safari chrome; airplane mode → app still opens and shows cached data; push a visible change to main → reopen app → change appears after the auto-reload.

---

## 15. Known pitfalls, already solved (builder: do not deviate)

**P1. Timezone date bug.** `new Date().toISOString().slice(0,10)` gives *yesterday* for any IST user before 5:30 AM. All date strings must come from the local-time helpers in dates.js. This is the single most common bug in this class of app.

**P2. Magic links break iOS PWAs.** A magic-link email opens in Safari, which is a separate storage context from the installed PWA, so the session never reaches the app and the user is stuck logging in forever. Email OTP codes are typed directly into the PWA. Non-negotiable.

**P3. GitHub Pages base path.** The site lives at `/expense-tracker/`, not `/`. Vite `base`, manifest `start_url` and `scope`, and the SW registration path must all agree. Use relative paths (`./`) inside sw.js. There is no router, so no 404 hack is needed.

**P4. SW update loops.** Only reload on `controllerchange`, once, with the boolean guard shown in 11.4. Never call `location.reload()` from inside the SW logic itself.

**P5. Never cache Supabase responses in the SW.** The origin check in sw.js handles this. Auth tokens and stale data in the HTTP cache cause bizarre bugs. Offline reads come from the store.js localStorage mirror instead.

**P6. iOS storage eviction.** Safari can purge localStorage for sites unused ~7 days, but *installed* PWAs are exempt in practice, and Supabase holds durable truth anyway. Worst case: log in again, refresh() repopulates. No action needed, just don't panic if it happens in a browser tab.

**P7. Floating point money.** Round to 2 decimals on input (Section 5). Display through money.js only. Never do `0.1 + 0.2` style accumulation for totals without a final round.

**P8. Recharts sizing.** Wrap every chart in `<ResponsiveContainer width="100%" height={260}>` and give the parent a real width, or charts render at 0px on mobile.

**P9. Vite copies `public/` as-is.** sw.js must live in `public/`, not `src/`, or it gets bundled, hashed, and the registration path breaks.

**P10. The queue must be idempotent.** Client-generated UUIDs + upsert. Never use plain insert for user rows.

---

## 16. Acceptance criteria (final checklist)

- [ ] Opening the installed app lands on today's Day Detail in under 2s on repeat visits
- [ ] Can log an expense in ≤ 4 taps from launch (+ → amount → category → Save)
- [ ] Any day in any month reachable and editable
- [ ] Calendar shows per-day nets and month totals correctly, including across year boundaries
- [ ] Donut, daily bars, and 6-month trend match hand-computed numbers for seeded data
- [ ] AI report copies to clipboard and matches the Section 9 template
- [ ] Full offline: app opens, shows data, accepts writes; writes sync with zero duplicates on reconnect
- [ ] Installed from Safari, runs fullscreen, no browser chrome, status bar blends with the dark theme
- [ ] Push to main → live within ~2 minutes → app self-updates on next open with one silent reload
- [ ] Second device: log in with OTP, all history appears
- [ ] Supabase table is unreadable without the authenticated session (test in an incognito REST call)

---

## 17. Prompt to hand to the builder model

Paste this along with the document:

> Build this app exactly as specified in the attached PRD. Work through Section 14 phase by phase and stop after each phase to show me it working before continuing. Do not add features, do not swap libraries, do not use TypeScript, and follow every rule in Section 15 (pitfalls) without exception. When in doubt, the PRD wins over your instincts.

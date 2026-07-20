# Kharcha — Change Plan v1.1

**Status: planning only. Nothing in this doc has been built. This amends the v1.0 PRD, it doesn't replace it.**

This covers the 8 issues you raised, in the same contract style as the original PRD: what changes, why, exact schema/SQL where relevant, and open questions that need your call before a builder model touches code.

---

## 0. What triggered scope

Since the v1.0 PRD, the app has grown a Profile screen and (per your message) a "Cards" area with its own Merchant/What entry pattern — neither is in the original doc, so I'm working from your description, not the code. Flagged below wherever that matters.

**Assumption I'm making:** "Cards" is an existing screen in your app (credit/debit card tracking) whose entry form already has Where (merchant) and What (optional) fields, and you want the main transaction form to adopt that same pattern. If that's wrong, tell me what Cards actually is before this gets built.

---

## 1. Category CRUD

**Now:** hardcoded in `src/lib/categories.js`, two fixed arrays, no in-app editing.

**Plan:** move categories into Supabase so they're user-editable.

```sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  label text not null,
  emoji text not null default '🔧',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "own categories only" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- On first login, seed the 13 expense + 6 income defaults from the current constants file (one-time insert if the table is empty for that user).
- New screen: **Manage Categories**, reached from Settings/Profile. List + add (label + emoji text input) + edit + delete.
- **Delete behavior (locked):** `transactions.category` stores a plain string snapshot, not a foreign key. Deleting a category from the list only removes it from the picker — past transactions keep their label untouched. No orphan risk, no confirm-heavy delete flow needed.
- Store layer: extend `store.js` (or a sibling `categoryStore.js`) with the same cache + subscribe pattern already used for transactions, just lower write frequency.

---

## 2. Transaction entry: Where / What / Category(optional)

**Now:** Amount → Category (required, grid picker) → Date → Note (optional).

**Plan — new field order:**

1. Type toggle (Expense/Income)
2. Amount
3. **Where** (merchant) — text input, now the primary required identifier
4. **What** (optional) — this is the existing `note` field, relabeled and repositioned
5. Date
6. **Category** — moved to the end, now optional
7. Save

**Schema change:**

```sql
alter table public.transactions add column merchant text not null default '';
alter table public.transactions alter column category drop not null;
```

Existing rows are untouched — `merchant` defaults to `''` for old rows, `category` stays populated for old rows since the `not null` only stops applying going forward.

**Save validation changes:** from `amount > 0 && category picked` to `amount > 0 && merchant filled`.

**New pitfall (P11) — merchant text normalization.** Free-text "Where" invites `Swiggy` / `swiggy` / `SWIGGY` as three different buckets in Expense-by-Where. Fix: trim + title-case on save, and offer an autocomplete/datalist of the user's own previously-used merchants while typing, so they tend to reuse the exact string.

---

## 3. Day list: swap prominence (Where large, Category small)

**Now:** category emoji + name leads, note is small.

**Plan:** flip it. Primary line = **Where** (merchant), in the large weight currently used for category. Category becomes a small chip/tag next to or below it — and simply omitted if the transaction has no category, since it's now optional. What (note) stays small, shown if present. Amount stays right-aligned, colored, unchanged.

This only makes sense once #2 ships (merchant field has to exist first).

---

## 4. Analytics — category drill-down (Category → Where → What)

**Now:** flat list under the donut, category / amount / % share, not tappable.

**Plan:** make each category row tappable, add a drill state to `Analytics.jsx`:

```js
const [drill, setDrill] = useState(null); // null | {category} | {category, merchant}
```

- Tap a category → show merchants under that category for the selected period, each with subtotal and % of the category total. Breadcrumb: `Expenses > Food`.
- Tap a merchant → show the individual transactions (the What/notes) for that merchant. Breadcrumb: `Expenses > Food > Swiggy`.
- No new backend query — everything is `filter`/`reduce` over the already-loaded transactions array, same pattern the rest of the app uses.
- Uncategorized transactions (category = null, post #2) bucket into an explicit "Uncategorized" row rather than being dropped.

---

## 5. Analytics — new "Expense by Where" view

**Plan:** a toggle above the existing donut/list — **Category | Where** — that switches the grouping key on the same chart components (`groupBy` prop) rather than building a second chart from scratch. "By Where" groups directly by merchant, no category nesting, since this is meant to answer "who am I paying the most" independent of category.

Tapping a merchant in this view can reuse the same "show What" drill-down from #4.

*Optional, not required:* once merchant data exists, the AI report (Section 9 of the original PRD) could gain a "TOP MERCHANTS" block the same way it has "10 LARGEST EXPENSES." Worth doing in the same pass as #4/#5 if you want it, not required.

---

## 6. Bug: profile name doesn't persist across logins

I don't have the Profile/Auth code, so this is diagnosis from the symptom, not a verified root cause. Three likely causes, in order of likelihood for this exact symptom (survives nothing, not even same-session-different-login):

- **A.** The name lives only in local React state — never written anywhere durable, so it's gone the instant the component unmounts or a new session starts. Most likely given "vanishes on each login."
- **B.** It's in `localStorage` under a key that gets caught by existing clear/reset logic (e.g. wiped alongside `et_cache` on sign-out).
- **C.** It's written to Supabase correctly but never read back — the update call fires, but nothing calls the fetch on app load.

**Correct pattern (recommended fix regardless of which it is):** store it in Supabase Auth's own user metadata, not a separate table or localStorage:

```js
// write
await supabase.auth.updateUser({ data: { full_name: name } });
// read, on app load / after auth state change
const { data: { user } } = await supabase.auth.getUser();
const name = user?.user_metadata?.full_name ?? '';
```

This persists server-side, survives logout/login and device changes, and needs no new table. **Send me the current Profile component next time and I'll give you the exact diff instead of a pattern.**

---

## 7. Rename app to "Kharcha"

Touch points:

- `manifest.webmanifest` → `name`, `short_name`
- `index.html` → `<title>`, `apple-mobile-web-app-title` meta tag
- Any in-app header/tab bar text that currently reads the old name
- App icon (if it has visible text/wordmark, not just a ₹ glyph)
- `package.json` `name` field — cosmetic, optional

**New pitfall (P13) — don't rename the GitHub repo as part of this.** The repo name is baked into the Vite `base`, the manifest `start_url`/`scope`, and the Supabase Auth Site URL. More importantly, your already-installed iPhone home screen icon is a snapshot pointing at the current URL — renaming the repo (and therefore the URL) orphans it, and you'd have to delete and re-add the PWA on your phone. Rebrand the visible name/icon; leave the repo/URL alone unless you're fine reinstalling.

---

## 8. Login: no "forgot password"

**This isn't actually missing a feature — there's no password to forget.** Auth is email OTP by design (PRD P2, non-negotiable: magic links break installed iOS PWAs). Every "Send code" click already is the forgot-password flow — a fresh 6-digit code, no memory required.

What's probably actually missing, based on the real complaint ("no way out if stuck"):

- **Resend code** link on the OTP-entry screen, with a short cooldown (e.g. 30s) so it can't be spammed.
- **Use a different email** link, in case of a typo, to back out to the email step without reloading the app.

Recommend adding these two, and explicitly not adding a password — that would undo the P2 decision and reopen the exact bug it was designed to avoid.

---

## Suggested order when you build this

1. **Schema pass** — categories table, merchant column, category-nullable, all in one migration since they touch the same tables (#1 + #2 schema half)
2. **Transaction form + Day list** (#2 UI half + #3) — depends on step 1
3. **Category management screen** (#1 UI half) — independent, can run parallel to step 2
4. **Analytics drill-down + Expense by Where** (#4 + #5) — depends on step 2 shipping (needs merchant data flowing in)
5. **Profile fix** (#6) — independent, but send the current code first
6. **Rebrand** (#7) — independent, cosmetic, do whenever
7. **Login resend/change-email** (#8) — independent, small

## Open questions before implementation

- [ ] Confirm what "Cards" actually is (see Section 0) — changes how closely the new Where/What fields should mirror it
- [ ] Is "Where" free text, or should it also support picking from a fixed merchant list you maintain? (Plan above assumes free text + autocomplete)
- [ ] Any interest in the optional "Top Merchants" addition to the AI report (Section 5), or skip it for now?

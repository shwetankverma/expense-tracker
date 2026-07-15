# Expense Tracker

Personal expense tracker PWA. React 18 + Vite, Supabase, GitHub Pages. Built from `expense-tracker-prd.md`.

## Run locally

```
npm install
npm run dev
```

## One-time setup (do these before first use)

### Supabase

1. Create a project at supabase.com → copy the Project URL and anon key into `src/lib/supabase.js` (replace the two placeholders)
2. SQL editor → run `supabase/schema.sql`
3. Authentication → Providers → Email: enabled. Turn **Confirm email: off** for instant registration (or leave on if you want email verification)
4. Authentication → URL Configuration → Site URL: `https://<your-username>.github.io/expense-tracker/`
5. After deploying, register once with your email and a password
6. Then Authentication → Settings → **turn off "Allow new users to sign up"** so nobody else can register

### GitHub

1. Create a repo named exactly `expense-tracker` (the Vite base path and manifest depend on it)
2. Push this folder to `main`
3. Repo Settings → Pages → Source: **GitHub Actions**
4. Every push to `main` builds and deploys automatically (`.github/workflows/deploy.yml`)

### iPhone

Open the deployed URL in Safari → Share → Add to Home Screen. The app runs fullscreen, works offline, and self-updates on next open after each deploy.

## Notes

- The anon key is safe to commit; Row Level Security is the security boundary
- Sign-in uses email OTP codes, never magic links (magic links break installed iOS PWAs)
- All dates are computed in local time, never via `toISOString()` (IST midnight bug)
- Offline writes queue in localStorage and flush when back online; client-generated UUIDs + upsert make retries idempotent

-- Run this once in the Supabase SQL editor (PRD Section 5)

create table public.transactions (
  id uuid primary key,                          -- client-generated for idempotent offline upserts
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

-- ============================================================
-- v2: credit card tracking
-- If you already ran the block above, run ONLY from here down.
-- ============================================================

create table public.cards (
  id uuid primary key,                          -- client-generated (offline-safe upserts)
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  bill_cycle_day int not null check (bill_cycle_day between 1 and 31),
  color text not null default 'noir',
  created_at timestamptz not null default now()
);

alter table public.cards enable row level security;

create policy "own cards only" on public.cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.card_expenses (
  id uuid primary key,                          -- client-generated
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  tx_date date not null,
  merchant text not null default '',
  note text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.card_expenses enable row level security;

create policy "own card expenses only" on public.card_expenses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_cardexp_user_date on public.card_expenses (user_id, tx_date);
create index idx_cardexp_card on public.card_expenses (card_id);

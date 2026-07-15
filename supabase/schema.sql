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

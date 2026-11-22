-- Kudi AI: one table of transactions, each row visible only to the user who owns it.
-- Run this once in the Supabase Dashboard SQL Editor (safe to re-run).

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount_kobo bigint not null check (amount_kobo > 0),
  balance_kobo bigint,
  narration text not null default '',
  category text not null,
  occurred_at timestamptz not null default now(),
  source text not null check (source in ('parser', 'ai')),
  raw_text text not null check (char_length(raw_text) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_occurred_idx
  on public.transactions (user_id, occurred_at desc);

alter table public.transactions enable row level security;

drop policy if exists "Users read their own transactions" on public.transactions;
create policy "Users read their own transactions"
  on public.transactions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users add their own transactions" on public.transactions;
create policy "Users add their own transactions"
  on public.transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Dimdim MVP schema (Supabase/Postgres)

create extension if not exists "pgcrypto";

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  type text not null check (type in ('income','expense')),
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "tx_select_own" on public.transactions
for select using (auth.uid() = user_id);

create policy "tx_insert_own" on public.transactions
for insert with check (auth.uid() = user_id);

create policy "tx_update_own" on public.transactions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tx_delete_own" on public.transactions
for delete using (auth.uid() = user_id);

create or replace function public.set_user_id()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_user_id_on_transactions on public.transactions;
create trigger set_user_id_on_transactions
before insert on public.transactions
for each row execute function public.set_user_id();

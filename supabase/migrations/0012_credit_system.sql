-- Credit balances and transactions to support paid translation usage.

create table if not exists public.user_credit_balances (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount bigint not null,
  transaction_type text not null check (transaction_type in ('charge', 'purchase', 'adjustment', 'refund')),
  description text,
  reference_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_credit_transactions_user_idx
  on public.user_credit_transactions (user_id, created_at desc);

comment on table public.user_credit_balances is 'Current credit balance for each user account.';
comment on table public.user_credit_transactions is 'Audit log of credit changes (purchases, charges, adjustments).';

alter table public.user_credit_balances enable row level security;
alter table public.user_credit_transactions enable row level security;

drop policy if exists "Users view own credit balance" on public.user_credit_balances;
create policy "Users view own credit balance"
  on public.user_credit_balances
  for select
  using (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "Users view own credit transactions" on public.user_credit_transactions;
create policy "Users view own credit transactions"
  on public.user_credit_transactions
  for select
  using (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "Service manages credit balances" on public.user_credit_balances;
create policy "Service manages credit balances"
  on public.user_credit_balances
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service manages credit transactions" on public.user_credit_transactions;
create policy "Service manages credit transactions"
  on public.user_credit_transactions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.ensure_credit_balance(target_user uuid, initial_balance bigint default 0)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.user_credit_balances (user_id, balance)
  values (target_user, greatest(initial_balance, 0))
  on conflict (user_id) do nothing;
end;
$$;

comment on function public.ensure_credit_balance(uuid, bigint) is 'Creates a credit balance row for the user when missing.';

create or replace function public.add_credits(target_user uuid, credit_amount bigint, txn_type text default 'purchase', txn_description text default null, reference text default null)
returns void
language plpgsql
security definer
as $$
begin
  if credit_amount <= 0 then
    return;
  end if;

  perform public.ensure_credit_balance(target_user);

  update public.user_credit_balances
  set balance = balance + credit_amount,
      updated_at = timezone('utc', now())
  where user_id = target_user;

  insert into public.user_credit_transactions (user_id, amount, transaction_type, description, reference_id)
  values (target_user, credit_amount, coalesce(txn_type, 'purchase'), txn_description, reference);
end;
$$;

comment on function public.add_credits(uuid, bigint, text, text, text) is 'Adds credits to a user and records a transaction.';

create or replace function public.spend_credits(target_user uuid, credit_amount bigint, txn_description text default null, reference text default null)
returns boolean
language plpgsql
security definer
as $$
declare
  remaining bigint;
begin
  if credit_amount <= 0 then
    return true;
  end if;

  update public.user_credit_balances
  set balance = balance - credit_amount,
      updated_at = timezone('utc', now())
  where user_id = target_user
    and balance >= credit_amount
  returning balance into remaining;

  if remaining is null then
    return false;
  end if;

  insert into public.user_credit_transactions (user_id, amount, transaction_type, description, reference_id)
  values (target_user, -credit_amount, 'charge', txn_description, reference);

  return true;
end;
$$;

comment on function public.spend_credits(uuid, bigint, text, text) is 'Attempts to deduct credits from a user. Returns false when insufficient balance.';

-- Seed balances for existing profiles (welcome credits of 1000).
insert into public.user_credit_balances (user_id, balance)
select id, 1000
from public.profiles
on conflict (user_id) do nothing;

alter table public.profiles add column if not exists twitter_url text;

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_sar numeric(12,2) not null,
  transaction_type text not null check (transaction_type in ('credit','debit','refund','adjustment')),
  description text not null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_user_idx on public.wallet_transactions(user_id, created_at desc);
alter table public.wallet_transactions enable row level security;
drop policy if exists "wallet_select_own" on public.wallet_transactions;
create policy "wallet_select_own" on public.wallet_transactions for select using (auth.uid() = user_id);
-- لا insert/update/delete للعميل؛ القيود المالية تُكتب فقط من الخادم بمفتاح service_role.

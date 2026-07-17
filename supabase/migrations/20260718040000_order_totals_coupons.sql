alter table public.orders add column if not exists subtotal_sar numeric(10,2);
alter table public.orders add column if not exists discount_sar numeric(10,2) not null default 0;
alter table public.orders add column if not exists vat_sar numeric(10,2) not null default 0;
alter table public.orders add column if not exists total_sar numeric(10,2);
alter table public.orders add column if not exists amount_paid_sar numeric(10,2) not null default 0;
alter table public.orders add column if not exists amount_due_sar numeric(10,2);
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists items jsonb not null default '[]'::jsonb;
update public.orders set subtotal_sar=amount_sar, total_sar=amount_sar, amount_due_sar=case when status='paid' then 0 else amount_sar end, amount_paid_sar=case when status='paid' then amount_sar else 0 end where subtotal_sar is null;

create table if not exists public.coupons (
  code text primary key,
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 100),
  active boolean not null default true,
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0
);
alter table public.coupons enable row level security;
insert into public.coupons(code,discount_percent,active) values ('WELCOME10',10,true) on conflict (code) do nothing;

create or replace function public.sync_order_paid_amounts() returns trigger as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    new.amount_paid_sar := coalesce(new.total_sar,new.amount_sar);
    new.amount_due_sar := 0;
  end if;
  return new;
end; $$ language plpgsql;
drop trigger if exists trg_sync_order_paid_amounts on public.orders;
create trigger trg_sync_order_paid_amounts before update of status on public.orders for each row execute function public.sync_order_paid_amounts();

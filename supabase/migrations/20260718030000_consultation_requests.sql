create table if not exists public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_id text,
  help_from_start boolean not null default false,
  consultant_level text not null check (consultant_level in ('specialist','consultant','advisor')),
  specialty text not null,
  sector text not null,
  idea_summary text not null,
  notes text,
  amount_sar numeric(10,2) not null default 0,
  status text not null default 'submitted' check (status in ('submitted','reviewing','quoted','awaiting_payment','paid','scheduled','completed','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function public.set_consultation_price() returns trigger as $$
begin
  new.amount_sar := case new.consultant_level when 'specialist' then 190 when 'consultant' then 490 else 990 end;
  return new;
end;
$$ language plpgsql;
drop trigger if exists trg_consultation_price on public.consultation_requests;
create trigger trg_consultation_price before insert or update of consultant_level on public.consultation_requests for each row execute function public.set_consultation_price();
drop trigger if exists update_consultation_requests_updated_at on public.consultation_requests;
create trigger update_consultation_requests_updated_at before update on public.consultation_requests for each row execute function public.update_updated_at();
alter table public.consultation_requests enable row level security;
create policy "consultations_select_own" on public.consultation_requests for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "consultations_insert_own" on public.consultation_requests for insert with check (auth.uid() = user_id);
create policy "consultations_admin_update" on public.consultation_requests for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

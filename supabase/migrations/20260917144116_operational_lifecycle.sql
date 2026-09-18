alter table public.work_requests add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.work_requests add column if not exists due_at timestamptz;
alter table public.work_requests add column if not exists next_action text;
alter table public.work_requests add column if not exists result jsonb;

create table if not exists public.external_party_members (
  party_id uuid not null references public.external_parties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create table if not exists public.work_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.work_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created','status_changed','message','attachment','result_submitted','assigned')),
  from_status text,
  to_status text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.work_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.work_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text,
  attachment_url text,
  created_at timestamptz not null default now(),
  check (nullif(trim(body), '') is not null or attachment_url is not null)
);

create index if not exists work_requests_assigned_to_idx on public.work_requests (assigned_to);
create index if not exists external_party_members_user_idx on public.external_party_members (user_id);
create index if not exists work_request_events_request_idx on public.work_request_events (request_id, created_at desc);
create index if not exists work_request_events_actor_idx on public.work_request_events (actor_id);
create index if not exists work_request_messages_request_idx on public.work_request_messages (request_id, created_at);
create index if not exists work_request_messages_sender_idx on public.work_request_messages (sender_id);

alter table public.external_party_members enable row level security;
alter table public.work_request_events enable row level security;
alter table public.work_request_messages enable row level security;

create policy "members_read_own_membership" on public.external_party_members for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));
create policy "admins_manage_party_members" on public.external_party_members for all to authenticated
using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

create policy "participants_read_request_events" on public.work_request_events for select to authenticated
using (exists (select 1 from public.work_requests wr where wr.id = request_id and (wr.user_id = (select auth.uid()) or wr.assigned_to = (select auth.uid()) or public.is_admin((select auth.uid())))));
create policy "participants_read_request_messages" on public.work_request_messages for select to authenticated
using (exists (select 1 from public.work_requests wr where wr.id = request_id and (wr.user_id = (select auth.uid()) or wr.assigned_to = (select auth.uid()) or public.is_admin((select auth.uid())))));
create policy "participants_create_request_messages" on public.work_request_messages for insert to authenticated
with check (sender_id = (select auth.uid()) and exists (select 1 from public.work_requests wr where wr.id = request_id and (wr.user_id = (select auth.uid()) or wr.assigned_to = (select auth.uid()) or public.is_admin((select auth.uid())))));

create or replace function public.record_work_request_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.work_request_events(request_id, actor_id, event_type, to_status)
    values (new.id, (select auth.uid()), 'created', new.status);
  elsif old.status is distinct from new.status then
    insert into public.work_request_events(request_id, actor_id, event_type, from_status, to_status)
    values (new.id, (select auth.uid()), 'status_changed', old.status, new.status);
    insert into public.notifications(user_id, type, title, body, study_id)
    values (new.user_id, 'system', 'تغيرت حالة طلبك', new.title || ': ' || new.status, new.study_id::text);
  end if;
  return new;
end $$;

drop trigger if exists work_request_change_event on public.work_requests;
create trigger work_request_change_event after insert or update of status on public.work_requests
for each row execute function public.record_work_request_change();

create or replace function public.record_work_request_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; target_study uuid; request_title text;
begin
  insert into public.work_request_events(request_id, actor_id, event_type, details)
  values (new.request_id, new.sender_id, 'message', jsonb_build_object('message_id', new.id));
  select user_id, study_id, title into owner_id, target_study, request_title from public.work_requests where id = new.request_id;
  if owner_id is distinct from new.sender_id then
    insert into public.notifications(user_id, type, title, body, study_id)
    values (owner_id, 'system', 'رسالة جديدة على طلبك', request_title, target_study::text);
  end if;
  return new;
end $$;

drop trigger if exists work_request_message_event on public.work_request_messages;
create trigger work_request_message_event after insert on public.work_request_messages
for each row execute function public.record_work_request_message();

create or replace function public.advance_work_request(target_id uuid, next_status text, requested_next_action text default null)
returns public.work_requests language plpgsql security definer set search_path = '' as $$
declare current_row public.work_requests; changed public.work_requests;
begin
  select * into current_row from public.work_requests where id = target_id;
  if current_row.id is null then raise exception 'request_not_found'; end if;
  if (select auth.uid()) is null or not (
    current_row.user_id = (select auth.uid()) or current_row.assigned_to = (select auth.uid()) or public.is_admin((select auth.uid()))
  ) then raise exception 'not_allowed'; end if;
  if next_status not in ('new','received','processing','waiting_customer','offered','accepted','rejected','completed','cancelled') then
    raise exception 'invalid_status';
  end if;
  update public.work_requests set status = next_status, next_action = nullif(trim(requested_next_action), '') where id = target_id returning * into changed;
  return changed;
end $$;

grant select on public.external_party_members to authenticated;
grant select on public.work_request_events to authenticated;
grant select, insert on public.work_request_messages to authenticated;
grant usage, select on sequence public.work_request_events_id_seq to authenticated;
grant update (assigned_to, due_at, next_action, result) on public.work_requests to authenticated;
revoke all on function public.record_work_request_change() from public, anon, authenticated;
revoke all on function public.record_work_request_message() from public, anon, authenticated;
revoke all on function public.advance_work_request(uuid, text, text) from public, anon;
grant execute on function public.advance_work_request(uuid, text, text) to authenticated;

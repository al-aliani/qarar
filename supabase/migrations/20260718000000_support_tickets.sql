-- ═══════════════════════════════════════════════════════════════════════
-- نظام تذاكر دعم داخلي (2026-07-18) — بلا مزوّد خارجي (لا Crisp/Tawk/Intercom).
-- تدقيق سابق كشف: لا شات دعم بشري حي ولا نظام تذاكر إطلاقاً — الموجود فقط
-- مساعد قواعد محلي (AIChatModal.js) ونموذج "طلب استشارة" يحوّل لحجز خارجي
-- (ConsultationModal.js). هذا الملف يبني البنية الفعلية: تذكرة + محادثة
-- ذهاب-وإياب حقيقية (لا رد واحد فقط)، بنفس أنماط RLS المتّبعة بالمشروع.
--
-- تعتمد على public.is_admin(uid) وpublic.admins (20260716000000_admin_
-- dashboard.sql) وpublic.update_updated_at() (20260717000000_profiles_and_
-- phone.sql) وpublic.notifications (20260716000002_dashboard_experience.sql)
-- — **يجب تطبيق هذه الترحيلات الثلاثة أولاً**. لا تُعاد هنا تعريف أيٍّ منها
-- (نفس مبدأ توثَّق في 20260716000001_customer_reviews.sql: تعريف واحد فقط
-- لكل مفهوم مشترك، لا تكرار بتخطيط مختلف).
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_id_idx
  on public.support_tickets (user_id, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "tickets_select_own" on public.support_tickets;
create policy "tickets_select_own"
  on public.support_tickets for select
  using (auth.uid() = user_id);

drop policy if exists "tickets_insert_own" on public.support_tickets;
create policy "tickets_insert_own"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

-- المستخدم العادي لا يملك أي سياسة update/delete على تذاكره — تغيير الحالة
-- (إغلاق/فتح) يمر فقط عبر الأدمن أو عبر handle_new_ticket_message() أدناه
-- (security definer، يتجاوز RLS للتحديث التلقائي عند رد/رد جديد).
drop policy if exists "tickets_admin_all" on public.support_tickets;
create policy "tickets_admin_all"
  on public.support_tickets for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop trigger if exists update_support_tickets_updated_at on public.support_tickets;
create trigger update_support_tickets_updated_at
  before update on public.support_tickets
  for each row
  execute function public.update_updated_at();

-- ─── رسائل المحادثة ───────────────────────────────────────────────────
create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  sender_type text not null check (sender_type in ('user', 'admin')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_id_idx
  on public.support_ticket_messages (ticket_id, created_at asc);

alter table public.support_ticket_messages enable row level security;

drop policy if exists "ticket_messages_select" on public.support_ticket_messages;
create policy "ticket_messages_select"
  on public.support_ticket_messages for select
  using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );

-- عمداً بلا فحص sender_id/sender_type هنا — القيمتان تُضبَطان قسراً بواسطة
-- handle_new_ticket_message() أدناه (BEFORE INSERT) بصرف النظر عمّا أرسله
-- العميل، فلا يمكن لعميل عادي انتحال sender_type='admin'.
drop policy if exists "ticket_messages_insert" on public.support_ticket_messages;
create policy "ticket_messages_insert"
  on public.support_ticket_messages for insert
  with check (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );

-- ─── ضبط sender تلقائياً + تأثيرات جانبية موثوقة عند كل رسالة ─────────
-- security definer ضروري هنا: التحديث التلقائي لحالة التذكرة والإشعار عند
-- رد الأدمن يتطلبان كتابة على جدولين (support_tickets.status، notifications)
-- لا يملك المستخدم العادي أي سياسة RLS تسمح له بالكتابة عليهما مباشرة —
-- نفس مبدأ handle_new_user() في profiles_and_phone.sql.
create or replace function public.handle_new_ticket_message()
returns trigger as $$
declare
  v_is_admin boolean;
  v_ticket_user_id uuid;
  v_subject text;
  v_ticket_status text;
begin
  v_is_admin := public.is_admin(auth.uid());
  new.sender_id := auth.uid();
  new.sender_type := case when v_is_admin then 'admin' else 'user' end;

  select user_id, subject, status into v_ticket_user_id, v_subject, v_ticket_status
  from public.support_tickets where id = new.ticket_id;

  if v_is_admin then
    update public.support_tickets
      set status = 'answered'
      where id = new.ticket_id;
    -- type='system' (لا 'ticket_reply') عمداً — notifications.type محدود بـ
    -- check constraint موجود أصلاً ('payment','review','reminder','system')؛
    -- تعديله يمسّ جدولاً تعتمد عليه ميزات أخرى، والعنوان/النص هنا كافيان
    -- لتوضيح أنه رد تذكرة بلا حاجة لقيمة type جديدة.
    insert into public.notifications (user_id, type, title, body)
    values (v_ticket_user_id, 'system', 'رد جديد على تذكرة الدعم', v_subject);
  elsif v_ticket_status = 'closed' then
    -- تذكرة مُغلقة والمستخدم كتب فيها مجدداً — أعِد فتحها ليراها الأدمن.
    update public.support_tickets
      set status = 'open'
      where id = new.ticket_id;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_ticket_message_insert on public.support_ticket_messages;
create trigger on_ticket_message_insert
  before insert on public.support_ticket_messages
  for each row
  execute function public.handle_new_ticket_message();

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════
--
-- أ) مستخدم عادي ينشئ تذكرة ويرسل أول رسالة:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<user-auth-uid>"}';
--   insert into public.support_tickets (user_id, subject) values ('<user-auth-uid>', 'تجربة') returning id;
--   insert into public.support_ticket_messages (ticket_id, body) values ('<ticket-id>', 'نص الرسالة');
--   select sender_type from public.support_ticket_messages where ticket_id = '<ticket-id>'; -- يجب 'user'
--   reset role;
--
-- ب) أدمن يرد — يجب أن تتحول الحالة لـ'answered' ويظهر إشعار للمستخدم:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<admin-auth-uid>"}';
--   insert into public.support_ticket_messages (ticket_id, body) values ('<ticket-id>', 'رد الدعم');
--   select status from public.support_tickets where id = '<ticket-id>'; -- 'answered'
--   select * from public.notifications where user_id = '<user-auth-uid>' order by created_at desc limit 1;
--   reset role;
--
-- ج) مستخدم آخر (غير مالك التذكرة) يحاول القراءة/الكتابة — يجب أن يفشل:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<other-user-auth-uid>"}';
--   select * from public.support_tickets where id = '<ticket-id>'; -- صف فارغ (RLS تُخفيه، لا خطأ)
--   insert into public.support_ticket_messages (ticket_id, body) values ('<ticket-id>', 'محاولة'); -- يجب أن يفشل
--   reset role;

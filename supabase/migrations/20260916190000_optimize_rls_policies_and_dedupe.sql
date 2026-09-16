-- ═══════════════════════════════════════════════════════════════════════
-- تحسين أداء RLS + إزالة تكرار حقيقي — دفعة تدقيق بنية تحتية 2026-09-16
--
-- (1) auth.uid()/auth.jwt() غير مُغلَّفة بـ(select ...) في نحو 37 سياسة عبر 16
-- جدولاً — بوستجرس يُعيد تقييمها لكل صف بدل مرة واحدة للاستعلام كامله
-- (auth_rls_initplan، توصية Supabase الرسمية). التغليف لا يغيّر أي سلوك:
-- نفس القيمة تماماً، فقط تُحسَب مرة واحدة لا لكل صف — عبء حقيقي عند نمو عدد
-- المستخدمين، ليس نظرياً.
--
-- (2) 4 سياسات على studies مكرّرة حرفياً منذ إنشائها: اسم قديم (من
-- docs/supabase_setup.sql البدائي) + اسم جديد (studies_*_own من ترحيل لاحق)
-- بنفس الشرط بالضبط، بلا حذف الأول عند إضافة الثاني — إزالة النسخة القديمة
-- فقط، الأحدث تغطي نفس الصلاحية تماماً بالاسم الحالي المستخدَم في كل مكان آخر.
-- باقي حالات "سياسات متعددة" (reviewers/reviews/support_tickets/
-- account_deletion_requests/study_shares) قواعد مختلفة فعلاً (مالك مقابل مدير
-- مقابل مراجع مُعتمَد) — لا تكرار حقيقي، تُركت سياسات منفصلة، فقط غُلِّف
-- auth.uid()/auth.jwt() فيها.
--
-- idempotent (drop if exists) — نفس نمط ترحيلات RLS السابقة في هذا المشروع.
-- مُغلَّف بمعاملة واحدة: فشل أي سطر يُلغي كل التغيير، لا حالة وسط خطرة.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ── studies: حذف 4 سياسات مكرّرة حرفياً (الاسم القديم)، وتغليف الأربع الحالية ──
drop policy if exists "Users can delete own studies" on public.studies;
drop policy if exists "Users can insert own studies" on public.studies;
drop policy if exists "Users can update own studies" on public.studies;
drop policy if exists "Users can view own studies" on public.studies;

drop policy if exists "studies_select_own" on public.studies;
create policy "studies_select_own" on public.studies
    for select using ((select auth.uid()) = user_id);

drop policy if exists "studies_insert_own" on public.studies;
create policy "studies_insert_own" on public.studies
    for insert with check ((select auth.uid()) = user_id);

drop policy if exists "studies_update_own" on public.studies;
create policy "studies_update_own" on public.studies
    for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "studies_delete_own" on public.studies;
create policy "studies_delete_own" on public.studies
    for delete using ((select auth.uid()) = user_id);

-- ── study_shares (نفس سياستَي 20260916000000، مُغلَّفتان الآن) ──
drop policy if exists "Shared users can view their shares" on public.study_shares;
create policy "Shared users can view their shares" on public.study_shares
    for select using (
        shared_with_user_id = (select auth.uid()) or
        shared_with_email = ((select auth.jwt()) ->> 'email')
    );

drop policy if exists "Study owners can manage shares" on public.study_shares;
create policy "Study owners can manage shares" on public.study_shares
    for all using (
        exists (
            select 1 from public.studies
            where id = study_shares.study_id
            and user_id = (select auth.uid())
        )
    );

-- ── study_versions ──
drop policy if exists "Users can manage versions of own studies" on public.study_versions;
create policy "Users can manage versions of own studies" on public.study_versions
    for all using (
        exists (
            select 1 from public.studies
            where id = study_versions.study_id
            and user_id = (select auth.uid())
        )
    );

-- ── orders ──
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
    for select using ((select auth.uid()) = user_id);

-- ── reviewers (سياستان مختلفتان فعلاً: صاحب الحساب نفسه، أو عميل عبر طلب مُعتمَد) ──
drop policy if exists "reviewers_select_own" on public.reviewers;
create policy "reviewers_select_own" on public.reviewers
    for select using ((select auth.uid()) = id);

drop policy if exists "reviewers_select_via_certified_order" on public.reviewers;
create policy "reviewers_select_via_certified_order" on public.reviewers
    for select using (
        exists (
            select 1 from public.orders o
            where o.reviewer_id = reviewers.id
            and o.review_status = 'certified'
            and o.user_id = (select auth.uid())
        )
    );

-- ── admins ──
drop policy if exists "admins_select_own" on public.admins;
create policy "admins_select_own" on public.admins
    for select using ((select auth.uid()) = id);

-- ── reviews (فقط reviews_admin_all مُغلَّفة — reviews_select_published شرطها published=true بلا أي استدعاء auth.*) ──
drop policy if exists "reviews_admin_all" on public.reviews;
create policy "reviews_admin_all" on public.reviews
    for all using (is_admin((select auth.uid()))) with check (is_admin((select auth.uid())));

-- ── notifications ──
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
    for select using ((select auth.uid()) = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
    for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ── export_history ──
drop policy if exists "export_history_select_own" on public.export_history;
create policy "export_history_select_own" on public.export_history
    for select using ((select auth.uid()) = user_id);

drop policy if exists "export_history_insert_own" on public.export_history;
create policy "export_history_insert_own" on public.export_history
    for insert with check ((select auth.uid()) = user_id);

drop policy if exists "export_history_delete_own" on public.export_history;
create policy "export_history_delete_own" on public.export_history
    for delete using ((select auth.uid()) = user_id);

-- ── profiles ──
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
    for select using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
    for update using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
    for insert with check ((select auth.uid()) = id);

-- ── support_tickets (مالك التذكرة مقابل مدير كامل الصلاحية — قاعدتان مختلفتان فعلاً) ──
drop policy if exists "tickets_admin_all" on public.support_tickets;
create policy "tickets_admin_all" on public.support_tickets
    for all using (is_admin((select auth.uid()))) with check (is_admin((select auth.uid())));

drop policy if exists "tickets_insert_own" on public.support_tickets;
create policy "tickets_insert_own" on public.support_tickets
    for insert with check ((select auth.uid()) = user_id);

drop policy if exists "tickets_select_own" on public.support_tickets;
create policy "tickets_select_own" on public.support_tickets
    for select using ((select auth.uid()) = user_id);

-- ── support_ticket_messages ──
drop policy if exists "ticket_messages_select" on public.support_ticket_messages;
create policy "ticket_messages_select" on public.support_ticket_messages
    for select using (
        is_admin((select auth.uid())) or exists (
            select 1 from public.support_tickets t
            where t.id = support_ticket_messages.ticket_id
            and t.user_id = (select auth.uid())
        )
    );

drop policy if exists "ticket_messages_insert" on public.support_ticket_messages;
create policy "ticket_messages_insert" on public.support_ticket_messages
    for insert with check (
        is_admin((select auth.uid())) or exists (
            select 1 from public.support_tickets t
            where t.id = support_ticket_messages.ticket_id
            and t.user_id = (select auth.uid())
        )
    );

-- ── public_applications ──
drop policy if exists "public_applications_admin_select" on public.public_applications;
create policy "public_applications_admin_select" on public.public_applications
    for select using (is_admin((select auth.uid())));

drop policy if exists "public_applications_admin_update" on public.public_applications;
create policy "public_applications_admin_update" on public.public_applications
    for update using (is_admin((select auth.uid()))) with check (is_admin((select auth.uid())));

-- ── wallet_transactions ──
drop policy if exists "wallet_select_own" on public.wallet_transactions;
create policy "wallet_select_own" on public.wallet_transactions
    for select using ((select auth.uid()) = user_id);

-- ── consultation_requests ──
drop policy if exists "consultations_admin_update" on public.consultation_requests;
create policy "consultations_admin_update" on public.consultation_requests
    for update using (is_admin((select auth.uid()))) with check (is_admin((select auth.uid())));

drop policy if exists "consultations_insert_own" on public.consultation_requests;
create policy "consultations_insert_own" on public.consultation_requests
    for insert with check (
        (select auth.uid()) = user_id and status = 'submitted' and payment_status = 'unpaid'
    );

drop policy if exists "consultations_select_own" on public.consultation_requests;
create policy "consultations_select_own" on public.consultation_requests
    for select using ((select auth.uid()) = user_id or is_admin((select auth.uid())));

-- ── account_deletion_requests (طلب المالك مقابل تحديث المدير — قاعدتان مختلفتان فعلاً) ──
drop policy if exists "deletion_select_own" on public.account_deletion_requests;
create policy "deletion_select_own" on public.account_deletion_requests
    for select using ((select auth.uid()) = user_id);

drop policy if exists "deletion_insert_own" on public.account_deletion_requests;
create policy "deletion_insert_own" on public.account_deletion_requests
    for insert with check ((select auth.uid()) = user_id and status = 'requested');

drop policy if exists "deletion_admin_update" on public.account_deletion_requests;
create policy "deletion_admin_update" on public.account_deletion_requests
    for update using (is_admin((select auth.uid()))) with check (is_admin((select auth.uid())));

drop policy if exists "deletion_cancel_own" on public.account_deletion_requests;
create policy "deletion_cancel_own" on public.account_deletion_requests
    for update using ((select auth.uid()) = user_id and status = 'requested')
    with check ((select auth.uid()) = user_id and status = 'cancelled');

commit;

-- اختبار تحقق يدوي (SQL Editor):
--   select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid
--   where c.relname='studies'; -- يجب أن تكون 5 لا 9 (4 محذوفة)
--   select polname, pg_get_expr(polqual, polrelid) from pg_policy
--   where pg_get_expr(polqual, polrelid) like '%auth.uid()%'
--   and pg_get_expr(polqual, polrelid) not like '%(select auth.uid())%';
--   -- يجب أن يرجع صفراً (لا استدعاء auth.uid() غير مُغلَّف متبقٍ)

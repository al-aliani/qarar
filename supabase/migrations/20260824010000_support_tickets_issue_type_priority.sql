-- ═══════════════════════════════════════════════════════════════════════
-- تصنيف نوع المشكلة + أولوية على تذاكر الدعم (2026-08-24)
-- support_tickets.category (20260718010001) لا يصلح لهذا: قيمتاه محصورتان
-- بـ('support', 'funding_introduction') وتُضبطان برمجياً من ShareStudyView.js
-- (مسار توجيه "طلب تعريف تمويل")، وليست تصنيف اهتمام حرّاً يختاره العميل عند
-- فتح تذكرة. عمودان جديدان مستقلّان بدل توسيع الـcheck الحالي، حفاظاً على
-- الشارة الإدارية والاختبارين المعتمدَين على category كما هي
-- (AdminDashboardView.js، TicketService.test.js، shareStudyView.
-- recipientRouting.test.js).
-- ═══════════════════════════════════════════════════════════════════════

alter table public.support_tickets
  add column if not exists issue_type text not null default 'other'
    check (issue_type in ('technical', 'billing', 'content', 'feature_request', 'other'));

alter table public.support_tickets
  add column if not exists priority text not null default 'normal'
    check (priority in ('normal', 'urgent'));

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════
--
-- select issue_type, priority from public.support_tickets limit 1;
--   -- 'other'، 'normal' افتراضياً للصفوف القديمة
-- insert into public.support_tickets (user_id, subject, issue_type, priority)
--   values ('<user-auth-uid>', 'تجربة', 'billing', 'urgent') returning issue_type, priority;
-- insert into public.support_tickets (user_id, subject, issue_type)
--   values ('<user-auth-uid>', 'تجربة قيمة غير صالحة', 'invalid'); -- يجب أن يفشل (check)

-- ═══════════════════════════════════════════════════════════════════════
-- إغلاق ثغرة أمنية حرجة (تدقيق حي 2026-07-22): is_reviewer_of_study لم تكن
-- تتحقق أن orders.study_uuid يخص فعلاً orders.user_id (من دفع ثمن المراجعة).
-- أي مستخدم يعرف UUID دراسة شخص آخر (مثلاً عبر دعوة تعاون بصلاحية 'view' فقط)
-- كان يستطيع دفع باقة 'reviewed' بماله الخاص مستهدفاً تلك الدراسة، فيمنح ذلك
-- أي مراجع نشط يدّعي الطلب قراءة كاملة لبياناتها المالية عبر studies_select_reviewer
-- — رغم أن مالك الدراسة الحقيقي لم يوافق على المراجعة ولم يدفع لها إطلاقاً.
--
-- الإصلاح الأساسي في create-checkout/index.ts يمنع الآن إنشاء طلب كهذا من الأصل
-- (يتحقق studies.user_id = المستخدم المصادَق قبل الإدراج). هذا الترحيل إصلاح
-- دفاع بعمق على مستوى القاعدة نفسها: حتى لو أُدرج صف orders مخالف بأي مسار آخر
-- (كتابة يدوية، خطأ مستقبلي في الكود)، لن تُفتح بيانات الدراسة للمراجع.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.is_reviewer_of_study(target_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.orders o
    join public.reviewers r on r.id = auth.uid() and r.active
    join public.studies s on s.id = o.study_uuid and s.user_id = o.user_id
    where o.study_uuid = target_study_id
      and o.reviewer_id = auth.uid()
      and o.review_status in ('in_review', 'certified')
  );
$$;

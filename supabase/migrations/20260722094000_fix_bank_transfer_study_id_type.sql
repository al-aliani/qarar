-- ═══════════════════════════════════════════════════════════════════════
-- إصلاح عطل حرج (تدقيق حي 2026-07-22): admin_list_pending_bank_transfers
-- تُعلن RETURNS TABLE(..., study_id uuid, ...) وتنضمّ s.id = o.study_id — لكن
-- orders.study_id عمود text (20260709120000_create_orders_payments.sql:15)
-- لا uuid، فالمقارنة/الإسناد uuid↔text يفشل في كل استدعاء. النتيجة: الأدمن لا
-- يستطيع رؤية أي تحويل بنكي معلّق ولا تأكيده من لوحة الإدارة — والتحويل البنكي
-- هو وسيلة الدفع الوحيدة المفعّلة حالياً، فهذا يمنع تأكيد أي عملية دفع فعلية.
--
-- الإصلاح: استخدام study_uuid (عمود مولَّد آمن يحوّل study_id نصياً إلى uuid
-- فقط عند صحة الصيغة، وإلا null — مُعرَّف أصلاً في
-- 20260713000000_reviewer_portal.sql لنفس هذه المشكلة تحديداً) بدل study_id
-- الخام، فلا حاجة لصبّ صريح قد يفشل على قيم نصية غير صالحة.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.admin_list_pending_bank_transfers()
returns table (
  order_id uuid,
  tier text,
  amount_sar numeric,
  study_id uuid,
  study_title text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select o.id, o.tier, coalesce(o.total_sar, o.amount_sar), o.study_uuid, s.title, o.created_at
    from public.orders o
    left join public.studies s on s.id = o.study_uuid
    where o.provider = 'bank_transfer' and o.status = 'pending'
    order by o.created_at desc;
end;
$$;

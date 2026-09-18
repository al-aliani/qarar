-- ══════════════════════════════════════════════════════════════════════════
-- دفع فعلي لطلبات الاستشارة عبر تحويل بنكي يدوي (2026-09-16) — قرار مالك المنتج
-- الصريح: "تصحيح [نص الصفحة] ومن ثم دفع فعلي". قبل هذا التغيير: consultation_requests
-- تُدرَج بحالة unpaid ولا يوجد أي مسار لتحصيل المبلغ الفعلي — نفس آلية التحويل
-- البنكي اليدوي المستخدمة أصلاً للاشتراكات (20260721150000_bank_transfer.sql)،
-- لكن على جدول consultation_requests بدل orders (منتج منفصل تماماً، لا صلة له
-- بمعرّفات tier/study_id الخاصة بالاشتراكات).
-- ══════════════════════════════════════════════════════════════════════════

-- سجلّ محاسبي لوقت تأكيد الدفع تحديداً (لا نعتمد على updated_at العام: أي تعديل
-- إداري آخر لاحق يُحرّكه، فيضيع تاريخ الدفع الفعلي — نفس سبب وجود orders.paid_at).
alter table public.consultation_requests add column if not exists paid_at timestamptz;

-- تأكيد تحويل بنكي يدوياً — أدمن فقط. يحوّل payment_status من unpaid إلى paid،
-- ويضبط paid_at، ويُشعِر صاحب الطلب داخل الموقع (نفس نمط admin_confirm_bank_transfer
-- بعد 20260827000000_bank_transfer_payment_notification.sql).
create or replace function public.admin_confirm_consultation_bank_transfer(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_study_id text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  update public.consultation_requests
    set payment_status = 'paid', paid_at = now()
    where id = target_request_id
      and payment_status = 'unpaid'
    returning user_id, study_id into v_user_id, v_study_id;

  if not found then
    raise exception 'no matching unpaid consultation request';
  end if;

  -- إعلام العميل بنجاح الدفع — مُغلَّفة بمعالج استثناء عمداً: فشل إدراج إشعار لا
  -- يجوز أن يُسقط تأكيد الدفع نفسه (الجزء الحرج أعلاه نجح فعلاً).
  begin
    insert into public.notifications (user_id, type, title, body, study_id)
    values (v_user_id, 'payment', 'تم تأكيد دفعتك', 'وصلتنا دفعة طلب الاستشارة بنجاح، وسيتواصل معك فريقنا لتحديد الموعد.', v_study_id);
  exception when others then
    raise warning 'admin_confirm_consultation_bank_transfer: فشل إدراج إشعار الدفع لطلب %: %', target_request_id, sqlerrm;
  end;
end;
$$;

grant execute on function public.admin_confirm_consultation_bank_transfer(uuid) to authenticated;

-- سرد طلبات الاستشارة غير المدفوعة للأدمن (لوحة الإدارة بدل SQL يدوي).
create or replace function public.admin_list_pending_consultation_bank_transfers()
returns table (
  request_id uuid,
  consultant_level text,
  specialty text,
  sector text,
  amount_sar numeric,
  study_id text,
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
    select cr.id, cr.consultant_level, cr.specialty, cr.sector, cr.amount_sar, cr.study_id, cr.created_at
    from public.consultation_requests cr
    where cr.payment_status = 'unpaid'
    order by cr.created_at desc;
end;
$$;

grant execute on function public.admin_list_pending_consultation_bank_transfers() to authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (SQL Editor):
--   -- أدمن يؤكّد طلب استشارة (يجب أن ينجح، ويُدرج إشعاراً):
--   select public.admin_confirm_consultation_bank_transfer('<request-uuid>');
--   select * from public.notifications where type = 'payment' order by created_at desc limit 5;
--   -- غير أدمن (يجب أن يفشل بـ not authorized).
--   -- إعادة تأكيد نفس الطلب مرة ثانية (يجب أن يفشل بـ no matching unpaid consultation request).
-- ══════════════════════════════════════════════════════════════════════════

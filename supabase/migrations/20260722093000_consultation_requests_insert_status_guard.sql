-- ═══════════════════════════════════════════════════════════════════════
-- إغلاق ثغرة (تدقيق حي 2026-07-22): سياسة consultations_insert_own كانت تتحقق
-- فقط من auth.uid()=user_id بلا قيد على status/payment_status — أي مستخدم
-- يستطيع إدراج طلب استشارة بنفسه عبر REST مباشر بحالة 'completed'/'paid' منذ
-- البداية (بخلاف consultations_admin_update المقيَّدة بالأدمن، فالتزوير هنا يقع
-- عند الإدراج لا التحديث). يطابق الآن نمط public_applications/
-- account_deletion_requests اللذين يفرضان صراحة قيمة الحالة الابتدائية.
-- ═══════════════════════════════════════════════════════════════════════

drop policy if exists "consultations_insert_own" on public.consultation_requests;
create policy "consultations_insert_own"
  on public.consultation_requests for insert
  with check (
    auth.uid() = user_id
    and status = 'submitted'
    and payment_status = 'unpaid'
  );

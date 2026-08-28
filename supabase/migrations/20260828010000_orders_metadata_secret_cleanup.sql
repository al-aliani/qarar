-- ═══════════════════════════════════════════════════════════════════════
-- تدقيق أمني 2026-08-28 (بعد إعادة تقييم الطبقات الـ16): webhook-moyasar كان
-- يخزّن جسم Moyasar الخام في orders.metadata — بما فيه secret_token (نفس السرّ
-- المشترك الذي يتحقق منه verifyMoyasarSecretToken). سياسة orders_select_own
-- تقيّد الصفوف لا الأعمدة، فصاحب الطلب يقرأ عمود metadata كاملاً. انظر إصلاح
-- الكود المقابل في supabase/functions/webhook-moyasar/index.ts (وwebhook-stripe/
-- webhook-tamara اتساقاً، رغم أن مصدر سرّهما رأس HTTP منفصل لا الجسم).
--
-- هذا الترحيل احترازي بحت: يُفرِّغ metadata لأي صف orders مصدره Moyasar فعلاً
-- (provider='moyasar') احتياطاً لاحتمال وصول حدث paid واحد فعلي قبل هذا الإصلاح
-- (نموذج bank_transfer هو مسار الدفع الوحيد المُفعَّل حالياً في الواجهة — التكلفة
-- شبه معدومة لكن التنظيف آمن ورخيص). لا يمسّ status/paid_at/أي عمود آخر.
-- ═══════════════════════════════════════════════════════════════════════

update public.orders
set metadata = '{}'::jsonb
where provider = 'moyasar' and metadata is distinct from '{}'::jsonb;

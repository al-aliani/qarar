-- ============================================================
-- إصلاح: إضافة عمود data لجدول studies (لحفظ محتوى الدراسة)
-- ============================================================
-- إذا ظهر الخطأ: "Could not find the 'data' column of 'studies'"
-- نفّذ هذا السكربت في Supabase: SQL Editor → New query → الصق → Run
-- ============================================================

-- إضافة عمود data إن لم يكن موجوداً (JSONB لمحتوى الدراسة الكامل)
ALTER TABLE public.studies
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';

-- إن كان الجدول يستخدم owner_id بدلاً من user_id، أضف user_id للتوافق مع التطبيق (اختياري)
-- ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
-- UPDATE public.studies SET user_id = owner_id WHERE user_id IS NULL AND owner_id IS NOT NULL;

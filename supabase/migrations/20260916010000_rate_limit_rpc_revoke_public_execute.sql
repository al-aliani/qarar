-- ══════════════════════════════════════════════════════════════════════════
-- سحب صلاحية تنفيذ check_and_record_rate_limit/check_and_record_anon_rate_limit
-- من anon/authenticated فعلياً (تدقيق شامل 2026-09-16، يُصحّح افتراضاً خاطئاً في
-- 20260829030000_atomic_rate_limit_functions.sql): ذلك الترحيل افترض أن غياب أي
-- عبارة GRANT EXECUTE صريحة كافٍ لمنع anon/authenticated من التنفيذ — لكن التحقق
-- الحي الفعلي (get_advisors + استعلام pg_proc.proacl مباشرة على قاعدة الإنتاج)
-- أثبت العكس: كلا الدالتين موجودتان بالفعل في ACL كـ`anon=X/postgres` و
-- `authenticated=X/postgres` صريحين — على الأرجح عبر ALTER DEFAULT PRIVILEGES
-- الذي يضبطه Supabase افتراضياً على مستوى المشروع نفسه (خارج أي ملف ترحيل نتتبّعه
-- هنا)، لا عبر PUBLIC وحدها. النتيجة: أي حامل مفتاح anon (بلا تسجيل دخول) يقدر
-- يستدعي الدالة بمعرّف مستخدم ضحية معروف/مُخمَّن واسم endpoint حقيقي (مثل
-- 'create-checkout') مع p_max_requests كبير، فيُدرَج صفّ باسم الضحية في
-- rate_limit_events ويُستهلَك حصته الفعلية — حجب خدمة مستهدف على الدفع واسترداد
-- 2FA. طبقة RLS رفض-افتراضي على rate_limit_events/anon_endpoint_hits (الموثَّقة
-- في نفس الترحيل القديم كـ"طبقة ثانية") **لا تحمي من هذا المسار إطلاقاً** —
-- كلتا الدالتين SECURITY DEFINER فتنفّذان بصلاحية المالك (تتجاوز RLS بنيوياً)
-- بصرف النظر عمّن استدعاها؛ RLS يحمي فقط من وصول مباشر للجدولين خارج الدالتين،
-- وهو ليس مسار الاستغلال هنا. الإصلاح الفعلي الوحيد هو صلاحية EXECUTE نفسها.
--
-- تحقّق مسبق (SQL Editor) قبل الاعتماد على هذا الترحيل: service_role يملك grant
-- صريحاً منفصلاً (لا عبر PUBLIC وحدها) على كلتا الدالتين — مؤكَّد حياً عبر
-- pg_proc.proacl = '{=X/postgres,postgres=X/postgres,anon=X/postgres,
-- authenticated=X/postgres,service_role=X/postgres}' — فسحب PUBLIC/anon/
-- authenticated أدناه لا يمسّ service_role (المستدعي الفعلي الوحيد، عبر
-- adminClient في create-checkout/mfa-recovery-generate/mfa-recovery-unenroll/
-- places-nearby/check-name-availability/submit-application — كلها تستدعيان عبر
-- عميل service_role لا عميل المستخدم، انظر _shared/rateLimit.ts).
-- ══════════════════════════════════════════════════════════════════════════

revoke execute on function public.check_and_record_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.check_and_record_anon_rate_limit(text, text, integer, integer) from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (SQL Editor):
--   select has_function_privilege('anon', 'public.check_and_record_rate_limit(uuid,text,integer,integer)', 'execute'); -- false
--   select has_function_privilege('authenticated', 'public.check_and_record_rate_limit(uuid,text,integer,integer)', 'execute'); -- false
--   select has_function_privilege('service_role', 'public.check_and_record_rate_limit(uuid,text,integer,integer)', 'execute'); -- true (لم يتأثر)
--   -- ونظيرتها الثلاثة لـcheck_and_record_anon_rate_limit(text,text,integer,integer)
-- ══════════════════════════════════════════════════════════════════════════

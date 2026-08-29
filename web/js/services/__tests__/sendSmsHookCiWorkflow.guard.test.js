/**
 * تدقيق 2026-08-29: حارس تهيئة .github/workflows/supabase-functions-deploy.yml —
 * نفس مبدأ mfaRecoveryCiWorkflow.guard.test.js/whatsappOtpCiWorkflow.guard.test.js.
 * send-sms-hook كانت مبنيّة بالكود منذ 2026-07-17 (تسليم رمز الدخول عبر واتساب
 * لـSupabase Send SMS Hook) لكن غائبة عن هذه الورشة كلياً — نفس فئة الخلل التي
 * أصابت reviewer-queue/health سابقاً حسب تعليقات الملف نفسه.
 *
 * بخلاف whatsapp-otp-send/verify (تُستدعيان من متصفح مستخدم مسجَّل)، المستدعي
 * الفعلي لـsend-sms-hook هو خدمة Supabase Auth (GoTrue) نفسها — لا يصل أي JWT
 * مستخدم إطلاقاً، والتحقق الحقيقي توقيع Standard Webhooks عبر SEND_SMS_HOOK_SECRET
 * (verifyStandardWebhookSignature، مُختبَر في sendSmsHookVerify.test.js)، تماماً
 * كنمط webhook-moyasar/webhook-stripe/webhook-tamara — فيجب أن تُنشَر بـ
 * --no-verify-jwt.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workflowPath = join(__dirname, '../../../../.github/workflows/supabase-functions-deploy.yml');

describe('CI: نشر send-sms-hook (تسليم رمز الدخول عبر واتساب)', () => {
    it('ملف workflow النشر موجود فعلياً', () => {
        expect(existsSync(workflowPath)).toBe(true);
    });

    it('send-sms-hook مذكورة فعلياً في خطوة نشر (لم تُنسَ من workflow)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        const line = src.split('\n').find((l) => l.includes('functions deploy send-sms-hook'));
        expect(line, 'سطر نشر send-sms-hook غير موجود في workflow النشر').toBeTruthy();
    });

    it('تُنشَر بـ --no-verify-jwt (المستدعي خدمة Supabase Auth نفسها لا متصفح مستخدم — لا JWT مستخدم يصل إطلاقاً)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        const line = src.split('\n').find((l) => l.includes('functions deploy send-sms-hook'));
        expect(line).toContain('--no-verify-jwt');
    });

    it('سرّ SEND_SMS_HOOK_SECRET مذكور صراحة (يُدفع من GitHub Secrets لا يُكتب كقيمة حرفية)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        expect(src, 'السرّ SEND_SMS_HOOK_SECRET غير مذكور في workflow النشر').toContain('SEND_SMS_HOOK_SECRET');
    });

    it('SEND_SMS_HOOK_SECRET مذكور ضمن مصفوفة دفع الأسرار (Push payment provider secrets) لا في تعليق فقط', () => {
        const src = readFileSync(workflowPath, 'utf8');
        const arrayLine = src.split('\n').find((l) => l.includes('[SEND_SMS_HOOK_SECRET]='));
        expect(arrayLine, 'السرّ غير موجود داخل declare -A SECRET_VALUES').toBeTruthy();
        expect(arrayLine).toContain('${{ secrets.SEND_SMS_HOOK_SECRET }}');
    });
});

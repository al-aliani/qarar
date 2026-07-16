/**
 * تدقيق 2026-07-17 (تحقق واتساب حقيقي عند التسجيل): حارس تهيئة
 * .github/workflows/supabase-functions-deploy.yml — نفس مبدأ
 * paymentCiWorkflow.guard.test.js. whatsapp-otp-send/verify تحتاجان مستخدماً
 * حقيقياً (تُستدعيان من متصفح مستخدم مسجَّل عبر supabase.functions.invoke)،
 * فيجب أن تُنشَرا بلا --no-verify-jwt — بخلاف webhook-* (مزوّدون خارجيون).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workflowPath = join(__dirname, '../../../../.github/workflows/supabase-functions-deploy.yml');

describe('CI: نشر دوال تحقق واتساب', () => {
    it('ملف workflow النشر موجود فعلياً', () => {
        expect(existsSync(workflowPath)).toBe(true);
    });

    it('whatsapp-otp-send وwhatsapp-otp-verify يُنشَران بلا --no-verify-jwt (يتطلبان مستخدماً حقيقياً)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        const sendLine = src.split('\n').find((l) => l.includes('functions deploy whatsapp-otp-send'));
        const verifyLine = src.split('\n').find((l) => l.includes('functions deploy whatsapp-otp-verify'));
        expect(sendLine, 'سطر نشر whatsapp-otp-send غير موجود').toBeTruthy();
        expect(verifyLine, 'سطر نشر whatsapp-otp-verify غير موجود').toBeTruthy();
        expect(sendLine).not.toContain('--no-verify-jwt');
        expect(verifyLine).not.toContain('--no-verify-jwt');
    });

    it('كل أسرار واتساب الخمسة مذكورة صراحة (تُدفع من GitHub Secrets لا تُكتب كقيم حرفية)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        [
            'WHATSAPP_ACCESS_TOKEN',
            'WHATSAPP_PHONE_NUMBER_ID',
            'WHATSAPP_TEMPLATE_NAME',
            'WHATSAPP_TEMPLATE_LANG',
            'OTP_HASH_SECRET',
        ].forEach((key) => {
            expect(src, `السرّ ${key} غير مذكور في workflow النشر`).toContain(key);
        });
    });

    it('لا قيمة سرّ حرفية مكتوبة مباشرة في الملف (كل شيء عبر ${{ secrets.* }})', () => {
        const src = readFileSync(workflowPath, 'utf8');
        expect(src).not.toMatch(/EAA[A-Za-z0-9]{20,}/); // نمط شائع لتوكنات وصول ميتا الحقيقية
    });
});

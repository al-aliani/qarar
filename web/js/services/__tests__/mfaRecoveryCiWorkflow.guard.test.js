/**
 * تدقيق 2026-08-24 (رموز استرداد 2FA): حارس تهيئة
 * .github/workflows/supabase-functions-deploy.yml — نفس مبدأ
 * whatsappOtpCiWorkflow.guard.test.js. mfa-recovery-generate/mfa-recovery-unenroll
 * تحتاجان مستخدماً حقيقياً (تُستدعيان من متصفح مستخدم مسجَّل عبر
 * supabase.functions.invoke)، فيجب أن تُنشَرا بلا --no-verify-jwt.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workflowPath = join(__dirname, '../../../../.github/workflows/supabase-functions-deploy.yml');

describe('CI: نشر دوال رموز استرداد 2FA', () => {
    it('ملف workflow النشر موجود فعلياً', () => {
        expect(existsSync(workflowPath)).toBe(true);
    });

    it('mfa-recovery-generate وmfa-recovery-unenroll يُنشَران بلا --no-verify-jwt (يتطلبان مستخدماً حقيقياً)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        const generateLine = src.split('\n').find((l) => l.includes('functions deploy mfa-recovery-generate'));
        const unenrollLine = src.split('\n').find((l) => l.includes('functions deploy mfa-recovery-unenroll'));
        expect(generateLine, 'سطر نشر mfa-recovery-generate غير موجود').toBeTruthy();
        expect(unenrollLine, 'سطر نشر mfa-recovery-unenroll غير موجود').toBeTruthy();
        expect(generateLine).not.toContain('--no-verify-jwt');
        expect(unenrollLine).not.toContain('--no-verify-jwt');
    });

    it('سرّ RECOVERY_CODE_HASH_SECRET مذكور صراحة (يُدفع من GitHub Secrets لا يُكتب كقيمة حرفية)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        expect(src, 'السرّ RECOVERY_CODE_HASH_SECRET غير مذكور في workflow النشر').toContain('RECOVERY_CODE_HASH_SECRET');
    });

    it('RECOVERY_CODE_HASH_SECRET منفصل عن OTP_HASH_SECRET في مصفوفة دفع الأسرار (سرّان مختلفان لا سرّ مشترك)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        const otpLine = src.split('\n').find((l) => l.includes('[OTP_HASH_SECRET]='));
        const recoveryLine = src.split('\n').find((l) => l.includes('[RECOVERY_CODE_HASH_SECRET]='));
        expect(otpLine).toBeTruthy();
        expect(recoveryLine).toBeTruthy();
        expect(recoveryLine).not.toBe(otpLine);
    });
});

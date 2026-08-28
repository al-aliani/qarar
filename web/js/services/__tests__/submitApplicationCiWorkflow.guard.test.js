/**
 * دفعة 3 من خطة إغلاق فجوات الطبقات الـ16 (2026-08-27، Rate limiting):
 * نفس مبدأ mfaRecoveryCiWorkflow.guard.test.js — دالة جديدة (submit-application)
 * لا قيمة لها إن نُسيت من ملف نشر workflow (يبقى الكود في المستودع بلا أثر
 * على الإنتاج الحي؛ سبق أن حدث هذا فعلياً لـreviewer-* وhealth حسب تعليقات
 * الملف نفسه — 404 حيّ لأسابيع رغم وجود الكود).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workflowPath = join(__dirname, '../../../../.github/workflows/supabase-functions-deploy.yml');

describe('CI: نشر submit-application (نموذج انضمام خبير/مورّد العام)', () => {
    it('ملف workflow النشر موجود فعلياً', () => {
        expect(existsSync(workflowPath)).toBe(true);
    });

    it('submit-application مذكورة فعلياً في خطوة نشر (لم تُنسَ من workflow)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        const line = src.split('\n').find((l) => l.includes('functions deploy submit-application'));
        expect(line, 'سطر نشر submit-application غير موجود في workflow النشر').toBeTruthy();
    });

    it('تُنشَر بلا --no-verify-jwt (مفتاح anon نفسه JWT صالح يجتاز تحقق المنصة الافتراضي — الحماية الحقيقية حدّ IP وhoneypot داخل الدالة)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        const line = src.split('\n').find((l) => l.includes('functions deploy submit-application'));
        expect(line).not.toContain('--no-verify-jwt');
    });
});

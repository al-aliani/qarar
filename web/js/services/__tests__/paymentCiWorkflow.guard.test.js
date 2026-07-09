/**
 * تدقيق 2026-07-09 (أتمتة الدفع): حارس تهيئة .github/workflows/supabase-functions-deploy.yml —
 * تفصيل أمني حرج: create-checkout يجب أن يبقى محمياً بتحقق JWT الافتراضي لمنصة
 * Supabase (يُستدعى من مستخدم مسجَّل حصراً)، بينما webhook-moyasar/webhook-stripe
 * يجب أن يُنشرا بـ --no-verify-jwt (مزوّدو الدفع خدمتان خارجيتان لا ترسلان أي JWT
 * مستخدم — التحقق الحقيقي لهما هو توقيع/سرّ الـwebhook نفسه). عكس أيٍّ من هذين
 * الشرطين بالخطأ يعطّل الدفع بالكامل (JWT مفروض على webhook) أو يُفقد الحماية.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workflowPath = join(__dirname, '../../../../.github/workflows/supabase-functions-deploy.yml');

describe('CI: نشر Edge Functions الخاصة بالدفع', () => {
    it('ملف workflow النشر موجود فعلياً', () => {
        expect(existsSync(workflowPath)).toBe(true);
    });

    it('create-checkout يُنشَر بلا --no-verify-jwt (يبقى محمياً بمصادقة Supabase)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        const line = src.split('\n').find((l) => l.includes('functions deploy create-checkout'));
        expect(line, 'سطر نشر create-checkout غير موجود').toBeTruthy();
        expect(line).not.toContain('--no-verify-jwt');
    });

    it('webhook-moyasar وwebhook-stripe يُنشَران بـ --no-verify-jwt (مزوّدو دفع خارجيون لا يرسلون JWT)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        const moyasarLine = src.split('\n').find((l) => l.includes('functions deploy webhook-moyasar'));
        const stripeLine = src.split('\n').find((l) => l.includes('functions deploy webhook-stripe'));
        expect(moyasarLine).toContain('--no-verify-jwt');
        expect(stripeLine).toContain('--no-verify-jwt');
    });

    it('كل أسرار مزوّدي الدفع الأربعة مذكورة صراحة (تُدفع من GitHub Secrets لا تُكتب كقيم حرفية)', () => {
        const src = readFileSync(workflowPath, 'utf8');
        ['MOYASAR_SECRET_KEY', 'MOYASAR_WEBHOOK_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'].forEach((key) => {
            expect(src, `السرّ ${key} غير مذكور في workflow النشر`).toContain(key);
        });
    });

    it('لا قيمة سرّ حرفية مكتوبة مباشرة في الملف (كل شيء عبر ${{ secrets.* }})', () => {
        const src = readFileSync(workflowPath, 'utf8');
        // بحث تقريبي عن أنماط مفاتيح API شائعة قد تُكتب بالخطأ حرفياً (sk_live/sk_test/pk_)
        expect(src).not.toMatch(/sk_(live|test)_[A-Za-z0-9]{10,}/);
    });
});

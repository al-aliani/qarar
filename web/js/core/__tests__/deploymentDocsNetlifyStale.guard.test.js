/**
 * دفعة 8 (2026-08-27، تنظيف توثيقي): netlify.toml حُذف نهائياً بتاريخ 2026-07-22
 * (commit c05fbfc، وصفه بنفسه "ملف يتيم" — لا نشر فعلي عبر Netlify)، لكن
 * docs/النشر_والتوزيع.md ظل يدّعي (جدول "ملخص المعايير") أن الملف "موجود في
 * جذر المشروع ✅" — ادّعاء زائف قابل للتحقق فوراً بمجرد فتح جذر المستودع.
 * Vercel هي منصة الاستضافة الفعلية الوحيدة الآن.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');

describe('توثيق النشر لا يدّعي وجود netlify.toml بعد حذفه فعلياً', () => {
    it('netlify.toml فعلاً غير موجود في جذر المستودع (يثبّت صحة الفرضية قبل فحص التوثيق)', () => {
        expect(existsSync(resolve(REPO_ROOT, 'netlify.toml'))).toBe(false);
    });

    it('docs/النشر_والتوزيع.md لا يدّعي وجود netlify.toml، ويوضّح Vercel كالمنصة الوحيدة', () => {
        const content = readFileSync(resolve(REPO_ROOT, 'docs/النشر_والتوزيع.md'), 'utf8');
        expect(content).not.toMatch(/`netlify\.toml`\s*\|\s*Netlify/); // صف الجدول الزائف السابق
        expect(content).not.toMatch(/npx netlify deploy/); // أمر نشر لمنصة غير مستخدَمة فعلياً
        expect(content).toMatch(/netlify\.toml[\s\S]*?أُزيل/); // يوثّق الإزالة بدل حذف كل أثر تاريخي (نص متعدد الأسطر)
        expect(content).toMatch(/# النشر والتوزيع — Vercel\s*$/m);
    });

    it('docs/Load_Balancing_CDN.md: الادّعاء المحدد عن استضافة الواجهة الفعلية يعكس Vercel فقط', () => {
        // normalize('NFC') يوحّد ترتيب الحروف المركَّبة العربية (تشكيل) قبل المطابقة —
        // نفس النص المرئي يمكن تخزينه بترتيب Unicode مختلف للحركات المركَّبة.
        const content = readFileSync(resolve(REPO_ROOT, 'docs/Load_Balancing_CDN.md'), 'utf8').normalize('NFC');
        expect(content).toContain('(Vercel حالياً'.normalize('NFC'));
        expect(content).not.toContain('(Vercel/Netlify)'.normalize('NFC'));
    });

    it('[إثبات الحارس] العطل الأصلي: لو عاد أي من الصفّين الحرفيين القديمين فعلياً إلى docs/النشر_والتوزيع.md، هذا يفشل', () => {
        // نصوص الادّعاء الزائف الحرفية التي كانت قائمة فعلاً قبل هذا الإصلاح (من كلا
        // الجدولين: ملفات النشر الجاهزة، وملخص المعايير). الفحص هنا ليس خاصية للنص
        // نفسه، بل تحقّق فعلي من غيابه في الملف الحقيقي على القرص الآن.
        const oldSection1Row = '| `netlify.toml` | Netlify | ربط المستودع من لوحة Netlify |';
        const oldSummaryRow = '| netlify.toml | ✅ | `netlify.toml` في جذر المشروع |';
        const content = readFileSync(resolve(REPO_ROOT, 'docs/النشر_والتوزيع.md'), 'utf8');
        expect(content).not.toContain(oldSection1Row);
        expect(content).not.toContain(oldSummaryRow);
    });
});

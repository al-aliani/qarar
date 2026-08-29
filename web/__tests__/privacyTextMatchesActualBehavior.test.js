/**
 * دفعة 4 من خطة إغلاق فجوات الطبقات الـ16 (2026-08-27، طبقة Compliance &
 * Legal). لوحة تقييم سابقة اليوم وجدت 3 ادّعاءات في privacy.html/
 * data-retention.html تناقض السلوك الفعلي للكود:
 *
 * 1) "لا نحتفظ بنسخة من ملفات التصدير" — يناقضه web/export/exportTracking.js
 *    الذي يرفع فعلاً نسخ Excel/Word/PowerPoint إلى Supabase Storage (وميزة
 *    كاملة "مركز التنزيلات" لإعادة تنزيلها). صحيح فقط لـPDF/JSON.
 * 2) "أحداث استخدام مجهّلة" — يناقضه track_event الذي يُدرِج auth.uid()
 *    الحقيقي حين يكون المستخدم مسجَّل الدخول (معرَّفة لا مجهَّلة).
 * 3) "نحذف... من نظامنا السحابي" عند طلب حذف الحساب — يناقضه أن الطلب
 *    اليوم إجراء يدوي يعالجه الفريق (requestAccountDeletion) لا حذفاً
 *    آلياً فورياً.
 *
 * هذا الاختبار يثبّت أن النص المصحَّح يعكس الواقع، ولا يعيد الادّعاءات
 * الخاطئة الأصلية.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const privacyHtml = readFileSync(resolve(__dirname, '../privacy.html'), 'utf8');
const retentionHtml = readFileSync(resolve(__dirname, '../data-retention.html'), 'utf8');
const exportTrackingSrc = readFileSync(resolve(__dirname, '../export/exportTracking.js'), 'utf8');

describe('privacy.html / data-retention.html — النص يطابق الواقع الفعلي للكود', () => {
    it('لا يدّعي أن كل ملفات التصدير بلا نسخة سحابية (Excel/Word/PowerPoint لها نسخة فعلياً)', () => {
        for (const html of [privacyHtml, retentionHtml]) {
            expect(html).not.toMatch(/ملفات التصدير[\s\S]{0,200}لا نحتفظ بنسخة/);
        }
    });

    it('يذكر صراحة أن Excel/Word/PowerPoint تُحفظ نسخة منها في مركز التنزيلات', () => {
        for (const html of [privacyHtml, retentionHtml]) {
            expect(html).toContain('مركز التنزيلات');
            expect(html).toMatch(/Excel وWord وPowerPoint[\s\S]{0,60}تُحفظ نسخة/);
        }
    });

    it('لا يصف أحداث التحليلات بـ"مجهّلة" (auth.uid() الحقيقي يُدرَج فعلياً للمستخدم المسجَّل)', () => {
        expect(privacyHtml).not.toMatch(/أحداث استخدام مجهّلة/);
    });

    it('يوضّح أن أحداث المستخدم المسجَّل تُربط بحسابه لا بمعرّف مجهول', () => {
        expect(privacyHtml).toMatch(/إذا كنت مسجّلاً الدخول[\s\S]{0,40}تُربط هذه الأحداث بحسابك/);
    });

    it('لا يعد بحذف فوري آلي عند "إغلاق الحساب أو طلب حذفه" — التسجيل فوري، الحذف الفعلي يدوي لاحق بلا مدة مضمونة', () => {
        // مراجعة عدائية 2026-08-27 وجدت أن الصياغة الأولى ("يراجع فريقنا الطلب ويعمل
        // على حذف...") لا تزال مبالغة — requestAccountDeletion() يكتب صفاً واحداً فقط
        // (status='requested')، بلا أي واجهة أدمن أو كود معالجة موثَّق. هذا بالضبط
        // الفخّ الذي حذّرت منه لجنة الصباح نفسها (DECISIONS.md بند 4): "تحسين رسائل
        // الطمأنة بلا بناء التنفيذ الفعلي خلفها يُضاعف فجوة الصدق". الصياغة النهائية
        // لا تدّعي مراجعة فعلية، فقط تسجيلاً فورياً + حذفاً يدوياً لاحقاً بلا مدة مضمونة.
        expect(retentionHtml).not.toMatch(/عند إغلاق الحساب أو طلب حذفه، نحذف/);
        expect(retentionHtml).not.toMatch(/يراجع فريقنا الطلب ويعمل على حذف/);
        expect(retentionHtml).toMatch(/تقديم طلب حذف الحساب يُسجَّل في نظامنا فوراً/);
        expect(retentionHtml).toMatch(/لا نضمن حالياً مدة زمنية محددة/);
    });

    it('نفس التصحيح مطبَّق في privacy.html §5 "حقوقك" أيضاً — كانت تحمل نفس الادّعاء الخاطئ بصياغة مستقلة فاتت المراجعة الأولى', () => {
        expect(privacyHtml).not.toMatch(/التواصل معنا لحذف حسابك ودراساتك والملفات\s*\n?\s*المرتبطة بها من نظامنا السحابي\./);
        expect(privacyHtml).toMatch(/التواصل معنا لطلب حذف حسابك/);
        expect(privacyHtml).toMatch(/يُسجَّل طلبك فوراً/);
        expect(privacyHtml).toMatch(/بلا مدة زمنية مضمونة حالياً/);
    });

    it('لا يعد بحذف ملفات التصدير "بنفسك" بهذه الصياغة تحديداً — لا ادّعاء غير مُقرّ به في النص الحالي', () => {
        // تحديث 2026-08-29: ميزة حذف ملف تصدير واحد (export_history + bucket
        // exports) دُمجت فعلياً (PR #26، fix/export-delete-2026-08-27) وهي حيّة
        // على main اليوم — الفرضية الأصلية هنا ("لم يُدمَج بعد") لم تعد صحيحة.
        // النص القانوني نفسه مع ذلك لا يذكر هذه الصياغة أصلاً (لا وعداً ولا نفياً)،
        // فلا تصحيح واقعي مطلوب على privacy.html/data-retention.html — هذا الفحص
        // يبقى حارساً عاماً ضد إضافة ادّعاء بهذه الصياغة تحديداً بلا مراجعة مقصودة.
        for (const html of [privacyHtml, retentionHtml]) {
            expect(html).not.toMatch(/حذفها نهائياً بنفسك/);
        }
    });

    it('لا يبالغ في "لا يُربط أي حدث بهويتهم" للزوار غير المسجَّلين — session_id شبه-معرِّف فعلي للزيارة الواحدة', () => {
        expect(privacyHtml).not.toMatch(/زوّار المنصة غير المسجَّلين لا يُربط أي حدث بهويتهم\./);
        expect(privacyHtml).toMatch(/لا يُربط أي حدث باسمهم أو حسابهم/);
        expect(privacyHtml).toMatch(/معرّف جلسة مؤقتاً/);
    });

    it('exportTracking.js يؤكد فعلياً أن Excel/Word/PPTX تُرفَع لـSupabase Storage (النص المصحَّح يعكس هذا لا يخترعه)', () => {
        expect(exportTrackingSrc).toMatch(/Storage|storage/);
    });

    it('كلا الملفين يحملان تاريخ تحديث أغسطس 2026 (لا يوليو القديم)', () => {
        expect(privacyHtml).toContain('آخر تحديث: أغسطس 2026');
        expect(retentionHtml).toContain('آخر تحديث: أغسطس 2026');
    });

    it('[إثبات الحارس] الادّعاء الأصلي الخاطئ (لو أُعيد حرفياً) كان سيجتاز الفحص العام — يثبت أن الفحص أعلاه فعلاً يكتشف هذا النمط', () => {
        const originalFalseClaim = 'ملفات التصدير (PDF وExcel وWord وPowerPoint وJSON) تُنشأ داخل متصفحك وتُنزَّل مباشرة على جهازك — لا نحتفظ بنسخة منها على خوادمنا.';
        expect(originalFalseClaim).toMatch(/ملفات التصدير[\s\S]{0,200}لا نحتفظ بنسخة/);
        expect(privacyHtml).not.toMatch(/ملفات التصدير[\s\S]{0,200}لا نحتفظ بنسخة/);
    });
});

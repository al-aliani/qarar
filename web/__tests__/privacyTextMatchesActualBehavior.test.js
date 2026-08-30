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

    it('لا يعد بمهلة تنفيذ محددة (خلال 7-8 أيام) لحذف الحساب — الآلية المحدِّدة لهذا الرقم (process-account-deletions المجدولة) مؤكَّدة معطَّلة صمتاً (لا SUPABASE_URL ولا ACCOUNT_DELETION_CRON_SECRET مضبوطان في أسرار المستودع)، فالوعد بالرقم كان سيكون كذباً قانونياً لعملاء حقيقيين', () => {
        // تصحيح 2026-08-30 (مراجعة عدائية لـ#57، بقرار مالك صريح): وعد "خلال 7-8
        // أيام" الذي أضافه #57 صادق فقط إذا كانت process-account-deletions تعمل
        // فعلاً. تحقّقنا مباشرة عبر `gh secret list`/`gh variable list` على
        // al-aliani/qarar: كلا السرّين الضروريين (SUPABASE_URL،
        // ACCOUNT_DELETION_CRON_SECRET) غائبان — أي أن التشغيلة اليومية المجدولة
        // تتخطّى نفسها صمتاً كل يوم منذ الدمج (skip، لا فشل). النص القانوني رجع
        // عمداً لصياغته الصادقة الأقدم (بلا رقم مضمون) حتى تُضبط الأسرار ويُتحقَّق
        // من الآلية طرفاً لطرف فعلياً — عندها قرار مستقبلي منفصل يمكنه إعادة الرقم.
        expect(retentionHtml).not.toMatch(/عند إغلاق الحساب أو طلب حذفه، نحذف/);
        expect(retentionHtml).not.toMatch(/يراجع فريقنا الطلب ويعمل على حذف/);
        // حارس ضد التراجع الصامت: لا يُعاد الرقم المحدَّد بلا قرار متعمَّد جديد.
        expect(retentionHtml).not.toMatch(/فترة سماح مدتها 7 أيام/);
        expect(retentionHtml).not.toMatch(/خلال 7 إلى 8 أيام من تقديم الطلب/);
        expect(retentionHtml).toMatch(/تقديم طلب حذف الحساب يُسجَّل في نظامنا فوراً/);
        expect(retentionHtml).toMatch(/لا نضمن حالياً مدة زمنية محددة/);
        expect(retentionHtml).toMatch(/يدوياً من فريقنا/);
    });

    it('نفس التصحيح مطبَّق في privacy.html §5 "حقوقك" أيضاً — رجعت لصياغتها الصادقة القديمة بلا رقم مضمون', () => {
        expect(privacyHtml).not.toMatch(/التواصل معنا لحذف حسابك ودراساتك والملفات\s*\n?\s*المرتبطة بها من نظامنا السحابي\./);
        // حارس ضد التراجع الصامت: لا يُعاد وعد فترة السماح المحدَّدة بلا قرار متعمَّد.
        expect(privacyHtml).not.toMatch(/فترة سماح مدتها 7 أيام/);
        expect(privacyHtml).not.toMatch(/خلال 7 إلى 8 أيام من تقديم الطلب/);
        expect(privacyHtml).toMatch(/التواصل معنا لطلب حذف حسابك/);
        expect(privacyHtml).toMatch(/يُسجَّل طلبك فوراً/);
        expect(privacyHtml).toMatch(/بلا مدة زمنية مضمونة حالياً/);
    });

    it('كلا الملفين يذكران صراحة الاحتفاظ بسجلات الفواتير 6 سنوات (نظام ضريبة القيمة المضافة) حتى بعد حذف الحساب — قرار مالك صريح 2026-08-29، لا اجتهاد هندسي', () => {
        for (const html of [privacyHtml, retentionHtml]) {
            expect(html).toMatch(/6 سنوات/);
        }
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

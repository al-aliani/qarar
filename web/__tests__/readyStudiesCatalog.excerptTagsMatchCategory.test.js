/**
 * كوميت f1426cc أعاد تصنيف عدة دراسات في «دراسات جدوى جاهزة» فحدّث
 * category/categoryLabel دون تحديث excerpt وtags — كلاهما يُشتقّان في
 * scripts/generate_ready_studies_catalog.py من التصنيف وقت التوليد فقط.
 *
 * النتيجة: بطاقة «صالون حلاقة متنقل» (categoryLabel: أزياء وعناية رجالية)
 * كانت تعرض مقتطفاً يقول حرفياً «دراسة جدوى جاهزة ضمن تصنيف أطعمة ومشروبات»
 * وأول وسم «أطعمة ومشروبات» — 23 دراسة بنفس النمط. عميل يصفّي على وسم
 * «أطعمة ومشروبات» يجد صالون حلاقة ضمن نتائجه، والبحث (getFilteredStudies
 * في ReadyStudiesView.js) يضع excerpt والوسوم في نطاق البحث فيتضاعف التلوث.
 *
 * الحارس هنا لا يفترض قيماً يدوياً لكل تصنيف (لا يستنسخ قاموس category_tag
 * من السكربت): يبني «القيمة المعتمدة» من الدراسات التي أثبتت صدقها هي نفسها
 * (مقتطفها النائب يطابق categoryLabel فعلاً) ثم يتحقق أن كل دراسة في نفس
 * المجموعة الموثوقة تطابقها.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const catalogPath = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/ready-studies.json');

// يُعاد التحميل من القرص في كل اختبار كي يعكس أي تعديل حي على الملف (يُستخدم
// في اختبار «إعادة إدخال العيب» أدناه دون تسريب التعديل إلى اختبارات أخرى.
function loadCatalog() {
    return JSON.parse(readFileSync(catalogPath, 'utf8'));
}

const FALLBACK_EXCERPT = /^دراسة جدوى جاهزة ضمن تصنيف (.+)\.$/;

function findExcerptMismatches(catalog) {
    return catalog.studies
        .map((s) => {
            const m = FALLBACK_EXCERPT.exec(s.excerpt || '');
            return m && m[1] !== s.categoryLabel
                ? `${s.title} (${s.id}): المقتطف يقول "${m[1]}" وcategoryLabel الفعلي "${s.categoryLabel}"`
                : null;
        })
        .filter(Boolean);
}

// «الوسم المعتمد» لكل تصنيف يُشتقّ من الدراسات التي أثبت اختبار المقتطف
// صدقها (مقتطفها النائب يطابق categoryLabel فعلاً) — لا قيم يدوية منسوخة
// من قاموس category_tag في السكربت. يُبنى من نسخة الفهرس *قبل* أي تعديل
// (انظر اختبار «إثبات الحارس» أدناه) كي لا يُفسِد تعديل صف واحد المرجع كله.
function buildCanonicalTags(catalog) {
    const canonical = new Map();
    for (const s of catalog.studies) {
        const m = FALLBACK_EXCERPT.exec(s.excerpt || '');
        if (m && m[1] === s.categoryLabel && s.tags?.[0] && !canonical.has(s.category)) {
            canonical.set(s.category, s.tags[0]);
        }
    }
    return canonical;
}

function findTagMismatches(catalog, canonical) {
    // يفحص كل دراسة أُنشئ مقتطفها من القالب النائب (سواء صحّ أم لا) — وليس
    // فقط الموثوق منها — كي لا يُفلِت صف عيبه في الحقلين معاً (excerpt وtags)
    // من هذا الفحص بحجة أن مقتطفه غير موثوق.
    return catalog.studies
        .filter((s) => FALLBACK_EXCERPT.test(s.excerpt || ''))
        .filter((s) => canonical.has(s.category) && s.tags?.[0] !== canonical.get(s.category))
        .map((s) => `${s.title} (${s.id}): tags[0]="${s.tags?.[0]}" بينما المعتمد لتصنيف "${s.category}" هو "${canonical.get(s.category)}"`);
}

describe('فهرس الدراسات الجاهزة — excerpt وtags[0] يطابقان categoryLabel بعد إعادة تصنيف', () => {
    it('المقتطف النائب (fallback excerpt) يطابق categoryLabel الفعلي لكل دراسة', () => {
        const catalog = loadCatalog();
        const mismatches = findExcerptMismatches(catalog);
        expect(mismatches, `دراسات مقتطفها النائب يناقض تصنيفها الفعلي:\n  ${mismatches.join('\n  ')}`).toEqual([]);
    });

    it('tags[0] يطابق الوسم المعتمد لنفس التصنيف عبر بقية الدراسات الموسومة بصدق', () => {
        const catalog = loadCatalog();
        const mismatches = findTagMismatches(catalog, buildCanonicalTags(catalog));
        expect(mismatches, `دراسات tags[0] لا يطابق تصنيفها الفعلي:\n  ${mismatches.join('\n  ')}`).toEqual([]);
    });

    it('[إثبات الحارس] إعادة إدخال العيب يدوياً على صف حقيقي يُفشِل كلا الاختبارين', () => {
        const catalog = loadCatalog();
        // «الوسم المعتمد» يُحسب من النسخة السليمة *قبل* إفساد الصف كي لا يُفقِد
        // إفساد الصف الوحيد من فئته مرجعه (تماماً كما يحدث في الملف الحقيقي).
        const canonical = buildCanonicalTags(catalog);

        const victim = catalog.studies.find((s) => s.id === '2e33be3cb73c'); // صالون حلاقة متنقل
        expect(victim, 'صف الاختبار الثابت غير موجود — تحقق من الفهرس').toBeTruthy();

        // نفس العيب الأصلي حرفياً: تصنيف "food" قديم متروك في excerpt/tags[0]
        // بعد أن أصبح categoryLabel الحالي "أزياء وعناية رجالية".
        victim.excerpt = 'دراسة جدوى جاهزة ضمن تصنيف أطعمة ومشروبات.';
        victim.tags[0] = 'أطعمة ومشروبات';

        const excerptMismatches = findExcerptMismatches(catalog);
        expect(excerptMismatches).toContain(
            'صالون حلاقة متنقل (2e33be3cb73c): المقتطف يقول "أطعمة ومشروبات" وcategoryLabel الفعلي "أزياء وعناية رجالية"',
        );

        const tagMismatches = findTagMismatches(catalog, canonical);
        expect(tagMismatches).toContain(
            'صالون حلاقة متنقل (2e33be3cb73c): tags[0]="أطعمة ومشروبات" بينما المعتمد لتصنيف "mens" هو "أزياء رجالية"',
        );
    });
});

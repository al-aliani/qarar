/**
 * إتمام 2026-08-26: `readyStudiesCatalog.excerptTagsMatchCategory.test.js` يحرس
 * حالة واحدة فقط — دراسات مقتطفها لا يزال يحمل النص النائب القديم «ضمن تصنيف X».
 * مُدقِّق مستقل فحص الملف بعد إصلاح تلك الـ23 فوجد **5 دراسات إضافية** بنفس
 * الجذر (إعادة تصنيف دون تحديث tags) لكن بعرض مختلف: excerpt حقيقي مستخرَج من
 * PDF (لا نائب)، وtags[0] يحمل تصنيف المجلد **القديم** بينما التصنيف الصحيح
 * موجود في المصفوفة لكن ليس أولاً — مثال: ورشة ميكانيكا سيارات (categoryLabel
 * الصحيح «سيارات ونقل») كان tags[0]="مشروعات إنتاجية" (تصنيف مجلدها الأصلي
 * قبل إعادة التصنيف). البطاقة تعرض tags[0] كشارة أولى، فالعميل يرى تصنيفاً
 * مغايراً لما تقوله شارة categoryLabel نفسها على نفس البطاقة.
 *
 * هذا الحارس أعمّ: لا يعتمد على نمط excerpt إطلاقاً. `make_tags()` في
 * scripts/generate_ready_studies_catalog.py يضع وسم التصنيف أولاً دائماً
 * (`tags.append(category_tag)` قبل أي وسم آخر) — فتصنيف tags[0] الغالب لكل
 * `category` عبر عشرات الدراسات هو «القيمة المعتمدة»، بلا نسخ قاموس
 * category_tag يدوياً هنا. دراسة يخالف tags[0] فيها الغالبية الساحقة لفئتها
 * هي شذوذ يستحق الفحص.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const catalogPath = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/ready-studies.json');

function loadCatalog() {
    return JSON.parse(readFileSync(catalogPath, 'utf8'));
}

// الوسم الغالب لكل category: يحتاج غالبية واضحة (>60%) وحجم عيّنة معقول (>=5)
// كي لا يُفرض حكم على فئة صغيرة العدد بلا إجماع فعلي.
function buildMajorityTag(catalog) {
    const counts = new Map(); // category -> Map(tag -> n)
    for (const s of catalog.studies) {
        const t0 = s.tags?.[0];
        if (!t0) continue;
        if (!counts.has(s.category)) counts.set(s.category, new Map());
        const m = counts.get(s.category);
        m.set(t0, (m.get(t0) || 0) + 1);
    }
    const majority = new Map();
    for (const [category, m] of counts) {
        const total = [...m.values()].reduce((a, b) => a + b, 0);
        const [topTag, topN] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
        if (total >= 5 && topN / total > 0.6) majority.set(category, topTag);
    }
    return majority;
}

function findOutliers(catalog, majority) {
    return catalog.studies
        .filter((s) => majority.has(s.category) && s.tags?.[0] !== majority.get(s.category))
        .map((s) => `${s.title} (${s.id}): tags[0]="${s.tags?.[0]}" بينما الغالب لفئة "${s.category}" هو "${majority.get(s.category)}" (categoryLabel: "${s.categoryLabel}")`);
}

describe('فهرس الدراسات الجاهزة — tags[0] يطابق الوسم الغالب لفئته (لا يعتمد على نمط excerpt)', () => {
    it('صفر دراسة يخالف tags[0] فيها الغالبية الساحقة لفئتها', () => {
        const catalog = loadCatalog();
        const majority = buildMajorityTag(catalog);
        const outliers = findOutliers(catalog, majority);
        expect(outliers, `دراسات tags[0] فيها شاذّ عن غالبية فئتها:\n  ${outliers.join('\n  ')}`).toEqual([]);
    });

    it('[إثبات الحارس] إعادة إدخال أحد العيوب الخمسة المُصلَحة يُفشِل الاختبار', () => {
        const catalog = loadCatalog();
        const majority = buildMajorityTag(catalog);

        const victim = catalog.studies.find((s) => s.id === 'c11b99caffb1'); // ورشة ميكانيكا سيارات
        expect(victim, 'صف الاختبار الثابت غير موجود — تحقق من الفهرس').toBeTruthy();
        expect(victim.categoryLabel).toBe('سيارات ونقل');

        // نفس العيب المُصلَح حرفياً: تصنيف المجلد القديم عائد إلى الصدارة.
        victim.tags = ['مشروعات إنتاجية', ...victim.tags.filter((t) => t !== 'مشروعات إنتاجية')];

        const outliers = findOutliers(catalog, majority);
        expect(outliers.some((m) => m.includes('c11b99caffb1'))).toBe(true);
    });
});

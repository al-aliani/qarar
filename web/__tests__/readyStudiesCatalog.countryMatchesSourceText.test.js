/**
 * تدقيق 2026-08-27 (لجنة استشارية ثلاثية: امتثال قانوني، مدير محتوى، ثقة
 * عميل): حقل country في كل الدراسات الـ301 كان "SA" بلا استثناء (كوميت
 * aa96ff1) رغم أن نص عشرات الملفات المصدرية يذكر صراحة مؤشرات مالية أو
 * جغرافية أردنية (دينار، محافظات كالطفيلة/جرش/الكرك) أو مصرية (جنيه،
 * القاهرة/الإسكندرية) في أول 10-15 صفحة من الملف. فحص مستقل لكل الملفات
 * الـ301 (نص مستخرَج فعلياً عبر pypdf، لا افتراض على الرقم 97 الأولي) وجد
 * 155 دراسة بدليل واضح — 74 أردنية و81 مصرية — صُحِّحت قيمة country لها في
 * scripts/generate_ready_studies_catalog.py (detect_country) وفي
 * web/public/data/ready-studies.json.
 *
 * هذا الحارس يثبّت العلاقة بين الدليل النصي الفعلي (مقتبس هنا حرفياً من كل
 * ملف) وقيمة country المعتمدة. لا يعيد استخراج النص من PDF وقت الاختبار (لا
 * مكتبة قراءة PDF في بيئة JS/vitest) بل يرسّخ عيّنة من الدراسات المؤكدة
 * يدوياً كي لا يتكرر نفس الادعاء الكاذب "SA" لاحقاً على أي منها.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const catalogPath = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/ready-studies.json');

function loadCatalog() {
    return JSON.parse(readFileSync(catalogPath, 'utf8'));
}

// عيّنة موثّقة من الدراسات الـ155 المصحَّحة: id، الدليل النصي المقتبس حرفياً
// من أول 15 صفحة من ملف PDF المصدر، والبلد الصحيح.
const CONFIRMED_EVIDENCE = [
    {
        id: '61920e00e232',
        title: 'مشروع استخراج حجر البناء',
        expected: 'JO',
        evidence: 'بلغت الايرادات المتوقعة 3,228,000 دينار أردني خلال السنة الاولى من عمر المشروع',
    },
    {
        id: '95c08423b27e',
        title: 'مشروع تصنيع الجميد',
        expected: 'JO',
        evidence: 'الاستثمار الكلي (الف دينار) 201 — صافي القيمة الحالية (الف دينار) 14326',
    },
    {
        id: 'cc2d0e41aa2b',
        title: 'مصنع منتجات الألبان',
        expected: 'JO',
        evidence: 'جدول 11: المصاريف الرأسمالية من المركبات (دينار أردني)',
    },
    {
        id: 'f175b2ca0456',
        title: 'مصنع أنابيب بلاستيكية',
        expected: 'JO',
        evidence: 'بلغت الايرادات المتوقعة 111,111 دينار أردني خلال السنة الأولى من عمر المشروع',
    },
    {
        id: '42da1a4ac260',
        title: '11 مصنع أعلاف ماشية طاقة 20 طن فى اليوم',
        expected: 'EG',
        evidence: 'رأس المال ... جنيه — عملة مصرية صريحة، تتكرر 7 مرات في أول 15 صفحة',
    },
    {
        id: 'ac30d6fc625f',
        title: 'تخريز البلاستيك',
        expected: 'EG',
        evidence: 'قيمة الإيجار السنوي: 24000 جنيه — قيمة الأرض: 0 جنيه (30 ذكراً لـ"جنيه" في الملف)',
    },
    {
        id: 'cf3fabb4facf',
        title: 'تصنيع أكياس بلاستيك',
        expected: 'EG',
        evidence: 'قيمة الإيجار السنوي: 24000 جنيه — نفس قالب دراسة تخريز البلاستيك',
    },
    {
        id: 'dda5eef03856',
        title: '129 سيارة نقل مبرد 4 طن',
        expected: 'EG',
        evidence: 'الاستثمارات الكلية للمشروع (رأس المال + القرض) 442.433 جنيه',
    },
    {
        id: '40e9c2a12b16',
        title: 'دراسة جدوى (mpdf.pdf)',
        expected: 'EG',
        evidence: 'خطوات تأسيس مشروع مركز الخدمات الطلابية في مصر — تصريح مباشر بموقع المشروع',
    },
];

// دراسات فُحصت يدوياً وتبيّن أن "الدليل" فيها عابر لا يخص موقع المشروع
// (قائمة دول استيراد، اقتباس مرجعي، خلفية تاريخية) — تبقى "SA" بلا تغيير،
// إثباتاً أن التصحيح لم يكن تعميماً أعمى لكل ذكر عابر لكلمة "مصر"/"الأردن".
const CONFIRMED_UNCHANGED = [
    { id: '45a115fd901f', title: 'محل بيع جلديات', reason: 'ذكر عابر: "مستوردة من ماليزيا، الهند، مصر" — بلد استيراد لا موقع مشروع' },
    { id: '87e372350e23', title: 'دراسة جدوى', reason: 'اقتباس مرجعي في قائمة مصادر: "دراسات الجدوى الاقتصادية... د. كاظم جاسم العيساوي، الأردن"' },
    { id: '23509f3fc687', title: 'ألواح الخشب المضغوط', reason: 'خلفية عامة عن الزراعة المصرية، لا موقع المشروع نفسه' },
];

describe('فهرس الدراسات الجاهزة — حقل country يطابق الدليل النصي الفعلي', () => {
    it('دراسات بدليل مالي/جغرافي أردني أو مصري واضح ومقتبس حرفياً لم تعد "SA"', () => {
        const catalog = loadCatalog();
        const byId = new Map(catalog.studies.map((s) => [s.id, s]));
        const wrong = CONFIRMED_EVIDENCE
            .map(({ id, title, expected, evidence }) => {
                const study = byId.get(id);
                if (!study) return `${title} (${id}): الدراسة غير موجودة في الفهرس`;
                if (study.country !== expected) {
                    return `${title} (${id}): country="${study.country}" رغم الدليل "${evidence}" (متوقَّع "${expected}")`;
                }
                return null;
            })
            .filter(Boolean);
        expect(wrong, `دراسات بدليل واضح لكنها غير مصحَّحة:\n  ${wrong.join('\n  ')}`).toEqual([]);
    });

    it('دراسات ذات ذكر عابر (لا يدل على موقع المشروع) بقيت "SA" — لا تعميم أعمى', () => {
        const catalog = loadCatalog();
        const byId = new Map(catalog.studies.map((s) => [s.id, s]));
        const wrong = CONFIRMED_UNCHANGED
            .map(({ id, title, reason }) => {
                const study = byId.get(id);
                if (!study) return `${title} (${id}): الدراسة غير موجودة في الفهرس`;
                return study.country !== 'SA'
                    ? `${title} (${id}): country="${study.country}" رغم أن الدليل عابر فقط (${reason})`
                    : null;
            })
            .filter(Boolean);
        expect(wrong, `دراسات غُيِّرت رغم عدم وجود دليل حقيقي:\n  ${wrong.join('\n  ')}`).toEqual([]);
    });

    it('التصحيح اقتصر على 155 دراسة (72 أردنية + 81 مصرية + 2 عراقية)، والبقية 145 بقيت "SA"', () => {
        // تدقيق لاحق (نفس اليوم): من الـ74 المصنَّفة "JO" آلياً، 2 اعتمدتا على
        // "دينار" وحدها بلا اسم مدينة/دولة أردنية مرافق — عملة مشتركة بين
        // الأردن والعراق (والكويت والبحرين وتونس والجزائر وليبيا)، والمحتوى
        // الفعلي عراقي بلا لبس (انظر COUNTRY_OVERRIDES في السكربت المولِّد).
        // إجمالي المصحَّح يبقى 155 دراسة، فقط توزيعه الآن أدق (74→72 أردنية
        // + 2 عراقية جديدة بدل خطأ سابق).
        const catalog = loadCatalog();
        const counts = { SA: 0, JO: 0, EG: 0, IQ: 0 };
        for (const s of catalog.studies) counts[s.country] = (counts[s.country] || 0) + 1;
        expect(counts).toEqual({ SA: 145, JO: 72, EG: 81, IQ: 2 });
    });

    it('العدد الكلي 300 (301 ناقص دراسة مكرَّرة حُذفت) وباقي حقول الدراسات المصحَّحة لم تتأثر', () => {
        const catalog = loadCatalog();
        expect(catalog.total).toBe(300);
        expect(catalog.studies).toHaveLength(300);

        const byId = new Map(catalog.studies.map((s) => [s.id, s]));
        const stoneProject = byId.get('61920e00e232');
        expect(stoneProject).toMatchObject({
            title: 'مشروع استخراج حجر البناء',
            category: 'manufacturing-agriculture',
            categoryLabel: 'تصنيع وزراعة وثروة حيوانية',
            country: 'JO',
        });
        expect(stoneProject.tags).toEqual(['مشروعات إنتاجية', 'دراسة موسعة', 'عربي وإنجليزي']);

        const feedFactory = byId.get('42da1a4ac260');
        expect(feedFactory).toMatchObject({
            title: '11 مصنع أعلاف ماشية طاقة 20 طن فى اليوم',
            category: 'manufacturing-agriculture',
            country: 'EG',
        });
        expect(feedFactory.tags).toEqual(['مشروعات إنتاجية', 'تصنيع', 'ثروة حيوانية', 'دراسة موسعة', 'عربي وإنجليزي']);
    });

    it('[إثبات الحارس] إعادة تصنيف دراسة أردنية مؤكدة كـ"SA" يدوياً تُفشِل اختبار الدليل الواضح', () => {
        const catalog = loadCatalog();
        const victim = catalog.studies.find((s) => s.id === '61920e00e232'); // مشروع استخراج حجر البناء
        expect(victim, 'صف الاختبار الثابت غير موجود — تحقق من الفهرس').toBeTruthy();
        expect(victim.country).toBe('JO');

        // نفس العيب الأصلي حرفياً: التراجع عن التصحيح إلى الادعاء الكاذب "SA".
        victim.country = 'SA';

        const byId = new Map(catalog.studies.map((s) => [s.id, s]));
        const wrong = CONFIRMED_EVIDENCE
            .filter(({ id, expected }) => byId.get(id)?.country !== expected)
            .map(({ id }) => id);
        expect(wrong).toContain('61920e00e232');
    });
});

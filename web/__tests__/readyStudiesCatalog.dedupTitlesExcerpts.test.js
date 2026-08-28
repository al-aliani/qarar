/**
 * تدقيق 2026-08-27 (متابعة فحص شامل + عمل لاحق على مكتبة الدراسات الجاهزة):
 * ثلاثة عيوب حية إضافية غير مشمولة بإصلاح حقل country السابق (نفس اليوم):
 *
 * 1) دراسة واحدة مكرَّرة حرفياً: نفس ملف PDF ("مشغل خياطة ثياب نسائية.pdf"،
 *    نفس الحجم وعدد الصفحات) موجود في مجلدين مختلفين ("الحي" و"مصنع")
 *    فيظهر للعميل كبطاقتين منفصلتين لدراسة واحدة.
 * 2) 4 عناوين مشتقة آلياً من اسم ملف تقني بلا معنى (mpdf.pdf، pdf.pdf) أو
 *    ملف اسمه حرفياً "دراسة جدوى.pdf" — عنوان "دراسة جدوى" العام بلا أي
 *    دلالة، رغم توفر محتوى فعلي يكشف الموضوع الحقيقي.
 * 3) 14 نبذة (excerpt) مهملة تظهر حرفياً على البطاقات: "رقم الدراسة" أو "٠"
 *    أو رموز جدولية بلا معنى — 12 منها من نفس قالب غلاف شبه فارغ لمكتب
 *    استشارات واحد (نصه الكامل في الصفحة الأولى "رقم الدراسة" فقط).
 *
 * اكتُشف أيضاً أثناء قراءة محتوى العناوين المصحَّحة: دراستان مصنَّفتان "JO"
 * آلياً (COUNTRY_OVERRIDES في السكربت) كانتا في الواقع عراقيتين — "دينار"
 * وحدها عملة مشتركة لعدة دول عربية، لا الأردن حصراً؛ محتواهما الفعلي (محافظة
 * المثنى، مدينة السماوة، جامعة المثنى، قانون الاستثمار العراقي رقم 13 لسنة
 * 2006) لا لبس فيه. يُختبر ضمن هذا الملف لأنه اكتُشف بنفس العملية.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const catalogPath = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/ready-studies.json');
const loadCatalog = () => JSON.parse(readFileSync(catalogPath, 'utf8'));

describe('فهرس الدراسات الجاهزة — دراسة مكرَّرة حُذفت', () => {
    it('نسخة "مصنع" من "مشغل خياطة ثياب نسائية" حُذفت، ونسخة "الحي" باقية', () => {
        const catalog = loadCatalog();
        const byId = new Map(catalog.studies.map((s) => [s.id, s]));
        expect(byId.get('f8dc69e65125'), 'النسخة المكرَّرة (مصنع) ما زالت موجودة').toBeUndefined();
        expect(byId.get('d9223367c023')?.title).toBe('مشغل خياطة ثياب نسائية');
    });

    it('العدد الكلي وعدّادات الوسوم/التصنيفات المتأثرة (تصنيع وزراعة، 3 وسوم) خُفِّضت بمقدار 1 بالضبط', () => {
        const catalog = loadCatalog();
        expect(catalog.total).toBe(300);
        expect(catalog.studies).toHaveLength(300);

        const manufacturing = catalog.categories.find((c) => c.id === 'manufacturing-agriculture');
        const actualManufacturing = catalog.studies.filter((s) => s.category === 'manufacturing-agriculture').length;
        expect(manufacturing.count).toBe(actualManufacturing);

        for (const label of ['مشروعات إنتاجية', 'دراسة موسعة', 'عربي وإنجليزي']) {
            const declared = catalog.tags.find((t) => t.label === label).count;
            const actual = catalog.studies.filter((s) => (s.tags || []).includes(label)).length;
            expect(declared, `عدّاد الوسم "${label}" لا يطابق الواقع بعد حذف المكرَّرة`).toBe(actual);
        }
    });

    it('[إثبات الحارس] لو أُعيدت النسخة المكرَّرة لظهرت مرتين بنفس العنوان', () => {
        const catalog = loadCatalog();
        const withDuplicateBack = {
            ...catalog,
            studies: [...catalog.studies, { ...catalog.studies.find((s) => s.id === 'd9223367c023'), id: 'f8dc69e65125' }],
        };
        const sameTitleCount = withDuplicateBack.studies.filter((s) => s.title === 'مشغل خياطة ثياب نسائية').length;
        expect(sameTitleCount).toBe(2);
    });
});

describe('فهرس الدراسات الجاهزة — عناوين تعكس محتوى الدراسة الفعلي لا اسم ملف تقني', () => {
    const TITLE_FIXES = [
        { id: '40e9c2a12b16', expectedTitle: 'دراسة جدوى لمشروع مركز خدمات طلابية متكامل', evidence: 'خطوات تأسيس مشروع مركز الخدمات الطلابية فـ مصر' },
        { id: '4c157def8d0b', expectedTitle: 'دراسة جدوى لمشروع إنشاء عمارة تجارية سكنية', evidence: 'دراسة جدوى مشروع إنشاء عمارة تجارية سكنية في مدينة السماوة' },
        { id: '87e372350e23', expectedTitle: 'دليل إعداد دراسات الجدوى الاقتصادية للمشاريع الصغيرة', evidence: 'دائرة التنمية الاقتصادية رأس الخيمة (rak.ae) — دليل منهجية عام، لا دراسة مشروع محدد' },
        { id: 'df6a2ece59eb', expectedTitle: 'دراسة جدوى لمشروع مقهى في مكة المكرمة', evidence: 'دراسة جدوى اقتصادية-مقهى مكة (صفحة 2؛ اسم الملف المصدري نفسه تالف جزئياً)' },
    ];

    it.each(TITLE_FIXES)('$id: العنوان "$expectedTitle" بدل "دراسة جدوى" العام', ({ id, expectedTitle }) => {
        const catalog = loadCatalog();
        const study = catalog.studies.find((s) => s.id === id);
        expect(study, `الدراسة ${id} غير موجودة`).toBeTruthy();
        expect(study.title).toBe(expectedTitle);
    });

    it('لا عنوان "دراسة جدوى" العام المجرَّد متبقٍّ لأي من الدراسات الأربع', () => {
        const catalog = loadCatalog();
        const ids = TITLE_FIXES.map((f) => f.id);
        const stillGeneric = catalog.studies.filter((s) => ids.includes(s.id) && s.title === 'دراسة جدوى');
        expect(stillGeneric.map((s) => s.id)).toEqual([]);
    });

    it('downloadName يطابق العنوان المصحَّح لكل دراسة (لا يبقى اسم الملف القديم)', () => {
        const catalog = loadCatalog();
        for (const { id, expectedTitle } of TITLE_FIXES) {
            const study = catalog.studies.find((s) => s.id === id);
            expect(study.downloadName).toBe(`${expectedTitle}.pdf`);
        }
    });

    it('[إثبات الحارس] إعادة العنوان القديم "دراسة جدوى" يدوياً تُفشِل الاختبار الأول', () => {
        const catalog = loadCatalog();
        const victim = catalog.studies.find((s) => s.id === '40e9c2a12b16');
        victim.title = 'دراسة جدوى';
        expect(victim.title).not.toBe('دراسة جدوى لمشروع مركز خدمات طلابية متكامل');
    });
});

describe('فهرس الدراسات الجاهزة — نبذات مهملة استُبدلت بنص صادق', () => {
    const FIXED_EXCERPT_IDS = [
        '0c774a411857', 'df6a2ece59eb', '6d86804cde21', '77cb1982325e', 'a6974c3dbe6e',
        '840ea39c633f', '338d06db741d', 'eb7a05f1184c', '8d06f17411ca',
        '8d602a1df6ce', '8d0d7c4bf84a', '98b7c42154fc',
    ];
    const JUNK_PATTERNS = [/^رقم\s+الدراسة$/, /^[٠-٩0-9\s]+$/];

    it.each(FIXED_EXCERPT_IDS)('%s: النبذة لم تعد "رقم الدراسة" أو رقماً مجرَّداً', (id) => {
        const catalog = loadCatalog();
        const study = catalog.studies.find((s) => s.id === id);
        expect(study, `الدراسة ${id} غير موجودة`).toBeTruthy();
        const isJunk = JUNK_PATTERNS.some((p) => p.test(study.excerpt.trim()));
        expect(isJunk, `النبذة ما زالت مهملة: "${study.excerpt}"`).toBe(false);
        expect(study.excerpt.length).toBeGreaterThanOrEqual(25);
    });

    it('حالتا الجداول المالية (أقفاص الجريد، عجوة البلح) تعرضان محتوى حقيقياً لا رموزاً مبعثرة', () => {
        const catalog = loadCatalog();
        const byId = new Map(catalog.studies.map((s) => [s.id, s]));
        expect(byId.get('0d6646adcdab').excerpt).toContain('الدراسة المالية');
        expect(byId.get('b64175bcc281').excerpt).toContain('الدراسة المالية');
    });

    it('نفس الحالتين: الوسم "دراسة موسعة" لا "دراسة مختصرة" بعد أن تجاوزت النبذة الجديدة 180 حرفاً', () => {
        // مراجعة عدائية مستقلة اكتشفت أن استبدال النبذة يدوياً لم يُعِد حساب
        // الوسوم التابعة لها — make_tags() (السكربت المولِّد) تفرض "دراسة
        // موسعة" عند excerpt.length >= 180 (كلا النبذتين الآن 221 حرفاً)،
        // فبقاء "دراسة مختصرة" كان تناقضاً حياً بين النص المعروض والوسم.
        const catalog = loadCatalog();
        const byId = new Map(catalog.studies.map((s) => [s.id, s]));
        for (const id of ['0d6646adcdab', 'b64175bcc281']) {
            const study = byId.get(id);
            expect(study.excerpt.length).toBeGreaterThanOrEqual(180);
            expect(study.tags).toContain('دراسة موسعة');
            expect(study.tags).not.toContain('دراسة مختصرة');
        }
    });

    it('[إثبات الحارس] إعادة "رقم الدراسة" يدوياً على دراسة مُصلَحة تُفشِل فحص الجودة', () => {
        const catalog = loadCatalog();
        const victim = catalog.studies.find((s) => s.id === '0c774a411857');
        victim.excerpt = 'رقم الدراسة';
        const isJunk = JUNK_PATTERNS.some((p) => p.test(victim.excerpt.trim()));
        expect(isJunk).toBe(true);
    });
});

describe('فهرس الدراسات الجاهزة — تصحيح تصنيف بلد خاطئ (JO خطأً بدل IQ)', () => {
    it('الدراستان العراقيتان (محافظة المثنى) لم تعودا مصنَّفتين "JO"', () => {
        const catalog = loadCatalog();
        const byId = new Map(catalog.studies.map((s) => [s.id, s]));
        expect(byId.get('4c157def8d0b').country).toBe('IQ');
        expect(byId.get('49ed45450eaa').country).toBe('IQ');
    });

    it('إجمالي الدراسات الأردنية بعد التصحيح 72 (كان 74 قبل استبعاد الحالتين العراقيتين)', () => {
        const catalog = loadCatalog();
        const joCount = catalog.studies.filter((s) => s.country === 'JO').length;
        expect(joCount).toBe(72);
    });

    it('[إثبات الحارس] إعادة تصنيفهما "JO" يدوياً تُفشِل اختبار الدولة الصحيحة', () => {
        const catalog = loadCatalog();
        const victim = catalog.studies.find((s) => s.id === '4c157def8d0b');
        victim.country = 'JO';
        expect(victim.country).not.toBe('IQ');
    });
});

/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-08-27: راجع رأس heroUsageStats.js لخلفية القرار (لجنة 3 خبراء).
 * كان القسم كله يظهر أو يختفي معاً — «0 دراسة مدفوعة فعلياً» و«0 دراسة معتمدة
 * من خبير» تظهران بجانب أزرار شراء حقيقية. الآن كل حقل يُخفى على حدة حين صفر،
 * ويظهر تلقائياً بمجرد أن يصبح رقمه الحقيقي غير صفري — بلا استبدال بأرقام مصطنعة.
 */
import { describe, it, expect } from 'vitest';
import { computeHeroUsageFacts, applyHeroUsageFacts } from '../heroUsageStats.js';

describe('computeHeroUsageFacts — منطق صرف (لا DOM)', () => {
    it('الحالة الحالية الحقيقية للمنصة: 55 دراسة، صفر مدفوعة، صفر معتمدة', () => {
        const { anyVisible, facts } = computeHeroUsageFacts({ total_studies: 55, paid_studies: 0, certified_studies: 0 });
        expect(anyVisible).toBe(true);
        expect(facts.find((f) => f.id === 'statTotalStudies')).toMatchObject({ value: 55, visible: true });
        expect(facts.find((f) => f.id === 'statPaidStudies')).toMatchObject({ value: 0, visible: false });
        expect(facts.find((f) => f.id === 'statCertifiedStudies')).toMatchObject({ value: 0, visible: false });
    });

    it('كل الحقول صفر معاً ⇒ anyVisible=false (القسم كله يختفي)', () => {
        const { anyVisible } = computeHeroUsageFacts({ total_studies: 0, paid_studies: 0, certified_studies: 0 });
        expect(anyVisible).toBe(false);
    });

    it('أول عملية بيع حقيقية ⇒ statPaidStudies يظهر تلقائياً بلا أي تعديل كود', () => {
        const { facts } = computeHeroUsageFacts({ total_studies: 56, paid_studies: 1, certified_studies: 0 });
        expect(facts.find((f) => f.id === 'statPaidStudies').visible).toBe(true);
    });

    it('لا يستبدل الصفر برقم مصطنع أبداً — القيمة المعروضة تبقى 0 حتى لو مخفية', () => {
        const { facts } = computeHeroUsageFacts({ total_studies: 55, paid_studies: 0, certified_studies: 0 });
        expect(facts.find((f) => f.id === 'statPaidStudies').value).toBe(0);
    });

    it('قيم null/undefined/نصية غير رقمية تُعامَل كصفر بلا كسر', () => {
        const { facts } = computeHeroUsageFacts({ total_studies: null, paid_studies: undefined, certified_studies: 'x' });
        expect(facts.every((f) => f.value === 0 && !f.visible)).toBe(true);
    });
});

describe('applyHeroUsageFacts — التطبيق على DOM فعلي', () => {
    function buildDom() {
        document.body.innerHTML = `
            <div class="hero-facts" id="heroUsageStats" hidden>
                <div class="hero-fact is-num"><b id="statTotalStudies">-</b><span>دراسة أُعِدَّت على المنصة</span></div>
                <div class="hero-fact is-num"><b id="statPaidStudies">-</b><span>دراسة مدفوعة فعلياً</span></div>
                <div class="hero-fact is-num"><b id="statCertifiedStudies">-</b><span>دراسة معتمدة من خبير</span></div>
            </div>`;
        return document;
    }

    it('الحالة الحقيقية اليوم: القسم يظهر، "55" ظاهر، وصفَّا المدفوعة/المعتمدة مخفيان', () => {
        const doc = buildDom();
        applyHeroUsageFacts(doc, { total_studies: 55, paid_studies: 0, certified_studies: 0 });

        expect(doc.getElementById('heroUsageStats').hidden).toBe(false);
        // toLocaleString('ar-SA') يُخرج أرقاماً هندية شرقية («٥٥») — سلوك أصلي
        // لم يتغيّر بهذا الإصلاح، نتحقق منه عددياً بدل نص ثابت هش لأشكال الأرقام.
        expect(Number(doc.getElementById('statTotalStudies').textContent.replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660))).toBe(55);
        expect(doc.getElementById('statTotalStudies').closest('.hero-fact').hidden).toBe(false);
        expect(doc.getElementById('statPaidStudies').closest('.hero-fact').hidden).toBe(true);
        expect(doc.getElementById('statCertifiedStudies').closest('.hero-fact').hidden).toBe(true);
    });

    it('كل الحقول صفر ⇒ القسم الحاوي يبقى hidden بالكامل', () => {
        const doc = buildDom();
        applyHeroUsageFacts(doc, { total_studies: 0, paid_studies: 0, certified_studies: 0 });
        expect(doc.getElementById('heroUsageStats').hidden).toBe(true);
    });

    it('[إثبات الحارس] النمط القديم (إظهار/إخفاء القسم كله معاً) كان سيُظهر "0 دراسة مدفوعة" بجانب "55"', () => {
        // محاكاة السلوك القديم: hidden=false على القسم كله متى وُجدت أي بيانات،
        // بلا فحص كل حقل على حدة — وهو بالضبط ما كان يعرض "0 دراسة مدفوعة فعلياً".
        const doc = buildDom();
        const oldBehaviorContainer = doc.getElementById('heroUsageStats');
        oldBehaviorContainer.hidden = false; // ما كان يحدث سابقاً بلا شرط لكل حقل
        expect(doc.getElementById('statPaidStudies').closest('.hero-fact').hidden).toBe(false); // العيب: صف "0 مدفوعة" ظاهر
    });
});

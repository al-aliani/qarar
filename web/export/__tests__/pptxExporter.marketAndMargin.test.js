/**
 * @vitest-environment jsdom
 *
 * مسح 2026-08-26 — بلاغان على «العرض التقديمي» (تصدير مدفوع يُعرض على مستثمر):
 *  1) شريحة «حجم السوق» تُضاف دائماً، فمن لم يملأ خطوة حجم السوق يستلم شريحة كاملة
 *     كلها «٠ ر.س.» بدل ألا توجد (wordExporter.js:108 يحمي نفس القسم منذ زمن).
 *  2) بطاقة «هامش الربح» كانت تحسب `netIncome / (revenue || 1)` فتحوّل صافي الخسارة
 *     نفسه إلى نسبة بالملايين حين لا إيراد (‎-28195031.3%‎).
 *
 * الفحص هنا على الملف الفعلي: نفكّ ضغط الـpptx الناتج ونقرأ نصوص الشرائح كما يراها
 * المستثمر — لا على متغيّرات داخلية.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { PPTXExporter } from '../pptxExporter.js';
import { createEmptyStudy } from '../../js/core/schema.js';
import { calculateStudy } from '../../js/core/engine.js';

function fakeStore(state) {
    return { getState: () => state };
}

/** مقهى حقيقي بإيراد: 3000 عميل/شهر × 25 ريال، معدات 400,000، 3 موظفين. */
function cafeState() {
    const s = createEmptyStudy();
    s.projectInfo.name = 'مقهى النرجس';
    s.revenue.streams = [
        { service: 'قهوة', customersPerMonth: 3000, avgPrice: 25, growthRate: 0.05, type: 'operating' }
    ];
    s.technical.equipment = [{ name: 'معدات', quantity: 1, price: 400000, depreciationRate: 0.15 }];
    s.hr.positions = [
        { position: 'باريستا', count: 3, months: 12, salary: 5000, nationality: 'saudi', isVariable: false }
    ];
    return s;
}

/** تكاليف بلا إيراد: مدير براتب 15,000 + معدات 400,000 ولم تُملأ مصادر الإيراد بعد. */
function noRevenueState() {
    const s = createEmptyStudy();
    s.projectInfo.name = 'مشروع قيد الإدخال';
    s.technical.equipment = [{ name: 'معدات', quantity: 1, price: 400000, depreciationRate: 0.15 }];
    s.hr.positions = [
        { position: 'مدير', count: 1, months: 12, salary: 15000, nationality: 'saudi', isVariable: false }
    ];
    return s;
}

/** نصوص كل شريحة في ملف الـpptx الناتج فعلياً. */
async function slideTexts(state) {
    const result = await new PPTXExporter(fakeStore(state)).export();
    expect(result.success).toBe(true);
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    const names = Object.keys(zip.files)
        .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    const slides = [];
    for (const name of names) {
        const xml = await zip.file(name).async('string');
        slides.push([...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m => m[1]));
    }
    return slides;
}

/** قيمة بطاقة «هامش الربح» في شريحة «أبرز المؤشرات». */
function marginValue(slides) {
    const kpi = slides.find(texts => texts.includes('أبرز المؤشرات'));
    expect(kpi).toBeTruthy();
    return kpi[kpi.indexOf('هامش الربح') + 1];
}

describe('PPTX — شريحة حجم السوق', () => {
    it('لا تُطبع إطلاقاً حين TAM/SAM/SOM كلها صفر', async () => {
        const state = cafeState(); // marketSizing فارغ كما في createEmptyStudy
        expect([state.marketSizing.tam?.value, state.marketSizing.sam?.value, state.marketSizing.som?.value]
            .some(v => Number(v) > 0)).toBe(false);

        const slides = await slideTexts(state);
        expect(slides.filter(texts => texts.includes('حجم السوق') || texts.includes('TAM'))).toEqual([]);
    });

    it('تُطبع كالمعتاد حين أُدخلت قيم سوق فعلية', async () => {
        const state = cafeState();
        state.marketSizing.tam = { value: 5000000 };
        state.marketSizing.sam = { value: 1200000 };
        state.marketSizing.som = { value: 300000 };

        const slides = await slideTexts(state);
        const market = slides.find(texts => texts.includes('حجم السوق'));
        expect(market).toBeTruthy();
        expect(market).toContain('TAM');
    });
});

describe('PPTX — بطاقة هامش الربح', () => {
    it('تطبع «—» لا نسبة بالملايين حين لا إيراد', async () => {
        const state = noRevenueState();
        const results = calculateStudy(state);
        const inc = results.incomeStatement[0];
        // شرطا البلاغ: مقام صفري وصافي خسارة كبير — الصيغة القديمة كانت تطبعه كنسبة.
        expect(inc.revenue).toBe(0);
        expect(inc.netIncome).toBeLessThan(-100000);

        expect(marginValue(await slideTexts(state))).toBe('—');
    });

    it('تطبع هامش المحرك الحقيقي حين يوجد إيراد', async () => {
        const state = cafeState();
        const engineMargin = calculateStudy(state).indicators.netMargin;
        expect(engineMargin).toBeGreaterThan(0.1);

        expect(marginValue(await slideTexts(state))).toBe((engineMargin * 100).toFixed(1) + '%');
    });
});

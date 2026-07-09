/**
 * اختبارات calculateIdeaScore.js — تدقيق دفعة 6 (2026-07-09):
 * 1) عتبات TAM (تُوزَّن 30%) ليست مشتقة من sectorBenchmarks.js كما فُعل بعتبات الهامش
 *    أعلاها — يثبّت هذا الاختبار وجود تعليق ASSUMPTION صريح فوق منطق عتبات TAM
 *    يفصح أنها أرقام داخلية ثابتة بلا سند قطاعي موثّق (بخلاف عتبات الهامش).
 * 2) المعامل الثاني الاختياري `results` يتفادى إعادة تشغيل المحرك الكامل
 *    (calculateStudy) حين يملك المستدعي نتيجة محسوبة مسبقاً — يثبّت الاختبار أن
 *    تمرير results يمنع استدعاء calculateStudy، وأن حذفه يستدعيه (المسار الاحتياطي).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.join(__dirname, '..', 'calculateIdeaScore.js');

const calculateStudyMock = vi.fn();
vi.mock('../engine.js', () => ({
    calculateStudy: (...args) => calculateStudyMock(...args)
}));

const { calculateIdeaScore } = await import('../calculateIdeaScore.js');

function makeState(overrides = {}) {
    return {
        projectInfo: { name: 'مشروع تجريبي', sector: 'مطعم' },
        marketSizing: { tam: { value: 2_000_000 } },
        ...overrides
    };
}

describe('calculateIdeaScore — تعليق ASSUMPTION فوق عتبات TAM', () => {
    it('يحتوي مصدر الملف على إفصاح ASSUMPTION قرب منطق عتبات TAM (لا سند قطاعي لها)', () => {
        const source = fs.readFileSync(SOURCE_PATH, 'utf8');

        // موقع تعليق TAM يجب أن يسبق أول استخدام لعتبة tamNum
        const tamCommentIdx = source.indexOf('ASSUMPTION');
        const tamThresholdIdx = source.indexOf('tamNum >=');
        expect(tamCommentIdx).toBeGreaterThan(-1);
        expect(tamThresholdIdx).toBeGreaterThan(-1);
        expect(tamCommentIdx).toBeLessThan(tamThresholdIdx);

        // النص نفسه يفصح أن لا حقل TAM في sectorBenchmarks.js (بخلاف الهامش)
        const assumptionBlock = source.slice(tamCommentIdx, tamThresholdIdx);
        expect(assumptionBlock).toMatch(/sectorBenchmarks\.js/);
        expect(assumptionBlock).toMatch(/لا يوجد|بلا سند|ليست معياراً/);
    });
});

describe('calculateIdeaScore — تفادي إعادة تشغيل المحرك عند توفر results', () => {
    beforeEach(() => {
        calculateStudyMock.mockReset();
    });

    it('تمرير results جاهزة لا يستدعي calculateStudy إطلاقاً', () => {
        const state = makeState();
        const precomputed = { indicators: { netMargin: 0.15 } };

        const result = calculateIdeaScore(state, precomputed);

        expect(calculateStudyMock).not.toHaveBeenCalled();
        expect(result.breakdown.margin).toBeGreaterThan(0);
    });

    it('حذف المعامل الثاني يستدعي calculateStudy (المسار الاحتياطي الداخلي)', () => {
        calculateStudyMock.mockReturnValue({ indicators: { netMargin: 0.15 } });
        const state = makeState();

        const result = calculateIdeaScore(state);

        expect(calculateStudyMock).toHaveBeenCalledTimes(1);
        expect(calculateStudyMock).toHaveBeenCalledWith(state);
        expect(result.breakdown.margin).toBeGreaterThan(0);
    });

    it('حذف المعامل الثاني مع رمي calculateStudy لاستثناء لا يكسر الدالة (يُعطى جزء من النقاط فقط)', () => {
        calculateStudyMock.mockImplementation(() => { throw new Error('لا بيانات كافية بعد'); });
        const state = makeState({
            revenue: { streams: [{ service: 'قهوة' }] },
            technical: { equipment: [{ price: 1000 }] }
        });

        const result = calculateIdeaScore(state);

        expect(calculateStudyMock).toHaveBeenCalledTimes(1);
        expect(result.breakdown.margin).toBe(10); // rev>0 && hasCosts
    });
});

/**
 * تدقيق 2026-07-09 — إصلاح علة #1: كانت score = completeness(0-40) + margin(0-30) +
 * tam(0-30) — أي أن مشروعاً بلا أي جدوى مالية فعلية (هامش=0، TAM=0) يمكن أن يحصل
 * على حتى 40/100 لمجرد ملء الحقول. الآن score = margin(0-50) + tam(0-50) حصراً،
 * وbreakdown.completeness معلوماتية بحتة (تبقى محسوبة ومُعادة، لكن مستبعدة من score).
 * هذان الاختباران يثبتان الفصل فعلياً في الاتجاهين: اكتمال مرتفع مع جودة مالية صفرية
 * يجب أن يعطي score=0 (لا 38+)، واكتمال شبه صفري مع جودة مالية ممتازة يجب أن يعطي
 * score=100 كاملاً (لا يُخصم منه لعدم ملء الحقول).
 */
describe('calculateIdeaScore — فصل اكتمال التعبئة عن جودة الفكرة المالية (علة #1)', () => {
    beforeEach(() => {
        calculateStudyMock.mockReset();
    });

    it('اكتمال تعبئة مرتفع (~95%) مع هامش=0 وTAM=0 يعطي score=0 — الاكتمال لا يُحتسب إطلاقاً', () => {
        const precomputed = { indicators: { netMargin: 0 } }; // نتيجة جاهزة — لا تشغّل calculateStudy
        const nearFullState = {
            projectInfo: {
                name: 'مشروع تجريبي', description: 'وصف تفصيلي للمشروع يوضح الفكرة والنطاق',
                city: 'الرياض', district: 'حي العليا', concept: 'مفهوم واضح', areaSize: 150,
                timeline: { projectStart: '2026-01-01', operationStart: '2026-03-01' },
                identityStatement: 'رسالتنا',
                locationAnalysis: { coordinates: { lat: 24.7, lng: 46.6 }, address: 'شارع كذا', selectionFactors: 'قرب العملاء' },
                dataGatheringChecklist: [{ done: true }]
            },
            keyPeople: { keyPeople: [{ name: 'فلان' }] },
            technical: {
                buildings: [{ type: 'مبنى' }], equipment: [{ price: 1000 }], furniture: [{ price: 500 }],
                productionCapacity: { annualCapacity: 1000, unitOrMeasure: 'وحدة' },
                locationAssessment: [{ factor: 'قرب' }]
            },
            hr: { positions: [{ title: 'مدير' }] },
            assumptions: { inflationRate: 0.02, taxRate: 0.2, discountRate: 0.1, workingCapitalMonths: 2, contingencyRate: 0.05, projectionYears: 5, thresholds: {} },
            techResources: { techResources: [{ name: 'نظام' }] },
            logistics: { logistics: [{ name: 'سيارة' }] },
            administrative: { administrative: [{ name: 'أثاث مكتبي' }] },
            legal: { licenses: [{ name: 'رخصة' }] },
            revenue: { streams: [{ service: 'خدمة' }] },
            marketing: {
                competitors: [{ name: 'منافس' }], campaigns: [{ name: 'حملة' }],
                marketingMix: { product: 'كذا' }, swot: { strengths: 'قوة' },
                marketAnalysis: {
                    marketSize: 1000,
                    summary: 'وصف مفصل للسوق يشرح الحجم والنمو والتوجهات الرئيسية بما يتجاوز خمسين حرفاً',
                    historicalData: [{ year: 2024 }]
                },
                supplyDemandBalance: [{ x: 1 }]
            },
            // ملاحظة: tam/sam/som متروكة فارغة عمداً — نريد tamScore=0 لهذا الاختبار
            marketSizing: { segments: [{ name: 'شريحة' }], vision2030: { alignment: true }, sectorAnalysis: 'تحليل', targetDistrict: 'حي' },
            strategic: {
                pestel: [{ description: 'تحليل سياسي' }],
                swot: { strengths: ['قوة'] },
                porter: { threatOfNewEntrants: { description: 'كذا' } }
            },
            services: { items: [{ name: 'خدمة1' }] },
            riskAnalysis: { risks: [{ name: 'خطر', description: 'وصف الخطر يفوق عشرين حرفاً بوضوح تام' }] },
            scenarios: { base: {}, pessimistic: {}, optimistic: {} },
            financing: { totalInvestment: 500000, sources: { equity: { amount: 200000 } } },
            executiveSummary: { projectOverview: 'ملخص تنفيذي طويل يشرح المشروع بتفصيل كافٍ يتجاوز خمسين حرفاً بوضوح' }
        };

        const result = calculateIdeaScore(nearFullState, precomputed);

        // تحقّق أن الاكتمال فعلاً مرتفع (وإلا فالاختبار لا يثبت شيئاً)
        expect(result.breakdown.completeness).toBeGreaterThan(30); // من أصل 40
        expect(result.breakdown.margin).toBe(0);
        expect(result.breakdown.tam).toBe(0);
        // العلة الأصلية: كانت score تساوي breakdown.completeness هنا (٣٠+) رغم انعدام أي جدوى مالية
        expect(result.score).toBe(0);
    });

    it('اكتمال تعبئة شبه صفري مع هامش وTAM ممتازين يعطي score=100 كاملاً — لا خصم لعدم ملء الحقول', () => {
        const precomputed = { indicators: { netMargin: 0.5 } }; // فوق سقف أي قطاع (بما فيه العام 0.05-0.25)
        const nearEmptyState = { projectInfo: {}, marketSizing: { tam: { value: 20_000_000 } } };

        const result = calculateIdeaScore(nearEmptyState, precomputed);

        expect(result.breakdown.margin).toBe(50);
        expect(result.breakdown.tam).toBe(50);
        expect(result.score).toBe(100); // لا يُخصم منه شيء لانخفاض اكتمال التعبئة
    });

    it('سقف الهامش وTAM الجديد هو 50 لكل منهما (كان 30) — score = margin + tam حصراً', () => {
        const precomputed = { indicators: { netMargin: 0.30 } }; // فوق sectorHi لقطاع fnb (0.18)
        const state = makeState({ projectInfo: { sector: 'مطعم' }, marketSizing: { tam: { value: 10_000_000 } } });

        const result = calculateIdeaScore(state, precomputed);

        expect(result.breakdown.margin).toBe(50);
        expect(result.breakdown.tam).toBe(50);
        expect(result.score).toBe(result.breakdown.margin + result.breakdown.tam);
        expect(result.score).toBe(100);
    });
});

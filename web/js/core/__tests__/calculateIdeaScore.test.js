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

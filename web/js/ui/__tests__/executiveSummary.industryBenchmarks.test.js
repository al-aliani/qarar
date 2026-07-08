/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة عالية #32): بطاقة «بنشمارك الصناعة» بالملخص التنفيذي كانت
 * تعرض 5 "صناعات" مستقلة مختلَقة (مطاعم/نوادي رياضية/تجزئة/خدمات مهنية/تقنية) بأرقام
 * هامش ربح/ROI/استرداد بلا أي مصدر، وأغلبها غير ذي صلة بمنصة مطاعم سعودية (نوادي
 * رياضية، تقنية عامة) — وتتناقض مع sectorBenchmarks.js (المصدر الموحّد لبقية المنصة).
 */
import { describe, it, expect } from 'vitest';
import { ExecutiveSummary } from '../ExecutiveSummary.js';
import { createEmptyStudy } from '../../core/schema.js';
import { SECTOR_BENCHMARKS } from '../../core/sectorBenchmarks.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {} };
}

describe('ExecutiveSummary — بنشمارك القطاع موحَّد مع sectorBenchmarks.js (#32)', () => {
    it('لا يعرض الصناعات المختلَقة القديمة (نوادي رياضية/تقنية) غير ذات الصلة', () => {
        const state = createEmptyStudy();
        const view = new ExecutiveSummary(null, fakeStore(state), null);
        const html = view.renderIndustryBenchmarks(state, {});

        expect(html).not.toContain('النوادي الرياضية');
        expect(html).not.toContain('التقنية');
        expect(html).not.toContain('الخدمات المهنية');
    });

    it('يعرض القطاعات الستة المعتمدة في sectorBenchmarks.js بنفس تسمياتها بالضبط', () => {
        const state = createEmptyStudy();
        const view = new ExecutiveSummary(null, fakeStore(state), null);
        const html = view.renderIndustryBenchmarks(state, {});

        Object.values(SECTOR_BENCHMARKS).forEach(b => {
            expect(html).toContain(b.label);
        });
    });

    it('يعرض نطاق هامش الربح لقطاع المطاعم مطابقاً تماماً لـ sectorBenchmarks.js (لا رقم منفصل مختلَق)', () => {
        const state = createEmptyStudy();
        const view = new ExecutiveSummary(null, fakeStore(state), null);
        const html = view.renderIndustryBenchmarks(state, {});

        const fnb = SECTOR_BENCHMARKS.fnb;
        const lo = Math.round(fnb.netProfitToRevenue[0] * 100);
        const hi = Math.round(fnb.netProfitToRevenue[1] * 100);
        expect(html).toContain(`${lo}-${hi}%`);
    });

    it('يُميّز صف قطاع الدراسة المكتشَف فعلياً بعلامة "(قطاعك)"', () => {
        const state = createEmptyStudy();
        state.projectInfo = { ...state.projectInfo, sector: 'مطعم وجبات سريعة' };
        const view = new ExecutiveSummary(null, fakeStore(state), null);
        const html = view.renderIndustryBenchmarks(state, {});

        expect(html).toContain('مطاعم ومقاهي (قطاعك)');
    });

    it('لا يختلق أرقام ROI/استرداد قطاعية — يعرض شرطة بدلاً منها لصفوف البنشمارك', () => {
        const state = createEmptyStudy();
        const view = new ExecutiveSummary(null, fakeStore(state), null);
        const html = view.renderIndustryBenchmarks(state, {});

        // كل صفوف البنشمارك (بخلاف صف "مشروعك") يجب أن تحتوي "—" لعمودي ROI/الاسترداد
        const dashCount = (html.match(/—/g) || []).length;
        expect(dashCount).toBe(Object.keys(SECTOR_BENCHMARKS).length * 2);
    });
});

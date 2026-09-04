/**
 * تدقيق 2026-09-04: بطاقة «هل أرقامي منطقية؟» كانت تحمل **جدول معايير قطاعي ثانياً
 * وكاشف قطاع مستقلاً** يناقضان المصدر الموحّد في core/sectorBenchmarks.js — رغم أن
 * ذاك يوثّق نفسه بأنه «نقطة الدخول الوحيدة كي لا يتناقض حكمان على نفس الرقم».
 *
 * الأثر الملموس: عيادة برواتب 40% من المبيعات تحصل في نفس الجلسة على «مقبول» من
 * بوابة الجودة والمستشار (نطاق خدمي 30–50%) و«خارج النطاق» من هذه البطاقة (نطاق
 * «عام» 20–35%). وكاشفها المحلي لم يكن يطابق «رعاية صحية / عيادة» ولا «صالون /
 * مركز تجميل» ولا «تعليم وتدريب» — فيُكتب للمستخدم صراحةً أن قطاعه «عام».
 */
import { describe, it, expect } from 'vitest';
import { renderBenchmarkingSection } from '../BenchmarkingView.js';
import { SECTOR_BENCHMARKS } from '../../core/sectorBenchmarks.js';

function resultsWithLabor(laborShare) {
    const revenue = 1000000;
    return {
        incomeStatement: [{ revenue, variableCosts: revenue * 0.2, grossProfit: revenue * 0.8, netIncome: revenue * 0.2 }],
        indicators: { grossMargin: 0.8, paybackPeriod: 2 },
        opex: {
            payrollAnnual: revenue * laborShare,
            rentAnnual: revenue * 0.08,
            marketingAnnual: revenue * 0.05,
            totalAnnual: revenue * (laborShare + 0.13),
        },
    };
}

const state = (concept) => ({ projectInfo: { concept } });

describe('بطاقة «هل أرقامي منطقية؟» تستهلك المصدر القطاعي الموحّد', () => {
    it('تسمّي القطاع بنفس تسمية المصدر الموحّد — لا «عام» لنشاط معروف', () => {
        for (const [concept, expected] of [
            ['رعاية صحية / عيادة', SECTOR_BENCHMARKS.service.label],
            ['صالون / مركز تجميل', SECTOR_BENCHMARKS.service.label],
            ['تعليم وتدريب', SECTOR_BENCHMARKS.service.label],
            ['مطعم', SECTOR_BENCHMARKS.fnb.label],
        ]) {
            const html = renderBenchmarkingSection(resultsWithLabor(0.4), state(concept));
            expect(html, concept).toContain(expected);
        }
    });

    it('نطاق الرواتب المعروض للعيادة هو النطاق الخدمي (30–50%) لا العام (20–35%)', () => {
        const html = renderBenchmarkingSection(resultsWithLabor(0.4), state('رعاية صحية / عيادة'));
        const [lo, hi] = SECTOR_BENCHMARKS.service.laborToRevenue;
        expect(html).toContain(`${Math.round(lo * 100)}-${Math.round(hi * 100)}%`);
    });

    it('رواتب 40% لعيادة تُعرض داخل النطاق — لا تناقض مع بوابة الجودة', () => {
        const html = renderBenchmarkingSection(resultsWithLabor(0.4), state('رعاية صحية / عيادة'));
        const laborBlock = html.slice(html.indexOf('نسبة الرواتب'), html.indexOf('نسبة الرواتب') + 400);
        expect(laborBlock).not.toContain('خارج النطاق');
    });

    it('مجمل الربح مشتقّ من نطاق التكلفة المتغيرة لا رقماً مستقلاً', () => {
        const html = renderBenchmarkingSection(resultsWithLabor(0.4), state('مطعم'));
        const [vcLo, vcHi] = SECTOR_BENCHMARKS.fnb.variableCostRate;
        const expected = `${100 - Math.round(vcHi * 100)}-${100 - Math.round(vcLo * 100)}%`;
        expect(html).toContain(expected);
    });

    it('تُفصح صراحةً حين لا يكون النشاط محدداً بدل الادعاء بمعرفة القطاع', () => {
        const html = renderBenchmarkingSection(resultsWithLabor(0.4), state(''));
        expect(html).toContain('لم يُحدَّد نشاط المشروع بدقة');
    });
});

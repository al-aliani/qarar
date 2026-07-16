import { describe, it, expect } from 'vitest';
import { forecastDemandTrend, NATIONAL_POPULATION_GROWTH_RATE, getCitySnapshot } from '../marketSizingModel.js';
import { PROVENANCE } from '../../services/DataConnectors.js';

describe('forecastDemandTrend — توقع سكاني/طلب بسيط', () => {
    it('يعيد سنة الأساس (offset=0) مطابقة تماماً للقطة GASTAT وموسومة SOURCED', () => {
        const forecast = forecastDemandTrend('الرياض', 3);
        const snapshot = getCitySnapshot('الرياض');
        expect(forecast.points[0].yearOffset).toBe(0);
        expect(forecast.points[0].value).toBe(snapshot.population);
        expect(forecast.points[0].provenance).toBe(PROVENANCE.SOURCED);
    });

    it('نقاط التوقع اللاحقة موسومة ASSUMPTION صراحة (لا تُخلط بالمصدر)', () => {
        const forecast = forecastDemandTrend('جدة', 3);
        const projected = forecast.points.slice(1);
        expect(projected.length).toBe(3);
        projected.forEach(pt => {
            expect(pt.provenance).toBe(PROVENANCE.ASSUMPTION);
            expect(pt.note).toMatch(/توقع|تقدير/);
        });
    });

    it('اتجاه تصاعدي ثابت (نمو موجب مركّب) — كل سنة أعلى من سابقتها', () => {
        const forecast = forecastDemandTrend('الدمام', 3);
        for (let i = 1; i < forecast.points.length; i++) {
            expect(forecast.points[i].value).toBeGreaterThan(forecast.points[i - 1].value);
        }
    });

    it('معدل النمو المستخدم مطابق للثابت المُصدَّر NATIONAL_POPULATION_GROWTH_RATE', () => {
        const forecast = forecastDemandTrend('الرياض', 2);
        expect(forecast.growthRatePct).toBe(NATIONAL_POPULATION_GROWTH_RATE.rate);
        expect(forecast.growthRateSource.provenance).toBeUndefined(); // كائن مصدر لا Datum
        expect(forecast.growthRateSource.source).toMatch(/GASTAT|الإحصاء/);
    });

    it('الافتراضي years=3 حين لا يُمرَّر أي شيء', () => {
        const forecast = forecastDemandTrend('الرياض');
        expect(forecast.years).toBe(3);
        expect(forecast.points.length).toBe(4);
    });

    it('مدينة غير معروفة/فارغة لا ترمي خطأ (fallback إلى «أخرى»)', () => {
        expect(() => forecastDemandTrend('', 2)).not.toThrow();
        expect(() => forecastDemandTrend('مدينة-غير-موجودة', 2)).not.toThrow();
    });

    it('حساب مركّب صحيح حسابياً لسنة واحدة', () => {
        const forecast = forecastDemandTrend('الرياض', 1);
        const base = getCitySnapshot('الرياض').population;
        const rate = NATIONAL_POPULATION_GROWTH_RATE.rate;
        expect(forecast.points[1].value).toBe(Math.round(base * (1 + rate)));
    });
});

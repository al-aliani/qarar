/**
 * buildNitaqatHrCardData (nitaqatHrCard.js) — يجمع تصنيف نطاقات + مقارنة تكلفة
 * سعودي/وافد لبطاقة الموارد البشرية (مهمة Nitaqat، دفعة 4). دالة نقية بلا DOM.
 */
import { describe, it, expect } from 'vitest';
import { buildNitaqatHrCardData } from '../nitaqatHrCard.js';
import { computeAnnualEmployeeCost } from '../engine.js';

describe('buildNitaqatHrCardData', () => {
    it('بلا وظائف بعد: tierInfo=null لكن مقارنة التكلفة تُبنى براتب توضيحي (avgSalaryIsAssumed=true)', () => {
        const data = buildNitaqatHrCardData({});
        expect(data.tierInfo).toBeNull();
        expect(data.totalHeadcount).toBe(0);
        expect(data.avgSalaryIsAssumed).toBe(true);
        expect(data.saudiAnnualCost).toBeGreaterThan(0);
        expect(data.expatAnnualCost).toBeGreaterThan(0);
    });

    it('يحسب نسبة التوطين الصحيحة من hr.positions (سعودي مقابل وافد بأعداد مختلفة)', () => {
        const state = {
            hr: {
                positions: [
                    { position: 'مدير', nationality: 'saudi', count: 1, salary: 12000 },
                    { position: 'كاشير', nationality: 'expat', count: 3, salary: 4000 }
                ]
            }
        };
        const data = buildNitaqatHrCardData(state);
        expect(data.totalHeadcount).toBe(4);
        expect(data.saudiHeadcount).toBe(1);
        expect(data.rate).toBeCloseTo(0.25, 6);
        expect(data.tierInfo).not.toBeNull();
        expect(data.avgSalaryIsAssumed).toBe(false);
    });

    it('يكتشف القطاع من projectInfo.sector ويمرّره لتصنيف النطاق', () => {
        const state = {
            projectInfo: { sector: 'مطعم شعبي' },
            hr: { positions: [{ position: 'شيف', nationality: 'saudi', count: 1, salary: 9000 }] }
        };
        const data = buildNitaqatHrCardData(state);
        expect(data.sectorLabel).toBe('مطاعم ومقاهي');
        expect(data.tierInfo.tier).toBe('platinum'); // 100% سعودة
    });

    it('مقارنة التكلفة تطابق computeAnnualEmployeeCost لنفس متوسط الراتب وإعدادات hr', () => {
        const state = {
            hr: {
                positions: [
                    { position: 'أ', nationality: 'saudi', count: 1, salary: 10000 },
                    { position: 'ب', nationality: 'expat', count: 1, salary: 8000 }
                ],
                healthInsurancePerHead: 1800,
                govtFees: { workCard: 9600, ticket: 2500, iqama: 650 }
            }
        };
        const data = buildNitaqatHrCardData(state);
        const avgSalary = (10000 + 8000) / 2;
        expect(data.avgSalary).toBeCloseTo(avgSalary, 6);

        const expectedSaudi = computeAnnualEmployeeCost({
            salary: avgSalary, months: 12, nationality: 'saudi',
            healthInsurancePerHead: 1800, govtFees: { workCard: 9600, ticket: 2500, iqama: 650 }
        });
        const expectedExpat = computeAnnualEmployeeCost({
            salary: avgSalary, months: 12, nationality: 'expat',
            healthInsurancePerHead: 1800, govtFees: { workCard: 9600, ticket: 2500, iqama: 650 }
        });
        expect(data.saudiAnnualCost).toBeCloseTo(expectedSaudi, 6);
        expect(data.expatAnnualCost).toBeCloseTo(expectedExpat, 6);
        expect(data.costDiff).toBeCloseTo(expectedSaudi - expectedExpat, 6);
    });

    it('لا يرمي مع state فارغة/undefined تماماً', () => {
        expect(() => buildNitaqatHrCardData(undefined)).not.toThrow();
        expect(() => buildNitaqatHrCardData({})).not.toThrow();
    });
});

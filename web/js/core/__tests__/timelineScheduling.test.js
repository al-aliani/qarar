import { describe, it, expect } from 'vitest';
import {
    computeCriticalPath,
    suggestParallelTracks,
    estimateDelayRisk,
    computeLinkedCashFlow,
    checkFinancingCollision,
    DELAY_RISK_VARIANCE
} from '../timelineScheduling.js';

describe('computeCriticalPath', () => {
    it('يُرجع empty لقائمة فارغة', () => {
        expect(computeCriticalPath([])).toEqual({ ok: false, reason: 'empty' });
    });

    it('نشاط مستقل واحد: earliestStart=0، حرج (لا مساحة سلاك ممكنة)', () => {
        const result = computeCriticalPath([{ id: 1, duration: 3 }]);
        expect(result.ok).toBe(true);
        expect(result.totalDuration).toBe(3);
        expect(result.byId['1']).toMatchObject({ earliestStart: 0, earliestFinish: 3, isCritical: true, slack: 0 });
    });

    it('سلسلة تبعيات خطية: earliestStart يتراكم، كلها حرجة', () => {
        const activities = [
            { id: 'a', duration: 2, dependsOn: [] },
            { id: 'b', duration: 3, dependsOn: ['a'] },
            { id: 'c', duration: 1, dependsOn: ['b'] }
        ];
        const result = computeCriticalPath(activities);
        expect(result.totalDuration).toBe(6);
        expect(result.byId.a).toMatchObject({ earliestStart: 0, earliestFinish: 2, isCritical: true });
        expect(result.byId.b).toMatchObject({ earliestStart: 2, earliestFinish: 5, isCritical: true });
        expect(result.byId.c).toMatchObject({ earliestStart: 5, earliestFinish: 6, isCritical: true });
    });

    it('مسار موازٍ أقصر له سلاك موجب وليس حرجاً', () => {
        // a(4) -> c(1) هو المسار الحرج (5)؛ b(1) مستقل وينتهي المشروع عند 5، فسلاكه = 5-1 = 4
        const activities = [
            { id: 'a', duration: 4, dependsOn: [] },
            { id: 'b', duration: 1, dependsOn: [] },
            { id: 'c', duration: 1, dependsOn: ['a'] }
        ];
        const result = computeCriticalPath(activities);
        expect(result.totalDuration).toBe(5);
        expect(result.byId.a.isCritical).toBe(true);
        expect(result.byId.c.isCritical).toBe(true);
        expect(result.byId.b.isCritical).toBe(false);
        expect(result.byId.b.slack).toBeGreaterThan(0);
    });

    it('دورة تبعيات تُعاد كـcycle بلا رمي', () => {
        const activities = [
            { id: 'a', duration: 1, dependsOn: ['b'] },
            { id: 'b', duration: 1, dependsOn: ['a'] }
        ];
        expect(() => computeCriticalPath(activities)).not.toThrow();
        expect(computeCriticalPath(activities)).toEqual({ ok: false, reason: 'cycle' });
    });

    it('dependsOn لمعرّف غير موجود يُتجاهَل بأمان (لا رمي، لا يُحتسب تبعية وهمية)', () => {
        const activities = [{ id: 'a', duration: 2, dependsOn: ['ghost'] }];
        const result = computeCriticalPath(activities);
        expect(result.ok).toBe(true);
        expect(result.byId.a.earliestStart).toBe(0);
    });
});

describe('suggestParallelTracks', () => {
    it('نشاطان مستقلان بلا تبعية بينهما يقعان في نفس المجموعة (يمكن تنفيذهما معاً)', () => {
        const result = suggestParallelTracks([{ id: 'a', duration: 2 }, { id: 'b', duration: 3 }]);
        expect(result.ok).toBe(true);
        expect(result.groups.length).toBe(1);
        expect(result.groups[0].sort()).toEqual(['a', 'b']);
    });

    it('نشاط يعتمد على آخر يقع في مجموعة مختلفة (لا يمكن تنفيذهما معاً)', () => {
        const result = suggestParallelTracks([
            { id: 'a', duration: 2, dependsOn: [] },
            { id: 'b', duration: 2, dependsOn: ['a'] }
        ]);
        expect(result.groups.length).toBe(2);
    });

    it('يُعيد نفس فشل computeCriticalPath عند وجود دورة', () => {
        const activities = [{ id: 'a', duration: 1, dependsOn: ['b'] }, { id: 'b', duration: 1, dependsOn: ['a'] }];
        expect(suggestParallelTracks(activities)).toEqual({ ok: false, reason: 'cycle' });
    });
});

describe('estimateDelayRisk', () => {
    it('يستخدم نطاق تباين القطاع الصحيح ويحسب أشهر إضافية تقريبية', () => {
        const [risk] = estimateDelayRisk([{ id: 1, category: 'legal', duration: 2 }]);
        expect(risk.variance).toBe(DELAY_RISK_VARIANCE.legal);
        expect(risk.extraMonths).toBeCloseTo(2 * DELAY_RISK_VARIANCE.legal, 1);
    });

    it('قطاع غير معروف يستخدم افتراض technical', () => {
        const [risk] = estimateDelayRisk([{ id: 1, category: 'unknown_cat', duration: 4 }]);
        expect(risk.variance).toBe(DELAY_RISK_VARIANCE.technical);
    });

    it('لا يرمي على مصفوفة فارغة/غير معرّفة', () => {
        expect(() => estimateDelayRisk([])).not.toThrow();
        expect(estimateDelayRisk(undefined)).toEqual([]);
    });
});

describe('computeLinkedCashFlow', () => {
    it('يجمع تكلفة بند تأسيس مرتبط في شهر بدء النشاط', () => {
        const activities = [{ id: 1, startMonth: 3, costItemName: 'ديكورات' }];
        const costs = [{ name: 'ديكورات', amount: 50000 }];
        expect(computeLinkedCashFlow(activities, costs)).toEqual({ 3: 50000 });
    });

    it('يتجاهل نشاطاً بلا ربط تكلفة، ولا يرمي عند اسم غير مطابق', () => {
        const activities = [{ id: 1, startMonth: 2 }, { id: 2, startMonth: 2, costItemName: 'غير موجود' }];
        expect(computeLinkedCashFlow(activities, [{ name: 'ديكورات', amount: 1000 }])).toEqual({});
    });
});

describe('checkFinancingCollision', () => {
    it('لا تنبيهات عند عدم توفر تمويل مُدخل (بلا افتراض)', () => {
        const activities = [{ id: 1, startMonth: 1, costItemName: 'أ' }];
        const costs = [{ name: 'أ', amount: 500000 }];
        expect(checkFinancingCollision(activities, costs, {})).toEqual([]);
    });

    it('يُنبّه عندما تتجاوز التكلفة التراكمية المرتبطة رأس المال المتاح', () => {
        const activities = [
            { id: 1, startMonth: 1, costItemName: 'أ' },
            { id: 2, startMonth: 2, costItemName: 'ب' }
        ];
        const costs = [{ name: 'أ', amount: 100000 }, { name: 'ب', amount: 200000 }];
        const financing = { sources: { equity: { amount: 150000 }, bankLoan: { amount: 0 } } };
        const warnings = checkFinancingCollision(activities, costs, financing);
        expect(warnings.length).toBe(1);
        expect(warnings[0]).toMatchObject({ month: 2, required: 300000, available: 150000, shortfall: 150000 });
    });
});

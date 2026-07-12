/**
 * دفعة 3 (2026-07-12): resolveQaStepIndex يربط تحذيرات qaChecks.js/validateInputs.js
 * بفهرس خطوة المعالج المسؤولة — أساس قائمة التصدير المفصّلة القابلة للنقر (3.3).
 */
import { describe, it, expect } from 'vitest';
import { resolveQaStepIndex } from '../qaStepMapper.js';
import { STEPS, stepIndexById } from '../../core/wizardSteps.js';

describe('resolveQaStepIndex — مسارات مباشرة تطابق مفتاح SECTIONS', () => {
    it('legal.licenses يقود لخطوة الدراسة القانونية', () => {
        expect(resolveQaStepIndex({ path: 'legal.licenses' })).toBe(stepIndexById('legal'));
    });

    it('marketing.competitors يقود لخطوة الدراسة السوقية', () => {
        expect(resolveQaStepIndex({ path: 'marketing.competitors' })).toBe(stepIndexById('marketing'));
    });

    it('marketSizing.targetNeighborhood يقود لخطوة تحجيم السوق (معرّف مطابق تماماً لأول جزء من المسار)', () => {
        expect(resolveQaStepIndex({ path: 'marketSizing.targetNeighborhood' })).toBe(stepIndexById('marketSizing'));
    });

    it('revenue (بلا نقطة) يقود لخطوة مصادر الإيرادات', () => {
        expect(resolveQaStepIndex({ path: 'revenue' })).toBe(stepIndexById('revenue'));
    });

    it('assumptions.rampUpMonths يقود لخطوة الافتراضات المالية', () => {
        expect(resolveQaStepIndex({ path: 'assumptions.rampUpMonths' })).toBe(stepIndexById('assumptions'));
    });

    it('financing.sources يقود لخطوة التمويل', () => {
        expect(resolveQaStepIndex({ path: 'financing.sources' })).toBe(stepIndexById('financing'));
    });

    it('projectInfo.name يقود لخطوة معلومات المشروع', () => {
        expect(resolveQaStepIndex({ path: 'projectInfo.name' })).toBe(stepIndexById('projectInfo'));
    });
});

describe('resolveQaStepIndex — مسارات نتائج محسوبة (بلا قسم إدخال مباشر)', () => {
    it('kpis.irr يقود للوحة المؤشرات المالية', () => {
        expect(resolveQaStepIndex({ path: 'kpis.irr' })).toBe(stepIndexById('dashboard'));
    });

    it('decision يقود للوحة القرار الاستثماري', () => {
        expect(resolveQaStepIndex({ path: 'decision' })).toBe(stepIndexById('decisionDashboard'));
    });

    it('incomeStatement يقود للقوائم المالية التقديرية', () => {
        expect(resolveQaStepIndex({ path: 'incomeStatement' })).toBe(stepIndexById('financialStatements'));
    });

    it('capex يقود لخطوة الأصول والتجهيزات', () => {
        expect(resolveQaStepIndex({ path: 'capex' })).toBe(stepIndexById('technical'));
    });
});

describe('resolveQaStepIndex — تحذيرات معايير القطاع (drivers) موجَّهة بدقة حسب الرمز', () => {
    it('BENCH_VC_RATE_HIGH يقود لمصادر الإيرادات لا اللوحة العامة', () => {
        expect(resolveQaStepIndex({ code: 'BENCH_VC_RATE_HIGH', path: 'drivers' })).toBe(stepIndexById('revenue'));
    });

    it('BENCH_RENT_RATIO_LOW يقود للموارد الإدارية', () => {
        expect(resolveQaStepIndex({ code: 'BENCH_RENT_RATIO_LOW', path: 'drivers' })).toBe(stepIndexById('administrative'));
    });

    it('BENCH_LABOR_RATIO_HIGH يقود لخطوة الفريق والرواتب', () => {
        expect(resolveQaStepIndex({ code: 'BENCH_LABOR_RATIO_HIGH', path: 'drivers' })).toBe(stepIndexById('hr'));
    });

    it('drivers بلا رمز معروف يقود للوحة المؤشرات كاحتياطي عام', () => {
        expect(resolveQaStepIndex({ code: 'UNKNOWN_CODE', path: 'drivers' })).toBe(stepIndexById('dashboard'));
    });
});

describe('resolveQaStepIndex — مسار غير معروف يعيد null بدل فهرس خاطئ', () => {
    it('مسار "system" (خطأ فحص الجودة نفسه) لا رابط منطقي له', () => {
        expect(resolveQaStepIndex({ path: 'system' })).toBeNull();
    });

    it('بلا path إطلاقاً يعيد null', () => {
        expect(resolveQaStepIndex({})).toBeNull();
    });
});

describe('resolveQaStepIndex — كل فهرس مُعاد صالح فعلياً ضمن STEPS', () => {
    it('كل النتائج غير null هي فهارس صحيحة ضمن حدود STEPS', () => {
        const samples = [
            { path: 'legal.licenses' }, { path: 'marketing.competitors' }, { path: 'revenue' },
            { path: 'kpis.dscr' }, { path: 'decision' }, { code: 'BENCH_VC_RATE_HIGH', path: 'drivers' }
        ];
        samples.forEach(s => {
            const idx = resolveQaStepIndex(s);
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThan(STEPS.length);
        });
    });
});

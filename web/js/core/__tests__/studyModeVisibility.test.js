/**
 * تدقيق المالك 2026-07-13: أوضاع «مصغّر/بسيط» لم تكن تقصّر شيئاً فعلياً (صفحة الفئات
 * كانت تتجاهل الوضع، والأوضاع القديمة تخفي أقساماً فقط دون تقليل الأسئلة داخل القسم).
 * هذه الاختبارات تثبّت المصدر الواحد الجديد في wizardSteps.js: أي الأقسام تظهر في كل
 * وضع، وأي الحقول/الجداول الجوهرية تظهر داخل الخطوة في الوضع المصغّر، وأن مجموعة
 * «مصغّر» تنكمش فعلياً إلى تصنيفات قليلة في صفحة الفئات.
 */
import { describe, it, expect } from 'vitest';
import {
    STEPS,
    SIDEBAR_SECTIONS,
    SECTIONS,
    MINI_MODE_STEP_IDS,
    SIMPLE_MODE_HIDDEN_STEP_IDS,
    isStepVisibleInStudyMode,
    miniEssentialFields,
    miniEssentialTables,
} from '../wizardSteps.js';

const stepIds = new Set(STEPS.map(s => s.id));

describe('أوضاع تفصيل الدراسة — إظهار الأقسام', () => {
    it('كل معرّف في MINI_MODE_STEP_IDS خطوة حقيقية في STEPS (لا معرّف ميت)', () => {
        MINI_MODE_STEP_IDS.forEach(id => {
            expect(stepIds.has(id), `المعرّف ${id} غير موجود في STEPS`).toBe(true);
        });
    });

    it('كل معرّف في SIMPLE_MODE_HIDDEN_STEP_IDS خطوة حقيقية في STEPS', () => {
        SIMPLE_MODE_HIDDEN_STEP_IDS.forEach(id => {
            expect(stepIds.has(id), `المعرّف ${id} غير موجود في STEPS`).toBe(true);
        });
    });

    it('مصغّر يعرض فقط الأقسام الجوهرية الستة + لوحة القرار', () => {
        const visible = STEPS.filter(s => isStepVisibleInStudyMode(s.id, 'mini')).map(s => s.id);
        expect(visible.sort()).toEqual([...MINI_MODE_STEP_IDS].sort());
        // أقسام ثقيلة يجب ألا تظهر في المصغّر
        [SECTIONS.MARKETING, SECTIONS.STRATEGIC, SECTIONS.RISK_ANALYSIS, SECTIONS.MONTE_CARLO,
         SECTIONS.SERVICES, 'sensitivity', SECTIONS.APPENDICES].forEach(id => {
            expect(isStepVisibleInStudyMode(id, 'mini'), `${id} يجب ألا يظهر في مصغّر`).toBe(false);
        });
    });

    it('مصغّر أقصر فعلياً من بسيط، وبسيط أقصر من مفصّل (تقصير حقيقي في عدد الأقسام)', () => {
        const count = (mode) => STEPS.filter(s => isStepVisibleInStudyMode(s.id, mode)).length;
        const mini = count('mini');
        const simple = count('simple');
        const advanced = count('advanced');
        expect(mini).toBeLessThan(simple);
        expect(simple).toBeLessThan(advanced);
        expect(advanced).toBe(STEPS.length); // مفصّل = كل الخطوات
        expect(mini).toBe(MINI_MODE_STEP_IDS.length);
    });

    it('بسيط يبقي أساس الدراسة (سوق/استراتيجي/مخاطر) لكن يخفي التحليلات المتقدمة', () => {
        // يبقى
        [SECTIONS.MARKETING, SECTIONS.STRATEGIC, SECTIONS.RISK_ANALYSIS,
         SECTIONS.TECHNICAL, SECTIONS.LEGAL, SECTIONS.FINANCING].forEach(id => {
            expect(isStepVisibleInStudyMode(id, 'simple'), `${id} يجب أن يبقى في بسيط`).toBe(true);
        });
        // يُخفى
        [SECTIONS.MONTE_CARLO, 'sensitivity', 'stress_test', SECTIONS.VALUATION,
         SECTIONS.SCENARIOS, 'marketSizing', SECTIONS.ACTUALS, 'reportBuilder'].forEach(id => {
            expect(isStepVisibleInStudyMode(id, 'simple'), `${id} يجب أن يُخفى في بسيط`).toBe(false);
        });
    });

    it('مفصّل (أو أي وضع غير معروف) يعرض كل شيء', () => {
        STEPS.forEach(s => {
            expect(isStepVisibleInStudyMode(s.id, 'advanced')).toBe(true);
            expect(isStepVisibleInStudyMode(s.id, undefined)).toBe(true);
        });
    });
});

describe('أوضاع تفصيل الدراسة — انكماش التصنيفات في صفحة الفئات (منطق app.js)', () => {
    // يحاكي visibleCategoryIndexesForMode في app.js بالاعتماد على نفس المصدر الواحد.
    const visibleCategoryIndexes = (mode) => {
        const visible = new Set(
            STEPS.map((_, i) => i).filter(i => isStepVisibleInStudyMode(STEPS[i].id, mode))
        );
        const cats = [];
        SIDEBAR_SECTIONS.forEach((cat, idx) => {
            for (let i = cat.range[0]; i <= cat.range[1]; i++) {
                if (visible.has(i)) { cats.push(idx); break; }
            }
        });
        return cats;
    };

    it('مصغّر ينكمش لتصنيفات قليلة غير فارغة (لا صفحات «لا توجد أقسام» في التنقل)', () => {
        const cats = visibleCategoryIndexes('mini');
        // مصغّر يمسّ: التعريف(0)، السوق/الإيراد(1)، التشغيل(2)، المالية(4)، النتائج(7)
        expect(cats).toEqual([0, 1, 2, 4, 7]);
        // التصنيفات الفارغة (خطة التنفيذ/المخاطر/الأدلة) تُستبعد من التنقل
        expect(cats).not.toContain(3);
        expect(cats).not.toContain(5);
        expect(cats).not.toContain(6);
    });

    it('مفصّل يُبقي كل التصنيفات ظاهرة', () => {
        expect(visibleCategoryIndexes('advanced')).toEqual(SIDEBAR_SECTIONS.map((_, i) => i));
    });
});

describe('أوضاع تفصيل الدراسة — تقصير الأسئلة داخل الخطوة (مصغّر)', () => {
    it('يقصّر حقول معلومات المشروع والافتراضات إلى الجوهري فقط', () => {
        expect(miniEssentialFields(SECTIONS.PROJECT_INFO)).toEqual(
            ['name', 'description', 'city', 'concept', 'targetSegment']
        );
        expect(miniEssentialFields(SECTIONS.ASSUMPTIONS)).toEqual(
            ['discountRate', 'inflationRate', 'projectionYears']
        );
    });

    it('يقصّر جداول الأصول والفريق إلى الجوهري فقط', () => {
        expect(miniEssentialTables(SECTIONS.TECHNICAL)).toEqual(
            ['establishmentCosts', 'equipment', 'furniture']
        );
        expect(miniEssentialTables(SECTIONS.HR)).toEqual(['positions']);
    });

    it('الأقسام بلا تقصير مُعرّف تُعيد null (تُعرض كاملةً)', () => {
        expect(miniEssentialFields(SECTIONS.FINANCING)).toBeNull();
        expect(miniEssentialTables(SECTIONS.REVENUE)).toBeNull();
    });
});

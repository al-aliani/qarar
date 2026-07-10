import { describe, expect, it } from 'vitest';
import { SECTIONS, SIDEBAR_SECTIONS, STEPS, STEP_HELP } from '../wizardSteps.js';

const indexOf = id => STEPS.findIndex(step => step.id === id);

describe('ترتيب الرحلة التشغيلية', () => {
    it('يحافظ على 41 خطوة فريدة وشرح مطابق لكل خطوة', () => {
        expect(STEPS).toHaveLength(41);
        expect(new Set(STEPS.map(step => step.id)).size).toBe(41);
        expect(STEP_HELP).toHaveLength(41);
        expect(STEP_HELP.every(Boolean)).toBe(true);
    });

    it('يبني السوق قبل الإيرادات، والتشغيل قبل المال', () => {
        expect(indexOf('marketSizing')).toBeLessThan(indexOf(SECTIONS.MARKETING));
        expect(indexOf(SECTIONS.MARKETING)).toBeLessThan(indexOf(SECTIONS.REVENUE));
        expect(indexOf(SECTIONS.TECHNICAL)).toBeLessThan(indexOf('operational_sim'));
        expect(indexOf(SECTIONS.LEGAL)).toBeLessThan(indexOf(SECTIONS.TIMELINE));
        expect(indexOf(SECTIONS.TIMELINE)).toBeLessThan(indexOf(SECTIONS.ASSUMPTIONS));
        expect(indexOf(SECTIONS.ASSUMPTIONS)).toBeLessThan(indexOf(SECTIONS.FINANCING));
        expect(indexOf(SECTIONS.FINANCING)).toBeLessThan(indexOf(SECTIONS.FINANCIAL_STATEMENTS));
    });

    it('يرتب المخاطر من السيناريو إلى الاختبارات الأعمق ثم الأدلة والقرار', () => {
        expect(indexOf(SECTIONS.RISK_ANALYSIS)).toBeLessThan(indexOf(SECTIONS.SCENARIOS));
        expect(indexOf(SECTIONS.SCENARIOS)).toBeLessThan(indexOf('sensitivity'));
        expect(indexOf('sensitivity')).toBeLessThan(indexOf('stress_test'));
        expect(indexOf('stress_test')).toBeLessThan(indexOf(SECTIONS.MONTE_CARLO));
        expect(indexOf(SECTIONS.APPENDICES)).toBe(34);
        expect(indexOf('dashboard')).toBeLessThan(indexOf(SECTIONS.DECISION_DASHBOARD));
        expect(indexOf(SECTIONS.DECISION_DASHBOARD)).toBeLessThan(indexOf(SECTIONS.EXECUTIVE_SUMMARY));
        expect(indexOf(SECTIONS.EXECUTIVE_SUMMARY)).toBeLessThan(indexOf('reportBuilder'));
    });

    it('تغطي مجموعات الرحلة كل الخطوات بلا فجوة', () => {
        const ordered = [...SIDEBAR_SECTIONS].sort((a, b) => a.range[0] - b.range[0]);
        expect(ordered[0].range[0]).toBe(0);
        expect(ordered.at(-1).range[1]).toBe(40);
        ordered.slice(1).forEach((section, index) => {
            expect(section.range[0]).toBe(ordered[index].range[1] + 1);
        });
    });
});


/**
 * تدقيق 2026-07-17: StudyComparison.js/DataService.compareStudies كانا موجودين وكاملين
 * منذ البداية، لكن isComparison:true لم يُضبط على أي خطوة في STEPS إطلاقاً — الفرع الحي
 * في stepComponentRegistry.js:108-113 لم يُفعَّل قط (تحقّق بالبحث في كامل تاريخ git).
 * أضيفت خطوة 'studyComparison' كآخر عنصر في STEPS (بلا إزاحة فهارس الخطوات الأخرى) —
 * أداة اختيارية ضمن تصنيف «النتائج والمتابعة»، متاحة في وضع «مفصّل» فقط (نفس معاملة
 * reportBuilder/الأدلة والمرفقات).
 */
import { describe, it, expect } from 'vitest';
import { STEPS, SIDEBAR_SECTIONS, isStepVisibleInStudyMode } from '../wizardSteps.js';

describe('خطوة مقارنة الدراسات (studyComparison) — إعادة وصل ميزة كانت ميتة', () => {
    const step = STEPS.find((s) => s.id === 'studyComparison');

    it('موجودة في STEPS وموسومة isComparison:true (يفعّل فرع stepComponentRegistry الحي)', () => {
        expect(step).toBeDefined();
        expect(step.isComparison).toBe(true);
    });

    it('تنتمي لتصنيف «النتائج والمتابعة» ضمن النطاق المُحدَّث', () => {
        const resultsSection = SIDEBAR_SECTIONS.find((s) => s.id === 'results');
        const index = STEPS.indexOf(step);
        expect(index).toBeGreaterThanOrEqual(resultsSection.range[0]);
        expect(index).toBeLessThanOrEqual(resultsSection.range[1]);
    });

    it('مخفية في وضعَي مصغّر وبسيط، ظاهرة في مفصّل فقط (أداة اختيارية لا خطوة أساسية)', () => {
        expect(isStepVisibleInStudyMode('studyComparison', 'mini')).toBe(false);
        expect(isStepVisibleInStudyMode('studyComparison', 'simple')).toBe(false);
        expect(isStepVisibleInStudyMode('studyComparison', 'advanced')).toBe(true);
    });
});

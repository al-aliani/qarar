/**
 * generateNameIdeas — مولّد أفكار اسم تجاري وشعار (ميزة جديدة 2026-07): يجب أن
 * يكون حتمياً (نفس المدخل = نفس المخرج، بلا شبكة) وقطاعي الوعي عبر sector/concept،
 * بنفس أسلوب اختبار cafeVsFandB لبقية مولّدات هذا الملف.
 */
import { describe, it, expect } from 'vitest';
import { generateNameIdeas } from '../InternalAIGenerator.js';

describe('generateNameIdeas', () => {
    it('يُرجع بين 3 و5 مقترحات، كل واحد باسم وفكرة شعار غير فارغين', () => {
        const ideas = generateNameIdeas({ projectInfo: { concept: 'مشروع عام', sector: 'مشروع عام' } });
        expect(ideas.length).toBeGreaterThanOrEqual(3);
        expect(ideas.length).toBeLessThanOrEqual(5);
        ideas.forEach(idea => {
            expect(typeof idea.name).toBe('string');
            expect(idea.name.trim().length).toBeGreaterThan(0);
            expect(typeof idea.logoIdea).toBe('string');
            expect(idea.logoIdea.trim().length).toBeGreaterThan(0);
        });
    });

    it('حتمي: نفس الحالة تُنتج نفس النتائج تماماً عبر استدعاءات متعددة', () => {
        const state = { projectInfo: { concept: 'مقهى مختص', sector: 'مقهى مختص' } };
        const first = generateNameIdeas(state);
        const second = generateNameIdeas(state);
        expect(second).toEqual(first);
    });

    it('قطاعي: مقهى/كافيه يُنتج مقترحات مختلفة عن مشروع عام (لا قائمة ثابتة واحدة للجميع)', () => {
        const cafeIdeas = generateNameIdeas({ projectInfo: { concept: 'كافيه مختص', sector: 'كافيه مختص' } });
        const genericIdeas = generateNameIdeas({ projectInfo: { concept: 'مشروع استشاري', sector: 'مشروع استشاري' } });
        const cafeNames = cafeIdeas.map(i => i.name);
        const genericNames = genericIdeas.map(i => i.name);
        expect(cafeNames).not.toEqual(genericNames);
        expect(cafeNames).toContain('رُكن البُن');
    });

    it('قطاعي: قطاع تقني يُدرج اسم النشاط داخل أحد المقترحات', () => {
        const ideas = generateNameIdeas({ projectInfo: { concept: 'تطبيق توصيل', sector: 'تطبيق توصيل' } });
        expect(ideas.some(i => i.name.includes('تطبيق توصيل'))).toBe(true);
    });

    it('لا يرمي عند غياب projectInfo تماماً', () => {
        expect(() => generateNameIdeas({})).not.toThrow();
        expect(() => generateNameIdeas(undefined)).not.toThrow();
    });
});

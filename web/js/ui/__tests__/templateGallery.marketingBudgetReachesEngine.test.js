/**
 * @vitest-environment jsdom
 *
 * تدقيق شامل 2026-09-16: قالبا "مكتب خدمات/استشارات" و"صالون/عناية" كانا يضعان
 * ميزانية "اشتراكات وتسويق" ضمن administrative.administrative بدل marketing.campaigns —
 * engine.js يحسب opex.marketingAnnual حصراً من marketing.campaigns، فالميزانية
 * المرصودة صراحة في القالب الرسمي لا تصل إليه إطلاقاً (تظهر صفراً في القوائم
 * المالية المصدَّرة، وكانت ستُطلق أيضاً تحذير "لا تسويق" كاذباً لولا عطل منفصل
 * في كشف القطاع كان يُسقط تحذيرات الجودة القطاعية لهذين القالبين تحديداً).
 */
import { describe, it, expect } from 'vitest';
import { TemplateGallery } from '../TemplateGallery.js';
import { createEmptyStudy } from '../../core/schema.js';
import { calculateStudy } from '../../core/engine.js';

describe('قوالب الخدمات والعناية الشخصية: ميزانية التسويق تصل فعلياً لـ opex.marketingAnnual', () => {
    it.each(['services', 'personal_care'])('قالب "%s": marketingAnnual > 0 (لا صفر رغم بند مرصود في القالب)', (templateId) => {
        const gallery = new TemplateGallery('test-marketing-budget-overlay', {});
        const template = gallery.templates.find((t) => t.id === templateId);
        expect(template).toBeTruthy();

        const study = { ...createEmptyStudy(), ...template.data };
        const results = calculateStudy(study);

        expect(results.opex.marketingAnnual).toBeGreaterThan(0);
    });
});

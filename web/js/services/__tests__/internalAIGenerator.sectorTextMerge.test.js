/**
 * @vitest-environment jsdom
 *
 * تدقيق شامل 2026-09-16: ~22 دالة توليد في InternalAIGenerator.js (generatePositions،
 * generateLicenses، generateEquipment، generateSuppliers، وغيرها) كانت تبني متغيّر
 * التصنيف عبر `or(p.sector, p.concept, ...)` — اختيار أول حقل غير فارغ فقط (or() تقبل
 * معاملين فعلياً، فالمعامل الثالث كان ميتاً)، لا دمج الإشارتين. نفس فئة الخلل المُصلَح
 * في sectorBenchmarks.js/qaChecks.js/Wizard.js بهذا الفرع نفسه (commit d297b47) — لكنه
 * لم يمسّ هذا الملف. قالبا "تقني" و"عناية شخصية" الرسميان يضعان في sector نصاً عاماً
 * ("تقنية المعلومات") لا يطابق أي فرع تصنيف هنا، بينما concept يحمل النص الدقيق — فكانت
 * مولّدات الاقتراح (الفريق/التراخيص/المعدات) تُرجع محتوى عاماً خاطئاً لهذين القالبين
 * الرسميين تحديداً، رغم أن resolveSectorBenchmark المُصلَح مسبقاً يُصنّفهما صح.
 */
import { describe, it, expect } from 'vitest';
import { generatePositions, generateLicenses } from '../InternalAIGenerator.js';
import { TemplateGallery } from '../../ui/TemplateGallery.js';

describe('InternalAIGenerator — الاقتراحات تستخدم القطاع الصحيح لقوالب TemplateGallery الرسمية', () => {
    function templateState(id) {
        const gallery = new TemplateGallery('test-ai-sector-overlay', {});
        const t = gallery.templates.find((x) => x.id === id);
        return { projectInfo: t.data.projectInfo };
    }

    it('قالب "عناية شخصية" الرسمي: generatePositions يقترح حلاق/عناية لا "موظف تنفيذي" عام', () => {
        const positions = generatePositions(templateState('personal_care'));
        const titles = positions.map((p) => p.position).join(' ');
        expect(/حلاق|مصفف|عناية|تجميل/i.test(titles), `المناصب المقترَحة: ${titles}`).toBe(true);
        expect(/موظف تنفيذي/i.test(titles)).toBe(false);
    });

    it('قالب "تقني" الرسمي: generatePositions لا يقع في الاحتياطي العام "موظف تنفيذي"', () => {
        const positions = generatePositions(templateState('tech'));
        const titles = positions.map((p) => p.position).join(' ');
        expect(/موظف تنفيذي/i.test(titles), `المناصب المقترَحة: ${titles}`).toBe(false);
    });

    it('[إثبات العطل الأصلي] sector وحده (بلا concept) لقالب العناية الشخصية كان يقع في الاحتياطي العام', () => {
        const positions = generatePositions({ projectInfo: { sector: 'الخدمات الشخصية والعناية' } });
        const titles = positions.map((p) => p.position).join(' ');
        expect(/موظف تنفيذي|مدير\/مديرة المشروع/i.test(titles)).toBe(true);
    });

    it('قالب "عناية شخصية" الرسمي: generateLicenses يقترح تراخيص صحية/عناية شخصية لا تراخيص عامة فقط', () => {
        const licenses = generateLicenses(templateState('personal_care'));
        const names = licenses.map((l) => l.name).join(' ');
        expect(/صحي|عناية|تجميل|بلدية/i.test(names), `التراخيص المقترَحة: ${names}`).toBe(true);
    });
});

/**
 * @vitest-environment jsdom
 *
 * تدقيق شامل 2026-09-16: resolveSectorBenchmark/resolveValuationMultiple/
 * checkDriversAgainstBenchmarks كانت تستخدم `sector || concept || activity`
 * (اختيار أحدهما فقط) بدل دمجهما. قالبا "تقني" و"عناية شخصية" الرسميان
 * (TemplateGallery.js) يضعان في sector نصاً تصنيفياً عاماً ("تقنية المعلومات"،
 * "الخدمات الشخصية والعناية") لا يطابق أي معيار قطاعي، بينما concept يحمل النص
 * الدقيق المطابق فعلياً ("تطبيق إلكتروني / منصة رقمية"، "صالون / مركز تجميل") —
 * فكانت الدالتان تُسقطان القطاع بالكامل إلى "عام (غير مصنّف)" وتُلغيان كل تحذيرات
 * الجودة القطاعية بصمت لهذين القالبين الرسميين تحديداً.
 *
 * الاختبار يبني state واقعياً من بيانات TemplateGallery.js الحقيقية نفسها (لا
 * detectSectorBenchmark(concept) مباشرة كما تفعل sectorDetectionServicePrecedence.test.js) —
 * هذا بالضبط ما فوّت العطل الأصلي رغم نجاح تلك الاختبارات 100%.
 */
import { describe, it, expect } from 'vitest';
import { resolveSectorBenchmark, sectorDetectionText } from '../sectorBenchmarks.js';
import { TemplateGallery } from '../../ui/TemplateGallery.js';

describe('resolveSectorBenchmark(state) — كل قوالب TemplateGallery الرسمية تُصنَّف فعلياً، لا "عام"', () => {
    it('كل القوالب الخمسة (fb/tech/retail/services/personal_care) تُعطي isGeneric=false', () => {
        const gallery = new TemplateGallery('test-sector-detection-overlay', {});
        const realTemplates = gallery.templates.filter((t) => t.id !== 'empty' && t.data);

        expect(realTemplates.length).toBe(5);

        realTemplates.forEach((t) => {
            const bench = resolveSectorBenchmark({ projectInfo: t.data.projectInfo });
            expect(bench.isGeneric, `قالب "${t.name}" (sector="${t.data.projectInfo.sector}", concept="${t.data.projectInfo.concept}") وقع في "عام" — العطل الأصلي`).toBe(false);
            expect(bench.label).not.toBe('عام (غير مصنّف)');
        });
    });

    it('[إثبات العطل الأصلي] sector وحده (بلا concept) لقالبي تقني/عناية شخصية كان يفشل فعلاً — يثبت أن الدمج هو ما يُصلح الحالة', () => {
        const techSectorOnly = resolveSectorBenchmark({ projectInfo: { sector: 'تقنية المعلومات' } });
        const careSectorOnly = resolveSectorBenchmark({ projectInfo: { sector: 'الخدمات الشخصية والعناية' } });
        expect(techSectorOnly.isGeneric).toBe(true);
        expect(careSectorOnly.isGeneric).toBe(true);
    });

    it('sectorDetectionText يدمج sector وconcept معاً في نص واحد، لا يختار أحدهما', () => {
        const text = sectorDetectionText({ sector: 'الخدمات الشخصية والعناية', concept: 'صالون / مركز تجميل' });
        expect(text).toContain('الخدمات الشخصية والعناية');
        expect(text).toContain('صالون');
    });
});

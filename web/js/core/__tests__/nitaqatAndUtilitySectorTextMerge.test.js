/**
 * @vitest-environment jsdom
 *
 * تدقيق شامل 2026-09-16: نفس فئة خلل sector||concept (اختيار أحدهما بدل دمجهما)
 * المُصلَحة في sectorBenchmarks.js/qaChecks.js/Wizard.js/InternalAIGenerator.js بهذا
 * الفرع نفسه — موجودة أيضاً حرفياً في nitaqatHrCard.js وutilityBenchmarks.js. قالب
 * "عناية شخصية" الرسمي (sector عام "الخدمات الشخصية والعناية" + concept دقيق
 * "صالون / مركز تجميل") هو أدق حالة إثبات: sector وحده لا يطابق أي معيار قطاعي.
 */
import { describe, it, expect } from 'vitest';
import { detectSectorBenchmark, sectorDetectionText } from '../sectorBenchmarks.js';
import { buildNitaqatHrCardData } from '../nitaqatHrCard.js';
import { estimateMonthlyUtilityCost } from '../utilityBenchmarks.js';

const personalCareProjectInfo = { sector: 'الخدمات الشخصية والعناية', concept: 'صالون / مركز تجميل', areaSize: 150 };
const personalCareState = {
    projectInfo: personalCareProjectInfo,
    hr: { positions: [{ position: 'حلاق', nationality: 'expat', count: 2, salary: 4000 }] }
};

describe('nitaqatHrCard وutilityBenchmarks: القطاع يُكتشَف من sector+concept معاً لا أحدهما', () => {
    it('[إثبات العطل الأصلي] sector وحده (بلا concept) لا يطابق أي معيار قطاعي', () => {
        expect(detectSectorBenchmark(personalCareProjectInfo.sector)).toBeNull();
        expect(detectSectorBenchmark(sectorDetectionText(personalCareProjectInfo))).not.toBeNull();
    });

    it('buildNitaqatHrCardData: يبني tierInfo فعلياً لقالب عناية شخصية (لا يفشل بمعيار عام غير مكتشَف)', () => {
        const data = buildNitaqatHrCardData(personalCareState);
        expect(data.tierInfo).not.toBeNull();
    });

    it('estimateMonthlyUtilityCost: يستخدم معيار "خدمي" الفعلي لا الاحتياطي العام "عام (غير مصنّف)"', () => {
        const cost = estimateMonthlyUtilityCost(personalCareState);
        expect(cost).not.toBeNull();
        expect(cost.sectorLabel).toBe('خدمي');
        expect(cost.sectorLabel).not.toBe('عام (غير مصنّف)');
    });
});

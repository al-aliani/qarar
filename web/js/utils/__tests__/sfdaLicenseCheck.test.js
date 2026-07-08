/**
 * تدقيق 2026-07-08 (ملاحظة حرجة، خبير السوق): مولّدا تراخيص متناقضان — الزر الفعلي
 * المربوط (DataService.getComplianceCosts، محذوف الآن) كان يفوّت رخصة هيئة الغذاء
 * والدواء (SFDA) للمطاعم؛ وqaChecks كان يمرّ بمجرد وجود أي ترخيص (length > 0) بلا
 * تحقق من نوعه. هذا يثبّت: (1) smartFill يستخدم الآن المولّد الواعي بالقطاع فعلياً،
 * (2) qaChecks يرفع تحذيراً مخصصاً عند غياب SFDA لمشروع أغذية حتى مع تراخيص أخرى موجودة.
 */
import { describe, it, expect } from 'vitest';
import { runQAChecks } from '../qaChecks.js';
import { generateLicenses } from '../../services/InternalAIGenerator.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS } from '../../core/schema.js';

function restaurantStudy(licenses) {
    return {
        [SECTIONS.PROJECT_INFO]: { name: 'مطعم اختبار', concept: 'مطعم وجبات سريعة', sector: 'مطعم', businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: { equipment: [{ price: 85000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        [SECTIONS.HR]: { positions: [{ position: 'شيف', count: 1, salary: 6000, months: 12, nationality: 'saudi' }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 12000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 800, avgPrice: 35, variableCostRate: 0.32, growthRate: 0.03 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses }
    };
}

describe('توحيد مولّدي التراخيص — SFDA لا يُفوَّت', () => {
    it('generateLicenses (المولّد الموحّد الآن لكلا الزرين) يضيف SFDA لمشروع مطعم', () => {
        const list = generateLicenses({ projectInfo: { concept: 'مطعم وجبات سريعة', sector: 'مطعم' } });
        expect(list.some(l => /الغذاء والدواء/.test(l.name))).toBe(true);
    });

    it('qaChecks يرفع تحذير SFDA_LICENSE_MISSING لمشروع مطعم لديه تراخيص أخرى لكن بلا SFDA', async () => {
        const state = restaurantStudy([
            { name: 'سجل تجاري', quantity: 1, price: 2000 },
            { name: 'رخصة بلدية', quantity: 1, price: 1500 }
        ]);
        const results = calculateStudy(state);
        const qa = await runQAChecks(state, results);
        expect(qa.softWarnings.some(w => w.code === 'SFDA_LICENSE_MISSING')).toBe(true);
    });

    it('qaChecks لا يرفع تحذير SFDA عند وجود رخصة هيئة الغذاء والدواء فعلياً', async () => {
        const state = restaurantStudy(generateLicenses({ projectInfo: { concept: 'مطعم وجبات سريعة', sector: 'مطعم' } }));
        const results = calculateStudy(state);
        const qa = await runQAChecks(state, results);
        expect(qa.softWarnings.some(w => w.code === 'SFDA_LICENSE_MISSING')).toBe(false);
    });
});

/**
 * تدقيق 2026-07-08:
 * ملاحظة عالية #31: جدول الأشخاص الرئيسين بالتقرير يُسقط عمود «المؤهلات» وجدول
 * «عقود الشراكة» بالكامل رغم وجودهما في المخطط (schema.js: keyPeople.qualifications
 * وpartnershipContracts) وفي البيانات المُدخلة فعلياً.
 * ملاحظة عالية #30: قائمة الدخل بالتقرير كانت تعرض «المصاريف التشغيلية الثابتة»
 * كرقم مجمّع واحد فقط، متجاهلة fixedCostsBreakdown (رواتب/إيجار وإداري/تسويق)
 * التي يحسبها المحرك فعلياً لكل سنة.
 */
import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../ReportGenerator.js';
import { createEmptyStudy, SECTIONS } from '../../core/schema.js';

describe('ReportGenerator — الأشخاص الرئيسون: المؤهلات وعقود الشراكة (#31)', () => {
    it('يعرض عمود المؤهلات بالقيم الفعلية لكل شخص رئيسي', () => {
        const state = createEmptyStudy();
        state[SECTIONS.KEY_PEOPLE] = {
            keyPeople: [{ name: 'خالد المطيري', role: 'المؤسس والمدير العام', experience: '10 سنوات في قطاع المطاعم', qualifications: 'بكالوريوس إدارة أعمال + شهادة HACCP لسلامة الغذاء' }],
            partnershipContracts: []
        };
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('intro_feasibility', state, results, state.projectInfo || {}, 1);

        expect(section).not.toBeNull();
        expect(section.html).toContain('خالد المطيري');
        expect(section.html).toContain('بكالوريوس إدارة أعمال + شهادة HACCP لسلامة الغذاء');
    });

    it('يعرض جدول عقود الشراكة (اسم الشريك/الدور/النسبة/ملاحظات) بالقيم الفعلية', () => {
        const state = createEmptyStudy();
        state[SECTIONS.KEY_PEOPLE] = {
            keyPeople: [],
            partnershipContracts: [{ partnerName: 'سارة العتيبي', role: 'شريك مموّل صامت', sharePercent: 30, notes: 'لا تدخل تشغيلي يومي' }]
        };
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('intro_feasibility', state, results, state.projectInfo || {}, 1);

        expect(section).not.toBeNull();
        expect(section.html).toContain('عقود الشراكة');
        expect(section.html).toContain('سارة العتيبي');
        expect(section.html).toContain('شريك مموّل صامت');
        expect(section.html).toContain('30%');
        expect(section.html).toContain('لا تدخل تشغيلي يومي');
    });
});

describe('ReportGenerator — قائمة الدخل: تفصيل المصاريف الثابتة (#30)', () => {
    function buildStudyWithPayroll() {
        const state = createEmptyStudy();
        state[SECTIONS.PROJECT_INFO] = { businessModel: 'Independent' };
        state.assumptions = { projectionYears: 3, discountRate: 0.10, inflationRate: 0, hiddenOverheadsRate: 0 };
        state[SECTIONS.TECHNICAL] = { ...state[SECTIONS.TECHNICAL], equipment: [{ price: 100000, quantity: 1 }] };
        state[SECTIONS.HR] = { ...state[SECTIONS.HR], positions: [{ position: 'مدير', count: 1, salary: 10000, months: 12, nationality: 'saudi' }] };
        state[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار المحل', monthly: 8000 }] };
        state[SECTIONS.MARKETING] = { ...state[SECTIONS.MARKETING], campaigns: [{ name: 'تسويق رقمي', type: 'operating', amount: 0, monthly: 2000 }] };
        state[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }] };
        return state;
    }

    it('يعرض صفوف تفصيل الرواتب والإيجار/الإداري والتسويق تحت إجمالي المصاريف الثابتة', () => {
        const state = buildStudyWithPayroll();
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('income_statement', state, results, null, 1);

        expect(section).not.toBeNull();
        expect(section.html).toContain('رواتب وأجور');
        expect(section.html).toContain('إيجار ولوجستيات وإداري');
        expect(section.html).toContain('تسويق');

        // القيم الفعلية: راتب سنوي 120,000 قبل GOSI — تظهر بصيغة عملة منسّقة تحتوي 120
        const y1 = results.incomeStatement[0];
        expect(y1.fixedCostsBreakdown.payroll).toBeGreaterThan(120000); // مع GOSI/تأمين
        expect(y1.fixedCostsBreakdown.rentAndAdmin).toBeCloseTo(96000, 2); // 8000*12
        expect(y1.fixedCostsBreakdown.marketing).toBeCloseTo(24000, 2); // 2000*12
    });
});

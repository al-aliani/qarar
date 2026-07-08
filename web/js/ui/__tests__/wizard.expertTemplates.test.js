import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSuggestionUpdateTarget } from '../Wizard.js';
import {
    applyExpertTemplatePreset,
    getExpertTemplatePresets,
    getExpertTemplates,
    EXPERT_TEMPLATE_PRESETS
} from '../../services/ExpertTemplateService.js';
import { SECTIONS } from '../../core/schema.js';
import { FIELD_OPTIONS } from '../../core/fieldOptions.js';
import { detectSectorBenchmark } from '../../core/sectorBenchmarks.js';
import { calculateStudy } from '../../core/engine.js';

describe('Wizard suggestion persistence', () => {
    it('keeps legacy textarea updates on the current step field', () => {
        expect(getSuggestionUpdateTarget('projectInfo', 'description', { dataset: {} })).toEqual({
            section: 'projectInfo',
            path: 'description'
        });
    });

    it('uses explicit data-section and data-path for nested fields', () => {
        const textarea = {
            dataset: {
                section: 'businessModel',
                path: 'valueProposition'
            }
        };

        expect(getSuggestionUpdateTarget('summary', 'notes', textarea)).toEqual({
            section: 'businessModel',
            path: 'valueProposition'
        });
    });
});

describe('expert template presets', () => {
    beforeEach(() => {
        const values = new Map();
        globalThis.localStorage = {
            getItem: vi.fn(key => values.get(key) ?? null),
            setItem: vi.fn((key, value) => values.set(key, String(value))),
            removeItem: vi.fn(key => values.delete(key)),
            clear: vi.fn(() => values.clear())
        };
    });

    it('offers a SaaS feasibility-platform draft without publishing it as an approved expert template', () => {
        localStorage.clear();

        const presets = getExpertTemplatePresets();
        const saasPreset = presets.find(p => p.id === 'saas_feasibility_platform');

        expect(saasPreset).toBeTruthy();
        expect(saasPreset.title).toContain('SaaS');
        expect(getExpertTemplates().map(t => t.id)).not.toContain('saas_feasibility_platform');
    });

    it('applies the SaaS draft with coherent financing and revenue assumptions', () => {
        const store = {
            mergeWithDefaults: vi.fn(data => data),
            set: vi.fn()
        };

        const applied = applyExpertTemplatePreset(store, 'saas_feasibility_platform');

        expect(applied?.preset?.id).toBe('saas_feasibility_platform');
        expect(store.set).toHaveBeenCalledTimes(1);

        const data = store.set.mock.calls[0][0];
        expect(data[SECTIONS.PROJECT_INFO].concept).toContain('SaaS');
        expect(data[SECTIONS.PROJECT_INFO].expertTemplatePresetId).toBe('saas_feasibility_platform');
        expect(data[SECTIONS.REVENUE].streams.length).toBeGreaterThanOrEqual(4);
        expect(data[SECTIONS.FINANCING].sources.equity.amount).toBe(700000);
        expect(data[SECTIONS.FINANCING].sources.bankLoan.amount).toBe(850000);
        expect(data[SECTIONS.FINANCING].targetDSCR).toBe(1.5);
    });

    it('keeps the SaaS activity selectable and tied to the SaaS benchmark', () => {
        const option = FIELD_OPTIONS.concept.options.find(o => o.value.includes('SaaS'));

        expect(option).toBeTruthy();
        expect(detectSectorBenchmark(option.value)?.label).toContain('SaaS');
    });
});

/**
 * تدقيق 2026-07-08 (ملاحظة حرجة، مدير المنتج): لا يوجد أي قالب مطعم فعلي رغم أن
 * دستور المنتج (القسم 10، MVP) يشترطه صراحة. هذا يثبّت وجود 3 قوالب مطعم حقيقية
 * (وجبات سريعة، كاجوال دايننج، مطبخ سحابي) بأرقام تحققت فعلياً عبر calculateStudy
 * الحقيقي (لا نتائج مصطنعة) وضمن نطاقات sectorBenchmarks.js الفعلية لقطاع fnb.
 */
describe('قوالب المطاعم الثلاثة (فجوة MVP معلنة — أُغلقت)', () => {
    const RESTAURANT_PRESET_IDS = ['restaurant_fast_food', 'restaurant_casual_dining', 'restaurant_cloud_kitchen'];

    it('الثلاثة موجودة فعلياً في EXPERT_TEMPLATE_PRESETS بعناوين عربية مطعمية واضحة', () => {
        RESTAURANT_PRESET_IDS.forEach(id => {
            const preset = EXPERT_TEMPLATE_PRESETS.find(p => p.id === id);
            expect(preset, `القالب ${id} غير موجود`).toBeTruthy();
            expect(preset.title).toMatch(/مطعم|مطبخ/);
            expect(typeof preset.buildData).toBe('function');
        });
    });

    RESTAURANT_PRESET_IDS.forEach(id => {
        it(`${id}: يُنتج دراسة صالحة عبر calculateStudy الحقيقي (لا انهيار) وضمن نطاقات fnb`, () => {
            const preset = EXPERT_TEMPLATE_PRESETS.find(p => p.id === id);
            const study = preset.buildData();
            const results = calculateStudy(study);

            expect(results).toBeTruthy();
            expect(['GO', 'REVISE', 'NO-GO']).toContain(results.decision);
            expect(Number.isFinite(results.indicators.npv)).toBe(true);
            expect(Number.isFinite(results.indicators.irr)).toBe(true);

            const y1 = results.incomeStatement[0];
            const vcRatio = y1.variableCosts / y1.revenue;
            const rentRatio = results.opex.rentAdminAnnual / y1.revenue;
            const laborRatio = results.opex.payrollAnnual / y1.revenue;

            // نطاقات fnb الفعلية في sectorBenchmarks.js: [0.28,0.45] / [0.08,0.15] / [0.20,0.32]
            expect(vcRatio).toBeGreaterThanOrEqual(0.28);
            expect(vcRatio).toBeLessThanOrEqual(0.45);
            expect(rentRatio).toBeGreaterThanOrEqual(0.08);
            expect(rentRatio).toBeLessThanOrEqual(0.15);
            expect(laborRatio).toBeGreaterThanOrEqual(0.20);
            expect(laborRatio).toBeLessThanOrEqual(0.32);

            // مصادر التمويل تغطي capex.total فعلياً — fundingGap موجب > 1 هو ما يُثير
            // تحذير القرار الفعلي في engine.js (سالب/صفر = تمويل كافٍ أو فائض، سليم).
            expect(results.financingCheck.fundingGap).toBeLessThanOrEqual(1);
            expect(results.decisionReasons.join(' ')).not.toMatch(/فجوة/);

            // تدقيق 2026-07-08 (وجده التحقق العدائي): financing.totalInvestment المُعلَن
            // يدوياً يجب أن يطابق results.capex.total الفعلي بدقة (لا فرق % ملموس) —
            // نفس نمط "أرقام استثمار متضاربة بين الشاشات" الذي حاربته تقارير سابقة.
            const declaredInvestment = Number(study[SECTIONS.FINANCING].totalInvestment);
            expect(Math.abs(declaredInvestment - results.capex.total)).toBeLessThan(500);
        });
    });

    RESTAURANT_PRESET_IDS.forEach(id => {
        it(`${id}: applyExpertTemplatePreset يكتب بيانات متسقة إلى المخزن دون رمي خطأ`, () => {
            const store = { mergeWithDefaults: vi.fn(data => data), set: vi.fn() };
            const applied = applyExpertTemplatePreset(store, id);

            expect(applied?.preset?.id).toBe(id);
            const data = store.set.mock.calls[0][0];
            expect(data[SECTIONS.REVENUE].streams.length).toBeGreaterThanOrEqual(2);
            expect(data[SECTIONS.LEGAL].licenses.some(l => /الغذاء والدواء/.test(l.name))).toBe(true);
        });
    });
});

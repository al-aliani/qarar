/**
 * دفعة 6 (doc-fixes-bundle) — ثلاثة إصلاحات توثيقية/تصنيفية لا تُغيّر أي حساب:
 *
 * 1) web/js/core/zakatTax.js: التعليق العلوي كان يدّعي أنه "متسق واحداً بواحد
 *    مع engine.js (مصدر الحقيقة)" رغم أن الصيغة المستخدمة هنا
 *    (base * zakatRate * (1 - foreignShare)) مختلفة بنيوياً عن حساب المحرك
 *    الفعلي (calculateZakatAndTax في web/js/core/financial/tax.js الذي يعتمد
 *    fundingSourcesBase/adjustedProfit/taxDepY). التعليق الآن يوضّح أنها صيغة
 *    مبسّطة/احتياطية فقط لبيانات قديمة، وليست مرجعاً موثوقاً لمخرجات المحرك.
 *    (ملاحظة: المهمة الأصلية أشارت لمسار lib/calc/zakatTax.js، لكن النص/الأسطر
 *    الموصوفة تطابق حرفياً web/js/core/zakatTax.js — الملف المُصلَح هنا فعلاً؛
 *    lib/calc/zakatTax.js لا يحتوي هذا التعليق المضلِّل أصلاً.)
 *
 * 2) web/js/utils/studyCompleteness.js: تعليقات أوزان الفئات كانت تقول
 *    (30%)/(25%)/(25%)/(20%) بينما المجموع الفعلي لأوزان كل فئة هو
 *    31/25/27/20 — الأرقام نفسها (weights) لم تتغيّر، فقط نص التعليق.
 *
 * 3) web/js/core/wizardSteps.js: خطوتا الزكاة/الضريبة وتقييم الشركة
 *    (مخرجات مالية أساسية IFC/UNIDO) انتقلتا من قسم 'advanced' إلى قسم
 *    'financial' في SIDEBAR_SECTIONS (مع الحفاظ على تجاور/تغطية كل النطاقات).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { STEPS, SIDEBAR_SECTIONS, SECTIONS } from '../wizardSteps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('توثيق: تعليق أعلى web/js/core/zakatTax.js لم يعد يدّعي تطابقاً واحداً بواحد مع المحرك', () => {
    const src = readFileSync(path.join(__dirname, '../zakatTax.js'), 'utf8');

    it('العبارة المضلِّلة "متسق واحداً بواحد" لم تعد موجودة', () => {
        expect(src).not.toMatch(/متسق\s*واحداً\s*بواحد/);
    });

    it('التعليق الجديد يوضّح أنها احتياط/نسخة قديمة مختلفة عن المحرك', () => {
        // يجب أن يذكر صراحة أنها "احتياط" لبيانات قديمة، وأنها مختلفة عن المحرك
        expect(src).toMatch(/احتياط/);
        expect(src).toMatch(/مختلفة/);
    });
});

describe('توثيق: أوزان فئات studyCompleteness.js تطابق مجموع الحقول الفعلي', () => {
    const src = readFileSync(path.join(__dirname, '../../utils/studyCompleteness.js'), 'utf8');

    it('الفئة الأولى (الأساسيات) موسومة بـ31% (8+3+8+5+7)', () => {
        expect(src).toMatch(/الأساسيات\s*\(31%\)/);
        expect(src).not.toMatch(/الأساسيات\s*\(30%\)/);
    });

    it('الفئة الثالثة (التسويق والاستراتيجية) موسومة بـ27% (9+8+5+5)', () => {
        expect(src).toMatch(/التسويق والاستراتيجية\s*\(27%\)/);
        expect(src).not.toMatch(/التسويق والاستراتيجية\s*\(25%\)/);
    });

    it('الفئتان الثانية والرابعة (25%/20%) بقيتا كما هما لأن مجموعهما صحيح أصلاً', () => {
        expect(src).toMatch(/التشغيل\s*\(25%\)/);
        expect(src).toMatch(/التحليل والمخاطر\s*\(20%\)/);
    });
});

describe('تصنيف: خطوتا الزكاة/الضريبة وتقييم الشركة ضمن قسم "financial" لا "advanced"', () => {
    it('SIDEBAR_SECTIONS تغطي كل الخطوات بتجاور تام بلا فجوات ولا تداخل (لم ينكسر شيء)', () => {
        const sorted = [...SIDEBAR_SECTIONS].sort((a, b) => a.range[0] - b.range[0]);
        expect(sorted[0].range[0]).toBe(0);
        expect(sorted[sorted.length - 1].range[1]).toBe(STEPS.length - 1);
        for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i].range[0]).toBe(sorted[i - 1].range[1] + 1);
        }
    });

    it('خطوة الزكاة والضريبة (SECTIONS.ZAKAT_TAX) تقع ضمن نطاق قسم financial', () => {
        const zakatIdx = STEPS.findIndex(s => s.id === SECTIONS.ZAKAT_TAX);
        expect(zakatIdx).toBeGreaterThanOrEqual(0);

        const financialSection = SIDEBAR_SECTIONS.find(s => s.id === 'financial');
        const advancedSection = SIDEBAR_SECTIONS.find(s => s.id === 'advanced');
        expect(financialSection).toBeTruthy();

        const inFinancial = zakatIdx >= financialSection.range[0] && zakatIdx <= financialSection.range[1];
        const inAdvanced = advancedSection && zakatIdx >= advancedSection.range[0] && zakatIdx <= advancedSection.range[1];

        expect(inFinancial).toBe(true);
        expect(inAdvanced).toBe(false);
    });

    it('خطوة تقييم الشركة (SECTIONS.VALUATION) تقع ضمن نطاق قسم financial', () => {
        const valuationIdx = STEPS.findIndex(s => s.id === SECTIONS.VALUATION);
        expect(valuationIdx).toBeGreaterThanOrEqual(0);

        const financialSection = SIDEBAR_SECTIONS.find(s => s.id === 'financial');
        const advancedSection = SIDEBAR_SECTIONS.find(s => s.id === 'advanced');

        const inFinancial = valuationIdx >= financialSection.range[0] && valuationIdx <= financialSection.range[1];
        const inAdvanced = advancedSection && valuationIdx >= advancedSection.range[0] && valuationIdx <= advancedSection.range[1];

        expect(inFinancial).toBe(true);
        expect(inAdvanced).toBe(false);
    });

    it('التصنيف عبر معرّف القسم (نفس النتيجة بالبحث المباشر بدل النطاقات)، لكل من الزكاة والتقييم', () => {
        const findSectionIdFor = (stepIndex) =>
            (SIDEBAR_SECTIONS.find(s => stepIndex >= s.range[0] && stepIndex <= s.range[1]) || {}).id;

        const zakatIdx = STEPS.findIndex(s => s.id === SECTIONS.ZAKAT_TAX);
        const valuationIdx = STEPS.findIndex(s => s.id === SECTIONS.VALUATION);

        expect(findSectionIdFor(zakatIdx)).toBe('financial');
        expect(findSectionIdFor(valuationIdx)).toBe('financial');
    });
});

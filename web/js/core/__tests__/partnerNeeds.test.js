/**
 * analyzePartnerNeeds — تصنيف نوع الشريك الاستراتيجي المطلوب من بيانات الدراسة
 * الفعلية (فجوة تمويل، ملكية أجنبية، نموذج العمل، مستوى التقنية، فراغ جدول
 * الموردين). قيمة مشتقة حياً مثل results.financingCheck — لا نص عام يُخزَّن.
 */
import { describe, it, expect } from 'vitest';
import { analyzePartnerNeeds } from '../partnerNeeds.js';

describe('analyzePartnerNeeds — لا إشارات', () => {
    it('دراسة فارغة بالكامل: لا تُرجع أي بند', () => {
        expect(analyzePartnerNeeds({}, {})).toEqual([]);
    });
});

describe('analyzePartnerNeeds — financial_equity', () => {
    it('فجوة تمويل تتجاوز حد المادية: يظهر بند مالي/حصص بأولوية عالية والرقم الفعلي في السبب', () => {
        const results = {
            financingCheck: { fundingGap: 50000, totalInvestment: 390957, fundingGapMaterialityThreshold: Math.max(1000, 390957 * 0.01) }
        };
        const needs = analyzePartnerNeeds({}, results);
        const need = needs.find(n => n.type === 'financial_equity');
        expect(need).toBeTruthy();
        expect(need.priority).toBe('high');
        expect(need.action).toBe('attract');
        expect(need.reason).toContain((50000).toLocaleString('ar-SA'));
        expect(need.reason).toContain((390957).toLocaleString('ar-SA'));
    });

    it('فجوة صغيرة دون حد المادية: لا يظهر البند', () => {
        const results = {
            financingCheck: { fundingGap: 945, totalInvestment: 390957, fundingGapMaterialityThreshold: Math.max(1000, 390957 * 0.01) }
        };
        const needs = analyzePartnerNeeds({}, results);
        expect(needs.some(n => n.type === 'financial_equity')).toBe(false);
    });

    it('بلا fundingGapMaterialityThreshold جاهز: تُشتق نفس صيغة engine.js (1% بحد أدنى 1000)', () => {
        const results = { financingCheck: { fundingGap: 945, totalInvestment: 390957 } };
        const needs = analyzePartnerNeeds({}, results);
        expect(needs.some(n => n.type === 'financial_equity')).toBe(false);
    });
});

describe('analyzePartnerNeeds — supplier', () => {
    it('قطاع سلعي (مطعم) وجدول موردين فارغ: يظهر بند شريك مورّد', () => {
        const study = { projectInfo: { concept: 'مطعم شعبي' }, marketing: { suppliers: [] } };
        const needs = analyzePartnerNeeds(study, {});
        expect(needs.some(n => n.type === 'supplier')).toBe(true);
    });

    it('نفس القطاع لكن جدول الموردين مملوء: لا يظهر البند', () => {
        const study = { projectInfo: { concept: 'مطعم شعبي' }, marketing: { suppliers: [{ name: 'مورد أ' }] } };
        const needs = analyzePartnerNeeds(study, {});
        expect(needs.some(n => n.type === 'supplier')).toBe(false);
    });

    it('قطاع خدمي (ليس سلعياً) وجدول موردين فارغ: لا يظهر البند', () => {
        const study = { projectInfo: { concept: 'استشارات إدارية' }, marketing: { suppliers: [] } };
        const needs = analyzePartnerNeeds(study, {});
        expect(needs.some(n => n.type === 'supplier')).toBe(false);
    });
});

describe('analyzePartnerNeeds — technology', () => {
    it('مستوى استفادة تقنية "عالية": يظهر بند شريك تقني', () => {
        const study = { projectInfo: { concept: 'خدمي', techInvestmentLevel: 'high' } };
        const needs = analyzePartnerNeeds(study, {});
        expect(needs.some(n => n.type === 'technology')).toBe(true);
    });

    it('قطاع منصة رقمية/SaaS بمستوى تقنية غير محدد: يظهر بند شريك تقني أيضاً', () => {
        const study = { projectInfo: { concept: 'تطبيق ومنصة رقمية SaaS', techInvestmentLevel: '' } };
        const needs = analyzePartnerNeeds(study, {});
        expect(needs.some(n => n.type === 'technology')).toBe(true);
    });

    it('مستوى تقنية منخفض وقطاع غير رقمي: لا يظهر البند', () => {
        const study = { projectInfo: { concept: 'مطعم شعبي', techInvestmentLevel: 'low' } };
        const needs = analyzePartnerNeeds(study, {});
        expect(needs.some(n => n.type === 'technology')).toBe(false);
    });
});

describe('analyzePartnerNeeds — market_entry', () => {
    it('نسبة ملكية أجنبية > 0: يظهر بند شريك دخول للسوق المحلي بالنسبة الصحيحة', () => {
        const study = { assumptions: { foreignOwnershipRate: 0.3 } };
        const needs = analyzePartnerNeeds(study, {});
        const need = needs.find(n => n.type === 'market_entry');
        expect(need).toBeTruthy();
        expect(need.reason).toContain('30%');
    });

    it('نسبة ملكية أجنبية = 0: لا يظهر البند', () => {
        const study = { assumptions: { foreignOwnershipRate: 0 } };
        const needs = analyzePartnerNeeds(study, {});
        expect(needs.some(n => n.type === 'market_entry')).toBe(false);
    });

    it('نص السبب ينفي صراحة أي إلزام نظامي (تسريع عملي فقط، لا يفرض شراكة محلية)', () => {
        const study = { assumptions: { foreignOwnershipRate: 0.5 } };
        const need = analyzePartnerNeeds(study, {}).find(n => n.type === 'market_entry');
        // يجب أن يوجد نفي صريح («لا شرط نظامي إلزامي»)، لا مجرد غياب كلمة «إلزامي»
        // (فالنص نفسه يستخدمها للنفي عمداً) — حارس ضد صياغة قد تُقرأ كشرط قانوني.
        expect(need.reason).toContain('لا شرط نظامي إلزامي');
        expect(need.reason).not.toMatch(/يُشترط نظاماً|يجب قانوناً|يفرض القانون/);
    });
});

describe('analyzePartnerNeeds — franchise_relationship', () => {
    it('نموذج العمل "Franchise": يظهر بند تفعيل علاقة المانح بفعل formalize لا attract', () => {
        const study = { projectInfo: { businessModel: 'Franchise' } };
        const need = analyzePartnerNeeds(study, {}).find(n => n.type === 'franchise_relationship');
        expect(need).toBeTruthy();
        expect(need.action).toBe('formalize');
    });

    it('نموذج العمل "Independent": لا يظهر بند الامتياز', () => {
        const study = { projectInfo: { businessModel: 'Independent' } };
        const needs = analyzePartnerNeeds(study, {});
        expect(needs.some(n => n.type === 'franchise_relationship')).toBe(false);
    });

    it('إتاوة 5% مُخزَّنة كنسبة كاملة (royaltyRate: 5): النص يظهر "5%" وليس "500%" (حارس فخ الضرب ×100)', () => {
        const study = { projectInfo: { businessModel: 'Franchise', franchiseDetails: { royaltyRate: 5, entryFee: 20000 } } };
        const need = analyzePartnerNeeds(study, {}).find(n => n.type === 'franchise_relationship');
        expect(need.reason).toContain('5%');
        expect(need.reason).not.toContain('500%');
    });
});

describe('analyzePartnerNeeds — إشارات متعددة وترتيب الأولوية', () => {
    it('financial_equity (عالية) يظهر أولاً، ثم البقية بترتيب الإدراج ضمن الأولوية المتوسطة', () => {
        const study = {
            projectInfo: { concept: 'مطعم شعبي', techInvestmentLevel: 'low' },
            assumptions: { foreignOwnershipRate: 0.2 },
            marketing: { suppliers: [] }
        };
        const results = {
            financingCheck: { fundingGap: 50000, totalInvestment: 390957, fundingGapMaterialityThreshold: Math.max(1000, 390957 * 0.01) }
        };
        const needs = analyzePartnerNeeds(study, results);
        expect(needs[0].type).toBe('financial_equity');
        expect(needs.slice(1).map(n => n.type)).toEqual(['supplier', 'market_entry']);
    });
});

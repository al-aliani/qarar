/**
 * CORPORATE_SAVING_OUT_OF_RANGE في runQAChecks() (qaChecks.js) — 2026-08-25
 * ═══════════════════════════════════════════════════════════════════════════
 * «نسبة التوفير» للأصول المؤسسية (projectInfo.corporateAssets[].savingPercentage) كسر
 * عشري في [0, 1] — التسمية نفسها تقول ذلك (labels.js: «نسبة التوفير (0.1 - 1.0)»).
 * لكن المحرك كان يقرأها بلا أي حدّ، فمُدخَل «40» (بنيّة 40%) يُنتج معامل (1 − 40) = −39
 * ⇒ أساس أصل سالب ⇒ نقد إحلال سالب يدخل التدفق النقدي كأنه إيراد
 * (NPV قفز من 721,352 إلى 12,897,050 على نفس المُعطى، وIRR = null).
 *
 * المحرك يُقيّد الآن إلى [0, 1] (engine.js: getSaving)، والتقييد وحده صامت — فهذا
 * التحذير هو ما يجعله مرئياً للمستخدم. عمداً لا يُقسَم أي رقم على 100 نيابةً عنه.
 */
import { describe, it, expect } from 'vitest';
import { runQAChecks } from '../qaChecks.js';

const CODE = 'CORPORATE_SAVING_OUT_OF_RANGE';
const codes = (qa) => [...(qa.softWarnings || []), ...(qa.hardErrors || [])].map(w => w.code);
const warning = (qa) => (qa.softWarnings || []).find(w => w.code === CODE);

const corporateState = (assets) => ({
    projectInfo: { businessModel: 'Corporate_Venture', corporateAssets: assets },
    assumptions: { discountRate: 0.10, workingCapitalMonths: 3 }
});

describe('runQAChecks — CORPORATE_SAVING_OUT_OF_RANGE', () => {
    it('نسبة 40 (نيّة 40% مكتوبة كنسبة مئوية): يُطلق التحذير', async () => {
        const qa = await runQAChecks(corporateState([
            { name: 'خط إنتاج الشركة الأم', costSavingType: 'Equipment', savingPercentage: 40 }
        ]), {});
        expect(codes(qa)).toContain(CODE);
    });

    it('نسبة 1.5 (أكبر من 1 بلا نيّة مئوية): يُطلق التحذير', async () => {
        const qa = await runQAChecks(corporateState([
            { costSavingType: 'Equipment', savingPercentage: 1.5 }
        ]), {});
        expect(codes(qa)).toContain(CODE);
    });

    it('نسبة سالبة (−0.2): يُطلق التحذير — تضخّم التكلفة بدل خفضها', async () => {
        const qa = await runQAChecks(corporateState([
            { costSavingType: 'HR', savingPercentage: -0.2 }
        ]), {});
        expect(codes(qa)).toContain(CODE);
    });

    it('نص الرسالة يوضّح أن القيمة كسر عشري، وأنها قُيِّدت، وأنه لم يُقسَم على 100', async () => {
        const qa = await runQAChecks(corporateState([
            { name: 'مستودع مشترك', costSavingType: 'AdminLogistics', savingPercentage: 40 }
        ]), {});
        const w = warning(qa);
        expect(w).toBeDefined();
        expect(w.message).toContain('0.4');   // «0.4 تعني 40%» — التفسير العشري صريح
        expect(w.message).toContain('40%');
        expect(w.message).toContain('قُيِّدت');
        expect(w.message).toContain('100');   // «لم يُقسَم أي رقم على 100 نيابةً عنك»
        expect(w.message).toContain('مستودع مشترك'); // البند المخالف مُسمّى
        expect(w.path).toBe('projectInfo.corporateAssets');
    });

    it('كل النسب داخل [0, 1] (الحدّان ضمناً): لا تحذير', async () => {
        const qa = await runQAChecks(corporateState([
            { costSavingType: 'Equipment', savingPercentage: 0 },
            { costSavingType: 'HR', savingPercentage: 0.4 },
            { costSavingType: 'Marketing', savingPercentage: 1 }
        ]), {});
        expect(codes(qa)).not.toContain(CODE);
    });

    it('قيم غير عددية أو غائبة: لا تحذير (المحرك يقرؤها صفراً، وليست خطأ نطاق)', async () => {
        const qa = await runQAChecks(corporateState([
            { costSavingType: 'Equipment' },
            { costSavingType: 'HR', savingPercentage: '' },
            { costSavingType: 'Marketing', savingPercentage: null },
            { costSavingType: 'AdminLogistics', savingPercentage: 'أربعون' }
        ]), {});
        expect(codes(qa)).not.toContain(CODE);
    });

    it('نموذج عمل غير مؤسسي: لا تحذير — getSaving تُعيد صفراً أصلاً فلا أثر للقيمة', async () => {
        const qa = await runQAChecks({
            projectInfo: {
                businessModel: 'Independent',
                corporateAssets: [{ costSavingType: 'Equipment', savingPercentage: 40 }]
            },
            assumptions: { discountRate: 0.10, workingCapitalMonths: 3 }
        }, {});
        expect(codes(qa)).not.toContain(CODE);
    });

    it('لا مصفوفة أصول مؤسسية إطلاقاً: لا تحذير ولا انهيار', async () => {
        const qa = await runQAChecks({
            projectInfo: { businessModel: 'Corporate_Venture' },
            assumptions: { discountRate: 0.10, workingCapitalMonths: 3 }
        }, {});
        expect(codes(qa)).not.toContain(CODE);
        expect(codes(qa)).not.toContain('QA_CHECK_ERROR');
    });
});

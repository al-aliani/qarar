/**
 * اختبار مخصص لقاعدة FINANCIAL_ASSUMPTIONS_MISSING في runQAChecks() (qaChecks.js):
 * تحذير ناعم (softWarning) عند غياب معدل الخصم أو أشهر رأس المال العامل — كانت
 * هذه القاعدة موثّقة فقط عبر فحص يدوي لبوابة التصدير (ExportMenu.js) بلا اختبار مباشر.
 */
import { describe, it, expect } from 'vitest';
import { runQAChecks } from '../qaChecks.js';

const codes = (qa) => [...(qa.softWarnings || []), ...(qa.hardErrors || [])].map(w => w.code);

describe('runQAChecks — FINANCIAL_ASSUMPTIONS_MISSING', () => {
    it('discountRate مفقود (undefined): يُطلق التحذير', async () => {
        const state = { assumptions: { workingCapitalMonths: 3 } };
        const qa = await runQAChecks(state, {});
        expect(codes(qa)).toContain('FINANCIAL_ASSUMPTIONS_MISSING');
    });

    it('discountRate يساوي null: يُطلق التحذير', async () => {
        const state = { assumptions: { discountRate: null, workingCapitalMonths: 3 } };
        const qa = await runQAChecks(state, {});
        expect(codes(qa)).toContain('FINANCIAL_ASSUMPTIONS_MISSING');
    });

    it('discountRate نص فارغ: يُطلق التحذير', async () => {
        const state = { assumptions: { discountRate: '', workingCapitalMonths: 3 } };
        const qa = await runQAChecks(state, {});
        expect(codes(qa)).toContain('FINANCIAL_ASSUMPTIONS_MISSING');
    });

    it('workingCapitalMonths مفقود (undefined): يُطلق التحذير', async () => {
        const state = { assumptions: { discountRate: 0.10 } };
        const qa = await runQAChecks(state, {});
        expect(codes(qa)).toContain('FINANCIAL_ASSUMPTIONS_MISSING');
    });

    it('workingCapitalMonths يساوي null: يُطلق التحذير', async () => {
        const state = { assumptions: { discountRate: 0.10, workingCapitalMonths: null } };
        const qa = await runQAChecks(state, {});
        expect(codes(qa)).toContain('FINANCIAL_ASSUMPTIONS_MISSING');
    });

    it('workingCapitalMonths نص فارغ: يُطلق التحذير', async () => {
        const state = { assumptions: { discountRate: 0.10, workingCapitalMonths: '' } };
        const qa = await runQAChecks(state, {});
        expect(codes(qa)).toContain('FINANCIAL_ASSUMPTIONS_MISSING');
    });

    it('كلاهما موجود وصحيح: لا يُطلق التحذير', async () => {
        const state = { assumptions: { discountRate: 0.10, workingCapitalMonths: 3 } };
        const qa = await runQAChecks(state, {});
        expect(codes(qa)).not.toContain('FINANCIAL_ASSUMPTIONS_MISSING');
    });
});

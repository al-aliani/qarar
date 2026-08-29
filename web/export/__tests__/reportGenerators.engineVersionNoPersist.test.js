/**
 * بلوكر بانر إصدار المحرك (2026-08-29): BankReportGenerator.js وMonshaatReportGenerator.js
 * وProfessionalReviewReportGenerator.js تشترك في نفس النمط الذي حمل خلل ReportGenerator.js
 * الأصلي (Bug 2) — استدعاء store.update('results', نتائج مُعادة الحساب) بعد كل تصدير، ما
 * يُفعِّل سلسلة الحفظ الكاملة (localStorage + مزامنة سحابية) فيُعيد وسم _meta.engineVersion
 * صامتاً. أي تصدير عبر أيٍّ من هذه المولِّدات الثلاثة كان يمحو الدليل الذي يُبنى عليه تنبيه
 * تغيّر إصدار المحرك في ProjectOverviewView، تماماً كما فعل ReportGenerator.js. الثلاثة
 * تستخدم الآن updateSectionInMemory (تحديث عرض بلا حفظ) بدل update() العادية.
 */
import { describe, it, expect, vi } from 'vitest';
import { BankReportGenerator } from '../BankReportGenerator.js';
import { MonshaatReportGenerator } from '../MonshaatReportGenerator.js';
import { ProfessionalReviewReportGenerator } from '../ProfessionalReviewReportGenerator.js';

function makeStore(state) {
    return { getState: () => state, update: vi.fn(), updateSectionInMemory: vi.fn() };
}

const BASE_STATE = {
    projectInfo: { name: 'مشروع اختبار', concept: 'اختبار' },
    financing: { sources: { bankLoan: { amount: 100000, bank: '' } } },
};

describe.each([
    ['BankReportGenerator', BankReportGenerator],
    ['MonshaatReportGenerator', MonshaatReportGenerator],
    ['ProfessionalReviewReportGenerator', ProfessionalReviewReportGenerator],
])('%s.generateHTML — تحديث النتائج بلا محو ذاتي لبصمة إصدار المحرك', (name, Generator) => {
    it('يستدعي store.updateSectionInMemory("results", ...) — لا store.update() العادية', () => {
        const store = makeStore(BASE_STATE);
        Generator.generateHTML(store);

        expect(store.updateSectionInMemory).toHaveBeenCalledWith('results', expect.any(Object));
        expect(store.update).not.toHaveBeenCalled();
    });

    it('مخزن بلا updateSectionInMemory إطلاقاً (نمط اختبارات أخرى قائمة): لا ينهار التصدير', () => {
        const minimalStore = { getState: () => BASE_STATE };
        expect(() => Generator.generateHTML(minimalStore)).not.toThrow();
    });
});

import { describe, it, expect } from 'vitest';
import { BankReportGenerator } from '../BankReportGenerator.js';

function makeStore(state) {
    return { getState: () => state };
}

const BASE_STATE = {
    projectInfo: { name: 'مشروع اختبار', concept: 'اختبار' },
    financing: {
        sources: { bankLoan: { amount: 100000, bank: '' } },
    },
};

describe('BankReportGenerator — قسم الضمانات وخانة الاعتماد (2026-07-13)', () => {
    it('لا يرمي خطأ عند نداء generateHTML بلا معامل ثانٍ (فحص انحدار)', () => {
        expect(() => BankReportGenerator.generateHTML(makeStore(BASE_STATE))).not.toThrow();
    });

    it('لا يعرض قسم الضمانات إن لم توجد ضمانات مدخلة', () => {
        const html = BankReportGenerator.generateHTML(makeStore(BASE_STATE));
        expect(html).not.toContain('الضمانات المقدَّمة');
    });

    it('يعرض قسم الضمانات ونسبة التغطية الصحيحة عند وجود ضمانات', () => {
        const state = {
            ...BASE_STATE,
            financing: {
                sources: { bankLoan: { amount: 100000, bank: '' } },
                guarantees: [{ type: 'mortgage', description: 'رهن عقار', value: 60000 }],
            },
        };
        const html = BankReportGenerator.generateHTML(makeStore(state));
        expect(html).toContain('الضمانات المقدَّمة');
        expect(html).toContain('رهن عقار/معدات');
        expect(html).toContain('60%'); // 60,000 / 100,000
    });

    it('خانة الاعتماد تعرض رسالة افتراضية بلا certification', () => {
        const html = BankReportGenerator.generateHTML(makeStore(BASE_STATE));
        expect(html).toContain('لم تتم مراجعة هذه الدراسة من خبير معتمد بعد');
    });

    it('خانة الاعتماد تعرض اسم المراجع ورقم الشهادة عند تمرير certification', () => {
        const html = BankReportGenerator.generateHTML(makeStore(BASE_STATE), {
            certification: { reviewerName: 'م. أحمد', certificateId: 'QR-CERT-2026-000001', certifiedAt: '2026-07-13' },
        });
        expect(html).toContain('م. أحمد');
        expect(html).toContain('QR-CERT-2026-000001');
        expect(html).not.toContain('لم تتم مراجعة هذه الدراسة من خبير معتمد بعد');
    });

    it('bankVariant يبدّل اسم جهة التمويل على الغلاف', () => {
        const htmlDefault = BankReportGenerator.generateHTML(makeStore(BASE_STATE));
        const htmlRajhi = BankReportGenerator.generateHTML(makeStore(BASE_STATE), { bankVariant: 'rajhi' });
        expect(htmlRajhi).toContain('مصرف الراجحي');
        expect(htmlDefault).not.toContain('مصرف الراجحي');
    });

    it('bankVariant الافتراضي يُشتق من financing.sources.bankLoan.bank عند عدم تمريره صراحة', () => {
        const state = { ...BASE_STATE, financing: { sources: { bankLoan: { amount: 100000, bank: 'riyad' } } } };
        const html = BankReportGenerator.generateHTML(makeStore(state));
        expect(html).toContain('بنك الرياض');
    });
});

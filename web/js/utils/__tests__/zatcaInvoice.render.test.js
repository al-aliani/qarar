import { describe, it, expect } from 'vitest';
import { renderInvoiceHtml } from '../zatcaInvoice.js';
import { MERCHANT_INFO } from '../../config.js';

/**
 * يتحقق أن هوية التاجر النظامية مُعبّأة فعلاً في config (المتطلب الوحيد المتبقّي
 * لبند فاتورة ZATCA)، وأن الفاتورة تعرضها مع تفكيك ضريبة صحيح، بلا تحذير «غير مُدخَل».
 */
describe('فاتورة ZATCA — هوية التاجر مُعبّأة والفاتورة تعرضها', () => {
    const order = {
        id: 'a1b2c3d4-1111-2222-3333-444455556666',
        tier: 'self',
        total_sar: 299,
        vat_sar: 39, // مُستخرَجة من الشامل عند الدفع (299 − 299/1.15 = 39)
        paid_at: '2026-07-19T12:00:00Z',
        provider: 'moyasar',
        items: [{ name: 'الباقة الذاتية', price: 299 }],
    };

    it('config يحمل رقماً ضريبياً صالحاً (15 خانة) واسم منشأة', () => {
        expect(MERCHANT_INFO.vatNumber).toMatch(/^\d{15}$/);
        expect(MERCHANT_INFO.name.trim().length).toBeGreaterThan(0);
    });

    it('الفاتورة تعرض الرقم الضريبي واسم المنشأة بلا تحذير «غير مُدخَل»', () => {
        const html = renderInvoiceHtml(order, MERCHANT_INFO, '');
        expect(html).toContain(MERCHANT_INFO.vatNumber);
        expect(html).toContain(MERCHANT_INFO.name);
        expect(html).not.toContain('غير مُدخَل');
    });

    it('الفاتورة تعرض تفكيك ضريبة القيمة المضافة الصحيح (صافٍ 260، ضريبة 39، إجمالي 299)', () => {
        const html = renderInvoiceHtml(order, MERCHANT_INFO, '');
        expect(html).toContain('260.00'); // الإجمالي قبل الضريبة = 299 − 39
        expect(html).toContain('39.00'); // ضريبة القيمة المضافة (15%)
        expect(html).toContain('299.00'); // الإجمالي المستحق (شامل الضريبة)
    });

    it('الرقم الموحّد يظهر بتسميته الصحيحة (لا كـ«س.ت») متى ضُبط', () => {
        if (!MERCHANT_INFO.unifiedNumber) return; // اختياري
        const html = renderInvoiceHtml(order, MERCHANT_INFO, '');
        expect(html).toContain(MERCHANT_INFO.unifiedNumber);
        expect(html).toContain('الرقم الموحّد');
    });
});

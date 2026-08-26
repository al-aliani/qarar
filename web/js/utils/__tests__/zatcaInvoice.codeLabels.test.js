import { describe, it, expect } from 'vitest';
import { renderInvoiceHtml } from '../zatcaInvoice.js';
import { MERCHANT_INFO } from '../../config.js';

/**
 * بلاغ SWEEP_CONFIRMED (P2، zatcaInvoice.js:81): الفاتورة الضريبية المبسّطة — مستند نظامي
 * عربي — كانت تطبع «طريقة الدفع: bank_transfer»، والتحويل البنكي هو القناة الوحيدة المفعّلة
 * فكل فاتورة تُسلَّم لكل عميل دافع تحمل رمزاً برمجياً إنجليزياً. يغطي هذا الملف كل رمز enum
 * يصل إلى الورق (مزوّد الدفع والباقة) وسلوك الرمز غير المعروف.
 */
const baseOrder = {
    id: 'a1b2c3d4-1111-2222-3333-444455556666',
    tier: 'reviewed',
    total_sar: 1999,
    vat_sar: 260.74,
    paid_at: '2026-07-19T12:00:00Z',
    provider: 'bank_transfer',
    items: [{ name: 'مراجَعة بخبير', price: 1999 }],
};

const render = (patch = {}) => renderInvoiceHtml({ ...baseOrder, ...patch }, MERCHANT_INFO, '');

describe('فاتورة ZATCA — لا رمز برمجي خام على مستند نظامي عربي', () => {
    it('التحويل البنكي (القناة الوحيدة المفعّلة) يُطبع «تحويل بنكي» لا bank_transfer', () => {
        const html = render();
        expect(html).toContain('طريقة الدفع: تحويل بنكي');
        expect(html).not.toContain('bank_transfer');
    });

    it.each([
        ['moyasar', 'بطاقة مدى/ائتمان (ميسر)'],
        ['stripe', 'بطاقة ائتمان (Stripe)'],
        ['tamara', 'تقسيط (تمارا)'],
    ])('المزوّد %s يُطبع بالعربية ولا يظهر رمزه الخام', (provider, expected) => {
        const html = render({ provider });
        expect(html).toContain(`طريقة الدفع: ${expected}`);
        expect(html).not.toContain(`طريقة الدفع: ${provider}`);
    });

    it('مزوّد غير معروف لا يُسرّب رمزه الخام إلى الورق', () => {
        const html = render({ provider: 'applepay' });
        expect(html).not.toContain('applepay');
    });

    it('مزوّد مفقود يُطبع كشرطة لا كقيمة فارغة أو رمز', () => {
        const html = render({ provider: undefined });
        expect(html).toContain('طريقة الدفع: —');
    });

    // البند الافتراضي (طلب بلا مصفوفة items) يشتقّ اسمه من orders.tier — وقيود
    // pricing.ts تشمل 'free' التي لم تكن في جدول الباقات القديم فتُطبع خاماً.
    it.each([
        ['free', 'الباقة المجانية'],
        ['self', 'الباقة الذاتية'],
        ['reviewed', 'مراجَعة بخبير'],
        ['full', 'الخدمة الكاملة'],
    ])('البند الافتراضي للباقة %s يُطبع بالعربية ولا يظهر رمزها الخام', (tier, expected) => {
        const html = render({ tier, items: undefined });
        expect(html).toContain(expected);
        expect(html).not.toContain(`<td>${tier}</td>`);
    });

    it('باقة غير معروفة لا تُسرّب رمزها الخام في وصف البند', () => {
        const html = render({ tier: 'enterprise', items: undefined });
        expect(html).not.toContain('enterprise');
        expect(html).toContain('خدمة دراسة جدوى');
    });
});

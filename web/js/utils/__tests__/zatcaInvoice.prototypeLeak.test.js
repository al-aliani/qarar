/**
 * الفاتورة الضريبية تترجم رموزاً (طريقة الدفع، الباقة) إلى نصّ عربي عبر جدول بحث.
 * القراءة بالأقواس على كائن حرفي تصل إلى مفاتيح `Object.prototype` الموروثة، ودالة
 * موروثة قيمة صادقة — فتُعاد بدل البديل المحايد.
 *
 * قياس 2026-08-26 على الكود قبل التشديد:
 *   provider='constructor' ⟶ «طريقة الدفع: function Object() { [native code] }»
 *   provider='toString'    ⟶ «طريقة الدفع: function toString() { [native code] }»
 * على **مستند نظامي**. غير قابل للوصول اليوم لأن قيود قاعدة البيانات تحصر القيم، لكن
 * الحصر شرط خارجي عن هذا الملف: توسيع القيد لاحقاً يُعيد العطل بلا أي إشارة.
 */
import { describe, it, expect } from 'vitest';
import { renderInvoiceHtml } from '../zatcaInvoice.js';

const order = (over = {}) => ({
    id: 'ord-1', tier: 'reviewed', provider: 'bank_transfer',
    total_sar: 1999, subtotal_sar: 1999, vat_sar: 260.74,
    created_at: '2026-08-26T09:00:00.000Z', items: [], ...over,
});

const PROTO_KEYS = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'];

describe('zatcaInvoice — لا تسريب من سلسلة النماذج إلى مستند نظامي', () => {
    it.each(PROTO_KEYS)('provider=%s لا يطبع دالة موروثة', (key) => {
        const html = renderInvoiceHtml(order({ provider: key }));
        expect(html, `تسرّبت دالة موروثة إلى الفاتورة عند provider=${key}`).not.toContain('native code');
        expect(html).not.toContain('function Object');
    });

    it.each(PROTO_KEYS)('tier=%s لا يطبع دالة موروثة في وصف البند', (key) => {
        const html = renderInvoiceHtml(order({ tier: key, items: [] }));
        expect(html, `تسرّبت دالة موروثة إلى وصف البند عند tier=${key}`).not.toContain('native code');
        expect(html).not.toContain('function Object');
    });

    it('الرموز الحقيقية ما زالت تُترجم صحيحاً — لا انحدار', () => {
        expect(renderInvoiceHtml(order({ provider: 'bank_transfer' }))).toContain('تحويل بنكي');
        expect(renderInvoiceHtml(order({ provider: 'moyasar' }))).toMatch(/ميسر|مدى/);
        expect(renderInvoiceHtml(order({ provider: 'bank_transfer' }))).not.toContain('bank_transfer');
    });

    it('رمز غير معروف يُستبدل بالبديل المحايد لا بالرمز الخام', () => {
        const html = renderInvoiceHtml(order({ provider: 'applepay' }));
        expect(html).not.toContain('applepay');
    });
});

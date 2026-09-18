/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-09-16: renderBankTransferPanel كانت مبنية حصراً حول tier/PRICING_PACKAGES
 * (باقات الاشتراك) — نص واتساب المُرسَل يقرأ "حوّلت مبلغ باقة «${pkg.name}»"، فأي
 * استدعاء بمنتج ليس باقة اشتراك (مثل طلب استشارة، انظر الدفع الفعلي الجديد لطلبات
 * الاستشارة عبر تحويل بنكي) كان يُنتج نصاً فارغاً مضلِّلاً "حوّلت مبلغ باقة «»".
 *
 * الإصلاح: معامل اختياري جديد productLabel يحل محل نص الباقة حين يُمرَّر، بلا أي أثر
 * على المسار القديم (tier) حين يغيب.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderBankTransferPanel } from '../BankTransferPanel.js';

function setBankConfig() {
    window.BANK_TRANSFER = {
        enabled: true,
        iban: 'SA0000000000000000000000',
        beneficiaryName: 'شركة قرار',
        bankName: 'البنك الأهلي'
    };
}

describe('renderBankTransferPanel — productLabel لمنتجات ليست باقة اشتراك', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="panel"></div>';
        setBankConfig();
    });

    it('بلا productLabel (المسار القديم): يبني نص باقة كما كان تماماً', () => {
        const container = document.getElementById('panel');
        const ok = renderBankTransferPanel(container, {
            tier: 'self', orderId: 'abc12345', amount: 299, onBack: () => {}
        });
        expect(ok).toBe(true);
        expect(container.textContent).toContain('299');
        expect(container.querySelector('#bankBack').textContent).toContain('رجوع للباقات');
    });

    it('مع productLabel (طلب استشارة): يستخدم النص المُمرَّر بدل باقة فارغة', () => {
        const container = document.getElementById('panel');
        const ok = renderBankTransferPanel(container, {
            orderId: 'req12345',
            amount: 990,
            onBack: () => {},
            productLabel: 'استشارة «مستشار»',
            backLabel: 'رجوع لطلبات الاستشارة'
        });
        expect(ok).toBe(true);
        expect(container.textContent).toContain('990');
        expect(container.querySelector('#bankBack').textContent).toContain('رجوع لطلبات الاستشارة');
        // لا أثر لنص "باقة «»" الفارغ المضلِّل
        expect(container.innerHTML).not.toContain('باقة «»');
    });

    it('لا إعداد تحويل بنكي صالح: يعيد false ولا يكتب شيئاً بغض النظر عن productLabel', () => {
        window.BANK_TRANSFER = { enabled: false };
        const container = document.getElementById('panel');
        const ok = renderBankTransferPanel(container, {
            orderId: 'req1', amount: 990, onBack: () => {}, productLabel: 'استشارة'
        });
        expect(ok).toBe(false);
    });
});

/**
 * يثبت أن ترميز TLV لرمز QR (فاتورة ZATCA المرحلة 1) صحيح: نُرمّز ثم نفكّ الـBase64
 * ونحلّل بنية TLV، ونتأكّد أن الحقول الخمسة تعود بقيمها وأوسمتها الصحيحة — بما فيها
 * النص العربي (UTF-8 متعدّد البايت) الذي يجب أن يُحسب طوله بالبايتات لا بالأحرف.
 */
import { describe, it, expect } from 'vitest';
import { buildZatcaTlvBase64 } from '../zatcaTlv.js';

function parseTlv(b64) {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const dec = new TextDecoder();
    const out = {};
    let i = 0;
    while (i < bytes.length) {
        const tag = bytes[i];
        const len = bytes[i + 1];
        out[tag] = dec.decode(bytes.slice(i + 2, i + 2 + len));
        i += 2 + len;
    }
    return out;
}

describe('ترميز TLV لفاتورة ZATCA', () => {
    it('يعيد الحقول الخمسة بقيمها الصحيحة (round-trip) مع نص عربي', () => {
        const input = {
            sellerName: 'مؤسسة بن صاحب التجارية',
            vatNumber: '300000000000003',
            timestamp: '2026-07-19T10:00:00Z',
            total: '299.00',
            vatTotal: '39.00',
        };
        const b64 = buildZatcaTlvBase64(input);
        // Base64 صالح وغير فارغ
        expect(typeof b64).toBe('string');
        expect(b64.length).toBeGreaterThan(0);
        const parsed = parseTlv(b64);
        expect(parsed[1]).toBe(input.sellerName);
        expect(parsed[2]).toBe(input.vatNumber);
        expect(parsed[3]).toBe(input.timestamp);
        expect(parsed[4]).toBe(input.total);
        expect(parsed[5]).toBe(input.vatTotal);
    });

    it('طول اسم البائع العربي محسوب بالبايتات (UTF-8) لا بالأحرف', () => {
        const b64 = buildZatcaTlvBase64({ sellerName: 'قرار', vatNumber: '', timestamp: '', total: '0', vatTotal: '0' });
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        // tag=1، ثم طول اسم «قرار» = 8 بايت UTF-8 (4 أحرف عربية × 2 بايت)
        expect(bytes[0]).toBe(1);
        expect(bytes[1]).toBe(new TextEncoder().encode('قرار').length);
    });
});

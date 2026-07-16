import { describe, it, expect } from 'vitest';
import { toE164SaudiPhone, isValidSaudiPhone, normalizeSaudiPhone } from '../phoneUtils.js';

describe('phoneUtils — توحيد وتحقق الجوال السعودي', () => {
    it('يحوّل صيغة محلية 05XXXXXXXX إلى E.164', () => {
        expect(toE164SaudiPhone('0512345678')).toBe('+966512345678');
    });

    it('يحوّل صيغة بلا صفر (5XXXXXXXX) إلى E.164', () => {
        expect(toE164SaudiPhone('512345678')).toBe('+966512345678');
    });

    it('يحوّل صيغة دولية بلا + إلى E.164', () => {
        expect(toE164SaudiPhone('966512345678')).toBe('+966512345678');
    });

    it('يتقبّل مسافات وشرطات ويوحّدها', () => {
        expect(toE164SaudiPhone('05 123 456 78')).toBe('+966512345678');
        expect(toE164SaudiPhone('0512-345-678')).toBe('+966512345678');
    });

    it.each([
        '0512345678',
        '512345678',
        '966512345678',
        '+966512345678',
        '0555555555',
    ])('%s رقم سعودي صحيح', (raw) => {
        expect(isValidSaudiPhone(raw)).toBe(true);
        expect(normalizeSaudiPhone(raw)).toBe('+966' + raw.replace(/^\+?966/, '').replace(/^0/, ''));
    });

    it.each([
        '',
        '123',
        '0412345678', // يبدأ بـ 04 (ليس جوال)
        '051234567', // ناقص رقم
        '05123456789', // زائد رقم
        '+201234567890', // مصري وليس سعودي
        'abcdefghij',
    ])('%s رقم غير صحيح', (raw) => {
        expect(isValidSaudiPhone(raw)).toBe(false);
        expect(normalizeSaudiPhone(raw)).toBeNull();
    });
});

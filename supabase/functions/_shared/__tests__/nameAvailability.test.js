/**
 * اختبار منطق فحص توفر الاسم عبر Vitest (Node) — نفس مبدأ otp.test.js: الملف
 * المصدر بلا أي API خاص بـDeno فيعمل بلا تعديل، وfetch قابل للحقن للاختبار بلا شبكة.
 */
import { describe, it, expect } from 'vitest';
import { slugify, interpretAvailability, checkOneCandidate } from '../nameAvailability.ts';

describe('slugify', () => {
    it('يحوّل اسماً عربياً بسيطاً إلى سلاج لاتيني غير فارغ', () => {
        expect(slugify('ركن البن')).toBe('rknalbn');
    });

    it('يزيل الرموز غير الأبجدية الرقمية بعد التحويل', () => {
        expect(slugify('Café-2026!')).toBe('caf2026');
    });

    it('يُرجع نصاً فارغاً لمدخل فارغ/غير موجود', () => {
        expect(slugify('')).toBe('');
        expect(slugify(undefined)).toBe('');
    });
});

describe('interpretAvailability', () => {
    it('taken=true → available=false', () => {
        expect(interpretAvailability(true)).toBe(false);
    });
    it('taken=false → available=true', () => {
        expect(interpretAvailability(false)).toBe(true);
    });
    it('taken=null (تعذّر) → available=null', () => {
        expect(interpretAvailability(null)).toBe(null);
    });
});

describe('checkOneCandidate', () => {
    it('اسم عربي خالص قصير جداً بعد التحويل → unsupported بلا أي طلب شبكة', async () => {
        const fetchImpl = () => { throw new Error('should not be called'); };
        const result = await checkOneCandidate('ء', fetchImpl);
        expect(result.checked).toBe('unsupported');
        expect(result.domainAvailable).toBe(null);
    });

    it('يعيد heuristic مع توفر=true عندما كل الطلبات تفشل (تُفسَّر كتعذّر لا كأخذ)', async () => {
        const fetchImpl = () => Promise.reject(new Error('network error'));
        const result = await checkOneCandidate('ركن البن', fetchImpl);
        expect(result.checked).toBe('heuristic');
        expect(result.domainAvailable).toBe(null);
        expect(result.instagramAvailable).toBe(null);
    });

    it('يعيد available=false عندما يستجيب الرابط بنجاح (مأخوذ على الأرجح)', async () => {
        const fetchImpl = () => Promise.resolve({ ok: true });
        const result = await checkOneCandidate('ركن البن', fetchImpl);
        expect(result.domainAvailable).toBe(false);
        expect(result.instagramAvailable).toBe(false);
        expect(result.xAvailable).toBe(false);
    });

    it('يعيد available=true عندما يفشل GET/HEAD بلا رمي (404 غير ok)', async () => {
        const fetchImpl = () => Promise.resolve({ ok: false });
        const result = await checkOneCandidate('ركن البن', fetchImpl);
        expect(result.domainAvailable).toBe(true);
    });
});

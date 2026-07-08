import { describe, it, expect, beforeEach } from 'vitest';
import { encryptionService } from '../encryption.js';

/**
 * حارس ضد تلف البيانات: كان مفتاح التشفير يُخزَّن في sessionStorage (يُمسح بإغلاق
 * التبويب) بينما النص المشفّر في localStorage (دائم) — فيتعذّر فك التشفير ويسقط
 * النظام صامتاً إلى «نص مشفّر كأنه صريح». الآن المفتاح في localStorage بنفس الدوام.
 */
function makeStorageShim() {
    const m = new Map();
    return {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: (k) => { m.delete(k); },
        clear: () => m.clear()
    };
}

beforeEach(() => {
    globalThis.localStorage = makeStorageShim();
    globalThis.sessionStorage = makeStorageShim();
    encryptionService._cryptoKey = null;
});

describe('دوام مفتاح التشفير (لا تلف بيانات بإغلاق التبويب)', () => {
    it('المفتاح يُخزَّن في localStorage لا sessionStorage', async () => {
        await encryptionService.encrypt('قيمة');
        expect(globalThis.localStorage.getItem('_enc_key')).toBeTruthy();
        expect(globalThis.sessionStorage.getItem('_enc_key')).toBeNull();
    });

    it('فك التشفير ينجح بعد محاكاة إغلاق التبويب (مسح مفتاح الذاكرة، بقاء localStorage)', async () => {
        const cipher = await encryptionService.encrypt('راتب 25000');
        expect(cipher).not.toBe('راتب 25000'); // مشفّر فعلاً (crypto متاح)
        // تبويب جديد: المفتاح في الذاكرة ضاع لكن localStorage باقٍ
        encryptionService._cryptoKey = null;
        const plain = await encryptionService.decrypt(cipher);
        expect(plain).toBe('راتب 25000'); // استُرجع المفتاح من localStorage — لا تلف
    });
});

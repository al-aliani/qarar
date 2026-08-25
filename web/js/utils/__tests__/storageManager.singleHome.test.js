/**
 * @vitest-environment jsdom
 *
 * الثابت المحروس: **المفتاح يعيش في مكان واحد فقط، وأحدث كتابة ناجحة هي ما يُقرأ دائماً.**
 *
 * الخلل الأصلي: مسار التقاط `QuotaExceededError` في setItem كان يكتب النسخة الجديدة في
 * IndexedDB ويُرجِع `success: true` دون أن يمسح النسخة القديمة العالقة في localStorage
 * ودون أن يكتب علامة `_ref`. فيُبلَّغ المستخدم بـ«حُفظ» بينما getItem التالية تجد القيمة
 * القديمة في localStorage وتُعيدها — عمل المستخدم يُفقد صامتاً مع كل حفظ لاحق (كلها ترمي
 * quota وكلها تُبلّغ بالنجاح).
 *
 * لا توجد اعتمادية fake-indexeddb في المشروع (ولا تُضاف)، وjsdom لا يوفّر IndexedDB —
 * لذا نحقن مضاعِفاً بسيطاً لـ`db` مباشرةً، ومضاعِفاً لـlocalStorage يسمح بمحاكاة الامتلاء
 * على مفاتيح بعينها.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storageManager } from '../storageManager.js';

const KEY = 'feasibility_study_data';

function makeFakeLocalStorage() {
    const map = new Map();
    return {
        map,
        // دالة اختيارية: تُرجِع true للمفتاح الذي يجب أن ترمي كتابته QuotaExceededError
        blocked: null,
        getItem(k) {
            return map.has(k) ? map.get(k) : null;
        },
        setItem(k, v) {
            if (this.blocked && this.blocked(k)) {
                const err = new Error('quota exceeded (fake)');
                err.name = 'QuotaExceededError';
                throw err;
            }
            map.set(k, String(v));
        },
        removeItem(k) {
            map.delete(k);
        },
        clear() {
            map.clear();
        },
    };
}

function makeFakeDB() {
    const data = new Map();
    const settle = (request, result) => {
        queueMicrotask(() => {
            request.result = result;
            if (request.onsuccess) request.onsuccess();
        });
    };
    return {
        data,
        transaction() {
            return {
                objectStore() {
                    return {
                        put(value, key) {
                            const request = {};
                            data.set(key, value);
                            settle(request, undefined);
                            return request;
                        },
                        get(key) {
                            const request = {};
                            settle(request, data.get(key));
                            return request;
                        },
                        delete(key) {
                            const request = {};
                            data.delete(key);
                            settle(request, undefined);
                            return request;
                        },
                    };
                },
            };
        },
    };
}

let ls;
let db;
const defaultLimit = storageManager.localStorageLimit;

beforeEach(() => {
    ls = makeFakeLocalStorage();
    db = makeFakeDB();
    Object.defineProperty(globalThis, 'localStorage', {
        value: ls,
        configurable: true,
        writable: true,
    });
    storageManager.db = db;
    storageManager.localStorageLimit = defaultLimit;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('storageManager — موطن واحد للمفتاح', () => {
    it('حفظ ناجح ثم حفظ يرمي QuotaExceededError: القراءة تُعيد الأحدث لا الأقدم', async () => {
        await storageManager.setItem(KEY, 'v10');
        expect(await storageManager.getItem(KEY)).toBe('v10');

        // امتلأ تخزين الأصل: كل كتابة للمفتاح نفسه ترمي من الآن فصاعداً
        ls.blocked = (k) => k === KEY;

        const res11 = await storageManager.setItem(KEY, 'v11');
        expect(res11.success).toBe(true);
        expect(await storageManager.getItem(KEY)).toBe('v11');

        // الفقد كان يتكرر مع كل حفظ لاحق — نتحقق أن التكرار سليم أيضاً
        await storageManager.setItem(KEY, 'v12');
        expect(await storageManager.getItem(KEY)).toBe('v12');

        // ولا تبقى نسخة قديمة عالقة في localStorage تحجب الأحدث
        expect(ls.getItem(KEY)).toBeNull();
    });

    it('فشل كتابة علامة _ref وحدها لا يُفسد القراءة (العلامة تحسين لا شرط للصحة)', async () => {
        await storageManager.setItem(KEY, 'v10');

        // القيمة التالية «كبيرة» فتسلك مسار IndexedDB المخطَّط، وعلامة _ref وحدها تفشل
        storageManager.localStorageLimit = 1;
        ls.blocked = (k) => k.endsWith('_ref');

        const res = await storageManager.setItem(KEY, 'v11-large');
        expect(res.method).toBe('indexedDB');
        expect(ls.getItem(`${KEY}_ref`)).toBeNull(); // العلامة لم تُكتب فعلاً
        expect(await storageManager.getItem(KEY)).toBe('v11-large');
    });

    it('علامة indexeddb بينما القاعدة غير متاحة: لا تُقدَّم بقايا localStorage كأنها حديثة', async () => {
        ls.map.set(KEY, 'v10-stale');
        ls.map.set(`${KEY}_ref`, 'indexeddb');
        storageManager.db = null;

        expect(await storageManager.getItem(KEY)).toBeNull();
    });

    it('كتابة صغيرة ناجحة تُبطل علامة _ref قديمة بدل الاتكال على صدفة الكتابة المزدوجة', async () => {
        ls.map.set(`${KEY}_ref`, 'indexeddb');
        db.data.set(KEY, 'stale-in-indexeddb');

        await storageManager.setItem(KEY, 'fresh-small');

        expect(ls.getItem(`${KEY}_ref`)).toBeNull();
        expect(await storageManager.getItem(KEY)).toBe('fresh-small');
    });

    it('عدم انحدار: بيانات صغيرة عادية تُكتب في localStorage وتُرآة في IndexedDB وتُقرأ كما كانت', async () => {
        const res = await storageManager.setItem(KEY, { a: 1 });

        expect(res).toMatchObject({ success: true, method: 'localStorage' });
        expect(ls.getItem(KEY)).toBe('{"a":1}');
        expect(db.data.get(KEY)).toBe('{"a":1}');
        expect(await storageManager.getItem(KEY)).toBe('{"a":1}');
    });
});

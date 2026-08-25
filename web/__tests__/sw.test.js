/**
 * اختبارات انحدار لـ web/public/sw.js — عيبان مقيسان أُصلحا 2026-08-25:
 *
 * 1) اسم الكاش كان ثابتاً ('feasibility-v5') لا يتغيّر مع البناء، فكل نشر يُضيف
 *    أصولاً جديدة (بأسماء تحمل بصمة محتوى) إلى نفس الكاش والقديمة تبقى = نمو بلا سقف.
 * 2) network-first بلا مهلة: «lie-fi» (متصل بلا استجابة) يُعلّق الصفحة للأبد بدل
 *    السقوط السريع إلى الكاش.
 *
 * sw.js ليس وحدة ES (لا exports) ولا يعمل خارج سياق Service Worker، فيُقيَّم مصدره
 * داخل دالة بمعاملات وهمية (self/caches/fetch) مع إلحاق return يكشف ما نختبره —
 * بهذا نختبر الملف المنشور نفسه حرفياً لا نسخة منه.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { computeBuildId, stampBuildId, SW_BUILD_ID_PLACEHOLDER } from '../../scripts/sw-build-id.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SW_PATH = resolve(__dirname, '../public/sw.js');
const SW_SOURCE = readFileSync(SW_PATH, 'utf-8');

const ORIGIN = 'https://sahib.sa';

/**
 * يُقيّم مصدر sw.js في بيئة وهمية ويعيد ما يلزم لاختباره.
 * @param {string} source مصدر sw.js (مختوماً أو غير مختوم)
 */
function loadServiceWorker(source, { caches, fetch } = {}) {
    const listeners = {};
    const self = {
        location: { origin: ORIGIN },
        addEventListener: (type, handler) => { listeners[type] = handler; },
        skipWaiting: vi.fn(async () => {}),
        clients: { claim: vi.fn(async () => {}), matchAll: vi.fn(async () => []) },
        registration: { showNotification: vi.fn(async () => {}) },
    };
    // eslint-disable-next-line no-new-func
    const factory = new Function(
        'self', 'caches', 'fetch',
        `${source}\n;return { CACHE_NAME, NETWORK_TIMEOUT_MS, shouldCache };`
    );
    const exported = factory(self, caches, fetch);
    return { ...exported, listeners, self };
}

/** كاش وهمي بسيط: خريطة url → Response. */
function makeCaches(initial = {}) {
    const stores = new Map();
    const put = vi.fn(async (name, request, response) => {
        if (!stores.has(name)) stores.set(name, new Map());
        stores.get(name).set(request.url, response);
    });
    const deleted = [];
    const caches = {
        _stores: stores,
        _put: put,
        _deleted: deleted,
        open: vi.fn(async (name) => ({
            put: (request, response) => put(name, request, response),
            addAll: vi.fn(async () => {}),
        })),
        match: vi.fn(async (request) => {
            for (const store of stores.values()) {
                if (store.has(request.url)) return store.get(request.url);
            }
            return undefined;
        }),
        keys: vi.fn(async () => [...stores.keys()]),
        delete: vi.fn(async (name) => { deleted.push(name); return stores.delete(name); }),
    };
    for (const [name, entries] of Object.entries(initial)) {
        stores.set(name, new Map(Object.entries(entries)));
    }
    return caches;
}

function makeRequest(url = `${ORIGIN}/assets/index-abc123.js`) {
    return { url, method: 'GET', destination: 'script' };
}

/** حدث fetch وهمي يلتقط الوعد المُمرَّر لـrespondWith. */
function makeFetchEvent(request) {
    const event = {
        request,
        waited: [],
        responsePromise: null,
        respondWith(p) { event.responsePromise = p; },
        waitUntil(p) { event.waited.push(p); },
    };
    return event;
}

function networkResponse(body = 'new-code') {
    return { ok: true, type: 'basic', body, clone: () => ({ ok: true, type: 'basic', body }) };
}

describe('sw.js — اسم الكاش مشتقّ من بصمة البناء', () => {
    it('غير مختوم (تشغيل محلي): يسقط إلى feasibility-dev بدل اسم مكسور', () => {
        const { CACHE_NAME } = loadServiceWorker(SW_SOURCE, { caches: makeCaches() });
        expect(CACHE_NAME).toBe('feasibility-dev');
    });

    it('مختوم بالبناء: الاسم يحمل بصمة البناء ويتغيّر بتغيّرها', () => {
        const first = loadServiceWorker(stampBuildId(SW_SOURCE, 'aaaa1111bbbb'), { caches: makeCaches() });
        const second = loadServiceWorker(stampBuildId(SW_SOURCE, 'cccc2222dddd'), { caches: makeCaches() });
        expect(first.CACHE_NAME).toBe('feasibility-aaaa1111bbbb');
        expect(second.CACHE_NAME).toBe('feasibility-cccc2222dddd');
        expect(first.CACHE_NAME).not.toBe(second.CACHE_NAME);
    });

    it('العنصر النائب موجود فعلاً في sw.js (وإلا بقي الاسم «dev» في الإنتاج صامتاً)', () => {
        expect(SW_SOURCE).toContain(SW_BUILD_ID_PLACEHOLDER);
    });

    it('activate يحذف كل كاش لا يطابق اسم البناء الحالي', async () => {
        const caches = makeCaches({
            'feasibility-aaaa1111bbbb': {},
            'feasibility-v5': {},
            'feasibility-oldbuild': {},
        });
        const sw = loadServiceWorker(stampBuildId(SW_SOURCE, 'aaaa1111bbbb'), { caches });
        const waited = [];
        await sw.listeners.activate({ waitUntil: (p) => waited.push(p) });
        await Promise.all(waited);
        expect(caches._deleted.sort()).toEqual(['feasibility-oldbuild', 'feasibility-v5']);
        expect(sw.self.clients.claim).toHaveBeenCalled();
    });
});

describe('scripts/sw-build-id.js — حساب البصمة والختم', () => {
    it('نفس قائمة الأصول ⇒ نفس البصمة (لا تبديل كاش بلا تغيير)', () => {
        expect(computeBuildId(['index-a1.js', 'style-b2.css']))
            .toBe(computeBuildId(['style-b2.css', 'index-a1.js']));
    });

    it('تغيّر أصل واحد ⇒ بصمة مختلفة', () => {
        expect(computeBuildId(['index-a1.js'])).not.toBe(computeBuildId(['index-a2.js']));
    });

    it('يرمي استثناءً إن اختفى العنصر النائب بدل الختم الصامت الفاشل', () => {
        expect(() => stampBuildId('const CACHE_NAME = "feasibility-v5";', 'abc')).toThrow(/sw\.js/);
    });
});

describe('sw.js — مهلة الشبكة (lie-fi)', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('شبكة معلّقة + نسخة مخزَّنة ⇒ يُقدَّم الكاش خلال المهلة بدل التعليق للأبد', async () => {
        const request = makeRequest();
        const cached = { ok: true, type: 'basic', body: 'cached-code' };
        const caches = makeCaches({ 'feasibility-dev': { [request.url]: cached } });
        const fetchMock = vi.fn(() => new Promise(() => {})); // لا تستجيب أبداً
        const sw = loadServiceWorker(SW_SOURCE, { caches, fetch: fetchMock });

        const event = makeFetchEvent(request);
        sw.listeners.fetch(event);
        await vi.advanceTimersByTimeAsync(sw.NETWORK_TIMEOUT_MS + 1);

        await expect(event.responsePromise).resolves.toBe(cached);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('لا يُلغى الطلب البطيء بعد المهلة: يكتمل لاحقاً ويُحدِّث الكاش', async () => {
        const request = makeRequest();
        const cached = { ok: true, type: 'basic', body: 'cached-code' };
        const caches = makeCaches({ 'feasibility-dev': { [request.url]: cached } });
        let resolveNetwork;
        const fetchMock = vi.fn((req) => {
            // لا AbortController/signal — الإلغاء يُضيّع تحديث الكاش بلا داعٍ
            expect(req.signal).toBeUndefined();
            return new Promise((r) => { resolveNetwork = r; });
        });
        const sw = loadServiceWorker(SW_SOURCE, { caches, fetch: fetchMock });

        const event = makeFetchEvent(request);
        sw.listeners.fetch(event);
        await vi.advanceTimersByTimeAsync(sw.NETWORK_TIMEOUT_MS + 1);
        await expect(event.responsePromise).resolves.toBe(cached);

        // وصلت الاستجابة متأخرة — يجب أن تُخزَّن للزيارة القادمة، والـSW مُبقىً حياً
        expect(event.waited.length).toBeGreaterThan(0);
        resolveNetwork(networkResponse());
        await Promise.all(event.waited);
        expect(caches._put).toHaveBeenCalled();
        expect(caches._put.mock.calls[0][0]).toBe('feasibility-dev');
    });

    it('شبكة سريعة ⇒ استجابة الشبكة لا الكاش (network-first يبقى كما هو)', async () => {
        const request = makeRequest();
        const cached = { ok: true, type: 'basic', body: 'cached-code' };
        const caches = makeCaches({ 'feasibility-dev': { [request.url]: cached } });
        const fresh = networkResponse('fresh-code');
        const sw = loadServiceWorker(SW_SOURCE, { caches, fetch: vi.fn(async () => fresh) });

        const event = makeFetchEvent(request);
        sw.listeners.fetch(event);
        await vi.advanceTimersByTimeAsync(10);
        await expect(event.responsePromise).resolves.toBe(fresh);
    });

    it('شبكة معلّقة بلا نسخة مخزَّنة ⇒ ينتظر الشبكة ولا يُرجع 503 عند المهلة', async () => {
        const request = makeRequest();
        const caches = makeCaches();
        let resolveNetwork;
        const sw = loadServiceWorker(SW_SOURCE, {
            caches,
            fetch: vi.fn(() => new Promise((r) => { resolveNetwork = r; })),
        });

        const event = makeFetchEvent(request);
        sw.listeners.fetch(event);
        let settled = false;
        event.responsePromise.then(() => { settled = true; });
        await vi.advanceTimersByTimeAsync(sw.NETWORK_TIMEOUT_MS * 3);
        expect(settled).toBe(false); // لا شيء نُقدِّمه — الانتظار أفضل من صفحة خطأ

        const fresh = networkResponse();
        resolveNetwork(fresh);
        await expect(event.responsePromise).resolves.toBe(fresh);
    });

    it('فشل الشبكة (أوفلاين) ⇒ الكاش فوراً', async () => {
        const request = makeRequest();
        const cached = { ok: true, type: 'basic', body: 'cached-code' };
        const caches = makeCaches({ 'feasibility-dev': { [request.url]: cached } });
        const sw = loadServiceWorker(SW_SOURCE, {
            caches,
            fetch: vi.fn(async () => { throw new Error('offline'); }),
        });

        const event = makeFetchEvent(request);
        sw.listeners.fetch(event);
        await vi.advanceTimersByTimeAsync(1);
        await expect(event.responsePromise).resolves.toBe(cached);
    });

    it('فشل الشبكة بلا كاش ⇒ استجابة 503 لا تعليق', async () => {
        const request = makeRequest();
        const sw = loadServiceWorker(SW_SOURCE, {
            caches: makeCaches(),
            fetch: vi.fn(async () => { throw new Error('offline'); }),
        });

        const event = makeFetchEvent(request);
        sw.listeners.fetch(event);
        await vi.advanceTimersByTimeAsync(1);
        const response = await event.responsePromise;
        expect(response.status).toBe(503);
    });

    it('طلبات /api تخضع للمهلة نفسها — لكنها لا تُخزَّن أصلاً فلا سقوط للكاش إنتاجياً', async () => {
        // تصحيح 2026-08-25: الصيغة الأولى كانت تزرع مدخل كاش لطلب /api يدوياً ثم تؤكد
        // السقوط إليه — توكيد أجوف: استجابات /api لا تمرّ بـfetchAndCache إطلاقاً
        // (المسار يستعمل fetch الخام)، وactivate يمسح الكاشات القديمة، فإصابة
        // caches.match على /api مستحيلة في الإنتاج. الاختبار كان ينجح على حالة لا وجود
        // لها. ما يستحق التثبيت فعلاً شيئان: أن المهلة تُطبَّق على هذا الفرع أيضاً،
        // وأن الاستجابة لا تُخزَّن.
        const request = makeRequest(`${ORIGIN}/api/market`);
        const caches = makeCaches({ 'feasibility-dev': {} });
        const networkResponse = { ok: true, type: 'basic', body: 'live-api' };
        let resolveNetwork;
        const sw = loadServiceWorker(SW_SOURCE, {
            caches,
            fetch: vi.fn(() => new Promise((r) => { resolveNetwork = r; }))
        });

        const event = makeFetchEvent(request);
        sw.listeners.fetch(event);

        // المهلة تمرّ ولا كاش ⟹ لا يُرجع 503 مبكراً، بل ينتظر الشبكة فعلاً.
        await vi.advanceTimersByTimeAsync(sw.NETWORK_TIMEOUT_MS + 1);
        resolveNetwork(networkResponse);
        await expect(event.responsePromise).resolves.toBe(networkResponse);

        // ولا تُخزَّن: بيانات حيّة لا يجوز تقديمها قديمة من الكاش.
        expect(caches._put).not.toHaveBeenCalled();
    });
});

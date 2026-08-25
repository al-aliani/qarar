/**
 * Service Worker
 * Network-first للكود (JS/CSS/HTML) حتى تصل التحديثات فوراً، مع fallback للكاش دون اتصال.
 * (كان Cache-first — فكانت إصلاحات الكود لا تصل المستخدمين أبداً حتى يتغيّر اسم الكاش يدوياً.)
 */
/**
 * اسم الكاش مشتقّ من بصمة البناء. كان ثابتاً ('feasibility-v5') لا يتغيّر مع البناء،
 * فكل نشر يُضيف الأصول الجديدة (أسماؤها تحمل بصمة محتوى: index-a1b2c3.js) إلى نفس
 * الكاش بينما القديمة تبقى للأبد — نمو بلا سقف على جهاز المستخدم. الآن كل نشر
 * = اسم كاش جديد، وحدث activate أدناه يحذف كل ما لا يطابقه.
 *
 * هذا الملف في web/public/ يُنسخ حرفياً بلا معالجة Vite (لا import.meta.env هنا)،
 * فالعنصر النائب يُستبدل بعد البناء عبر إضافة stamp-sw-build-id في vite.config.js.
 * الفحص /^__/ يكشف النسخة غير المختومة (تشغيل محلي/تطوير) فيصير الاسم feasibility-dev.
 */
const BUILD_ID = '__SW_BUILD_ID__';
const CACHE_NAME = 'feasibility-' + (/^__/.test(BUILD_ID) ? 'dev' : BUILD_ID);

/**
 * مهلة الشبكة قبل السقوط للكاش. بلا مهلة كانت استراتيجية network-first تسقط للكاش
 * عند فشل الطلب فقط — أما «lie-fi» (متصل لكن لا يستجيب) فيُبقي الطلب معلّقاً بلا
 * نهاية فتتجمّد الصفحة. لا نُلغي الطلب بعد المهلة (لا AbortController): يُترك
 * ليكتمل ويُحدِّث الكاش للزيارة التالية، والمستخدم يحصل على النسخة المخزَّنة فوراً.
 */
const NETWORK_TIMEOUT_MS = 4000;

/** علامة داخلية: الشبكة فشلت أو تجاوزت المهلة (ليست استجابة). */
const NETWORK_UNAVAILABLE = { networkUnavailable: true };

// أصول حرجة تُخزَّن عند التثبيت
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/landing.html',
    '/manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_URLS).catch(() => {});
        }).then(() => self.skipWaiting())
    );
});

/**
 * مسار تحديث الـService Worker موجود ومقصود: skipWaiting عند التثبيت + clients.claim
 * هنا — بدونهما يبقى المستخدم على نسخة قديمة إلى أن يُغلق كل تبويبات الموقع.
 * أثره على تبويب مفتوح قديم لم يتغيّر بإضافة اسم الكاش المتغيّر: بعد نشر جديد تُعيد
 * قاعدة vercel.json (`^/assets/.*$` → 404) للأصول القديمة استجابة 404، وهي استجابة
 * *ناجحة* لا رمية، فالسقوط للكاش لا يحدث أصلاً في تلك الحالة قبل التغيير ولا بعده.
 * حذف الكاشات القديمة أدناه هو ما يجعل الاسم المتغيّر يمنع النمو فعلاً — بدونه
 * تتراكم نسخة كاش لكل نشر بدل أن تحل محلها.
 */
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

function isSameOrigin(url) {
    try {
        const u = new URL(url);
        return self.location.origin === u.origin;
    } catch (_) {
        return false;
    }
}

function shouldCache(request) {
    if (request.method !== 'GET') return false;
    if (!isSameOrigin(request.url)) return false;
    const dest = request.destination;
    const url = request.url;
    return dest === 'document' || dest === 'script' || dest === 'style' ||
        /\.(js|mjs|cjs|css|html|json)$/i.test(url.split('?')[0]);
}

// Push Notifications — أساس: عرض إشعار عند استلام push
self.addEventListener('push', (e) => {
    let data = { title: 'محاكي الجدوى', body: '' };
    try {
        if (e.data) data = e.data.json();
    } catch (_) {
        if (e.data) data.body = e.data.text();
    }
    const opts = {
        body: data.body || '',
        icon: '/brand-icon.svg',
        badge: '/brand-icon.svg',
        tag: data.tag || 'feasibility',
        requireInteraction: false
    };
    e.waitUntil(
        self.registration.showNotification(data.title || 'محاكي الجدوى', opts)
    );
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const url = e.notification.data?.url || '/';
    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            if (clients.length) clients[0].focus();
            else if (self.clients.openWindow) self.clients.openWindow(url);
        })
    );
});

/** جلب من الشبكة مع تخزين النسخة الناجحة في كاش هذا البناء. */
function fetchAndCache(request) {
    return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            return caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, clone))
                .catch(() => {})
                .then(() => response);
        }
        return response;
    });
}

/**
 * Network-first بمهلة: الشبكة أولاً (تحديثات فورية)، فإن تجاوزت NETWORK_TIMEOUT_MS
 * أو فشلت نُقدِّم النسخة المخزَّنة إن وُجدت. إن لم توجد نسخة مخزَّنة فالانتظار حتى
 * نهاية الطلب أفضل من صفحة خطأ فورية — لا شيء آخر نُقدِّمه للمستخدم.
 */
function networkFirstWithTimeout(request, networkPromise, offlineResponse) {
    let timer;
    const settled = networkPromise.then(
        (response) => { clearTimeout(timer); return response; },
        () => { clearTimeout(timer); return NETWORK_UNAVAILABLE; }
    );
    const timedOut = new Promise((resolve) => {
        timer = setTimeout(() => resolve(NETWORK_UNAVAILABLE), NETWORK_TIMEOUT_MS);
    });
    return Promise.race([settled, timedOut]).then((result) => {
        if (result !== NETWORK_UNAVAILABLE) return result;
        return caches.match(request).then((cached) => {
            if (cached) return cached;
            return networkPromise.catch(() => offlineResponse());
        });
    });
}

// Offline-first: Network-first بمهلة للأصول ولـ /api، مع السقوط للكاش
self.addEventListener('fetch', (e) => {
    const isApi = e.request.url.includes('/api/');
    if (!isApi && !shouldCache(e.request)) {
        e.respondWith(fetch(e.request));
        return;
    }
    // استجابات /api لا تُخزَّن (تُقرأ من الكاش فقط كاحتياط كما كانت)
    const networkPromise = isApi ? fetch(e.request) : fetchAndCache(e.request);
    if (!isApi) {
        // بعد المهلة نكون قد رددنا من الكاش، لكن الطلب لا يزال جارياً — waitUntil
        // يُبقي الـService Worker حياً حتى يكتمل التخزين، وإلا ضاع تحديث الكاش.
        e.waitUntil(networkPromise.catch(() => {}));
    }
    e.respondWith(networkFirstWithTimeout(e.request, networkPromise, () => (
        isApi
            ? new Response(JSON.stringify({ offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } })
            : new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
    )));
});

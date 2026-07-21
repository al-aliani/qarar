/**
 * Service Worker
 * Network-first للكود (JS/CSS/HTML) حتى تصل التحديثات فوراً، مع fallback للكاش دون اتصال.
 * (كان Cache-first — فكانت إصلاحات الكود لا تصل المستخدمين أبداً حتى يتغيّر اسم الكاش يدوياً.)
 */
const CACHE_NAME = 'feasibility-v5';

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

// Offline-first: Cache-first للأصول، Network-first لـ /api
self.addEventListener('fetch', (e) => {
    const url = e.request.url;
    if (url.includes('/api/')) {
        e.respondWith(
            fetch(e.request)
                .catch(() => caches.match(e.request).then((cached) => cached || new Response(JSON.stringify({ offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
        );
        return;
    }
    if (!shouldCache(e.request)) {
        e.respondWith(fetch(e.request));
        return;
    }
    // Network-first: الشبكة أولاً (تحديثات فورية) ثم الكاش عند انقطاع الاتصال
    e.respondWith(
        fetch(e.request)
            .then((response) => {
                if (response.ok && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
                }
                return response;
            })
            .catch(() => caches.match(e.request).then((cached) => cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })))
    );
});

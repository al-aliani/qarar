import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { defineConfig } from 'vite';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, 'assets');

export default defineConfig({
    root: './web',
    publicDir: 'public',
    // بناء متعدد الصفحات: بدون هذا كان Vite يبني index.html فقط، فتُفقد صفحة الهبوط
    // والشروط والخصوصية من الإنتاج (روابط التذييل تُعطي 404). smoke_test أداة تطوير — تُستثنى.
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'web/index.html'),
                landing: resolve(__dirname, 'web/landing.html'),
                terms: resolve(__dirname, 'web/terms.html'),
                privacy: resolve(__dirname, 'web/privacy.html'),
                // investor.html مُستثناة: فيها استيراد مكسور (getPitchFromStorage) وهي خارج مسار الإطلاق.
            },
        },
    },
    optimizeDeps: {
        include: ['lz-string'],
    },
    test: {
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts}'],
        environment: 'node',
        coverage: {
            provider: 'v8',
            enabled: true,
            reporter: ['text', 'html'],
            reportsDirectory: './coverage',
            lines: 80,
            functions: 80,
            branches: 80,
            statements: 80,
            exclude: [
                'node_modules/**',
                'dist/**',
                '**/*.test.js',
                '**/*.spec.js',
                '**/__tests__/**',
                '**/test/**',
                'web/dist/**',
            ],
        },
    },
    resolve: {
        alias: {
            '/lib': resolve(__dirname, 'lib')
        }
    },
    plugins: [
        {
            name: 'configure-server',
            configureServer(server) {
                // الجذر "/" يعرض صفحة الهبوط (الرئيسية) في التطوير — مطابقةً للإنتاج.
                // الأداة (المحاكي) تبقى على /index.html، وروابط الرئيسية النسبية تفتحها.
                server.middlewares.use((req, res, next) => {
                    const p = (req.url || '/').split('?')[0];
                    if (p === '/') {
                        const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
                        req.url = '/landing.html' + qs;
                    }
                    next();
                });
                server.middlewares.use('/assets', (req, res, next) => {
                    // fetch()/المتصفح يُرسل المسار مُرمَّزاً بالنسبة المئوية (%D9%82...) لأي حرف غير ASCII
                    // (أسماء الملفات العربية هنا). بدون فك الترميز، resolve() يبحث عن اسم ملف حرفي
                    // "%D9%82..." غير موجود على القرص، فيفشل الشرط دائماً ويُعاد index.html بدل الملف.
                    let pathname = (req.url?.split('?')[0] || '/').replace(/^\//, '');
                    try { pathname = decodeURIComponent(pathname); } catch (_) { /* اترك كما هو إن فشل الفك */ }
                    if (pathname.includes('..')) return next();
                    const file = resolve(assetsDir, pathname);
                    if (!file.startsWith(assetsDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
                        return next();
                    }
                    const data = fs.readFileSync(file);
                    const ext = (pathname.split('.').pop() || '').toLowerCase();
                    const types = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', json: 'application/json' };
                    res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
                    res.end(data);
                });
            }
        }
    ],
    server: {
        port: 5173,
        fs: {
            allow: ['..']
        },
        // تعطيل HMR يمنع خطأ WebSocket 400 إن ظهر في المتصفح
        hmr: false,
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false,
            },
        }
    },
});

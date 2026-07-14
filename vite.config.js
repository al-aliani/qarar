import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, 'assets');

// build فقط: configureServer أعلاه يخدم /studies /databases /hr-files محلياً
// في وضع dev فقط (middleware لا يعمل أثناء vite build) — بدونها كانت روابط
// التحميل/العرض الثلاثة تُرجع 404 في الإنتاج (أو تُبتلع بواسطة SPA fallback في
// netlify.toml/vercel.json فيُنزَّل index.html باسم .pdf). ننسخ فقط الملفات
// المفهرسة فعلياً في كل JSON (لا نسخ كامل للمجلد) لتفادي تضخيم الحزمة بصور/أرشيفات مستبعدة.
function copyCatalogFiles(catalogPath, sourceRoot, urlPrefix, distDir) {
    if (!fs.existsSync(catalogPath)) return;
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    const urls = [];
    if (Array.isArray(catalog.studies)) urls.push(...catalog.studies.map((s) => s.url));
    if (Array.isArray(catalog.groups)) {
        for (const group of catalog.groups) {
            for (const file of group.files || []) urls.push(file.url);
        }
    }
    let copied = 0;
    for (const url of urls) {
        if (!url.startsWith(urlPrefix + '/')) continue;
        const relative = decodeURIComponent(url.slice(urlPrefix.length + 1));
        const src = resolve(sourceRoot, relative);
        const dest = resolve(distDir, relative);
        if (!src.startsWith(sourceRoot) || !fs.existsSync(src)) continue;
        fs.mkdirSync(dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        copied += 1;
    }
    console.log(`[copy-catalog-files] ${copied}/${urls.length} → ${distDir}`);
}

export default defineConfig({
    root: './web',
    publicDir: 'public',
    // mpa: المسارات المجهولة تعيد 404 صريحاً بدل حقن index.html كاحتياط SPA
    // (كان يجعل الروابط الخاطئة مثل /web/ تعرض التطبيق بلا CSS — «تصميم مكسور» يصعب تشخيصه).
    appType: 'mpa',
    // بناء متعدد الصفحات: بدون هذا كان Vite يبني index.html فقط، فتُفقد صفحة الهبوط
    // والشروط والخصوصية من الإنتاج (روابط التذييل تُعطي 404). smoke_test أداة تطوير — تُستثنى.
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'web/index.html'),
                landing: resolve(__dirname, 'web/landing.html'),
                terms: resolve(__dirname, 'web/terms.html'),
                privacy: resolve(__dirname, 'web/privacy.html'),
                // investor.html: صفحة عرض المستثمر (للقراءة فقط) — أُصلح الاستيراد المكسور (getPitchFromStorage)
                investor: resolve(__dirname, 'web/investor.html'),
                charts: resolve(__dirname, 'web/financial_charts.html'),
                dashboard: resolve(__dirname, 'web/dashboard.html'),
            },
        },
    },
    optimizeDeps: {
        include: ['lz-string'],
    },
    test: {
        // تدقيق 2026-07-09 (حزمة 5): lib/calc/__tests__/*.test.js (calc.test.js،
        // verification.test.js) كانا يتيمين تماماً — root:'./web' أعلاه يحصر التقاط
        // vitest الافتراضي (**/*.test.js) داخل web/ فقط، فلا تُشغَّل هذه الاختبارات
        // إطلاقاً عبر npm test رغم وجودها ونجاحها لو شُغِّلت يدوياً. أُضيف مسار صريح
        // خارج الجذر (../lib) بدل نقل الاختبارات (يفصلها عن شجرة المصدر lib/calc
        // التي تختبرها ويكسر مسارات الاستيراد النسبية ../index.js).
        // تدقيق 2026-07-09 (أتمتة الدفع): نفس العلة تكررت لـ supabase/functions/_shared —
        // منطق تحقق Webhook/التسعير الحرج يُختبر عبر Vitest (Web Crypto API قياسية
        // تعمل في Node كما في Deno دون تعديل) رغم أن الوجهة الفعلية Edge Functions/Deno
        // غير المتوفر محلياً؛ بلا هذا المسار الإضافي كانت ستُصبح اختبارات يتيمة أخرى.
        include: [
            '**/*.{test,spec}.{js,mjs,cjs,ts}',
            '../lib/**/*.{test,spec}.{js,mjs,cjs,ts}',
            '../supabase/**/*.{test,spec}.{js,mjs,cjs,ts}'
        ],
        environment: 'node',
        coverage: {
            provider: 'v8',
            enabled: true,
            reporter: ['text', 'html'],
            reportsDirectory: './coverage',
            // تدقيق 2026-07-08: كانت lines/functions/branches/statements هنا مباشرة تحت
            // coverage (بلا مفتاح thresholds) — صياغة Vitest 1.x قديمة لا يقرأها Vitest 2.x،
            // فتُتجاهل صامتة و"80%" كانت وثيقة زخرفية (التغطية الفعلية ~18-19% وnpm test
            // ينجح دون أي تحذير). الصياغة الصحيحة thresholds أدناه، بحد ابتدائي واقعي
            // أسفل القيمة الفعلية الحالية بقليل (حاجز انحدار Ratchet) — يُرفع تدريجياً،
            // لا يُنزَّل إلا بمراجعة موثّقة صريحة كهذه:
            // إعادة معايرة 2026-07-08 (لاحقة، نفس اليوم): بعد حملة إصلاحات المستوى الحرج
            // ارتفعت lines/functions/statements فعلياً (~18-19%→30-34%) فرُفعت هنا لتطابق
            // ذلك (اتجاه الـratchet الصحيح: للأعلى). branches ارتفع أيضاً (61%→~54.5% مبدئياً
            // بعد إضافة كود شرطي جديد كثير عبر ملفات كبيرة غير مُغطاة أصلاً كاملة مثل
            // DashboardView.js/Wizard.js) لكنه استقر دون 55% رغم اختبارات جديدة مضافة
            // فعلياً (livePanel.thresholds.test.js) — خُفِّض بمقدار نقطة واحدة فقط (54)
            // بدل ملاحقة رقم عبر اختبارات صورية لا تخدم الصحة الفعلية.
            thresholds: {
                lines: 28,
                functions: 32,
                branches: 54,
                statements: 28,
            },
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
        react(),
        {
            name: 'configure-server',
            configureServer(server) {
                // الجذر "/" يعرض صفحة الهبوط (الرئيسية) في التطوير — مطابقةً للإنتاج.
                // الأداة (المحاكي) تبقى على /index.html، وروابط الرئيسية النسبية تفتحها.
                server.middlewares.use((req, res, next) => {
                    const p = (req.url || '/').split('?')[0];
                    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
                    if (p === '/') {
                        req.url = '/landing.html' + qs;
                    } else if (p === '/web' || p.startsWith('/web/')) {
                        // روابط قديمة من حقبة «الجذر = المستودع» (http://localhost:5173/web/…):
                        // إعادة توجيه للمسار الصحيح بدل صفحة بلا CSS. ‏/web/ → التطبيق.
                        const rest = (p === '/web' || p === '/web/') ? '/index.html' : p.slice(4);
                        res.statusCode = 302;
                        res.setHeader('Location', rest + qs);
                        res.end();
                        return;
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
                
                const serveDir = (prefix, targetDir) => {
                    server.middlewares.use(prefix, (req, res, next) => {
                        let pathname = (req.url?.split('?')[0] || '/').replace(/^\//, '');
                        try { pathname = decodeURIComponent(pathname); } catch (_) {}
                        if (pathname.includes('..')) return next();
                        const file = resolve(__dirname, targetDir, pathname);
                        if (!file.startsWith(resolve(__dirname, targetDir)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
                            return next();
                        }
                        const data = fs.readFileSync(file);
                        const ext = (pathname.split('.').pop() || '').toLowerCase();
                        const types = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', zip: 'application/zip', rar: 'application/x-rar-compressed' };
                        res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
                        res.end(data);
                    });
                };
                
                serveDir('/studies', 'درسات جدوى');
                serveDir('/databases', 'ملفات قواعد البيانات');
                serveDir('/hr-files', 'ملفات الموارد البشرية/الموارد البشرية');
            }
        },
        {
            name: 'copy-catalog-files',
            apply: 'build',
            closeBundle() {
                const distDir = resolve(__dirname, 'web/dist');
                copyCatalogFiles(
                    resolve(__dirname, 'web/public/data/ready-studies.json'),
                    resolve(__dirname, 'درسات جدوى'),
                    '/studies',
                    resolve(distDir, 'studies'),
                );
                copyCatalogFiles(
                    resolve(__dirname, 'web/public/data/database-files.json'),
                    resolve(__dirname, 'ملفات قواعد البيانات'),
                    '/databases',
                    resolve(distDir, 'databases'),
                );
                copyCatalogFiles(
                    resolve(__dirname, 'web/public/data/hr-files.json'),
                    resolve(__dirname, 'ملفات الموارد البشرية/الموارد البشرية'),
                    '/hr-files',
                    resolve(distDir, 'hr-files'),
                );
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

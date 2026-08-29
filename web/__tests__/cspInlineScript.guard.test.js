/**
 * حارس: سكربتات/معالجات inline في web/*.html يجب أن يسمح بها script-src
 * الفعلي في vercel.json — وإلا تُحجب صامتاً في الإنتاج فقط.
 *
 * العطل الذي استدعى هذا الحارس (2026-08-2x): cookie-policy.html كان يحمل زر
 * "تغيير تفضيلات الكوكيز" بمنطق داخل <script> عادي (بلا src). يعمل محلياً وفي
 * كل اختبارات Vitest (لا CSP في jsdom)، وينجح `npm run build` بلا أي تحذير،
 * لكن CSP الإنتاج في vercel.json (script-src 'self' ... بلا 'unsafe-inline'
 * ولا nonce/hash) يحجب تنفيذه صامتاً في متصفح حقيقي: الزر يظهر لكن الضغط
 * عليه بلا أي أثر. لا شيء في CI كان يتحقق أن مصدر HTML الفعلي متوافق مع CSP
 * قبل هذا الحارس — أُصلح الموضع بنقل المنطق لملف خارجي
 * (web/js/cookie-policy-page.js)، لا بتخفيف CSP.
 *
 * ملاحظة مهمة تحقَّقت فعلياً عبر `npm run build` (وليست افتراضاً): <script
 * type="module"> الخالي من src (كما في landing.html/contact.html/
 * partners.html/pricing.html) ليس نفس الخطر إطلاقاً — Vite يستخرجه تلقائياً
 * إلى ملف حزمة خارجي مُرقَّم وقت البناء (مثال محقَّق: landing.html فيه 5 كتل
 * <script type="module"> تتحول في dist/landing.html إلى سكربت واحد
 * <script type="module" crossorigin src="/assets/landing-*.js">، ملف خارجي
 * من نفس الأصل يسمح به script-src 'self' دون أي حاجة لـunsafe-inline).
 * الأمر نفسه تحقَّق لـcookie-policy.html بعد الإصلاح هنا: dist/cookie-policy.html
 * يحمل <script type="module" crossorigin src="/assets/cookiePolicy-*.js">
 * ومحتواه هو بالضبط منطق الزر المنقول. لذا يُستثنى type="module" هنا عمداً
 * (تماماً مثل application/ld+json فهو بيانات مُهيكَلة لا شفرة قابلة للتنفيذ) —
 * ما يبقى مكشوفاً فعلياً في الإنتاج هو أي <script> "كلاسيكي" (بلا src وبلا
 * type="module") بمحتوى غير فارغ، لأن Vite لا يحوّله ولا يستخرجه إطلاقاً؛
 * يصل الإنتاج حرفياً inline كما كُتب.
 *
 * الحارس يفحص مصدر web/*.html مباشرة لا web/dist/: `npm run test` في ci.yml
 * يسبق `npm run build`، فـdist/ غير موجود وقت تشغيل الاختبارات أصلاً، وحتى لو
 * وُجد فإن ما يهمّ هذا الحارس هو ما سيُنتجه البناء من *كل* صفحة مصدر، لا نسخة
 * بناء سابقة قد تكون قديمة.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, '..');
const REPO_ROOT = join(WEB_DIR, '..');

const pages = readdirSync(WEB_DIR)
    .filter((f) => f.endsWith('.html'))
    .sort();

/** يمحو كل تطابق للنمط إلى مسافات (لا يحذف) — يحافظ على الإزاحات وأرقام الأسطر. */
function blank(src, regex) {
    return src.replace(regex, (m) => m.replace(/[^\n]/g, ' '));
}

function lineOf(src, index) {
    return src.slice(0, index).split('\n').length;
}

// --- استخراج اتجاه script-src من كل رأس Content-Security-Policy في vercel.json ---

function getScriptSrcTokenSets() {
    const vercelConfig = JSON.parse(readFileSync(join(REPO_ROOT, 'vercel.json'), 'utf8'));
    const cspValues = (vercelConfig.routes || [])
        .map((route) => route.headers && route.headers['Content-Security-Policy'])
        .filter(Boolean);
    return cspValues.map((csp) => {
        const m = csp.match(/(?:^|;)\s*script-src\s+([^;]+)/i);
        return m ? m[1].trim().split(/\s+/) : [];
    });
}

const UNSAFE_INLINE = /^'unsafe-inline'$/i;
const NONCE_OR_HASH = /^'(nonce|sha256|sha384|sha512)-/i;

function tokensAllowInline(tokens) {
    return tokens.some((t) => UNSAFE_INLINE.test(t) || NONCE_OR_HASH.test(t));
}

const scriptSrcTokenSets = getScriptSrcTokenSets();
// متحفّظ: يكفي رأس CSP واحد يسمح بـinline (لا يوجد اليوم أكثر من رأس واحد فعلياً في vercel.json).
const cspAllowsInline = scriptSrcTokenSets.some(tokensAllowInline);

// --- فحص web/*.html ---

function findInlineScriptViolations(html, file) {
    const violations = [];
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const [, attrs, body] = m;
        if (/\bsrc\s*=/i.test(attrs)) continue; // خارجي أصلاً — لا علاقة بالحارس
        const typeMatch = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
        const type = (typeMatch ? typeMatch[1] : '').toLowerCase();
        if (type === 'application/ld+json') continue; // بيانات مُهيكَلة لا شفرة
        if (type === 'module') continue; // Vite يستخرجه لملف خارجي وقت البناء — انظر تعليق الرأس
        if (body.trim() === '') continue;
        violations.push({ file, line: lineOf(html, m.index), snippet: body.trim().slice(0, 80).replace(/\s+/g, ' ') });
    }
    return violations;
}

function findInlineEventHandlerViolations(html, file) {
    // يُمحى محتوى <script> والتعليقات أولاً كي لا يلتقط الفحص نصاً مشابهاً داخل
    // شفرة JS أو تعليق — الهدف معالجات HTML الحرفية مثل onclick="..." فقط.
    const cleaned = blank(blank(html, /<!--[\s\S]*?-->/g), /<script\b[^>]*>[\s\S]*?<\/script>/gi);
    const re = /\son[a-z]+\s*=/gi;
    const violations = [];
    let m;
    while ((m = re.exec(cleaned)) !== null) {
        violations.push({ file, line: lineOf(html, m.index), snippet: m[0].trim() });
    }
    return violations;
}

describe('حارس CSP: سكربتات/معالجات inline في web/*.html يجب أن يسمح بها script-src', () => {
    it('يجد صفحات HTML للفحص', () => {
        expect(pages.length).toBeGreaterThan(0);
    });

    it('script-src يُقرأ بنجاح من رأس CSP واحد على الأقل في vercel.json', () => {
        expect(scriptSrcTokenSets.length).toBeGreaterThan(0);
        expect(scriptSrcTokenSets.every((tokens) => tokens.length > 0)).toBe(true);
    });

    it('لا <script> بلا src (كلاسيكي، غير module/ld+json) بمحتوى — إلا إن سمح script-src بـ inline', () => {
        const violations = pages.flatMap((file) =>
            findInlineScriptViolations(readFileSync(join(WEB_DIR, file), 'utf8'), file)
        );
        if (cspAllowsInline) {
            // CSP نفسها تسمح بـinline صراحة (unsafe-inline/nonce/hash) — لا شيء يُحجب،
            // فلا داعي لمنع هذا النمط. (توثيق أن الفحص لم يُعطَّل صامتاً.)
            expect(cspAllowsInline).toBe(true);
            return;
        }
        const report = violations.map((v) => `  ${v.file}:${v.line} — ${v.snippet}`).join('\n');
        expect(
            violations,
            `script-src في vercel.json لا يحوي 'unsafe-inline' ولا nonce/hash، فأي <script> ` +
                `inline (بلا src، بلا type="module"، بلا ld+json) يُحجب صامتاً في الإنتاج فقط ` +
                `(لا CSP محلياً في jsdom/Vitest ولا في npm run build). الإصلاح الصحيح نقل الشفرة ` +
                `لملف JS خارجي مرجعي عبر <script src="..."> أو <script type="module" src="...">، ` +
                `لا تخفيف CSP بإضافة 'unsafe-inline'.\nالمواضع:\n${report}`
        ).toEqual([]);
    });

    it('لا معالج حدث inline (onclick= ونحوه) في أي صفحة — إلا إن سمح script-src بـ inline', () => {
        const violations = pages.flatMap((file) =>
            findInlineEventHandlerViolations(readFileSync(join(WEB_DIR, file), 'utf8'), file)
        );
        if (cspAllowsInline) {
            expect(cspAllowsInline).toBe(true);
            return;
        }
        const report = violations.map((v) => `  ${v.file}:${v.line} — ${v.snippet}`).join('\n');
        expect(
            violations,
            `script-src بلا 'unsafe-inline'/nonce/hash يحجب معالجات الأحداث inline (onclick=...) ` +
                `صامتاً في الإنتاج.\nالمواضع:\n${report}`
        ).toEqual([]);
    });
});

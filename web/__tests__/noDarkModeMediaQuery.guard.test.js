/**
 * حارس قرار المالك (2026-08-22): الوضع الداكن أُزيل من الموقع — «فاتح دائماً بلا استثناء»
 * (انظر web/public/js/theme-init.js). كانت web/landing.html الصفحة الوحيدة التي نُسيت عند
 * تنفيذ القرار: هي الملف الوحيد في المشروع الذي احتوى @media (prefers-color-scheme: dark)،
 * وهي الصفحة العامة الوحيدة التي لا تحمّل theme-init.js. النتيجة كانت نصف سمة داكنة تُطبَّق
 * على أي زائر نظامه داكن — ألوان النصوص تنقلب بينما سلّم الأسطح (--mint-50/--mint-100/
 * --gold-soft) وترويسة .top تبقى فاتحة، فيهبط تباين 28 عنصراً نصياً إلى 1.02–1.5:1.
 *
 * استعلام الوسائط وحده لا يُبطله ضبط data-theme="light": prefers-color-scheme يقرأ تفضيل
 * النظام لا سمة العنصر. لذا الحارس يمنع الاستعلام «غير المقيَّد» — أي استعلام لا تكون كل
 * مُحدِّداته محميّة بـ[data-theme="dark"] أو :root:not([data-theme="light"]) — في أي HTML
 * أو CSS داخل web/. سمة دارجة مقيَّدة صحيحاً تبقى ممكنة لو عاد قرار المالك يوماً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative, sep } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, '..');

// مخرجات بناء/تغطية لا مصادر — تحتوي نسخاً قديمة حتى إعادة البناء.
const SKIP_DIRS = new Set(['dist', 'coverage', 'node_modules', '.git']);

/** مُحدِّد يُعدّ «مقيَّداً» إن حصر نفسه في سمة داكنة صريحة. */
const SCOPED = /\[data-theme\s*=\s*["']?dark["']?\]|:not\(\s*\[data-theme\s*=\s*["']?light["']?\]\s*\)/;

function collectFiles(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        if (SKIP_DIRS.has(entry)) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collectFiles(full, out);
        else if (/\.(html|css)$/i.test(entry)) out.push(full);
    }
    return out;
}

/** يمحو التعليقات مع الحفاظ على الإزاحات وأرقام الأسطر (كي تبقى الرسالة دقيقة). */
function blankComments(src) {
    const blank = (m) => m.replace(/[^\n]/g, ' ');
    return src.replace(/<!--[\s\S]*?-->/g, blank).replace(/\/\*[\s\S]*?\*\//g, blank);
}

function closingBrace(src, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) return i;
    }
    return -1;
}

/** المُحدِّدات في المستوى الأول داخل جسم @media. */
function topLevelSelectors(body) {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < body.length; i++) {
        if (body[i] === '{') {
            if (depth === 0) out.push(body.slice(start, i).trim().replace(/\s+/g, ' '));
            depth++;
        } else if (body[i] === '}') {
            if (--depth === 0) start = i + 1;
        }
    }
    return out.filter(Boolean);
}

function findUnscopedDarkQueries(file) {
    const src = blankComments(readFileSync(file, 'utf8'));
    const violations = [];
    const re = /@media([^{]*)\{/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        if (!/prefers-color-scheme\s*:\s*dark/i.test(m[1])) continue;
        const openIdx = m.index + m[0].length - 1;
        const close = closingBrace(src, openIdx);
        const body = close === -1 ? src.slice(openIdx + 1) : src.slice(openIdx + 1, close);
        const unscoped = topLevelSelectors(body).filter((sel) => !SCOPED.test(sel));
        if (unscoped.length === 0) continue;
        violations.push({
            file: relative(webRoot, file).split(sep).join('/'),
            line: src.slice(0, m.index).split('\n').length,
            selectors: unscoped,
        });
    }
    return violations;
}

describe('قرار المالك: لا وضع داكن في الموقع', () => {
    it('web/public/js/theme-init.js ما زال يفرض data-theme="light" (مصدر القرار)', () => {
        const js = readFileSync(join(webRoot, 'public/js/theme-init.js'), 'utf8');
        expect(js).toContain("setAttribute('data-theme', 'light')");
    });

    it('لا @media (prefers-color-scheme: dark) غير مقيَّد في أي HTML/CSS داخل web/', () => {
        const files = collectFiles(webRoot);
        expect(files.length).toBeGreaterThan(0);

        const violations = files.flatMap(findUnscopedDarkQueries);
        const report = violations
            .map((v) => `  ${v.file}:${v.line} — مُحدِّدات غير محميّة: ${v.selectors.join(' | ')}`)
            .join('\n');

        expect(
            violations,
            'الوضع الداكن أُزيل بقرار مالك 2026-08-22 («فاتح دائماً بلا استثناء»، انظر ' +
            'web/public/js/theme-init.js). استعلام prefers-color-scheme يقرأ تفضيل النظام ولا ' +
            'يُبطله data-theme="light"، فيُطبَّق نصف سمة داكنة تكسر التباين. احذف الكتلة، أو ' +
            'قيّد كل مُحدِّداتها بـ:root:not([data-theme="light"]) إن عاد الوضع الداكن بقرار ' +
            `جديد.\nالمواضع:\n${report}`,
        ).toEqual([]);
    });
});

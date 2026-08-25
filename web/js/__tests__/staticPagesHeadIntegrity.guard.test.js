/**
 * @vitest-environment jsdom
 *
 * حارس بنية الصفحات الثابتة — web/*.html
 *
 * العطل الذي استدعى هذا الحارس (P1 مرئي للزائر، 2026-08-25):
 * أربع صفحات (blog / experiences / experts / suppliers) كانت تحتوي داخل <head>
 * على تتابع الحرفين «\» و«n» حرفياً — أي شفرة هروب سطر جديد تسرّبت كنص خام بدل
 * أن تُفسَّر — بين وسمَي main.css وlegal-pages.css:
 *
 *     <link rel="stylesheet" href="/css/main.css">\n    <link ... legal-pages.css">
 *
 * وفق خوارزمية تحليل HTML القياسية، أي محرف غير مسافة بيضاء في وضع «in head»
 * يُغلق <head> ضمنياً ويُعيد معالجة المحرف في وضع «in body». فكانت النتيجة:
 *   • عقدة نصية دخيلة "\n    " تظهر كأول عقدة في <body> — رمز مكسور يراه الزائر
 *     أعلى الصفحة.
 *   • ورقة legal-pages.css وكل السكربتات التي يحقنها Vite تسقط خارج <head>.
 * والصفحات لم تكن مولَّدة بأي سكربت (لا مولّد في المستودع) — تُحرَّر يدوياً، فالعطل
 * قابل للتكرار حرفياً في أي صفحة جديدة تُنسخ عن واحدة منها.
 *
 * الحارس يمسح كل web/*.html (لا الأربع فقط) ليلتقط أي صفحة جديدة بنفس العيب.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(__dirname, '..', '..');

const pages = fs
    .readdirSync(WEB_DIR)
    .filter((f) => f.endsWith('.html'))
    .sort();

function parse(html) {
    return new DOMParser().parseFromString(html, 'text/html');
}

// الوسوم التي لا تُكتب إلا داخل <head>؛ ظهور أيٍّ منها في <body> يعني أن <head>
// أُغلق ضمنياً قبل أوانه. (<script> مستثنى عمداً: وضعه في نهاية <body> ممارسة
// سليمة ومقصودة في هذه الصفحات — theme-init.js مثلاً.)
const HEAD_ONLY = ['title', 'meta', 'link', 'base'];

describe('بنية <head>/<body> في صفحات الموقع الثابتة', () => {
    it('يجد صفحات HTML للفحص', () => {
        expect(pages.length).toBeGreaterThan(0);
    });

    describe.each(pages)('%s', (file) => {
        const html = fs.readFileSync(path.join(WEB_DIR, file), 'utf8');
        const doc = parse(html);

        it('لا عقدة نصية دخيلة قبل أول عنصر في <body>', () => {
            const stray = [];
            for (const node of doc.body.childNodes) {
                if (node.nodeType === 1 /* ELEMENT */) break;
                if (node.nodeType === 3 /* TEXT */ && node.data.trim() !== '') {
                    stray.push(node.data.trim());
                }
            }
            expect(
                stray,
                `نص خام قبل أول عنصر في <body> — غالباً محرف داخل <head> أغلقه ضمنياً`
            ).toEqual([]);
        });

        it('لا وسم من وسوم <head> تسرّب إلى <body>', () => {
            const leaked = HEAD_ONLY.flatMap((tag) =>
                [...doc.body.querySelectorAll(tag)].map((el) => el.outerHTML.slice(0, 120))
            );
            expect(leaked, `وسوم <head> ظهرت داخل <body>`).toEqual([]);
        });

        it('كل ما كُتب بين <head> و</head> في المصدر بقي فعلاً داخل <head> بعد التحليل', () => {
            const open = html.indexOf('<head');
            const close = html.indexOf('</head>');
            expect(open, 'لا وسم <head> في الصفحة').toBeGreaterThanOrEqual(0);
            expect(close, 'لا وسم </head> في الصفحة').toBeGreaterThan(open);

            const headSource = html.slice(open, close);
            for (const tag of ['link', 'meta', 'script', 'title', 'style']) {
                const inSource = (headSource.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
                const inDom = doc.head.querySelectorAll(tag).length;
                expect(
                    inDom,
                    `عدد <${tag}> المكتوبة داخل <head> = ${inSource} لكن الباقي فيه بعد التحليل = ${inDom}؛ ` +
                        `أي أن <head> أُغلق ضمنياً وسقط الباقي إلى <body>`
                ).toBe(inSource);
            }
        });
    });
});

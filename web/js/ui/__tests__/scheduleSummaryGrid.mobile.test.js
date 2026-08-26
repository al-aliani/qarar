/**
 * العلة (مسح 2026-08-26، components.css:2083): `.schedule-summary` كانت
 * `grid-template-columns: repeat(3, 1fr)` — و`1fr` تعني `minmax(auto, 1fr)`، أي أن
 * الأعمدة لا تنكمش دون min-content. على جوال 375px (عمود المحتوى ~293px) كانت
 * بطاقة «إجمالي الأقساط» تخرج خارج الشاشة كلياً (صفر بكسل مرئي) فيفقد العميل
 * إجمالي ما سيدفعه على عمر القرض، بلا شريط تمرير يدلّ على وجودها.
 *
 * **هذا حارس بنيوي، لا قياس تخطيط**: jsdom لا يحسب CSS Grid إطلاقاً (كل العروض
 * تعود 0)، فلا يمكن قياس الفيضان هنا. الاختبار يقرأ قاعدة CSS من الملف الفعلي
 * ويثبّت أنها لا تفرض عدد أعمدة صلباً — أي أنها تلتفّ بحكم البناء — وأنها لم
 * «تُصلَح» بإخفاء الفائض (overflow-x: hidden يقتطع بصمت في RTL، القاعدة موثّقة
 * في مهارة qarar-ui). القياس البصري الفعلي عند 375px يبقى مسؤولية اختبار e2e.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const CSS = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../css/components.css'),
    'utf-8'
);

function ruleBlock(css, selector) {
    const re = new RegExp(`^\\s*${selector.replace(/\./g, '\\.')}\\s*\\{`, 'm');
    const m = re.exec(css);
    if (!m) return null;
    const start = css.indexOf('{', m.index);
    return css.slice(start + 1, css.indexOf('}', start));
}

function gridColumnsOf(css, selector) {
    const block = ruleBlock(css, selector);
    if (!block) return null;
    const m = /grid-template-columns:\s*([^;]+);/.exec(block);
    return m ? m[1].trim() : null;
}

describe('.schedule-summary — ملخّص القرض يلتفّ على الجوال بدل الخروج خارج الشاشة', () => {
    it('لا تفرض عدد أعمدة صلباً (حارس بنيوي على المصدر، لا قياس تخطيط)', () => {
        const cols = gridColumnsOf(CSS, '.schedule-summary');
        expect(cols).not.toBeNull();
        // repeat(N, …) بعدد ثابت = N بطاقات جنباً إلى جنب مهما ضاق العرض
        expect(cols).not.toMatch(/repeat\(\s*\d+\s*,/);
        // ولا عرض ثابت بديل (px/%) يعيد نفس الفخّ بصيغة أخرى
        expect(cols).not.toMatch(/\d+(px|%)\s+\d+(px|%)/);
    });

    it('تلتفّ فعلاً: auto-fit مع حدّ أدنى محدود بعرض الأب', () => {
        const cols = gridColumnsOf(CSS, '.schedule-summary');
        expect(cols).toMatch(/auto-fit|auto-fill/);
        // min(100%, …) يمنع عودة الفيضان حين يضيق الأب دون العتبة نفسها
        expect(cols).toMatch(/min\(\s*100%/);
    });

    it('لم تُعالَج بإخفاء الفائض — overflow-x: hidden يقتطع بصمت في RTL', () => {
        expect(ruleBlock(CSS, '.schedule-summary')).not.toMatch(/overflow-x:\s*hidden/);
    });
});

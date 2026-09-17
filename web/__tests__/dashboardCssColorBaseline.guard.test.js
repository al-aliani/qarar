/**
 * @vitest-environment node
 *
 * تدقيق 2026-09-17: تشخيص أول للوحة بعد تسجيل الدخول وجد أن decision-dashboard.css
 * تراكم فيه ~40 لوناً hex/rgba يدوياً يتجاوز نظام التوكنات في variables.css (انظر
 * ذاكرة qarar-dashboard-css-fragmentation-2026-09-17) — من أسباب شعور اللوحة
 * "مجمّعة من منتجات متعددة". هذا الحارس لا يمنع كل لون يدوي فوراً (كثير منها ألوان
 * خافتة/بيضاء متعمَّدة لسطح داكن مضبوطة التباين بعناية — راجعتها 2026-09-17 ولم
 * ألمسها لتفادي كسر تباين مُدقَّق سابقاً بلا إعادة قياس)، لكن يمنع نموّها أكثر:
 * أي لون hex/rgba جديد خارج الأساس المسجَّل أدناه يُفشل الاختبار — يمنع تكرار نفس
 * الانجراف الذي أنتج الرقم الحالي. أُصلحت 3 حالات فعلية بهذه الجولة: #0a4634 (نسخة
 * طبق الأصل من --c-p-600 دون استخدام التوكن)، واحتياطي var(--c-gold-500, #d7aa4a)
 * المضلِّل (لا يُطبَّق أبداً لأن المتغيّر معرَّف دوماً)، وتوهّج drop-shadow كان بلون
 * ذهبي فاتح (rgba(215,170,74)) لا يطابق --c-gold-500 الغامق المعروض فعلياً كنص.
 *
 * dashboard-home.css أصبح خالياً تماماً من الألوان اليدوية (0 — كانت 0 أيضاً بعد
 * حذف كتلة "DASHBOARD V2 PREMIUM AESTHETIC OVERRIDES")؛ أساسه هنا فارغ عمداً
 * ليبقى كذلك.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssDir = join(__dirname, '..', 'css');

function blankComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function extractColors(src) {
    const hex = (src.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((c) => c.toLowerCase());
    const rgb = (src.match(/rgba?\([0-9., ]+\)/g) || []).map((c) => c.replace(/\s+/g, ''));
    return new Set([...hex, ...rgb]);
}

// الأساس المسجَّل 2026-09-17 — راجع التعليق أعلاه. أي إضافة هنا تعني لوناً جديداً
// خارج نظام التوكنات دخل الملف فعلاً؛ تأكد أنه مقصود ومضبوط التباين قبل توسيع
// القائمة، ولا تُضِف لوناً هنا لمجرّد إسكات الاختبار.
const DECISION_DASHBOARD_BASELINE = new Set([
    '#bff0dc', '#d7aa4a', '#e9c87f', '#ffd9d4', '#ffe9b3', '#ffeec2', '#fff',
    'rgba(0,0,0,.22)', 'rgba(0,0,0,0.18)',
    'rgba(176,125,44,0)', 'rgba(176,125,44,0.1)', 'rgba(176,125,44,0.3)',
    'rgba(176,125,44,0.4)', 'rgba(176,125,44,0.5)',
    'rgba(217,168,78,0.14)', 'rgba(217,168,78,0.18)', 'rgba(217,168,78,0.22)', 'rgba(217,168,78,0.35)',
    'rgba(234,243,238,0.7)', 'rgba(234,243,238,0.82)', 'rgba(234,243,238,0.85)',
    'rgba(255,255,255)', 'rgba(255,255,255,.2)',
    'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.1)',
    'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.18)',
    'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0.4)',
    'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.62)', 'rgba(255,255,255,0.78)',
    'rgba(8,22,17,0.5)', 'rgba(8,22,17,0.58)', 'rgba(8,22,17,0.72)',
]);

const DASHBOARD_HOME_BASELINE = new Set([]);

function reportNew(found, baseline, label) {
    const extra = [...found].filter((c) => !baseline.has(c));
    return { extra, message: `${label}: لون/ألوان جديدة خارج الأساس المسجَّل — ${extra.join('، ')}\n` +
        'أضف التوكن المناسب في variables.css واستخدمه بدل قيمة hex/rgba مباشرة. ' +
        'إن كان اللون متعمَّداً ومضبوط التباين فعلاً، وسّع DECISION_DASHBOARD_BASELINE/DASHBOARD_HOME_BASELINE هنا مع تعليق يشرح السبب.' };
}

describe('لوحتا القرار — عدم توسّع الألوان اليدوية خارج نظام التوكنات', () => {
    it('decision-dashboard.css: لا ألوان hex/rgba جديدة خارج الأساس المسجَّل 2026-09-17', () => {
        const src = blankComments(readFileSync(join(cssDir, 'decision-dashboard.css'), 'utf8'));
        const found = extractColors(src);
        const { extra, message } = reportNew(found, DECISION_DASHBOARD_BASELINE, 'decision-dashboard.css');
        expect(extra, message).toEqual([]);
    });

    it('dashboard-home.css: يبقى خالياً تماماً من الألوان اليدوية (كل شيء توكن)', () => {
        const src = blankComments(readFileSync(join(cssDir, 'dashboard-home.css'), 'utf8'));
        const found = extractColors(src);
        const { extra, message } = reportNew(found, DASHBOARD_HOME_BASELINE, 'dashboard-home.css');
        expect(extra, message).toEqual([]);
    });
});

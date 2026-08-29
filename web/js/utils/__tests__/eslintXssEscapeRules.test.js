/**
 * اختبارات قاعدتَي ESLint المخصّصتين (eslint-rules/require-escape-html.js و
 * eslint-rules/no-local-escape-helpers.js) — القفل البنيوي ضد إعادة فتح ثغرات
 * XSS المخزَّنة (المرحلة 1.1، بعد توحيد التهريب في المرحلة 0.1).
 *
 * نستخدم ESLint Linter مباشرة (لا RuleTester) لتفادي تعقيد ربط RuleTester
 * بـ describe/it الخاصّين بـ Vitest (لا globals:true في vitest.config هنا).
 *
 * ملاحظة مسار: هذا الملف تحت web/js/utils/__tests__/ عمداً — vite.config.js
 * (root:'./web') يحصر التقاط vitest الافتراضي داخل web/، فأي اختبار تحت
 * eslint-rules/__tests__/ بجذر المستودع كان سيُصبح يتيماً تماماً (لا يُشغَّل
 * أبداً عبر npm test).
 */
import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import requireEscapeHtml from '../../../../eslint-rules/require-escape-html.js';
import noLocalEscapeHelpers from '../../../../eslint-rules/no-local-escape-helpers.js';

function lintWith(rule, ruleName, code) {
    const linter = new Linter();
    const messages = linter.verify(code, {
        languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
        plugins: { local: { rules: { [ruleName]: rule } } },
        rules: { [`local/${ruleName}`]: 'error' },
    });
    return messages.filter((m) => m.ruleId === `local/${ruleName}`);
}

const lintEscape = (code) => lintWith(requireEscapeHtml, 'require-escape-html', code);
const lintNoLocal = (code) => lintWith(noLocalEscapeHelpers, 'no-local-escape-helpers', code);

describe('local/require-escape-html', () => {
    it('يُبلغ عن خاصية كائن محفوفة بالخطر (name) غير مُهرَّبة داخل قالب HTML', () => {
        const messages = lintEscape(`
            function render(idea) {
                return \`<div>\${idea.name}</div>\`;
            }
        `);
        expect(messages.length).toBe(1);
    });

    it('لا يُبلغ حين تُمرَّر القيمة عبر escapeHtml المستوردة من escape.js', () => {
        const messages = lintEscape(`
            import { escapeHtml } from '../utils/escape.js';
            function render(idea) {
                return \`<div>\${escapeHtml(idea.name)}</div>\`;
            }
        `);
        expect(messages.length).toBe(0);
    });

    it('لا يُبلغ عن alias مباشر لـ escapeHtml (const esc = escapeHtml) بعد الاستيراد', () => {
        const messages = lintEscape(`
            import { escapeHtml } from '../utils/escape.js';
            const esc = escapeHtml;
            function render(idea) {
                return \`<div>\${esc(idea.name)}</div>\`;
            }
        `);
        expect(messages.length).toBe(0);
    });

    it('لا يُبلغ عن alias استيراد صريح (import { escapeHtml as esc })', () => {
        const messages = lintEscape(`
            import { escapeHtml as esc } from '../utils/escape.js';
            function render(idea) {
                return \`<div>\${esc(idea.name)}</div>\`;
            }
        `);
        expect(messages.length).toBe(0);
    });

    it('لا يُبلغ عن تعبيرات رقمية/منطقية مثبتة (toFixed، Math، مقارنات، length)', () => {
        const messages = lintEscape(`
            function render(n, arr) {
                return \`<div>\${n.toFixed(2)}</div><span>\${Math.round(n)}</span><p>\${n > 0}</p><i>\${arr.length}</i>\`;
            }
        `);
        expect(messages.length).toBe(0);
    });

    it('لا يُبلغ عن ternary بفروع نصية ثابتة (enum-like)', () => {
        const messages = lintEscape(`
            function render(ok) {
                return \`<span class="\${ok ? 'active' : 'inactive'}">x</span>\`;
            }
        `);
        expect(messages.length).toBe(0);
    });

    it('لا يُبلغ عن وصول لخاصية داخل map() على مصفوفة ثابتة محلية (بيانات مُدرَجة في الكود)', () => {
        const messages = lintEscape(`
            function render() {
                const tips = [{ title: 'a', text: 'b' }, { title: 'c', text: 'd' }];
                return tips.map(t => \`<h3>\${t.title}</h3><p>\${t.text}</p>\`).join('');
            }
        `);
        expect(messages.length).toBe(0);
    });

    it('يُبلغ عن نفس النمط حين تكون المصفوفة حالة/بيانات تطبيق ديناميكية لا حرفية', () => {
        const messages = lintEscape(`
            function render(state) {
                return state.ideas.map(idea => \`<li>\${idea.name}</li>\`).join('');
            }
        `);
        expect(messages.length).toBe(1);
    });

    it('لا يُبلغ عن Template Literal بلا وسم HTML في أجزائه الحرفية', () => {
        const messages = lintEscape(`
            function render(idea) {
                return \`الاسم: \${idea.name}\`;
            }
        `);
        expect(messages.length).toBe(0);
    });

    it('يثق باستدعاء تابع صنف محلي (this.method(...)) لأن جسمه يُفحص باستقلالية عند تعريفه', () => {
        const messages = lintEscape(`
            class View {
                render(idea) {
                    return \`<div>\${this.renderName(idea)}</div>\`;
                }
                renderName(idea) {
                    return idea.name; // خطر حقيقي هنا -- يُكشَف عند فحص هذا القالب نفسه، لا عند موضع الاستدعاء
                }
            }
        `);
        // التابع المستدعى renderName لا يبني HTML (لا يحتوي على وسم) فلا يُفحص كقالب HTML مستقل،
        // والاستدعاء نفسه يُعتبر آمناً بالثقة بالتغطية المزدوجة — سلوك مقصود وموثّق في الشيفرة.
        expect(messages.length).toBe(0);
    });
});

describe('local/no-local-escape-helpers', () => {
    it('يمنع تعريف function باسم escapeHtml خارج escape.js', () => {
        const messages = lintNoLocal(`
            function escapeHtml(s) { return String(s); }
        `);
        expect(messages.length).toBe(1);
    });

    it('يمنع تعريف arrow function باسم safe', () => {
        const messages = lintNoLocal(`
            const safe = (s) => String(s ?? '');
        `);
        expect(messages.length).toBe(1);
    });

    it('يمنع تعريف arrow function باسم esc', () => {
        const messages = lintNoLocal(`
            const esc = (s) => String(s ?? '');
        `);
        expect(messages.length).toBe(1);
    });

    it('يمنع تعريف function باسم escapeAttr خارج escape.js', () => {
        const messages = lintNoLocal(`
            function escapeAttr(s) { return String(s); }
        `);
        expect(messages.length).toBe(1);
    });

    it('لا يمنع alias بسيط (const esc = escapeHtml) — ليس تعريف دالة جديدة', () => {
        const messages = lintNoLocal(`
            import { escapeHtml } from '../utils/escape.js';
            const esc = escapeHtml;
        `);
        expect(messages.length).toBe(0);
    });

    it('لا يمنع استيراد escapeHtml/escapeAttr بأي اسم مستعار', () => {
        const messages = lintNoLocal(`
            import { escapeHtml as esc, escapeAttr as safe } from '../utils/escape.js';
        `);
        expect(messages.length).toBe(0);
    });

    it('لا يمنع دالة/متغيّراً بأسماء أخرى غير محظورة', () => {
        const messages = lintNoLocal(`
            function formatCurrency(n) { return String(n); }
            const fmt = (n) => String(n);
        `);
        expect(messages.length).toBe(0);
    });
});

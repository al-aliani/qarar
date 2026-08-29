/**
 * قاعدة ESLint مخصّصة: تمنع تعريف دالة أو متغيّر باسم escapeHtml/escapeAttr/esc/safe
 * في أي ملف غير web/js/utils/escape.js (يُستثنى عبر eslint.config.js، ليست هذه
 * القاعدة نفسها من تعرف اسم الملف المرجعي).
 *
 * الهدف: منع تكرار نفس فئة الخطأ التي أصلحتها المرحلة 0.1 (~26 نسخة محلية مكرّرة/
 * ناقصة من دالة تهريب HTML) — بإجبار أي كود جديد على استيراد النسخة المرجعية
 * بدل كتابة "نسخة سريعة" محلية قد تكون ناقصة (تنسى تهريب علامة الاقتباس مثلاً).
 *
 * لا تُمنَع الأسماء عند استخدامها كـ import specifier أو alias بسيط
 * (`const esc = escapeHtml;`) — فقط عند "تعريف" دالة فعلية بهذا الاسم
 * (function declaration / function expression / arrow function)، لأن هذه هي
 * الحالة التي يمكن أن تحمل منطق تهريب مستقل (وربما ناقص).
 */

const BANNED_NAMES = new Set(['escapeHtml', 'escapeAttr', 'esc', 'safe']);

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                'يمنع إعادة تعريف دالة/متغيّر باسم escapeHtml أو escapeAttr أو esc أو safe خارج web/js/utils/escape.js — استورد النسخة المرجعية بدلاً من ذلك.',
        },
        schema: [],
        messages: {
            noLocalRedefinition:
                'تعريف محلي لدالة باسم "{{name}}" ممنوع خارج web/js/utils/escape.js — استورد escapeHtml/escapeAttr من هناك بدلاً من إعادة تعريفها (قد تكون النسخة المحلية ناقصة).',
        },
    },

    create(context) {
        function checkName(name, node) {
            if (!BANNED_NAMES.has(name)) return;
            context.report({ node, messageId: 'noLocalRedefinition', data: { name } });
        }

        return {
            FunctionDeclaration(node) {
                if (node.id) checkName(node.id.name, node.id);
            },
            VariableDeclarator(node) {
                if (
                    node.id.type === 'Identifier' &&
                    node.init &&
                    (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')
                ) {
                    checkName(node.id.name, node.id);
                }
            },
        };
    },
};

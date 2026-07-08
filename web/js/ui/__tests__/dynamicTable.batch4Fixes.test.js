/**
 * @vitest-environment jsdom
 *
 * دفعة 4 — DynamicTable.js:
 * 1) XSS: قيمة نصية خام في خلية جدول (اسم منتج/منافس/بند) كانت تُحقَن بلا تهريب في
 *    سمة value="..." فتكسر الخاصية وتحقن عناصر HTML حقيقية عند كل إعادة رسم (كل تغيير خانة).
 * 2) a11y: زر «التقدير التلقائي» (🪄) وزر «حذف الصف» (🗑️) أيقونات بلا نص — كانا بلا
 *    aria-label يوضّح الغرض لقارئ الشاشة.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicTable } from '../DynamicTable.js';

const XSS_PAYLOAD = '"><img src=x onerror=alert(1)>';

function makeTable(overrides = {}) {
    const config = {
        id: 'test-table',
        title: 'جدول اختبار',
        columns: [
            { key: 'name', label: 'الاسم', type: 'text' },
            { key: 'price', label: 'السعر', type: 'number' },
        ],
        initialData: [
            { name: XSS_PAYLOAD, price: 0 }, // price=0 ⇒ يظهر زر التقدير التلقائي
        ],
        ...overrides,
    };
    const table = new DynamicTable('c', config);
    table.render();
    return table;
}

describe('DynamicTable — تهريب XSS + aria-label لأزرار الأيقونات (دفعة 4)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
    });

    it('لا يحقن السلسلة الخام في innerHTML، وتظهر صورتها المُهرَّبة، ولا يُنشئ عنصر <img> فعلياً', () => {
        makeTable();
        const container = document.getElementById('c');

        // 1) السلسلة الخام (التي تكسر سمة value) يجب ألا تظهر كنص متصل في innerHTML
        expect(container.innerHTML).not.toContain(XSS_PAYLOAD);

        // 2) صورة مُهرَّبة موجودة فعلاً (علامة الاقتباس أصبحت &quot;) — إثبات أن escapeHtml طُبِّق فعلياً لا أن القيمة اختفت
        expect(container.innerHTML).toContain('&quot;');

        // 3) الإثبات الحاسم لعدم نجاح الحقن: لا عنصر <img> حقيقي انبثق في DOM
        expect(container.querySelectorAll('img').length).toBe(0);

        // 4) رغم التهريب، القيمة الأصلية محفوظة بلا تلف في سمة value (يقرأها المتصفح بعد فك التهريب)
        const nameInput = container.querySelector('input[data-col="name"]');
        expect(nameInput).toBeTruthy();
        expect(nameInput.getAttribute('value')).toBe(XSS_PAYLOAD);
    });

    it('قيمة رقمية عادية (مثل 5000) لا يتغيّر عرضها بسبب التهريب — لا تحويل لأرقام هندية', () => {
        makeTable({
            initialData: [{ name: 'بند عادي', price: 5000 }],
        });
        const container = document.getElementById('c');
        const priceInput = container.querySelector('input[data-col="price"]');
        expect(priceInput.getAttribute('value')).toBe('5000');
    });

    it('زر حذف الصف يحمل aria-label غير فارغ', () => {
        makeTable();
        const container = document.getElementById('c');
        const deleteButtons = container.querySelectorAll('.btn-delete');
        expect(deleteButtons.length).toBeGreaterThan(0);
        deleteButtons.forEach(btn => {
            const label = btn.getAttribute('aria-label');
            expect(label).toBeTruthy();
            expect(label.trim().length).toBeGreaterThan(0);
        });
    });

    it('زر التقدير التلقائي (🪄) يظهر لخلية رقمية فارغة/صفرية ويحمل aria-label غير فارغ', () => {
        makeTable(); // price: 0 ⇒ يجب أن يظهر زر التقدير التلقائي
        const container = document.getElementById('c');
        const magicButtons = container.querySelectorAll('.btn-magic-cell');
        expect(magicButtons.length).toBeGreaterThan(0);
        magicButtons.forEach(btn => {
            const label = btn.getAttribute('aria-label');
            expect(label).toBeTruthy();
            expect(label.trim().length).toBeGreaterThan(0);
        });
    });
});

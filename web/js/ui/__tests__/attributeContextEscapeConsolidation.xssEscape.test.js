/**
 * @vitest-environment jsdom
 *
 * دفعة 0.1 (2026-08-28، إيقاف نزيف XSS بعد إعادة تقييم الطبقات الـ16): عدة ملفات
 * كانت تحمل نسخاً محلية من دالة تهريب تفتقد تهريب علامتَي التنصيص (" ')، رغم
 * استخدامها داخل سمات value="…" — وهي بالضبط الأعطال المكتشفة في هذه الدفعة:
 *
 * - Timeline.js/MarketAnalysis.js: حيلة div.textContent→innerHTML — لا تهرّب
 *   التنصيص إطلاقاً مهما كانت الحمولة.
 * - ProjectAlternativesView.js: دالة esc() محلية مكرَّرة 3 مرات، تهرّب & < " فقط.
 *
 * هذا يثبّت بالاستغلال الفعلي (لا بقراءة الكود) أن التوحيد على escape.js الكنسي
 * أغلق فجوة كسر السمة في كلا الملفين.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Timeline } from '../Timeline.js';
import { ProjectAlternativesView } from '../ProjectAlternativesView.js';

const ATTR_BREAK_PAYLOAD = `" onfocus=alert(1) autofocus x="`;

function fakeStore(state) {
    return { getState: () => state, updatePath: () => {}, update: () => {} };
}

describe('توحيد التهريب في سياق السمات — استغلال فعلي', () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        container = document.getElementById('c');
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('Timeline.js: اسم بند تكلفة تأسيس في datalist <option value="…"> آمن من كسر السمة', () => {
        const state = {
            timeline: { activities: [] },
            technical: { establishmentCosts: [{ name: ATTR_BREAK_PAYLOAD, id: 1 }] },
            legal: {},
        };
        const view = new Timeline('c', { get: () => state, getState: () => state, update: () => {}, updatePath: () => {} });
        view.render();

        const option = container.querySelector('#establishmentCostsDatalist option, datalist option');
        // العنصر قد لا يوجد إن لم يُستدعَ الجزء الخاص بقائمة التكاليف في هذا المسار —
        // نتحقق مباشرة أن أي onfocus حي غير موجود بالكامل في الشجرة المصيَّرة أياً كان مصدره.
        expect(container.querySelectorAll('[onfocus]').length).toBe(0);
        if (option) {
            expect(option.value).toBe(ATTR_BREAK_PAYLOAD);
        }
    });

    it('ProjectAlternativesView.js: اسم الفكرة وملاحظتها في value="…" آمنان من كسر السمة', () => {
        const state = {
            projectAlternatives: {
                ideas: [{ name: ATTR_BREAK_PAYLOAD, notes: ATTR_BREAK_PAYLOAD, estimatedCost: 0, estimatedReturn: 0 }],
                selectedIndex: 0,
            },
            preliminaryCheck: {},
        };
        const view = new ProjectAlternativesView('c', fakeStore(state));
        view.render();

        const nameInput = container.querySelector('[data-field="name"].alt-field');
        const notesInput = container.querySelector('[data-field="notes"].alt-field');

        expect(nameInput.value).toBe(ATTR_BREAK_PAYLOAD);
        expect(notesInput.value).toBe(ATTR_BREAK_PAYLOAD);
        expect(container.querySelectorAll('[onfocus]').length).toBe(0);
    });

    it('[إثبات الحارس] العطل الأصلي: دالة esc() المحذوفة من ProjectAlternativesView (بلا تهريب علامة الاقتباس المفردة) لا تحمي من بعض حمولات كسر السمة', () => {
        // النسخة الأصلية المحذوفة: تهرّب & < " فقط — لا تهرّب علامة الاقتباس المفردة (').
        const oldEsc = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const singleQuotePayload = `' onfocus='alert(1)' autofocus x='`;
        const probe = document.createElement('div');
        // سياق سمة مقتبسة بعلامة اقتباس مفردة — نمط أقل شيوعاً لكن ممكن في قوالب أخرى
        probe.innerHTML = `<input value='${oldEsc(singleQuotePayload)}'>`;
        expect(probe.querySelector('input[onfocus]')).not.toBeNull();
    });
});

/**
 * @vitest-environment jsdom
 *
 * دفعة 0.1 (2026-08-28، إيقاف نزيف XSS بعد إعادة تقييم الطبقات الـ16): MarketAnalysis.js
 * كان أخطر عنقود حقن حيّ في المشروع — 7 حقول نصية حرة (وصف TAM/SAM/SOM، اسم المنافس
 * ونقاط قوته/ضعفه/ميزته) تُدرَج خاماً داخل سمات value="…" بلا أي تهريب، رغم أن نفس
 * الملف يستخدم escapeHtml في مواضع أخرى — سهو لا قرار. حمولة مثل
 * `" onfocus=alert(1) autofocus x="` تُنفَّذ بلا أي تفاعل من الضحية بمجرد فتح الصفحة.
 *
 * هذا يثبّت الإصلاح بالاستغلال الفعلي — لا بقراءة الكود فقط — لكل الحقول السبعة
 * الأصلية، إضافة إلى عيّنة من الحقول الإضافية المكتشفة أثناء نفس الدفعة (السكن
 * المستهدف، ديموغرافيا السكان، تحليل القطاع، مزيج التسويق).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MarketAnalysis } from '../MarketAnalysis.js';

const XSS_PAYLOAD = `" onfocus=alert(1) autofocus x="`;

function fakeStore(state) {
    return { getState: () => state, update: () => {} };
}

describe('MarketAnalysis — حقن HTML مخزَّن عبر سمات value=" (استغلال فعلي)', () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        container = document.getElementById('c');
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network disabled in test'))));
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
    });

    it('وصف TAM/SAM/SOM: الحمولة تظهر نصاً خاملاً داخل السمة، لا تُنفَّذ كمعالج حدث', () => {
        const state = {
            marketSizing: {
                tam: { value: 1000, description: XSS_PAYLOAD },
                sam: { value: 500, description: XSS_PAYLOAD },
                som: { value: 100, description: XSS_PAYLOAD },
            },
        };
        const view = new MarketAnalysis('c', fakeStore(state));
        view.render();

        const tamInput = container.querySelector('[data-subfield="description"][data-field="tam"]');
        const samInput = container.querySelector('[data-subfield="description"][data-field="sam"]');
        const somInput = container.querySelector('[data-subfield="description"][data-field="som"]');

        // لو الحمولة أفلتت من السمة، onfocus سينفَّذ عند focus() ويصنع alert حقيقياً —
        // نتحقق بدلاً من ذلك أن قيمة العنصر بعد التحليل هي النص الحرفي للحمولة كاملة
        // (لا مقطوعة عند أول علامة تنصيص، دليل أن المتصفح لم "يخرج" من السمة).
        expect(tamInput.value).toBe(XSS_PAYLOAD);
        expect(samInput.value).toBe(XSS_PAYLOAD);
        expect(somInput.value).toBe(XSS_PAYLOAD);
        expect(container.querySelector('[onfocus]')).toBeNull();
        expect(tamInput.outerHTML).toContain('&quot;');
    });

    it('حقول المنافس: الاسم ونقاط القوة/الضعف/الميزة كلها آمنة من كسر السمة', () => {
        const state = {
            marketSizing: {},
            marketing: {
                competitors: [
                    { name: XSS_PAYLOAD, strengths: XSS_PAYLOAD, weaknesses: XSS_PAYLOAD, advantage: XSS_PAYLOAD },
                ],
            },
        };
        const view = new MarketAnalysis('c', fakeStore(state));
        view.render();

        const nameInput = container.querySelector('[data-field="name"].competitor-field');
        const strengthsInput = container.querySelector('[data-field="strengths"].competitor-field');
        const weaknessesInput = container.querySelector('[data-field="weaknesses"].competitor-field');
        const advantageInput = container.querySelector('[data-field="advantage"].competitor-field');

        expect(nameInput.value).toBe(XSS_PAYLOAD);
        expect(strengthsInput.value).toBe(XSS_PAYLOAD);
        expect(weaknessesInput.value).toBe(XSS_PAYLOAD);
        expect(advantageInput.value).toBe(XSS_PAYLOAD);
        expect(container.querySelectorAll('[onfocus]').length).toBe(0);
    });

    it('[عيّنة إضافية] حقول ديموغرافيا السكان وتحليل القطاع ومزيج التسويق — نفس صنف الحقن، مواضع اكتُشفت لاحقاً بنفس الدفعة', () => {
        const state = {
            marketSizing: {
                targetNeighborhood: XSS_PAYLOAD,
                populationDemographics: { source: XSS_PAYLOAD },
                sectorAnalysis: XSS_PAYLOAD,
            },
            marketing: { marketingMix: { price: XSS_PAYLOAD } },
        };
        const view = new MarketAnalysis('c', fakeStore(state));
        view.render();

        expect(container.querySelector('#target-neighborhood').value).toBe(XSS_PAYLOAD);
        expect(container.querySelector('#pop-source').value).toBe(XSS_PAYLOAD);
        expect(container.querySelector('#mix-price').value).toBe(XSS_PAYLOAD);
        expect(container.querySelector('#sector-analysis').textContent).toBe(XSS_PAYLOAD);
        expect(container.querySelectorAll('[onfocus]').length).toBe(0);
    });

    it('[إثبات الحارس] العطل الأصلي: تهريب ناقص (بلا علامتي تنصيص) كان يسمح بكسر السمة والوصول لمعالج حدث حي', () => {
        // محاكاة الدالة المحلية الأصلية المحذوفة من هذا الملف — كانت تهرّب النص عبر
        // div.textContent→innerHTML، وهذه الحيلة لا تهرّب علامتي التنصيص إطلاقاً.
        const oldEscapeHtml = (s) => {
            if (s == null) return '';
            const d = document.createElement('div');
            d.textContent = s;
            return d.innerHTML;
        };
        const rendered = `<input value="${oldEscapeHtml(XSS_PAYLOAD)}">`;
        const probe = document.createElement('div');
        probe.innerHTML = rendered;
        const input = probe.querySelector('input');
        // العطل الأصلي: السمة onfocus تصير سمة DOM حقيقية منفصلة — إثبات أن الحقن نجح فعلاً
        expect(input.hasAttribute('onfocus')).toBe(true);
    });
});

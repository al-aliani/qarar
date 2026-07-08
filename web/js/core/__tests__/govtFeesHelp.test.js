/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة عالية #33): أربعة حقول رسوم حكومية للعمالة الوافدة
 * (govtFees.workCard/visa/ticket/iqama) كانت بلا أي شرح (؟) أو مصدر أو ذكر لأثر
 * نسبة السعودة — رغم أن حقلاً مجاوراً (gosiRate) موثّق جيداً. هذا يثبّت أن الشروحات
 * أُضيفت فعلياً لـ FIELD_HELP_TEXTS وأنها تظهر عبر مسار الرسم الحقيقي
 * (Wizard.renderField لكائن govtFees المتداخل)، لا فقط أنها مُعرَّفة في القاموس.
 */
import { describe, it, expect } from 'vitest';
import { getFieldHelp } from '../fieldHelpTexts.js';
import { Wizard } from '../../ui/Wizard.js';

describe('getFieldHelp — الرسوم الحكومية للعمالة الوافدة', () => {
    it('workCard: يذكر أثر نسبة السعودة صراحة (الشرط الذي كان غائباً تماماً)', () => {
        const entry = getFieldHelp('workCard');
        expect(entry).toBeTruthy();
        expect(entry.help).toMatch(/نسبة توطين|السعودة|نطاقات/);
        expect(entry.example).toBeTruthy();
    });

    it('visa/ticket/iqama: كل حقل له شرح ومثال نطاق عملي، ويُميَّز أحدها عن الآخر (لا نسخ نص واحد)', () => {
        const visa = getFieldHelp('visa');
        const ticket = getFieldHelp('ticket');
        const iqama = getFieldHelp('iqama');
        [visa, ticket, iqama].forEach(entry => {
            expect(entry).toBeTruthy();
            expect(entry.help.length).toBeGreaterThan(15);
            expect(entry.example).toBeTruthy();
        });
        // نصوص مختلفة فعلياً — لا نسخ نفس الشرح ثلاث مرات
        expect(new Set([visa.help, ticket.help, iqama.help]).size).toBe(3);
    });

    it('يُطابَق عبر المسار الكامل (govtFees.workCard) تماماً كما يستدعيه Wizard.renderField فعلياً', () => {
        expect(getFieldHelp('govtFees.workCard')).toEqual(getFieldHelp('workCard'));
        expect(getFieldHelp('govtFees.visa')).toEqual(getFieldHelp('visa'));
    });
});

describe('Wizard.renderField — أيقونة (؟) تظهر فعلياً لحقول govtFees المتداخلة', () => {
    function fakeStore(state = {}) {
        return { get: () => state, getState: () => state };
    }

    it('يُنتج زر مساعدة (field-help-btn) ونص التلميح الصحيح لكل من workCard وvisa وticket وiqama', () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const w = new Wizard('c', fakeStore(), {}, { steps: [], onNavigate: () => {} });

        const fields = [
            ['workCard', 9600],
            ['visa', 2000],
            ['ticket', 2500],
            ['iqama', 650],
        ];

        for (const [key, value] of fields) {
            const html = w.renderField('hr', `govtFees.${key}`, key, value);
            const wrap = document.createElement('div');
            wrap.innerHTML = html;

            const btn = wrap.querySelector('.field-help-btn');
            expect(btn, `الحقل ${key} بلا أيقونة مساعدة`).toBeTruthy();

            const pop = wrap.querySelector('.field-help-pop');
            const expectedHelp = getFieldHelp(key).help;
            expect(pop.textContent).toContain(expectedHelp);
        }
    });
});

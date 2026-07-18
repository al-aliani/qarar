/**
 * @vitest-environment jsdom
 *
 * إتاحة (a11y): أرباع SWOT الأربعة (نقاط القوة/الضعف/الفرص/التهديدات) مُميَّزة
 * بصنف CSS لوني مختلف لكل ربع (swot-strengths/weaknesses/opportunities/threats).
 * نتحقق أن كل ربع يحمل — إلى جانب الصنف اللوني — أيقونة ونصاً ظاهرين يميّزانه
 * فعلياً، فلا يعتمد التمييز بين "إيجابي" (قوة/فرصة) و"سلبي" (ضعف/تهديد) على
 * اللون وحده. الأيقونات مهاجَرة إلى SVG-sprite (aria-hidden، لا تُحتسب ضمن
 * textContent) فنتحقق من وجودها عبر innerHTML/href، بنفس نمط التحقق المستخدم
 * في pageTitleAndEmojiSprite.batch7.test.js.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { StrategicAnalysis } from '../StrategicAnalysis.js';

function fakeStore(state) {
    return { getState: () => state, update: () => {} };
}

describe('StrategicAnalysis — أرباع SWOT لا تعتمد على اللون فقط (a11y)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
    });

    const quadrants = [
        { cls: 'swot-strengths', iconId: 'i-shield', emoji: '💪', label: 'نقاط القوة' },
        { cls: 'swot-weaknesses', iconId: 'i-warning', emoji: '⚠️', label: 'نقاط الضعف' },
        { cls: 'swot-opportunities', iconId: 'i-target', emoji: '🎯', label: 'الفرص' },
        { cls: 'swot-threats', iconId: 'i-hand-stop', emoji: '🔥', label: 'التهديدات' }
    ];

    it('كل ربع من SWOT يحمل صنف اللون المائز + أيقونة ونص مائزين معاً', () => {
        const store = fakeStore({
            strategic: { swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] } },
            marketing: {}
        });
        const view = new StrategicAnalysis('c', store, () => {});
        view.render(0);

        quadrants.forEach(({ cls, iconId, emoji, label }) => {
            const quadrant = document.querySelector(`.swot-quadrant.${cls}`);
            expect(quadrant).toBeTruthy();
            // (1) الصنف اللوني
            expect(quadrant.className).toContain(cls);
            // (2) أيقونة ونص ظاهران — لا يكفي اللون وحده للتمييز بين الأرباع
            const header = quadrant.querySelector('.swot-quadrant-header');
            expect(header.innerHTML).toContain(`href="#${iconId}"`);
            expect(header.textContent).toContain(label);
            expect(header.textContent).not.toMatch(new RegExp(emoji, 'u'));
        });
    });

    it('يبقى التمييز قائماً حتى حين تُعبَّأ الأرباع ببنود فعلية', () => {
        const store = fakeStore({
            strategic: {
                swot: {
                    strengths: ['موقع مميز'],
                    weaknesses: ['اعتماد على مورد واحد'],
                    opportunities: ['نمو الطلب'],
                    threats: ['دخول منافس']
                }
            },
            marketing: {}
        });
        const view = new StrategicAnalysis('c', store, () => {});
        view.render(0);

        quadrants.forEach(({ cls, iconId, emoji, label }) => {
            const quadrant = document.querySelector(`.swot-quadrant.${cls}`);
            expect(quadrant.className).toContain(cls);
            const header = quadrant.querySelector('.swot-quadrant-header');
            expect(header.innerHTML).toContain(`href="#${iconId}"`);
            expect(header.textContent).toContain(label);
            expect(header.textContent).not.toMatch(new RegExp(emoji, 'u'));
        });
    });
});

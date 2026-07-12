/**
 * @vitest-environment jsdom
 *
 * بند 2.4 (خطة الدفعة 2): زر «توليد من SWOT» في مصفوفة TOWS. تحذيرا الخطة اللذان
 * يختبرهما هذا الملف مباشرة:
 *   1) الكتابة تذهب إلى marketing.towsMatrix لا strategic.swot (قسم مختلف عمداً).
 *   2) تعبئة الأرباع الفارغة فقط — نص كتبه المستخدم يدوياً في ربع آخر لا يُمس، وبلا
 *      أي window.confirm (الذي يُقبل تلقائياً بصمت تحت أدوات الأتمتة أصلاً).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrategicAnalysis } from '../StrategicAnalysis.js';

function fakeStore(initialState) {
    let state = initialState;
    return {
        getState: () => state,
        update: (section, value) => { state = { ...state, [section]: value }; }
    };
}

describe('StrategicAnalysis — زر توليد TOWS من SWOT', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
    });

    it('يعبّئ الأرباع الأربعة في marketing.towsMatrix من بنود strategic.swot الفعلية', () => {
        const store = fakeStore({
            strategic: {
                swot: {
                    strengths: ['فريق تقني قوي'],
                    weaknesses: ['رأس مال محدود'],
                    opportunities: ['طلب متزايد'],
                    threats: ['منافس جديد']
                }
            },
            marketing: {}
        });
        const view = new StrategicAnalysis('c', store, () => {});
        view.render(0);

        document.querySelector('.btn-generate-tows').click();

        const state = store.getState();
        expect(state.marketing.towsMatrix.so).toContain('فريق تقني قوي');
        expect(state.marketing.towsMatrix.so).toContain('طلب متزايد');
        expect(state.marketing.towsMatrix.wo).toContain('رأس مال محدود');
        expect(state.marketing.towsMatrix.st).toContain('منافس جديد');
        expect(state.marketing.towsMatrix.wt).toBeTruthy();
        // لم تُكتب في strategic.swot خطأً
        expect(state.strategic.swot.strengths).toEqual(['فريق تقني قوي']);
    });

    it('لا يستبدل ربعاً كتبه المستخدم يدوياً — يعبّئ الفارغ فقط', () => {
        const store = fakeStore({
            strategic: {
                swot: {
                    strengths: ['قوة'],
                    weaknesses: ['ضعف'],
                    opportunities: ['فرصة'],
                    threats: ['تهديد']
                }
            },
            marketing: { towsMatrix: { so: 'نص المستخدم اليدوي الأصلي — لا يُمس' } }
        });
        const view = new StrategicAnalysis('c', store, () => {});
        view.render(0);

        document.querySelector('.btn-generate-tows').click();

        const state = store.getState();
        // الربع الذي كتبه المستخدم بقي كما هو حرفياً
        expect(state.marketing.towsMatrix.so).toBe('نص المستخدم اليدوي الأصلي — لا يُمس');
        // الأرباع الفارغة الثلاثة الأخرى امتلأت
        expect(state.marketing.towsMatrix.wo).toBeTruthy();
        expect(state.marketing.towsMatrix.st).toBeTruthy();
        expect(state.marketing.towsMatrix.wt).toBeTruthy();
    });

    it('لا يستخدم window.confirm إطلاقاً (لا يعتمد عليه لحماية بيانات المستخدم)', () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const store = fakeStore({
            strategic: { swot: { strengths: ['قوة'], opportunities: ['فرصة'] } },
            marketing: { towsMatrix: { so: 'نص محفوظ' } }
        });
        const view = new StrategicAnalysis('c', store, () => {});
        view.render(0);

        document.querySelector('.btn-generate-tows').click();

        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('SWOT فارغة بالكامل: لا يكتب شيئاً في المخزن (لا نص وهمي)', () => {
        const store = fakeStore({ strategic: { swot: {} }, marketing: {} });
        const updateSpy = vi.spyOn(store, 'update');
        const view = new StrategicAnalysis('c', store, () => {});
        view.render(0);

        document.querySelector('.btn-generate-tows').click();

        expect(updateSpy).not.toHaveBeenCalled();
    });
});

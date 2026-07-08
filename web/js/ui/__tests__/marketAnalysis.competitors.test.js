/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08: زر "✨ اكتشف (AI)" للمنافسين كان يستدعي دائماً AIWriter (نص AI
 * بلا صلة بموقع حقيقي) بينما طبقة DataConnectors/OverpassConnector (بيانات حية فعلية
 * من OpenStreetMap) مبنية ومختبرة لكن غير مستدعاة إطلاقاً. هذا يثبّت أن الزر الآن
 * يستخدم Overpass أولاً عند توفر مدينة معروفة، ويسقط لـAI فقط عند تعذّر ذلك.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MarketAnalysis } from '../MarketAnalysis.js';
import * as AIWriterModule from '../../services/AIWriter.js';

function fakeStore(initialState) {
    let state = initialState;
    return {
        getState: () => state,
        update: (section, value) => { state = { ...state, [section]: value }; }
    };
}

describe('MarketAnalysis — زر اكتشاف المنافسين', () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        container = document.getElementById('c');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('يستخدم منافسين حقيقيين من Overpass (لا AI) عند وجود مدينة معروفة وتغطية OSM', async () => {
        // fetch مقيّد بمسار Overpass فقط — نفس المكوّن يستدعي أيضاً SaudiDemographicsService
        // (اقتراح TAM) بشكل غير مرتبط بالزر؛ ترك fetch عاماً يجعله يُطعِمها استجابة Overpass
        // بالخطأ (ضجيج console.error لا علاقة له بهذا الاختبار).
        vi.stubGlobal('fetch', vi.fn((url) => {
            if (String(url).includes('overpass-api.de')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        elements: [
                            { tags: { name: 'مطعم الرياض الأصيل' } },
                            { tags: { name: 'مقهى العليا' } }
                        ]
                    })
                });
            }
            return Promise.reject(new Error('unrelated fetch in test'));
        }));
        const aiSpy = vi.spyOn(AIWriterModule.AIWriter, 'generate');

        const store = fakeStore({
            projectInfo: { city: 'الرياض' },
            marketing: { competitors: [] },
            marketSizing: {}
        });
        const view = new MarketAnalysis('c', store);
        view.render(0);

        const btn = container.querySelector('.ai-competitors-btn');
        expect(btn).toBeTruthy();
        btn.click();
        // ننتظر تسوية الوعود الداخلية (fetch + suggest + store.update)
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => setTimeout(r, 0));

        const finalCompetitors = store.getState().marketing.competitors;
        expect(finalCompetitors.map(c => c.name)).toEqual(['مطعم الرياض الأصيل', 'مقهى العليا']);
        expect(aiSpy).not.toHaveBeenCalled();
    });

    it('يسقط إلى AIWriter عند غياب مدينة معروفة/تعذّر Overpass (لا تراجع صامت لبيانات فارغة)', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))));
        const aiSpy = vi.spyOn(AIWriterModule.AIWriter, 'generate').mockResolvedValue([
            { name: 'منافس افتراضي (AI)', marketShare: 10, strengths: '', weaknesses: '', advantage: '' }
        ]);

        const store = fakeStore({
            projectInfo: { city: 'مدينة غير معروفة تماماً' },
            marketing: { competitors: [] },
            marketSizing: {}
        });
        const view = new MarketAnalysis('c', store);
        view.render(0);

        const btn = container.querySelector('.ai-competitors-btn');
        btn.click();
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => setTimeout(r, 0));

        expect(aiSpy).toHaveBeenCalled();
        expect(store.getState().marketing.competitors.map(c => c.name)).toEqual(['منافس افتراضي (AI)']);
    });
});

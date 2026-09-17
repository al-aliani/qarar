/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-09-16: fetch() في OverpassConnector.js وChamberSuppliersConnector.js كان
 * بلا أي مهلة — تعليق شبكي فعلي لدى خادم Overpass العام المجاني (لا استجابة، لا رفض)
 * كان يُعلّق الموصّل (وزر "اكتشف المنافسين"/"اكتشف موردين محتملين" في الواجهة) للأبد
 * بدوّار تحميل أبدي، بدل إرجاع unavailable(...) كباقي حالات الفشل المُعالَجة أصلاً.
 *
 * نمط الاختبار مطابق لـ web/__tests__/supabaseClient.fetchTimeout.test.js (مُثبَت هناك
 * تجريبياً): AbortController + setTimeout يدوياً يتأثر بمؤقّتات Vitest الوهمية
 * (vi.useFakeTimers) خلافاً لـ AbortSignal.timeout — فيُختبَر الإلغاء الفعلي بسرعة
 * دون أي انتظار حقيقي.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { overpassCompetitorsConnector } from '../OverpassConnector.js';
import { chamberSuppliersConnector } from '../ChamberSuppliersConnector.js';
import { isUsable, PROVENANCE } from '../../DataConnectors.js';

describe.each([
    ['overpassCompetitorsConnector', overpassCompetitorsConnector, { city: 'الرياض', concept: 'مطعم' }],
    ['chamberSuppliersConnector', chamberSuppliersConnector, { city: 'الرياض' }],
])('%s — مهلة اتصال Overpass', (_name, connector, context) => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('طلب مُعلَّق للأبد يُلغى تلقائياً بعد المهلة ويُعيد unavailable (لا تعليق أبدي)', async () => {
        vi.useFakeTimers();
        const hangingFetch = vi.fn((url, init) => new Promise((resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }));
        vi.stubGlobal('fetch', hangingFetch);

        const promise = connector(context);
        await vi.advanceTimersByTimeAsync(30000);
        const result = await promise;

        expect(isUsable(result)).toBe(false);
        expect(result.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(hangingFetch).toHaveBeenCalledTimes(1);
        const [, init] = hangingFetch.mock.calls[0];
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('لا يُطلق إلغاءً متأخراً بعد نجاح الطلب فعلياً (المهلة تُلغى بعد الاستجابة)', async () => {
        vi.useFakeTimers();
        const okFetch = vi.fn(async () => ({ ok: true, json: async () => ({ elements: [] }) }));
        vi.stubGlobal('fetch', okFetch);

        const result = await connector(context);
        expect(isUsable(result)).toBe(true);

        // بعد النجاح، حتى لو تقدّم الوقت الوهمي كثيراً، لا استثناء غير مُعالَج (clearTimeout استُدعيت فعلياً).
        await vi.advanceTimersByTimeAsync(120000);
    });
});

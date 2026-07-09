/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة حرجة، خبير الذكاء + قرار مدير المنتج 2026-07-08: إحياء
 * لا حذف): calculateIdeaScore.js كان منطقاً مختبراً فعلياً لكن كوداً ميتاً 100% —
 * المستهلك الوحيد (Sidebar.js) مخفي بالكامل. الآن يظهر في خطوة «الدراسة المبدئية»
 * نفسها (حيث الفحص السريع منطقي فعلاً)، بثلاث فروع منفصلة لا رقماً مدموجاً واحداً
 * (يمنع فهم «اكتمال التعبئة» على أنه «جودة الفكرة» — ملاحظة متوسطة منفصلة بنفس التدقيق).
 *
 * تحديث 2026-07-09 (علة #1): score الآن = هامش(0-50) + TAM(0-50) حصراً — اكتمال
 * التعبئة معلوماتية بحتة (% منفصل موسوم صراحة) ولا تدخل في المجموع أو في سقف الفروع.
 */
import { describe, it, expect } from 'vitest';
import { PreliminaryCheckView } from '../PreliminaryCheckView.js';
import { createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {} };
}

describe('PreliminaryCheckView — إحياء نتيجة الفكرة (لم تعد كوداً ميتاً)', () => {
    it('يعرض بطاقة "نتيجة الفكرة الأولية" مع فرعي الهامش/TAM (سقف 50 لكل منهما) واكتمال معلوماتي منفصل', () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const state = createEmptyStudy();
        state.marketSizing = { tam: { value: 2_000_000 } };
        state.revenue = { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.3 }] };
        state.technical = { equipment: [{ price: 50000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };

        const view = new PreliminaryCheckView('c', fakeStore(state), () => {});
        view.render();

        const html = document.getElementById('c').innerHTML;
        expect(html).toContain('نتيجة الفكرة الأولية');
        expect(html).toMatch(/الهامش الربحي: \d+\/50/);
        expect(html).toMatch(/حجم السوق \(TAM\): \d+\/50/);
        // اكتمال التعبئة معروض كنسبة % منفصلة، موسومة صراحة بأنها لا تُحتسب ضمن score
        expect(html).toMatch(/اكتمال تعبئة البيانات: \d+% \(معلوماتي — لا يُحتسب ضمن نتيجة الفكرة\)/);
    });
});

/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة حرجة، خبير الذكاء + قرار مدير المنتج 2026-07-08: إحياء
 * لا حذف): calculateIdeaScore.js كان منطقاً مختبراً فعلياً لكن كوداً ميتاً 100% —
 * المستهلك الوحيد (Sidebar.js) مخفي بالكامل. الآن يظهر في خطوة «الدراسة المبدئية»
 * نفسها (حيث الفحص السريع منطقي فعلاً)، بثلاث فروع منفصلة لا رقماً مدموجاً واحداً
 * (يمنع فهم «اكتمال التعبئة» على أنه «جودة الفكرة» — ملاحظة متوسطة منفصلة بنفس التدقيق).
 */
import { describe, it, expect } from 'vitest';
import { PreliminaryCheckView } from '../PreliminaryCheckView.js';
import { createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {} };
}

describe('PreliminaryCheckView — إحياء نتيجة الفكرة (لم تعد كوداً ميتاً)', () => {
    it('يعرض بطاقة "نتيجة الفكرة الأولية" مع الفروع الثلاثة منفصلة عند وجود بيانات كافية', () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const state = createEmptyStudy();
        state.marketSizing = { tam: { value: 2_000_000 } };
        state.revenue = { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.3 }] };
        state.technical = { equipment: [{ price: 50000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };

        const view = new PreliminaryCheckView('c', fakeStore(state), () => {});
        view.render();

        const html = document.getElementById('c').innerHTML;
        expect(html).toContain('نتيجة الفكرة الأولية');
        expect(html).toMatch(/اكتمال البيانات: \d+\/40/);
        expect(html).toMatch(/الهامش الربحي: \d+\/30/);
        expect(html).toMatch(/حجم السوق \(TAM\): \d+\/30/);
    });
});

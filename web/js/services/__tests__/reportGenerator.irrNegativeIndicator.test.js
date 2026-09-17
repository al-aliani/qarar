/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-09-16: قسم "المؤشرات المالية" (financial_kpis) في التقرير المُصدَّر —
 * بطاقة IRR (kpi-card) لم تكن تُلوَّن أحمر أبداً مهما كانت سالبة (شرط لوني ناقص:
 * `irr > 0.15 ? 'positive' : ''` بلا فرع negative)، بخلاف بطاقة NPV المجاورة التي
 * تُلوَّن الاثنين. جدول "التقييم" أسفلها كان أسوأ: يصنّف أي IRR سالب كـ"متوسط" —
 * نفس تصنيف عائد إيجابي متواضع، رغم أن المشروع يخسر فعلياً.
 */
import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../ReportGenerator.js';

const baseState = { projectInfo: { name: 'دراسة اختبار' }, revenue: {}, assumptions: {} };

function render(irr) {
    const results = { indicators: { npv: -100000, irr }, capex: { total: 100000 }, decision: 'NO-GO' };
    return ReportGenerator._renderSection('financial_kpis', baseState, results, {}, 1, 'ar').html;
}

describe('ReportGenerator — بطاقة IRR السالبة تُلوَّن أحمر ولا تُصنَّف "متوسط"', () => {
    it('IRR سالب: بطاقة kpi-value تحمل class="negative" (لم تكن تُلوَّن إطلاقاً من قبل)', () => {
        const html = render(-0.12);
        const irrCardMatch = html.match(/kpi-label">معدل العائد الداخلي \(IRR\)<\/div><div class="kpi-value ([^"]*)"/);
        expect(irrCardMatch).not.toBeNull();
        expect(irrCardMatch[1]).toBe('negative');
    });

    it('IRR سالب: جدول التقييم يعرض "⚠ سالب" لا "متوسط"', () => {
        const html = render(-0.12);
        expect(html).toContain('⚠ سالب');
        expect(html).not.toContain('>متوسط<');
    });

    it('IRR مرتفع (>15%): يبقى "positive"/"✓ مرتفع" كما كان (لا انحدار)', () => {
        const html = render(0.28);
        const irrCardMatch = html.match(/kpi-label">معدل العائد الداخلي \(IRR\)<\/div><div class="kpi-value ([^"]*)"/);
        expect(irrCardMatch[1]).toBe('positive');
        expect(html).toContain('✓ مرتفع');
    });

    it('IRR إيجابي متواضع (0-15%): يبقى بلا تلوين خاص و"متوسط" كما كان (لا انحدار)', () => {
        const html = render(0.08);
        const irrCardMatch = html.match(/kpi-label">معدل العائد الداخلي \(IRR\)<\/div><div class="kpi-value ([^"]*)"/);
        expect(irrCardMatch[1]).toBe('');
        expect(html).toContain('>متوسط<');
    });

    it('IRR غير محقق (null): لا تلوين، ونص "غير محقق" في الموضعين', () => {
        const html = render(null);
        const irrCardMatch = html.match(/kpi-label">معدل العائد الداخلي \(IRR\)<\/div><div class="kpi-value ([^"]*)"/);
        expect(irrCardMatch[1]).toBe('');
        expect(html).toContain('غير محقق');
    });
});

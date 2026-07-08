/**
 * تدقيق 2026-07-08 (ملاحظة متوسطة #31): سجل المخاطر (RiskMatrix.js) يجمع 4 حقول
 * تحليلية — الأثر المالي المقدَّر، الأفق الزمني، الخطر المتبقي، مؤشر الإنذار المبكر —
 * لا تُطبع إطلاقاً في التقرير النهائي المُصدَّر (renderRisks كانت تعرض 5 أعمدة فقط)،
 * رغم أن المستخدم يُدخلها فعلياً كجزء من التحليل. هذا يثبّت ظهورها في التقرير + إجمالي
 * الأثر المالي + إفصاح واضح بأنها تخطيطية ولا تُخصَم مباشرة من صافي القيمة الحالية
 * (تفادياً لازدواج مع علاوة المخاطر التي يحتسبها المحرك فعلياً من probability/impact).
 */
import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../ReportGenerator.js';
import { createEmptyStudy } from '../../core/schema.js';
import { formatCurrency } from '../../utils/formatters.js';

function risk(overrides = {}) {
    return {
        name: 'خطر', type: 'operational', probability: 'medium', impact: 'medium',
        estimatedFinancialImpact: 0, timeHorizon: 'short', mitigation: '', residualRisk: 'medium',
        earlyWarning: '', owner: '', ...overrides
    };
}

describe('ReportGenerator.renderRisks — الحقول التحليلية الأربعة تظهر في التقرير (#31)', () => {
    it('يعرض الأثر المالي المقدَّر (منسَّقاً كعملة)، الأفق الزمني، الخطر المتبقي، ومؤشر الإنذار المبكر', () => {
        const html = ReportGenerator.renderRisks([
            risk({
                name: 'تقلّب أسعار المدخلات', type: 'financial', probability: 'high', impact: 'high',
                estimatedFinancialImpact: 120000, timeHorizon: 'short', mitigation: 'عقود توريد ثابتة',
                residualRisk: 'medium', earlyWarning: 'ارتفاع فاتورة الشراء أكثر من 8%'
            })
        ]);

        expect(html).toContain('تقلّب أسعار المدخلات');
        expect(html).toContain('قصير (< سنة)'); // ترجمة الأفق الزمني
        expect(html).toContain('ارتفاع فاتورة الشراء أكثر من 8%'); // مؤشر الإنذار المبكر
        expect(html).toContain('عقود توريد ثابتة');
        // الأثر المالي يظهر منسَّقاً كعملة (نفس formatCurrency الفعلية) لا رقماً خاماً
        expect(html).toContain(formatCurrency(120000));
    });

    it('يعرض إجمالي الأثر المالي المقدَّر عبر كل المخاطر (تذييل الجدول) عند وجود قيم موجبة', () => {
        const html = ReportGenerator.renderRisks([
            risk({ name: 'أ', estimatedFinancialImpact: 120000 }),
            risk({ name: 'ب', estimatedFinancialImpact: 80000 }),
        ]);
        expect(html).toContain('إجمالي الأثر المالي المقدّر');
        expect(html).toContain(formatCurrency(200000));
    });

    it('لا تذييل إجمالي عندما تكون كل قيم الأثر المالي صفراً/فارغة (لا صف "٠" مضلِّل)', () => {
        const html = ReportGenerator.renderRisks([risk({ name: 'أ' }), risk({ name: 'ب' })]);
        expect(html).not.toContain('إجمالي الأثر المالي المقدّر');
    });

    it('يفصح صراحة أن الأثر المالي تخطيطي ولا يُخصَم مباشرة من صافي القيمة الحالية (تفادي ازدواج الاحتساب)', () => {
        const html = ReportGenerator.renderRisks([risk({ name: 'خطر' })]);
        expect(html).toContain('لا يُخصَم مباشرة من صافي القيمة الحالية');
    });

    it('يهرب (escape) نصوص المستخدم في اسم الخطر/خطة التخفيف/مؤشر الإنذار المبكر (لا حقن HTML)', () => {
        const html = ReportGenerator.renderRisks([
            risk({ name: '<img src=x onerror=alert(1)>', mitigation: '<script>alert(2)</script>', earlyWarning: '<b>test</b>' })
        ]);
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).not.toContain('<script>alert(2)</script>');
        expect(html).not.toContain('<b>test</b>');
    });

    it('حالة تكامل عبر _renderSection: قسم risks الفعلي في التقرير يحمل نفس الأعمدة الجديدة', () => {
        const state = createEmptyStudy();
        state.riskAnalysis = {
            risks: [risk({ name: 'خطر متكامل', estimatedFinancialImpact: 50000, timeHorizon: 'long', earlyWarning: 'مؤشر تجريبي' })]
        };
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('risks', state, results, null, 1);

        expect(section).not.toBeNull();
        expect(section.html).toContain('خطر متكامل');
        expect(section.html).toContain('طويل (> 3 سنوات)');
        expect(section.html).toContain('مؤشر تجريبي');
    });
});

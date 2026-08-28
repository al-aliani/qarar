/**
 * تدقيق أمني 2026-08-27: ProfessionalReviewReportGenerator.js كان يعتمد على
 * تهريب جزئي يدوي (`.replace(/</g, '&lt;')` فقط — بلا `&`/`"`/`'`) مكرَّراً في
 * 9 مواضع بدل دالة موحّدة، ومنها ترتيب خاطئ (slice بعد الهروب في حقل خطة
 * مواجهة المخاطر) قد يقطع كيان HTML مُهرَّباً في المنتصف عند القص عند 100 حرف.
 * استُبدل الجميع بـescapeHtml الموحّد (web/js/utils/escape.js).
 */
import { describe, it, expect } from 'vitest';
import { ProfessionalReviewReportGenerator } from '../ProfessionalReviewReportGenerator.js';

function makeStore(state) {
    return { getState: () => state };
}

const BASE_STATE = {
    projectInfo: { name: 'مشروع اختبار', concept: 'اختبار', city: 'الرياض' },
};

describe('ProfessionalReviewReportGenerator — تهريب HTML كامل بدل نمط جزئي', () => {
    it('اسم المشروع في العنوان يُهرَّب بالكامل (لا "<" فقط)', () => {
        const state = { ...BASE_STATE, projectInfo: { ...BASE_STATE.projectInfo, name: '"><script>alert(1)</script>' } };
        const html = ProfessionalReviewReportGenerator.generateHTML(makeStore(state));
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('الملخص التنفيذي الحر يُهرَّب', () => {
        const state = { ...BASE_STATE, executiveSummary: { projectOverview: '<script>alert(1)</script>' } };
        const html = ProfessionalReviewReportGenerator.generateHTML(makeStore(state));
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('حقول فريق الملاحق (الاسم/الدور/البريد) تُهرَّب', () => {
        const state = { ...BASE_STATE, keyPeople: { keyPeople: [{ name: '<script>alert("n")</script>', role: 'مدير', email: 'a@b.com' }] } };
        const html = ProfessionalReviewReportGenerator.generateHTML(makeStore(state));
        expect(html).not.toContain('<script>alert("n")</script>');
    });

    it('حقل خطة المواجهة الطويل (>100 حرف) لا يقطع كياناً مُهرَّباً في المنتصف', () => {
        // نص يضع "<" عند الموضع 99-100 بالضبط ليكشف خطأ ترتيب slice/escape القديم
        const longMitigation = 'أ'.repeat(99) + '<script>x</script>' + 'ب'.repeat(20);
        const state = { ...BASE_STATE, riskAnalysis: { risks: [{ name: 'خطر', mitigation: longMitigation }] } };
        const html = ProfessionalReviewReportGenerator.generateHTML(makeStore(state));
        // لا يجوز أن يظهر كيان مقطوع مثل "&l" أو "&lt" بلا فاصلة منقوطة
        expect(html).not.toMatch(/&l(?!t;)/);
        expect(html).not.toMatch(/&lt(?!;)/);
        expect(html).not.toContain('<script>x</script>');
    });

    it('نص عادي بلا وسوم يظهر طبيعياً (لا انحدار وظيفي)', () => {
        const state = { ...BASE_STATE, executiveSummary: { projectOverview: 'مشروع مطعم شاورما في الرياض' } };
        const html = ProfessionalReviewReportGenerator.generateHTML(makeStore(state));
        expect(html).toContain('مشروع مطعم شاورما في الرياض');
    });
});

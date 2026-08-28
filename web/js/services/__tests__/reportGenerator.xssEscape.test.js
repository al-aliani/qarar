/**
 * تدقيق أمني 2026-08-27: نفس فئة العطل الذي أُصلح في BankReportGenerator.js
 * بتاريخ 2026-08-21 ("تدقيق أمني: نص حر يكتبه مالك الدراسة يُحقن هنا بلا escape")
 * كان لا يزال حياً في ReportGenerator.js (المولِّد "المتميز" العام) — نص الملخص
 * التنفيذي الحر (executiveSummary.projectOverview/aiGeneratedText، حقل نصي حر
 * يملؤه صاحب الدراسة في ExecutiveSummary.js) كان يُحقَن بلا escapeHtml بينما
 * النص الاحتياطي المولَّد آلياً بجواره في نفس السطر كان مُهرَّباً — تناقض يكشف
 * أن الإهمال سهو لا قرار. أيضاً: قائمة أخطاء التحقق (validationNotice) كانت
 * تُحقَن بلا تهريب رغم أنها قد تحوي تسميات أدخلها المستخدم (مثال:
 * validation.js:80 يُضمِّن "label" مصدر الإيراد حرفياً في رسالة الخطأ).
 */
import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../ReportGenerator.js';

function makeStore(state) {
    return { getState: () => state };
}

const BASE_STATE = {
    projectInfo: { name: 'مشروع اختبار', concept: 'اختبار' },
};

describe('ReportGenerator — تهريب HTML بالملخص التنفيذي وتنبيه الأخطاء', () => {
    it('نص حر بالملخص التنفيذي (projectOverview) يُهرَّب ولا يُنفَّذ كوسم HTML خام', () => {
        const state = { ...BASE_STATE, executiveSummary: { projectOverview: '<script>alert(1)</script>' } };
        const html = ReportGenerator.generateHTML(makeStore(state));
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('aiGeneratedText كنص احتياطي يُهرَّب أيضاً', () => {
        const state = { ...BASE_STATE, executiveSummary: { aiGeneratedText: '<img src=x onerror=alert(1)>' } };
        const html = ReportGenerator.generateHTML(makeStore(state));
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('نص عادي بلا وسوم يبقى يظهر طبيعياً (لا انحدار وظيفي)', () => {
        const state = { ...BASE_STATE, executiveSummary: { projectOverview: 'مشروع مطعم شاورما في الرياض' } };
        const html = ReportGenerator.generateHTML(makeStore(state));
        expect(html).toContain('مشروع مطعم شاورما في الرياض');
    });

    it('[إثبات الحارس] العطل الأصلي: إدراج النص الحر بلا escapeHtml كان سيُبقي وسم <script> خاماً', () => {
        const raw = '<script>alert(1)</script>';
        const buggyHtml = `<p>${raw || 'fallback'}</p>`;
        expect(buggyHtml).toContain('<script>alert(1)</script>');
    });
});

describe('ReportGenerator — رابط حجز الاستشارة (consultationBookingUrl) يرفض مخططات خطرة', () => {
    it('رابط javascript: لا يظهر إطلاقاً كرابط قابل للنقر', () => {
        const state = { ...BASE_STATE, consultationBookingUrl: 'javascript:alert(document.cookie)' };
        const html = ReportGenerator.generateHTML(makeStore(state));
        expect(html).not.toContain('javascript:alert(document.cookie)');
        expect(html).not.toContain('احجز استشارة مع خبير');
    });

    it('رابط data: أيضاً يُرفَض', () => {
        const state = { ...BASE_STATE, consultationBookingUrl: 'data:text/html,<script>alert(1)</script>' };
        const html = ReportGenerator.generateHTML(makeStore(state));
        expect(html).not.toContain('data:text/html');
    });

    it('رابط https حقيقي يظهر طبيعياً (لا انحدار وظيفي)', () => {
        const state = { ...BASE_STATE, consultationBookingUrl: 'https://calendly.com/example' };
        const html = ReportGenerator.generateHTML(makeStore(state));
        expect(html).toContain('href="https://calendly.com/example"');
        expect(html).toContain('احجز استشارة مع خبير');
    });

    it('[إثبات الحارس] العطل الأصلي: تهريب علامة التنصيص وحده لا يمنع مخطط javascript:', () => {
        const raw = 'javascript:alert(1)';
        const buggyHref = String(raw).replace(/"/g, '&quot;');
        expect(buggyHref).toBe('javascript:alert(1)');
    });
});

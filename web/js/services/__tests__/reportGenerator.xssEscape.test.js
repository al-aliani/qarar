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
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ReportGenerator } from '../ReportGenerator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(__dirname, '../ReportGenerator.js'), 'utf8');

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

    it('[إثبات الحارس] قراءة السطر الحقيقي في ReportGenerator.js: projectOverview وaiGeneratedText مُغلَّفان فعلياً بـescapeHtml (لا اعتماد على سطر مصطنع)', () => {
        const line = SOURCE.split('\n').find((l) => l.includes('executiveSummary?.projectOverview ?'));
        expect(line, 'سطر إدراج الملخص التنفيذي لم يُعثر عليه في ReportGenerator.js').toBeTruthy();
        expect(line).toContain('escapeHtml(state.executiveSummary.projectOverview)');
        expect(line).toContain('escapeHtml(state.executiveSummary.aiGeneratedText)');
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

    it('[إثبات الحارس] قراءة السطر الحقيقي في ReportGenerator.js: رابط الاستشارة محروس فعلياً بتحقق مخطط https قبل الإدراج (لا تهريب علامة تنصيص وحده)', () => {
        const line = SOURCE.split('\n').find((l) => l.includes('consultationBookingUrl'));
        expect(line, 'سطر رابط حجز الاستشارة لم يُعثر عليه في ReportGenerator.js').toBeTruthy();
        expect(line).toContain('/^https?:\\/\\//i.test(');
        expect(line).toContain('href="${escapeHtml(state.consultationBookingUrl.trim())}"');
    });
});

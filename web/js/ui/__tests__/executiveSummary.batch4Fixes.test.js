/**
 * @vitest-environment jsdom
 *
 * دفعة 4: ExecutiveSummary.js لم يكن يستورد escapeHtml إطلاقاً — فقط تهريب جزئي ارتجالي
 * (.replace(/</g,'&lt;')) في موضعين، لا يغطي بقية الحقول ولا يهرّب > & " '. حقول نصية حرة
 * متعددة (اسم المشروع، الحي، وصف المشروع، ومخاطر تحليل المخاطر المعروضة أيضاً في
 * RiskMatrix.js المهرَّب أصلاً) كانت تُعاد بلا تهريب في innerHTML. هذا الاختبار يثبّت أن
 * حقن HTML عبر كل حقل من هذه الحقول لا يظهر خاماً بعد الإصلاح.
 */
import { describe, it, expect } from 'vitest';
import { ExecutiveSummary } from '../ExecutiveSummary.js';
import { createEmptyStudy } from '../../core/schema.js';

const XSS = '<img src=x onerror=alert(1)>';
const XSS2 = '<script>alert(2)</script>';
const XSS3 = '<svg onload=alert(3)>';
const XSS4 = '<img src=y onerror=alert(4)>';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {} };
}

describe('ExecutiveSummary — تهريب الحقول النصية الحرة (دفعة 4)', () => {
    it('اسم المشروع (projectInfo.name) لا يظهر خاماً في نظرة عامة المشروع', () => {
        const state = createEmptyStudy();
        state.projectInfo = { ...state.projectInfo, name: XSS };
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const html = view.renderProjectOverview(state, state.executiveSummary || {});

        expect(html).not.toContain(XSS);
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('الحي (projectInfo.district) لا يظهر خاماً في نظرة عامة المشروع', () => {
        const state = createEmptyStudy();
        state.projectInfo = { ...state.projectInfo, district: XSS2 };
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const html = view.renderProjectOverview(state, state.executiveSummary || {});

        expect(html).not.toContain(XSS2);
        expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
    });

    it('المدينة (projectInfo.city) لا تظهر خامة في نظرة عامة المشروع', () => {
        const state = createEmptyStudy();
        state.projectInfo = { ...state.projectInfo, city: XSS3 };
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const html = view.renderProjectOverview(state, state.executiveSummary || {});

        expect(html).not.toContain(XSS3);
        expect(html).toContain('&lt;svg onload=alert(3)&gt;');
    });

    it('وصف المشروع (executiveSummary.projectOverview) لا يظهر خاماً في مربع النص', () => {
        const state = createEmptyStudy();
        const execSummary = { ...state.executiveSummary, projectOverview: XSS4 };
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const html = view.renderProjectOverview(state, execSummary);

        expect(html).not.toContain(XSS4);
        expect(html).toContain('&lt;img src=y onerror=alert(4)&gt;');
    });

    it('المشكلة التي يحلها المشروع (executiveSummary.problemStatement) لا تظهر خامة', () => {
        const state = createEmptyStudy();
        const execSummary = { ...state.executiveSummary, problemStatement: XSS };
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const html = view.renderProjectOverview(state, execSummary);

        expect(html).not.toContain(XSS);
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('الميزة التنافسية الفريدة (executiveSummary.uniqueValueProposition) لا تظهر خامة', () => {
        const state = createEmptyStudy();
        const execSummary = { ...state.executiveSummary, uniqueValueProposition: XSS2 };
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const html = view.renderProjectOverview(state, execSummary);

        expect(html).not.toContain(XSS2);
        expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
    });

    it('اسم الخطر (riskAnalysis.risks[].name) لا يظهر خاماً في المخاطر الرئيسية', () => {
        const state = createEmptyStudy();
        state.riskAnalysis = {
            risks: [
                { name: XSS, type: 'operational', probability: 'high', impact: 'high', mitigation: 'خطة مواجهة عادية', owner: '' }
            ]
        };
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const html = view.renderKeyRisks(state);

        expect(html).not.toContain(XSS);
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('خطة مواجهة الخطر (riskAnalysis.risks[].mitigation) لا تظهر خامة في المخاطر الرئيسية', () => {
        const state = createEmptyStudy();
        state.riskAnalysis = {
            risks: [
                { name: 'خطر عادي', type: 'operational', probability: 'high', impact: 'high', mitigation: XSS3, owner: '' }
            ]
        };
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const html = view.renderKeyRisks(state);

        expect(html).not.toContain(XSS3);
        expect(html).toContain('&lt;svg onload=alert(3)&gt;');
    });

    it('نفس بيانات الخطر لا تظهر خامة في «الحلول المقترحة للتحديات» أيضاً (التحدي والحل)', () => {
        const state = createEmptyStudy();
        state.riskAnalysis = {
            risks: [
                { name: XSS, type: 'operational', probability: 'medium', impact: 'medium', mitigation: XSS4, owner: '' }
            ]
        };
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const html = view.renderProposedSolutions(state);

        expect(html).not.toContain(XSS);
        expect(html).not.toContain(XSS4);
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).toContain('&lt;img src=y onerror=alert(4)&gt;');
    });
});

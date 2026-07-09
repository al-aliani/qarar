/**
 * @vitest-environment jsdom
 *
 * دفعة 4 (ميكانيكية): إصلاحان صغيران عبر 5 ملفات.
 * 1) أزرار حذف بلا اسم accessible (أيقونة سلة فقط 🗑️/× بلا نص) في MarketAnalysis،
 *    RiskMatrix، IntroductionView، StrategicAnalysis — أُضيف aria-label لكل منها.
 * 2) خلط نظامي الأرقام (لاتيني/هندي) داخل نفس الجملة: نسبة الطاقة القصوى في
 *    FinancialDashboard.renderAuditorPanel، ودرجة الخطر في جدول RiskMatrix — وُحِّدا
 *    على الأرقام الهندية العربية (toLocaleString('ar-SA')) مثل بقية الأرقام المجاورة.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MarketAnalysis } from '../MarketAnalysis.js';
import { RiskMatrix } from '../RiskMatrix.js';
import { IntroductionView } from '../IntroductionView.js';
import { StrategicAnalysis } from '../StrategicAnalysis.js';
import { FinancialDashboard } from '../FinancialDashboard.js';
import { createEmptyStudy } from '../../core/schema.js';

const ARABIC_INDIC = /[٠-٩]/;

function fakeStore(state) {
    return {
        getState: () => state,
        get: () => state,
        update: () => {},
        notify: () => {}
    };
}

beforeEach(() => {
    document.body.innerHTML = `<div id="c"></div>`;
});

afterEach(() => {
    document.body.innerHTML = '';
});

describe('MarketAnalysis — aria-label على أزرار الحذف الأيقونية', () => {
    it('.btn-remove-segment يحمل aria-label="حذف الشريحة السوقية"', () => {
        const store = fakeStore({
            projectInfo: { city: 'الرياض' },
            marketing: { competitors: [] },
            marketSizing: { segments: [{ name: 'شريحة 1', demographics: '', needs: '', size: 100, priority: 'primary', purchaseFrequency: '', purchaseMethod: '' }] }
        });
        const view = new MarketAnalysis('c', store, () => {});
        view.render(0);

        const btn = document.querySelector('.btn-remove-segment');
        expect(btn).toBeTruthy();
        expect(btn.getAttribute('aria-label')).toBe('حذف الشريحة السوقية');
    });

    it('.btn-remove-competitor يحمل aria-label="حذف المنافس"', () => {
        const store = fakeStore({
            projectInfo: { city: 'الرياض' },
            marketing: { competitors: [{ name: 'منافس 1', marketShare: 10, strengths: '', weaknesses: '', advantage: '' }] },
            marketSizing: {}
        });
        const view = new MarketAnalysis('c', store, () => {});
        view.render(0);

        const btn = document.querySelector('.btn-remove-competitor');
        expect(btn).toBeTruthy();
        expect(btn.getAttribute('aria-label')).toBe('حذف المنافس');
    });
});

describe('RiskMatrix — aria-label على زر الحذف + الأرقام العربية لدرجة الخطر', () => {
    function risk(overrides = {}) {
        return {
            name: 'خطر اختبار', type: 'operational', probability: 'medium', impact: 'medium',
            estimatedFinancialImpact: 0, timeHorizon: 'short', mitigation: '', residualRisk: 'medium',
            earlyWarning: '', owner: '', ...overrides
        };
    }

    it('.btn-remove-risk يحمل aria-label="حذف الخطر"', () => {
        const store = fakeStore({ riskAnalysis: { risks: [risk()] } });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);

        const btn = document.querySelector('.btn-remove-risk');
        expect(btn).toBeTruthy();
        expect(btn.getAttribute('aria-label')).toBe('حذف الخطر');
    });

    it('شارة درجة الخطر (احتمالية=متوسط × أثر=متوسط ⇒ 6) تُعرض بأرقام هندية عربية لا لاتينية', () => {
        const store = fakeStore({ riskAnalysis: { risks: [risk({ probability: 'medium', impact: 'medium' })] } });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);

        const badge = document.querySelector('.risk-register .badge');
        expect(badge).toBeTruthy();
        const text = badge.textContent.trim();
        expect(text).toBe((6).toLocaleString('ar-SA')); // "٦"
        expect(text).toMatch(ARABIC_INDIC);
        expect(text).not.toMatch(/[0-9]/); // لا تسرّب رقم لاتيني بجانب الرقم الهندي
    });
});

describe('IntroductionView — aria-label على أزرار حذف المنتج/الخدمة/الموقع البديل/شريحة العميل', () => {
    function buildState(overrides) {
        const state = createEmptyStudy();
        Object.assign(state.projectInfo, overrides);
        return state;
    }

    it('.btn-remove-product يحمل aria-label="حذف المنتج"', () => {
        const state = buildState({
            products: [{ type: 'final', name: 'قهوة مختصة', description: '', uniqueFeatures: '', valueAdded: '', customerBenefit: '' }]
        });
        const view = new IntroductionView('c', fakeStore(state), () => {});
        view.render(0);

        const btn = document.querySelector('.btn-remove-product');
        expect(btn).toBeTruthy();
        expect(btn.getAttribute('aria-label')).toBe('حذف المنتج');
    });

    it('.btn-remove-service يحمل aria-label="حذف الخدمة"', () => {
        const state = buildState({
            introServices: [{ name: 'تركيب', type: 'supporting', description: 'خدمة تركيب' }]
        });
        const view = new IntroductionView('c', fakeStore(state), () => {});
        view.render(0);

        const btn = document.querySelector('.btn-remove-service');
        expect(btn).toBeTruthy();
        expect(btn.getAttribute('aria-label')).toBe('حذف الخدمة');
    });

    it('.btn-remove-loc-alt يحمل aria-label="حذف الموقع البديل"', () => {
        const state = buildState({});
        state.projectInfo.locationAnalysis.locationAlternatives = [
            { name: 'موقع بديل 1', address: '', lat: '', lng: '', notes: '' }
        ];
        const view = new IntroductionView('c', fakeStore(state), () => {});
        view.render(0);

        const btn = document.querySelector('.btn-remove-loc-alt');
        expect(btn).toBeTruthy();
        expect(btn.getAttribute('aria-label')).toBe('حذف الموقع البديل');
    });

    it('.btn-remove-customer يحمل aria-label="حذف شريحة العملاء"', () => {
        const state = buildState({
            customerValues: [{ customerType: 'صاحب المقهى', customerNeed: '', valueWeProvide: '' }]
        });
        const view = new IntroductionView('c', fakeStore(state), () => {});
        view.render(0);

        const btn = document.querySelector('.btn-remove-customer');
        expect(btn).toBeTruthy();
        expect(btn.getAttribute('aria-label')).toBe('حذف شريحة العملاء');
    });
});

describe('StrategicAnalysis — aria-label على زر حذف بند SWOT', () => {
    it('.btn-remove-swot يحمل aria-label="حذف بند التحليل الرباعي"', () => {
        const store = fakeStore({
            strategic: { swot: { strengths: ['بند اختبار'] } }
        });
        const view = new StrategicAnalysis('c', store, () => {});
        view.render(0);

        const btn = document.querySelector('.btn-remove-swot');
        expect(btn).toBeTruthy();
        expect(btn.getAttribute('aria-label')).toBe('حذف بند التحليل الرباعي');
    });
});

describe('FinancialDashboard — نسبة الطاقة القصوى بالأرقام العربية داخل نفس الجملة', () => {
    it('renderAuditorPanel: يعرض النسبة المئوية (pctOfMax) بأرقام هندية عربية إلى جانب الأرقام الأخرى في نفس الجملة', () => {
        const dashboard = new FinancialDashboard('c', fakeStore({}));
        const results = {
            capacityCheck: {
                exceeded: false,
                utilizationOfMax: 0.6, // ⇒ pctOfMax = 60 ⇒ الفرع "قابلة للتحقيق" (أيقونة i-check) (<=85)
                plannedUnitsPerMonth: 300,
                maxUnitsPerMonth: 500
            },
            tornado: [],
            indicators: {}
        };

        const html = dashboard.renderAuditorPanel(results);

        // دفعة 6: استُبدل الرمز التعبيري الخام (✅) بأيقونة SVG من المكتبة المشتركة
        expect(html).toContain('href="#i-check"');
        expect(html).toContain('قابلة للتحقيق');
        expect(html).not.toMatch(/[✅❌⚠️]/u);
        // النسبة المئوية نفسها يجب أن تكون بالأرقام الهندية العربية (٦٠%) لا اللاتينية (60%)
        expect(html).toMatch(/[٠-٩]+% من الطاقة القصوى/);
        expect(html).not.toMatch(/[0-9]+% من الطاقة القصوى/);
        // الرقمان الآخران في نفس الجملة (المخطَّط والطاقة القصوى) كانا بالفعل بالأرقام الهندية
        expect(html).toContain((300).toLocaleString('ar-SA'));
        expect(html).toContain((500).toLocaleString('ar-SA'));
        expect(html).toContain((60).toLocaleString('ar-SA') + '%');
    });
});

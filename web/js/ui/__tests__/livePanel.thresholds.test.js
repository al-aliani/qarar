/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (اكتُشف بتحقق عدائي بعد إصلاح توحيد العتبات الأول): اللوحة الحية
 * (LivePanel.js) نشطة فعلياً في الإنتاج (مرتبطة بأزرار حقيقية) وكانت تستخدم عتبات
 * ثابتة (IRR≥5%، استرداد≤5 سنوات) منفصلة تماماً عن minIRR/maxPayback الفعليين —
 * فتُظهر ✅ لمشروع تصنّفه لوحة القرار المجاورة REVISE لنفس البيانات بالضبط.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LivePanel } from '../LivePanel.js';

function fakeStore(state) {
    return { get: () => state, subscribe: () => {} };
}

describe('LivePanel — عتبات موحّدة (لا 5%/5-سنوات ثابتة)', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <span id="liveIRR"></span>
            <span id="headerKpiIrr"></span>
            <div id="qaStatusList"></div>
        `;
    });

    it('IRR بين 5% و15%: لا يُصنَّف text-gold (ذهبي) رغم أنه كان يُصنَّف كذلك سابقاً بعتبة 5%', () => {
        const panel = new LivePanel(fakeStore({}));
        panel.lastResults = {
            indicators: { irr: 0.10, npv: 100000, paybackPeriod: 4 },
            decision: 'REVISE',
            assumptionsApplied: { thresholds: { minIRR: 0.15, maxPayback: 3.5 } }
        };
        panel.updateIRR();
        const el = document.getElementById('liveIRR');
        expect(el.classList.contains('text-gold')).toBe(false);
    });

    it('IRR فوق العتبة الفعلية (18%) يُصنَّف text-gold فعلياً', () => {
        const panel = new LivePanel(fakeStore({}));
        panel.lastResults = {
            indicators: { irr: 0.18, npv: 100000, paybackPeriod: 2 },
            decision: 'GO',
            assumptionsApplied: { thresholds: { minIRR: 0.15, maxPayback: 3.5 } }
        };
        panel.updateIRR();
        expect(document.getElementById('liveIRR').classList.contains('text-gold')).toBe(true);
        expect(document.getElementById('headerKpiIrr').classList.contains('text-gold')).toBe(true);
    });

    it('IRR سالب يُصنَّف text-danger لا text-gold', () => {
        const panel = new LivePanel(fakeStore({}));
        panel.lastResults = {
            indicators: { irr: -0.05, npv: -50000, paybackPeriod: null },
            decision: 'NO-GO',
            assumptionsApplied: { thresholds: { minIRR: 0.15, maxPayback: 3.5 } }
        };
        panel.updateIRR();
        const el = document.getElementById('liveIRR');
        expect(el.classList.contains('text-danger')).toBe(true);
        expect(el.classList.contains('text-gold')).toBe(false);
    });

    it('لا نتائج بعد (lastResults=null): لا يرمي خطأً ولا يغيّر المحتوى', () => {
        const panel = new LivePanel(fakeStore({}));
        panel.lastResults = null;
        expect(() => panel.updateIRR()).not.toThrow();
        expect(() => panel.updateQAStatus()).not.toThrow();
    });

    it('بند فحص الجودة IRR/استرداد يعكس نفس عتبتي القرار الفعليتين لا ثوابت 5%/5 سنوات', () => {
        const panel = new LivePanel(fakeStore({}));
        panel.lastResults = {
            indicators: { irr: 0.10, npv: 100000, paybackPeriod: 4 },
            decision: 'REVISE',
            _meta: {},
            assumptionsApplied: { thresholds: { minIRR: 0.15, maxPayback: 3.5 } }
        };
        panel.updateQAStatus();
        const text = document.getElementById('qaStatusList').textContent;
        // قبل الإصلاح: IRR=10% وpayback=4 كانا يظهران ✅ (فوق 5%، تحت 5 سنوات) —
        // بعد الإصلاح: كلاهما يفشل عتبة القرار الفعلية (15%، 3.5 سنة) فيظهران ⚠️.
        expect(text).toContain('⚠️');
        expect(text).not.toMatch(/معدل العائد الداخلي[^⚠]*✅/);
    });
});

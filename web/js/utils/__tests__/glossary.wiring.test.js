/**
 * حارس توصيل القاموس (glossary.js) — تدقيق 2026-07-12 اكتشف أن FinancialDashboard كان
 * يمرر التسميات العربية كمفاتيح بحث بدل مفاتيح القاموس (NPV/IRR/...) فيفشل
 * createTooltip/wrapWithTooltip/indicatorHelp بصمت (console.warn فقط) ولا يظهر أي شرح؛
 * ومفتاح 'BEP' في DecisionExplainer لم يكن موجوداً أصلاً في القاموس (الصحيح BREAKEVEN).
 * هذا الاختبار يقرأ نص الملفات المستدعية مباشرة (كنمط labels.dedup.test.js) ويتحقق
 * أن كل مفتاح مذكور حرفياً موجود فعلاً في FINANCIAL_TERMS — لا يعتمد على DOM أو تشغيل.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { FINANCIAL_TERMS } from '../glossary.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = (relPath) => readFileSync(join(__dirname, '../../..', relPath), 'utf8');

function matchAll(text, re) {
    return [...text.matchAll(re)].map(m => m[1]);
}

describe('توصيل القاموس: كل مفتاح مستدعى حرفياً موجود في FINANCIAL_TERMS', () => {
    it('DecisionExplainer.js — tooltipKey', () => {
        const keys = matchAll(src('js/core/DecisionExplainer.js'), /tooltipKey:\s*'([A-Za-z_]+)'/g);
        expect(keys.length).toBeGreaterThan(0);
        const missing = keys.filter(k => !FINANCIAL_TERMS[k]);
        expect(missing, `مفاتيح غير موجودة في القاموس: ${missing.join(', ')}`).toEqual([]);
    });

    it('FinancialDashboard.js — renderKPICard(term, ...)', () => {
        const keys = matchAll(src('js/ui/FinancialDashboard.js'), /renderKPICard\(\s*'([A-Za-z_]+)'/g);
        expect(keys.length).toBeGreaterThan(0);
        const missing = keys.filter(k => !FINANCIAL_TERMS[k]);
        expect(missing, `مفاتيح غير موجودة في القاموس: ${missing.join(', ')}`).toEqual([]);
    });

    it('DecisionDashboard.js — renderKPIItem(..., term) [المعامل الخامس]', () => {
        const text = src('js/ui/DecisionDashboard.js');
        const keys = [];
        for (const m of text.matchAll(/renderKPIItem\(([^()]*)\)/g)) {
            const args = m[1].split(',').map(s => s.trim());
            if (args.length < 5) continue; // بلا معامل term
            const literal = args[args.length - 1].match(/^'([A-Za-z_]+)'$/);
            if (literal) keys.push(literal[1]);
        }
        expect(keys.length).toBeGreaterThan(0);
        const missing = keys.filter(k => !FINANCIAL_TERMS[k]);
        expect(missing, `مفاتيح غير موجودة في القاموس: ${missing.join(', ')}`).toEqual([]);
    });

    it('ExecutiveSummary.js — highlights[].term', () => {
        const keys = matchAll(src('js/ui/ExecutiveSummary.js'), /term:\s*'([A-Za-z_]+)'/g);
        expect(keys.length).toBeGreaterThan(0);
        const missing = keys.filter(k => !FINANCIAL_TERMS[k]);
        expect(missing, `مفاتيح غير موجودة في القاموس: ${missing.join(', ')}`).toEqual([]);
    });

    it('StudyComparison.js — renderRow(label, term, ...)', () => {
        const keys = matchAll(src('js/ui/StudyComparison.js'), /renderRow\('[^']*',\s*'([A-Za-z_]+)'/g);
        expect(keys.length).toBeGreaterThan(0);
        const missing = keys.filter(k => !FINANCIAL_TERMS[k]);
        expect(missing, `مفاتيح غير موجودة في القاموس: ${missing.join(', ')}`).toEqual([]);
    });

    it("ZakatView.js — createTooltip('ZAKAT_BASE')", () => {
        const keys = matchAll(src('js/ui/ZakatView.js'), /createTooltip\('([A-Za-z_]+)'\)/g);
        expect(keys.length).toBeGreaterThan(0);
        const missing = keys.filter(k => !FINANCIAL_TERMS[k]);
        expect(missing, `مفاتيح غير موجودة في القاموس: ${missing.join(', ')}`).toEqual([]);
    });
});

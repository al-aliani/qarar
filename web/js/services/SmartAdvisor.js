/**
 * Smart Advisor Service (The "Auto-Consultant")
 * Analyzes financial metrics against industry benchmarks and generates recommendations.
 *
 * المعايير تُقرأ من المصدر الوحيد sectorBenchmarks.js (حسب القطاع) — لا جدول
 * مثبّت مواز، كي لا يتناقض حكم المستشار مع بوابة QA على نفس النسبة.
 */

import { resolveSectorBenchmark } from '../core/sectorBenchmarks.js';
import { getCostRatios } from '../core/costRatios.js';

const pctText = (v) => (v * 100).toFixed(0) + '%';
// تدقيق 2026-07-08 (ملاحظة حرجة، خبير السوق): نطاقات sectorBenchmarks.js تقديرية
// (ASSUMPTION) بلا مصدر خارجي — كانت تُعرض هنا كأنها معيار قاطع. الآن كل نطاق مذكور
// في نصيحة المستشار الذكي يُفصح صراحة عن طبيعته التقديرية.
const rangeText = ([lo, hi]) => `${pctText(lo)}–${pctText(hi)} تقديري`;

export class SmartAdvisor {

    /**
     * Analyze the project state and return structured insights
     * @param {Object} results Financial results object (from engine)
     * @param {Object} inputs Original inputs (state)
     */
    static analyze(results, inputs) {
        const empty = { ratios: { cogs: 0, labor: 0, rent: 0, marketing: 0, profit: 0 }, insights: [] };
        const year1 = results?.incomeStatement?.[0];
        const revenue = year1?.revenue;
        const hasFull = year1 && revenue && revenue > 0;

        if (!hasFull) {
            // تحليل جزئي من المؤشرات فقط عند غياب year1 أو الإيرادات
            const ind = results?.indicators || results || {};
            const insights = [];
            const npv = Number(ind.npv);
            if (!isNaN(npv) && npv <= 0) insights.push({ type: 'critical', category: 'جدوى', value: npv, message: 'صافي القيمة الحالية غير إيجابي؛ المشروع قد لا يخلق قيمة فوق تكلفة رأس المال.', action: 'مراجعة الافتراضات أو خفض التكاليف أو زيادة الإيرادات.' });
            const irr = Number(ind.irr);
            if (!isNaN(irr) && irr > 0 && irr < 0.10) insights.push({ type: 'warning', category: 'عائد', value: irr, message: `معدل العائد الداخلي (${(irr * 100).toFixed(1)}%) منخفض.`, action: 'تحسين الهوامش أو تقليل رأس المال أو إعادة تقييم المخاطر.' });
            const payback = Number(ind.paybackPeriod ?? ind.payback);
            if (!isNaN(payback) && payback > 5) insights.push({ type: 'warning', category: 'سيولة', value: payback, message: `فترة الاسترداد طويلة (${payback.toFixed(1)} سنة).`, action: 'خفض التكاليف الأولية أو تعجيل الإيرادات.' });
            const decision = results?.decision;
            const reasons = results?.decisionReasons || [];
            if (decision === 'REVISE' || decision === 'NO-GO') {
                const msg = decision === 'NO-GO' ? 'القرار يشير إلى عدم جدوى المشروع.' : 'القرار يوصي بمراجعة الدراسة.';
                const reasonStr = Array.isArray(reasons) && reasons.length ? ' ' + reasons.slice(0, 2).map(r => typeof r === 'string' ? r : (r?.text || r?.reason || '')).filter(Boolean).join('؛ ') : '';
                insights.push({ type: 'critical', category: 'قرار', message: msg + reasonStr, action: 'مراجعة بنود الدراسة وإصلاح الافتراضات ثم إعادة الحساب.' });
            }
            if (insights.length === 0 && (ind.npv !== undefined || ind.irr !== undefined)) insights.push({ type: 'success', category: 'General', message: 'المؤشرات المتوفرة إيجابية. أكمِل إدخال البيانات لقائمة الدخل لتحليل تفصيلي.', action: 'أضف الإيرادات والتكاليف ثم أعد الحساب.' });
            return { ratios: empty.ratios, insights };
        }

        // 1. Calculate ratios from the same engine drivers used by the dashboards.
        const ratios = getCostRatios(results);

        const insights = [];

        // 2a. مؤشرات مالية (إن وُجدت)
        const ind = results?.indicators || results;
        if (ind && (ind.npv !== undefined || ind.irr !== undefined || ind.paybackPeriod !== undefined)) {
            const npv = Number(ind.npv);
            if (!isNaN(npv) && npv <= 0) {
                insights.push({ type: 'critical', category: 'جدوى', value: npv, message: 'صافي القيمة الحالية غير إيجابي؛ المشروع قد لا يخلق قيمة فوق تكلفة رأس المال.', action: 'مراجعة الافتراضات أو خفض التكاليف أو زيادة الإيرادات.' });
            }
            const irr = Number(ind.irr);
            // IRR مخزّن ككسر (0.999 = 99.9%). العتبة 0.10 = 10٪، والعرض يُضرب في 100.
            // كان الشرط irr<10 (=1000%) فيُطلق «منخفض» لمشروع عائده 99.9% ويطبع 0.999 كـ«1.0%».
            if (!isNaN(irr) && irr > 0 && irr < 0.10) {
                insights.push({ type: 'warning', category: 'عائد', value: irr, message: `معدل العائد الداخلي (${(irr * 100).toFixed(1)}%) منخفض مقارنة بمعدلات متوقعة للمخاطرة.`, action: 'تحسين الهوامش أو تقليل رأس المال أو إعادة تقييم المخاطر.' });
            }
            const payback = Number(ind.paybackPeriod ?? ind.payback);
            if (!isNaN(payback) && payback > 5) {
                insights.push({ type: 'warning', category: 'سيولة', value: payback, message: `فترة الاسترداد طويلة (${payback.toFixed(1)} سنة)؛ مخاطر سيولة وربط رأس المال.`, action: 'خفض التكاليف الأولية أو تعجيل الإيرادات.' });
            }
        }

        // 2b. القرار وأسبابه (REVISE / NO-GO)
        const decision = results?.decision;
        const reasons = results?.decisionReasons || [];
        if (decision === 'REVISE' || decision === 'NO-GO') {
            const msg = decision === 'NO-GO' ? 'القرار يشير إلى عدم جدوى المشروع في ظل الافتراضات الحالية.' : 'القرار يوصي بمراجعة الدراسة قبل المضي قدماً.';
            const reasonStr = Array.isArray(reasons) && reasons.length ? ' أبرز الأسباب: ' + reasons.slice(0, 2).map(r => typeof r === 'string' ? r : (r?.text || r?.reason || '')).filter(Boolean).join('؛ ') : '';
            insights.push({ type: 'critical', category: 'قرار', message: msg + reasonStr, action: 'مراجعة بنود الدراسة وإصلاح الافتراضات أو الهيكلة ثم إعادة الحساب.' });
        }

        // 2c. Evaluate against Benchmarks — من المصدر الوحيد حسب القطاع المكتشَف
        const bench = resolveSectorBenchmark(inputs);
        const sectorNote = bench.isGeneric ? '' : ` لقطاع «${bench.label}»`;
        const [cogsLo, cogsHi] = bench.variableCostRate;
        const [, laborHi] = bench.laborToRevenue;
        const [, rentHi] = bench.rentToRevenue;
        const [profitLo] = bench.netProfitToRevenue;

        // COGS Analysis
        if (ratios.cogs > cogsHi) {
            insights.push({
                type: 'danger',
                category: 'COGS',
                value: ratios.cogs,
                message: `تكلفة البضاعة (${(ratios.cogs * 100).toFixed(1)}%) أعلى من النطاق الصحي${sectorNote} (${rangeText(bench.variableCostRate)}).`,
                action: 'حاول التفاوض مع الموردين أو رفع أسعار المنتجات قليلاً.'
            });
        } else if (ratios.cogs < cogsLo) {
            insights.push({
                type: 'warning',
                category: 'COGS',
                value: ratios.cogs,
                message: `تكلفة البضاعة (${(ratios.cogs * 100).toFixed(1)}%) أدنى من النطاق المتوقع${sectorNote} (${rangeText(bench.variableCostRate)}) — قد يكون تفاؤلاً مختبئاً.`,
                action: 'تأكد من حساب جميع الهوالك وتكاليف التغليف.'
            });
        }

        // Labor Analysis
        if (ratios.labor > laborHi) {
            insights.push({
                type: 'danger',
                category: 'Labor',
                value: ratios.labor,
                message: `تكلفة الرواتب تستنزف ${(ratios.labor * 100).toFixed(1)}% من دخلك — أعلى من النطاق${sectorNote} (${rangeText(bench.laborToRevenue)}).`,
                action: 'قلل عدد الموظفين في السنة الأولى أو اربط جزء من الراتب بالمبيعات (عمولة).'
            });
        }

        // Rent Analysis
        if (ratios.rent > rentHi) {
            insights.push({
                type: 'danger',
                category: 'Rent',
                value: ratios.rent,
                message: `الإيجار يمثل ${(ratios.rent * 100).toFixed(1)}% من المبيعات — أعلى من النطاق${sectorNote} (${rangeText(bench.rentToRevenue)}) (خطر).`,
                action: 'الموقع مكلف جداً مقارنة بالمبيعات المتوقعة. ابحث عن موقع أرخص أو حسن خطة المبيعات.'
            });
        }

        // Profit Analysis
        if (ratios.profit < profitLo && ratios.profit > 0) {
            insights.push({
                type: 'warning',
                category: 'Profitability',
                value: ratios.profit,
                message: `هامش الربح ${(ratios.profit * 100).toFixed(1)}% منخفض (المستهدف${sectorNote} ≥ ${pctText(profitLo)}).`,
                action: 'مشروعك يربح لكن المخاطرة عالية. يجب تحسين كفاءة التشغيل.'
            });
        } else if (ratios.profit < 0) {
            insights.push({
                type: 'critical',
                category: 'Profitability',
                value: ratios.profit,
                message: 'المشروع خاسر في السنة الأولى.',
                action: 'يجب إعادة هيكلة التكاليف بالكامل أو زيادة المبيعات المتوقعة.'
            });
        }

        // Add "Good Job" insights if everything is fine
        if (insights.length === 0) {
            insights.push({
                type: 'success',
                category: 'General',
                message: 'مؤشراتك المالية ممتازة وتقع ضمن النطاق الصحي للصناعة. 🚀',
                action: 'استمر في هذا التخطيط!'
            });
        }

        return {
            ratios,
            insights
        };
    }

    static extractRent(inputs) {
        // Try to find rent in technical items or opex
        // Assuming user puts rent in "Logistics" or "Technical" usually, 
        // but simplified logic often puts it in generic OPEX in this app.
        // Let's rely on aggregated OPEX if possible, or search tech inputs.
        // For MVP, look for item named 'إيجار' or 'rent' in Technical/Fixed Expenses.

        let rent = 0;
        // Check technical buildings/rent
        // Or check Opex Fixed items (aggregated elsewhere, but here we have raw inputs).
        // Let's check 'logistics' or 'administrative' for rent keywords
        const keywords = ['إيجار', 'ايجار', 'rent', 'lease'];

        // Helper to extract array from input section
        const getItems = (sectionData, key) => {
            if (!sectionData) return [];
            if (Array.isArray(sectionData)) return sectionData;
            return sectionData[key] || [];
        };

        const rawLogistics = inputs?.logistics;
        const logisticsArr = Array.isArray(rawLogistics) ? rawLogistics : (rawLogistics?.logistics || []);
        const checkList = [
            ...logisticsArr,
            ...getItems(inputs?.administrative, 'administrative'),
            ...getItems(inputs?.technical, 'buildings'),
            ...getItems(inputs?.technical, 'equipment'),
            ...getItems(inputs?.technical, 'furniture')
        ];

        checkList.forEach(item => {
            const n = (item?.name || '').toString();
            if (!keywords.some(k => n.includes(k))) return;
            const m = (Number(item.monthly) || 0) * 12;
            const a = Number(item.annual) || 0;
            rent += m || a || 0;
        });

        // Fallback: If not found, estimating 10% of total Fixed OPEX (very rough, maybe skip ratio if 0)
        return rent;
    }

    /**
     * Call the backend optimization engine.
     * عند فشل الخادم أو إرجاع []: Fallback لاقتراحات من SmartAdvisor.analyze
     * @param {Object} inputs Full project state/inputs
     * @param {Object} financials Financial results
     * @returns {Array<{ action, message, category }>}
     */
    static async getOptimizationSuggestions(inputs, financials) {
        const { optimizeProject } = await import('./AIConnector.js');
        const projectData = { inputs, financials };
        let out = await optimizeProject(projectData);
        if (Array.isArray(out) && out.length > 0) return out;

        // Fallback: بناء اقتراحات من SmartAdvisor.analyze
        try {
            const analyzed = this.analyze(financials, inputs);
            const insights = analyzed?.insights || [];
            return insights.map(i => ({
                action: i.action || '—',
                message: i.message || '',
                category: i.category || 'عام'
            }));
        } catch (e) {
            console.warn('SmartAdvisor getOptimizationSuggestions fallback failed', e);
            return [{ action: 'مراجعة الافتراضات وإعادة الحساب.', message: 'لم تتوفر اقتراحات تحسين من الخادم. راجع التكاليف والإيرادات والمؤشرات.', category: 'عام' }];
        }
    }

    /**
     * Ask the brain: "What price do I need for X margin?"
     * عند فشل الخادم (null): تقدير داخلي: suggestedPrice = variableCostPerUnit / (1 - targetMargin)
     * @param {Object} inputs Full project state/inputs
     * @param {number} [targetMargin=0.20]
     * @returns {{ suggestedPrice: number, formula: string, source: string, variableCostUsed?: number }|null}
     */
    static async getReverseEngineering(inputs, targetMargin = 0.20) {
        const { aiConnector } = await import('./AIConnector.js');
        let out = await aiConnector.reverseEngineerPrice(inputs, targetMargin);
        if (out != null && (typeof out?.suggestedPrice === 'number' || out?.suggested_price != null)) {
            return { suggestedPrice: out.suggestedPrice ?? out.suggested_price, formula: out.formula || 'خادم', source: 'server', variableCostUsed: out.variableCostUsed ?? out.variable_cost_used };
        }

        // Fallback: تقدير سعر من أول مصدر إيرادات
        const m = Math.max(0, Math.min(1, targetMargin));
        const streams = inputs?.revenue?.streams || inputs?.revenue?.revenueStreams || [];
        const items = inputs?.services?.items || [];
        const first = streams[0] || items[0];
        if (!first) {
            return { suggestedPrice: 0, formula: 'تكلفة/(1-هامش)', source: 'internal', note: 'أضف مصدر إيرادات أو خدمة لإجراء العكس الهندسي.' };
        }
        const avgPrice = Number(first.avgPrice ?? first.pricePerUnit) || 100;
        let vc = Number(first.variableCostPerUnit) || 0;
        if (vc <= 0) vc = avgPrice * 0.35;
        const denom = 1 - m;
        const suggested = denom > 0 ? vc / denom : avgPrice;
        return { suggestedPrice: Math.round(suggested * 100) / 100, formula: 'تكلفة/(1-هامش)', source: 'internal', variableCostUsed: vc };
    }
}

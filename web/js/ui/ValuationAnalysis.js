/**
 * Company Valuation Component
 * Calculates Pre-money and Post-money valuation using DCF and Multiples
 */
import { calculateStudy as runFullModel } from '../core/engine.js';

export class ValuationAnalysis {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    render() {
        const state = this.store.get();
        let results = null;
        try {
            results = runFullModel(state);
        } catch (e) {
            console.error('Financial Model Error:', e);
        }

        const valuation = this.calculateValuation(state, results);
        // مبلغ الاستثمار المطلوب يأتي من خطوة التمويل — إن كان فارغاً تظهر الحصة 0% والتقييم بعد التمويل صفراً بلا تفسير
        const investmentMissing = !((state.financing?.totalInvestment || 0) > 0);

        this.container.innerHTML = `
            <div class="valuation-container animate-entry">
                <div class="section-header">
                    <h2 class="text-xl font-bold">تقييم الشركة</h2>
                    <p class="text-muted">تقدير القيمة السوقية العادلة للمشروع لجذب المستثمرين أو تحديد حصص الشركاء.</p>
                </div>

                <div class="grid-2-col gap-4">
                    <!-- DCF Card -->
                    <div class="card glass-card">
                        <div class="flex-between mb-2">
                            <h3 class="card-title">طريقة التدفقات المخصومة (DCF)</h3>
                            <span class="badge badge-gold">الأكثر دقة</span>
                        </div>
                        <div class="valuation-hero">
                            <span class="val-label">قيمة المنشأة</span>
                            <span class="val-price text-gold">${this.formatCurrency(valuation.dcf.ev)}</span>
                        </div>
                        <div class="valuation-details mt-4">
                            <div class="val-row"><span>معدل خصم التقييم (معدل خصم دراستك + علاوة حجم وسيولة)</span> <span>${(valuation.dcf.wacc * 100).toFixed(1)}%</span></div>
                            <div class="val-row"><span>معدل النمو الأبدي</span> <span>${(valuation.dcf.growth * 100).toFixed(1)}%</span></div>
                            <div class="val-row"><span>مجموع القيمة الحالية للأرباح</span> <span>${this.formatCurrency(valuation.dcf.pvCashFlows)}</span></div>
                            <div class="val-row"><span>القيمة المتبقية (Terminal Value)</span> <span>${this.formatCurrency(valuation.dcf.terminalValue)}</span></div>
                            <div class="val-row"><span>(-) رصيد القرض البنكي</span> <span>${this.formatCurrency(valuation.dcf.bankLoan)}</span></div>
                            <div class="val-row"><span><strong>قيمة حقوق الملكية (بعد خصم الدَّين)</strong></span> <span><strong>${this.formatCurrency(valuation.dcf.equityValue)}</strong></span></div>
                            <div class="val-row"><span>المضاعف الضمني (قيمة المنشأة ÷ أرباح السنة 1)</span> <span>${(valuation.dcf.impliedMultiple || 0).toFixed(1)}×</span></div>
                        </div>
                        <p class="text-xs text-muted mt-2">معدل الخصم يشمل علاوة حجم وسيولة لمنشأة صغيرة خاصة؛ القيمة محسوبة على التدفق النقدي بعد الزكاة/الضريبة وإحلال الأصول.</p>
                        <div class="wacc-disclosure alert alert--warning mt-3" style="font-size: 0.85rem;">
                            ⚠️ هذا الرقم إعلامي لمرجعك الشخصي فقط، ولا يُغذّي تلقائياً معدل الخصم الفعلي المستخدم لحساب
                            صافي القيمة الحالية (NPV) والعائد الداخلي (IRR) في هذه الدراسة — ذلك المعدل يُضبط بشكل منفصل
                            ضمن افتراضات الدراسة/الإعدادات المالية. إن رغبت في اعتماد هذا الرقم، انسخه يدوياً إلى حقل
                            «معدل الخصم» هناك.
                        </div>
                        <div class="alert alert--info mt-3" style="font-size: 0.85rem;">
                            <strong>كيف يجتمع تقييم موجب مع NPV سالبة؟</strong> التقييم يقيس قيمة <em>التشغيل المستقبلي</em>
                            لمشروع قائم (بلا خصم استثمار التأسيس)، بينما صافي القيمة الحالية تجيب سؤالاً آخر:
                            «هل يستحق ضخ الاستثمار أصلاً؟» بعد خصمه بالكامل. إن كانت NPV سالبة فقيمة التشغيل
                            أدنى من كلفة إنشائه — راجع قرار الجدوى قبل التفاوض على أي حصص.
                        </div>
                    </div>

                    <!-- Multipliers Card -->
                    <div class="card glass-card">
                        <h3 class="card-title">تقييم مضاعفات السوق</h3>
                        <div class="valuation-hero">
                            <span class="val-label">القيمة بناءً على الأرباح قبل الفوائد والضرائب (EBITDA)</span>
                            <span class="val-price">${this.formatCurrency(valuation.multiples.ev)}</span>
                        </div>
                        <div class="valuation-details mt-4">
                            <div class="val-row"><span>مضاعف الأرباح</span> <span>${valuation.multiples.multiple}x</span></div>
                            <div class="val-row"><span>الأرباح السنوية (السنة 1)</span> <span>${this.formatCurrency(valuation.multiples.ebitda)}</span></div>
                            <div class="val-row"><span>مقارنة بمتوسط السوق</span> <span>مقبول</span></div>
                        </div>
                    </div>
                </div>

                <!-- Investment Terms -->
                <div class="card glass-card mt-4 investment-terms-card">
                    <h3 class="card-title text-center">🎯 بطاقة المستثمر</h3>
                    <div class="investor-terms-grid">
                        <div class="term-box">
                            <span class="term-label">التقييم قبل التمويل (Pre-money)</span>
                            <span class="term-value">${this.formatCurrency(valuation.dcf.equityValue)}</span>
                        </div>
                        <div class="term-box highlight">
                            <span class="term-label">الاستثمار المطلوب</span>
                            <span class="term-value text-gold">${this.formatCurrency(state.financing?.totalInvestment || 0)}</span>
                        </div>
                        <div class="term-box">
                            <span class="term-label">التقييم بعد التمويل (Post-money)</span>
                            <span class="term-value">${this.formatCurrency(valuation.postMoney)}</span>
                        </div>
                        <div class="term-box">
                            <span class="term-label">الحصة المقابلة للاستثمار</span>
                            <span class="term-value">${valuation.equityOffer.toFixed(1)}%</span>
                        </div>
                    </div>
                    ${investmentMissing ? `<div class="alert alert--warning mt-4">لم يُدخل مبلغ الاستثمار المطلوب بعد، لذا تظهر «الحصة المقابلة» و«التقييم بعد التمويل» أصفاراً. انتقل إلى خطوة «مصادر وهيكلة التمويل» وأدخل إجمالي الاستثمار المطلوب لحساب الحصة والتقييم بدقة.</div>` : ''}
                    <div class="valuation-tip mt-4">
                        <p>💡 <strong>نصيحة:</strong> إذا قمت ببيع حصة <strong>${valuation.equityOffer.toFixed(1)}%</strong> مقابل <strong>${this.formatCurrency(state.financing?.totalInvestment || 0)}</strong>، فإنك تقيّم حقوق ملكية مشروعك حالياً بـ <strong>${this.formatCurrency(valuation.dcf.equityValue)}</strong> قبل دخول المستثمر.</p>
                    </div>
                </div>
            </div>
        `;
    }

    calculateValuation(state, results) {
        if (!results || !Array.isArray(results.incomeStatement) || results.incomeStatement.length === 0) {
            return { dcf: { ev: 0, wacc: 0.18, growth: 0.02, pvCashFlows: 0, terminalValue: 0 }, multiples: { ev: 0, multiple: 3, ebitda: 0 }, postMoney: 0, equityOffer: 0, impliedMultiple: 0, bankLoan: 0 };
        }

        // B4: معدل الخصم من فروض الدراسة نفسها + علاوة حجم وسيولة لمنشأة صغيرة خاصة
        // (كان 12% مصمتاً — أقل بكثير من العائد المطلوب لمقهى صغير، فينتفخ التقييم).
        const baseRate = Number(state.assumptions?.discountRate || results.assumptionsApplied?.discountRate || 0.10);
        const wacc = Math.max(baseRate + 0.08, 0.18);
        const growth = Math.min(0.02, Math.max(0, wacc - 0.02)); // نمو مستدام مقصوص تحت معدل الخصم

        // 1. DCF على التدفق النقدي الحر «غير المرفوع» (unlevered): نعيد الفائدة لأن رصيد القرض
        //    يُخصم مستقلاً في قيمة حقوق الملكية أدناه — كان يخصم تدفقات بعد الفائدة ثم يطرح
        //    الدين ثانية = تحميل مزدوج لعبء الدين داخل التقييم نفسه (تدقيق ٢٠٢٦-٠٧-٠٦).
        //    (درع الفائدة الزكوي شبه معدوم — إعادة الفائدة كاملة تقريب مقبول ومتحفظ الاتجاه.)
        const fcfOf = (year) => (Number(year.netIncome) || 0) + (Number(year.interest) || 0) + (Number(year.depreciation) || 0) - (Number(year.replacementCost) || 0);
        let pvCashFlows = 0;
        results.incomeStatement.forEach((year, i) => {
            pvCashFlows += fcfOf(year) / Math.pow(1 + wacc, i + 1);
        });

        const fcfLast = fcfOf(results.incomeStatement[results.incomeStatement.length - 1]);
        const terminalValue = fcfLast > 0 ? (fcfLast * (1 + growth)) / (wacc - growth) : 0;
        const pvTerminal = terminalValue / Math.pow(1 + wacc, results.incomeStatement.length);

        const enterpriseValue = Math.max(0, pvCashFlows + pvTerminal);

        // 2. مضاعف السوق — نطاق واقعي لمطعم/مقهى صغير في السعودية (≈2–3.5×)، كان 6× مبالغاً
        const ebitdaY1 = results.incomeStatement[0].ebitda;
        const multiple = 3;
        const multipleValue = Math.max(0, ebitdaY1 * multiple);

        // 3. صافي الدَّين: قيمة حقوق الملكية = قيمة المنشأة − رصيد القرض (لا تُعرض القيمة قبل خصم الدين كقيمة للمالك)
        const bankLoan = Number(state.financing?.sources?.bankLoan?.amount || results.loanSchedule?.loanAmount || 0);
        const equityValue = Math.max(0, enterpriseValue - bankLoan);
        const impliedMultiple = ebitdaY1 > 0 ? enterpriseValue / ebitdaY1 : 0;

        // 4. حسابيات جولة الاستثمار — على أساس قيمة حقوق الملكية (قبل ضخّ المستثمر)
        const investment = state.financing?.totalInvestment || 0;
        const postMoney = equityValue + investment;
        const equityOffer = postMoney > 0 ? (investment / postMoney) * 100 : 0;

        return {
            dcf: {
                ev: enterpriseValue,
                equityValue,
                impliedMultiple,
                bankLoan,
                wacc,
                growth,
                pvCashFlows,
                terminalValue
            },
            multiples: {
                ev: multipleValue,
                multiple,
                ebitda: ebitdaY1
            },
            postMoney,
            equityOffer,
            impliedMultiple,
            bankLoan
        };
    }

    formatCurrency(n) {
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
    }
}

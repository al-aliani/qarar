/**
 * Investor Analysis / تحليل الجدوى الاستثمارية
 * يُقيّم المشروع من منظور المستثمر: الجاذبية، الجاهزية، ومعايير القرار.
 * أفكار مختلفة عن "مقارنة مصادر التمويل": درجة الجاذبية، قائمة الجاهزية،
 * معايير المستثمر vs مشروعك، مقارنة ديون/أسهم، مسارات الخروج.
 */
import { calculateStudy as runFullModel } from '../core/engine.js';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

export class InvestorAnalysis {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
    }

    render() {
        const state = this.store.getState ? this.store.getState() : this.store.get();
        let results = null;
        try {
            results = runFullModel(state);
        } catch (e) {
            console.warn('InvestorAnalysis: runFullModel failed', e);
        }

        const ind = results?.indicators || {};
        const npv = ind.npv ?? 0;
        const irr = ind.irr ?? 0;
        const payback = ind.paybackPeriod ?? ind.payback ?? 999;
        const roi = ind.roi ?? 0;
        const profitMargin = ind.profitMargin ?? 0;
        // تدقيق 2026-07-08: ind.discountRateUsed غير موجود إطلاقاً في مخرجات المحرك
        // فكان يسقط دائماً لـ10% الثابتة متجاهلاً علاوة المخاطر الفعلية (حتى +8%) —
        // الحقل الصحيح results.assumptionsApplied.discountRate (يشمل العلاوة فعلياً).
        const discountRate = results?.assumptionsApplied?.discountRate ?? 0.10;
        // مصدر وحيد لعتبة الاسترداد (كانت 7 ثابتة هنا بينما الفعلية 3.5 في محرك القرار
        // — تناقض مباشر: ✓ أخضر هنا لمشروع يرفضه القرار الحقيقي REVISE/NO-GO).
        const maxPayback = results?.assumptionsApplied?.thresholds?.maxPayback ?? 3.5;
        // نفس المصدر الموحّد لعتبة ROI (كانت 15% ثابتة هنا مختلفة عن minROI=20% الفعلية).
        const minROI = results?.assumptionsApplied?.thresholds?.minROI ?? 0.20;
        const breakeven = ind.breakEvenUnits ?? ind.breakevenUnitsPerMonth;

        const tam = state.marketSizing?.tam?.value ?? 0;
        const som = state.marketSizing?.som?.value ?? 0;
        const hasMarket = (tam > 0 || som > 0);
        // بند «سجل مخاطر» يفحص سجل المخاطر الفعلي فقط — كان يتحقق زوراً بوجود منافسين
        // (السوق له بند مستقل «hasMarket» أعلاه) فيمنح ✓ لدراسة بلا أي تحليل مخاطر فعلي.
        const risks = state.riskAnalysis?.risks || [];
        const hasRisks = Array.isArray(risks) && risks.length > 0;
        const hasProjectInfo = !!(state.projectInfo?.name || state.projectInfo?.concept);

        const score = this.calcInvestabilityScore({ npv, irr, payback, roi, profitMargin, hasMarket, hasRisks, hasProjectInfo, discountRate, maxPayback, minROI });
        const checklist = this.buildReadinessChecklist(state, results, { npv, irr, payback, hasMarket, hasRisks, discountRate, maxPayback });
        const criteria = this.buildInvestorCriteriaTable({ npv, irr, payback, roi, profitMargin, tam, som, discountRate, maxPayback, minROI });

        this.container.innerHTML = `
            <div class="investor-analysis animate-entry">
                <h2 class="section-title">تحليل الجدوى الاستثمارية</h2>
                <p class="text-muted mb-4">تقييم المشروع من منظور المستثمر: درجة الجاذبية، قائمة الجاهزية، ومعايير القرار.</p>

                <!-- درجة الجاذبية -->
                <div class="card mb-4">
                    <h3 class="text-gold mb-2">${icon('i-chart')} درجة الجاذبية الاستثمارية</h3>
                    <div class="flex items-center gap-4 flex-wrap">
                        <div class="investability-gauge" style="width:100px;height:100px;flex-shrink:0;">
                            <svg viewBox="0 0 100 100" class="w-full h-full" style="transform:rotate(-90deg)">
                                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--c-bg-app)" stroke-width="10"/>
                                <circle cx="50" cy="50" r="42" fill="none" stroke="${score.color}" stroke-width="10"
                                    stroke-dasharray="${264}" stroke-dashoffset="${264 - (264 * score.percent / 100)}"
                                    stroke-linecap="round"/>
                            </svg>
                            <div style="position:relative;margin-top:-70px;text-align:center;font-size:1.25rem;font-weight:700;color:var(--c-text-main);">${score.percent}</div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm text-muted mb-2">${score.label}</p>
                            <div class="rounded-full h-2 mb-2" style="max-width:280px;background:var(--c-bg-app);">
                                <div class="h-2 rounded-full transition-all" style="width:${score.percent}%;background:${score.color};"></div>
                            </div>
                            ${score.gaps.length > 0 ? `<p class="text-xs text-muted">يعزّز الجاذبية: ${score.gaps.join('، ')}</p>` : ''}
                        </div>
                    </div>
                </div>

                <!-- قائمة الجاهزية -->
                <div class="card mb-4">
                    <h3 class="text-gold mb-3">${icon('i-check')} قائمة الجاهزية للمستثمر</h3>
                    <div class="investor-readiness-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
                        ${checklist.map(c => `
                            <div class="flex items-center gap-2 text-sm ${c.ok ? 'text-success' : 'text-muted'}">
                                <span>${c.ok ? icon('i-check') : '○'}</span>
                                <span>${c.label}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- معايير المستثمر vs مشروعك -->
                <div class="card mb-4">
                    <h3 class="text-gold mb-3">${icon('i-clipboard')} معايير المستثمر مقابل مشروعك</h3>
                    <div class="table-wrapper">
                        <table class="service-comparison-table" style="font-size:0.8rem;">
                            <thead><tr><th>المعيار</th><th>عتبة نموذجية</th><th>وضعك</th><th>ملاحظة</th></tr></thead>
                            <tbody>
                                ${criteria.map(c => `
                                    <tr>
                                        <td>${c.name}</td>
                                        <td class="text-mono">${c.threshold}</td>
                                        <td class="text-mono ${c.ok ? 'text-success' : 'text-muted'}">${c.yours}</td>
                                        <td class="text-muted" style="font-size:0.75rem;">${c.note}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ديون vs أسهم (منظور المؤسس) -->
                <div class="card mb-4">
                    <h3 class="text-gold mb-3">${icon('i-scale')} مقارنة الديون والأسهم (منظورك كمؤسس)</h3>
                    <div class="table-wrapper">
                        <table class="service-comparison-table" style="font-size:0.85rem;">
                            <thead><tr><th>الاعتبار</th><th>تمويل بالديون (بنك/كفالة)</th><th>تمويل بالأسهم (ملاك/VC)</th></tr></thead>
                            <tbody>
                                <tr><td>التكلفة عليك</td><td>فائدة محددة، لا تخفّض حصتك</td><td>تخفيض الحصة، قد تخسر السيطرة لاحقاً</td></tr>
                                <tr><td>السيطرة</td><td>تبقى مسيطراً مع الالتزام بالأقساط</td><td>مشاركة في القرار حسب حجم الحصة</td></tr>
                                <tr><td>المخاطرة</td><td>ضمانات وأقساط ثابتة حتى إن خسر المشروع</td><td>المستثمر يتحمل الخسارة معك، لا أقساط دورية</td></tr>
                                <tr><td>الملاءمة لمشروعك</td><td>مناسب إن كان التدفق النقدي متوقعاً ومستقراً (NPV موجب)</td><td>مناسب للنمو السريع أو عند ضعف الضمانات</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- مسارات الخروج -->
                <div class="card mb-4">
                    <h3 class="text-gold mb-2">${icon('i-link')} مسارات الخروج للمستثمر</h3>
                    <p class="text-muted text-sm mb-3">المستثمر يقدّر المشاريع التي تملك خيار خروج واضح:</p>
                    <ul class="text-sm space-y-2 text-muted" style="list-style:disc;padding-right:1.25rem;">
                        <li><strong style="color:var(--c-text-main)">البيع للطرف الثالث:</strong> بعد 5–7 سنوات إن تحققت النمو والإيرادات.</li>
                        <li><strong style="color:var(--c-text-main)">الاكتتاب أو الطرح:</strong> للمشاريع الكبيرة ذات النمو العالي والسوق الواسع.</li>
                        <li><strong style="color:var(--c-text-main)">جني الأرباح (أرباح موزعة):</strong> مناسِب للمشاريع الربحية المستقرة التي لا تستهدف بيعاً سريعاً.</li>
                        <li><strong style="color:var(--c-text-main)">استحواذ أو اندماج:</strong> عندما يصبح المشروع مكمّلاً لشركة كبرى.</li>
                    </ul>
                </div>

                <!-- توصية مبنية على الأرقام -->
                <div class="card" style="border-right:4px solid var(--c-p-500);">
                    <h3 class="text-gold mb-2">${icon('i-lightbulb')} توصية مبنية على أرقامك</h3>
                    <p>${this.getEvidenceBasedRecommendation(results, { npv, irr, payback, maxPayback, decision: results?.decision }, state)}</p>
                </div>
            </div>
        `;
    }

    calcInvestabilityScore(ctx) {
        let p = 0;
        const gaps = [];
        if (ctx.npv > 0) p += 20; else gaps.push('تحسين NPV (صافي القيمة الحالية)');
        if (ctx.irr > (ctx.discountRate || 0.10)) p += 15; else if (ctx.irr != null) gaps.push('رفع IRR فوق معدل الخصم');
        // عتبة الاسترداد موحّدة فعلياً مع maxPayback الحقيقي في محرك القرار (engine.js عبر
        // assumptionsApplied.thresholds) — لا رقم مستقل (كانت 7 ثابتة هنا بينما الفعلية 3.5).
        if (ctx.payback < ctx.maxPayback && ctx.payback >= 0) p += 15; else if (ctx.payback >= 0) gaps.push('تقليل فترة الاسترداد');
        if (ctx.roi > (ctx.minROI ?? 0.20)) p += 10; else if (ctx.roi != null && ctx.roi > 0) gaps.push('تحسين العائد على الاستثمار');
        if (ctx.profitMargin > 0.10) p += 10; else gaps.push('تحسين هامش الربح');
        if (ctx.hasMarket) p += 15; else gaps.push('تحديد حجم السوق TAM/SAM/SOM');
        if (ctx.hasRisks) p += 10; else gaps.push('توثيق تحليل المخاطر');
        if (ctx.hasProjectInfo) p += 5;
        const percent = Math.min(100, Math.round(p));
        let color = '#22c55e';
        if (percent < 40) color = '#ef4444';
        else if (percent < 70) color = '#8a5f1c';
        let label = 'جاذبية منخفضة — يحتاج تعزيز عدة معايير';
        if (percent >= 70) label = 'جاذبية جيدة — المشروع مؤهل لعرضه على مستثمرين مدروسين';
        else if (percent >= 50) label = 'جاذبية متوسطة — التركيز على الفجوات أعلاه يرفع الفرص';
        return { percent, color, label, gaps };
    }

    buildReadinessChecklist(state, results, ctx) {
        const rev = (results?.incomeStatement || [])[0]?.revenue;
        const net = (results?.incomeStatement || [])[0]?.netIncome;
        return [
            { label: 'نموذج مالي مكتمل (إيرادات وتكاليف)', ok: !!results && typeof rev === 'number' },
            { label: 'صافي القيمة الحالية (NPV) موجب', ok: ctx.npv > 0 },
            { label: 'معدل العائد الداخلي (IRR) فوق معدل الخصم', ok: ctx.irr != null && ctx.irr > (ctx.discountRate ?? 0.10) },
            { label: `فترة استرداد معقولة (&lt; ${ctx.maxPayback} سنوات)`, ok: ctx.payback >= 0 && ctx.payback < ctx.maxPayback },
            { label: 'وجود نقطة تعادل أو خطة لها', ok: results?.indicators?.breakEvenUnits != null || results?.indicators?.breakevenUnitsPerMonth != null || (state.assumptions || {}).projectionYears > 0 },
            { label: 'تحليل منافسين أو سوق', ok: ctx.hasMarket || (state.marketing?.competitors || []).length > 0 },
            { label: 'سجل مخاطر أو تحليل مخاطر', ok: ctx.hasRisks },
            { label: 'بيانات مشروع وتعريف واضح', ok: !!(state.projectInfo?.name || state.projectInfo?.concept) },
        ];
    }

    buildInvestorCriteriaTable(ctx) {
        const dr = (ctx.discountRate ?? 0.10) * 100;
        return [
            { name: 'NPV', threshold: '> 0', yours: (ctx.npv ?? 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 }), ok: (ctx.npv ?? 0) > 0, note: (ctx.npv ?? 0) > 0 ? 'مقبول' : 'يُفضّل تحسين التدفقات أو تخفيف التكاليف' },
            { name: 'IRR', threshold: `> ${dr}% (معدل الخصم)`, yours: ctx.irr != null ? (ctx.irr * 100).toFixed(1) + '%' : '--', ok: (ctx.irr ?? 0) > (ctx.discountRate ?? 0.1), note: 'المستثمر يفضّل عائداً أعلى من تكلفة رأس المال' },
            { name: 'فترة الاسترداد', threshold: `< ${ctx.maxPayback} سنوات`, yours: ctx.payback != null && ctx.payback < 100 ? ctx.payback.toFixed(1) + ' سنة' : '--', ok: ctx.payback >= 0 && ctx.payback < ctx.maxPayback, note: 'استرداد أطول يقلل الجاذبية لرأس المال الجريء' },
            { name: 'العائد على الاستثمار (ROI)', threshold: `> ${((ctx.minROI ?? 0.20) * 100).toFixed(0)}%`, yours: ctx.roi != null ? (ctx.roi * 100).toFixed(1) + '%' : '--', ok: (ctx.roi ?? 0) > (ctx.minROI ?? 0.20), note: 'مؤشر على كفاءة استخدام رأس المال' },
            { name: 'هامش الربح (تقريبي)', threshold: '> 10%', yours: ctx.profitMargin != null ? (ctx.profitMargin * 100).toFixed(1) + '%' : '--', ok: (ctx.profitMargin ?? 0) > 0.1, note: 'يعكس قوة نموذج الإيرادات والتكاليف' },
            { name: 'حجم السوق (TAM/SOM)', threshold: 'محدّد وواقعي', yours: (ctx.tam > 0 || ctx.som > 0) ? 'مُدخل' : 'غير محدد', ok: ctx.tam > 0 || ctx.som > 0, note: 'المستثمر يقدّر السوق القابل للتحقق' },
        ];
    }

    getEvidenceBasedRecommendation(results, ctx, state) {
        const npv = ctx.npv ?? 0;
        const irr = ctx.irr ?? 0;
        const payback = ctx.payback ?? 999;
        if (!results) return 'أكمل إدخال البيانات المالية وتشغيل النموذج لعرض توصية مبنية على الأرقام.';
        // القرار من المحرك حصراً — لا نصنع قراراً محلياً بعتبة موازية قد تناقض لوحة القرار
        // (المصدر الوحيد للحقيقة engine.js: minIRR/maxPayback الفعليين لا 5% ثابتة)
        const decision = ctx.decision || null;
        if (!decision) return 'تعذّر استخراج القرار — أكمل بيانات الدراسة (الإيرادات، التكاليف، التمويل).';
        const cap = state.financing?.totalInvestment ?? results?.capex?.total ?? 0;

        const npvStr = npv >= 1e6 ? (npv/1e6).toFixed(2) + ' مليون' : (npv/1e3).toFixed(0) + ' ألف';
        if (decision === 'GO' && npv > 0) {
            if (cap >= 2000000) return `مشروعك يحقق NPV موجباً (حوالي ${npvStr} ريال) وعائداً داخلياً جيداً—<strong>ملائم لعرضه على صناديق أو رأس مال جريء</strong> إن كان النمو والتوسع ضمن الأهداف.`;
            if (cap >= 500000) return `الأرقام تدعم الجدوى: NPV موجب (حوالي ${npvStr}) وIRR مقبول—<strong>ملائم لعرضه على مستثمر ملائكي أو تمويل مختلط (ديون + حصة)</strong> مع التركيز على خطة النمو.`;
            return `مشروعك يظهر جدوى مالية (NPV موجب، حوالي ${npvStr})—<strong>مناسب للتمويل البنكي أو برامج الدعم (كفالة، بنك المنشآت)</strong> إن توفرت الضمانات، أو التمويل الذاتي لتجنّب الديون.`;
        }

        if (npv <= 0 && payback > (ctx.maxPayback ?? 3.5)) return 'صافي القيمة الحالية غير إيجابي وفترة الاسترداد طويلة—<strong>يُنصح بمراجعة التكاليف والإيرادات وتحسين الفروض</strong> قبل التوجه لمستثمر. زيادة الأسعار أو خفض التكاليف الثابتة قد تُحسّن النتيجة.';
        if (npv <= 0) return 'NPV سالب—<strong>اعمل على تحسين التدفقات النقدية أو خفض الاستثمار الأولي والتشغيل</strong> قبل العرض على مستثمر. تحليل نقطة التعادل والحساسية يساعد.';
        return 'بناءً على أرقامك الحالية، ركّز على <strong>تعزيز النموذج المالي وإكمال قائمة الجاهزية</strong> أعلاه لرفع درجة الجاذبية ثم العودة لتحديد المصدر الأنسب (بنك، ملاك، أو ذاتي).';
    }
}

/**
 * Investor Analysis / تحليل الجدوى الاستثمارية
 * يُقيّم المشروع من منظور المستثمر: الجاذبية، الجاهزية، ومعايير القرار.
 * أفكار مختلفة عن "مقارنة مصادر التمويل": درجة الجاذبية، قائمة الجاهزية،
 * معايير المستثمر vs مشروعك، مقارنة ديون/أسهم، مسارات الخروج.
 */
import { calculateStudy as runFullModel, rateOrDefault } from '../core/engine.js';
import { hasMinimumRevenueData, hasMinimumFinancialData } from '../utils/dataSufficiency.js';
import { escapeHtml as esc } from '../utils/escape.js';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

// عرض عتبة/قيمة كاسر المحرك رقمياً كما هي — الوحدة يوضّحها نص الشرح المرافق (من المحرك
// نفسه)، فلا نخمّن وحدة رقم لا نملك تعريفها هنا (ريال؟ مرة؟ عميل/شهر؟).
const issueNum = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString('ar-SA', { maximumFractionDigits: 2 }) : '—';
};

// تسمية القرار بالعربية — مصدر واحد يستهلكه البانر وقائمة الجاهزية وجدول المعايير،
// فلا يظهر الرمز اللاتيني GO/REVISE في واجهة عربية (وهو أيضاً عرضة لـarabize rewriter).
const decisionLabel = (d) => (d === 'GO' ? 'المشروع مجدٍ' : (d === 'REVISE' ? 'المشروع يحتاج مراجعة' : 'المشروع غير مجدٍ'));

// عتبات تسمية الجاذبية — مصدر واحد تُشتقّ منه أسقف القرار في calcInvestabilityScore،
// فلا يمكن بنيوياً أن تُفلت تسمية «مؤهل لعرضه على مستثمرين» فوق قرار المحرك.
const GOOD_ATTRACTIVENESS_MIN = 70;
const MEDIUM_ATTRACTIVENESS_MIN = 50;

export class InvestorAnalysis {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
    }

    render() {
        const state = this.store.getState ? this.store.getState() : this.store.get();

        // بوابة كفاية البيانات — نفس المزدوجة المعتمدة في لوحة القرار
        // (DecisionDashboard.js:54-56) ولوحة المؤشرات المالية. بدونها كانت هذه الشاشة
        // وحدها بين خمس شاشات تُصدر على دراسة فارغة تماماً: درجة جاذبية، و✓ خضراء على
        // «نموذج مالي مكتمل»، وتوصية نصية «راجع التكاليف والإيرادات قبل التوجه لمستثمر»
        // — حكم على أصفار من شاشة سؤالها الوحيد «هل أنا جاهز للمستثمر؟».
        if (!hasMinimumRevenueData(state) || !hasMinimumFinancialData(state)) {
            this.container.innerHTML = `
                <div class="investor-analysis animate-entry">
                    <h2 class="section-title">تحليل الجدوى الاستثمارية</h2>
                    <div class="card">
                        <div class="alert alert--warning" role="alert">
                            <p><strong>${icon('i-warning')} بيانات غير كافية — لا يمكن تقييم جاهزيتك للمستثمر بعد.</strong></p>
                            <p class="text-sm mt-2">درجة الجاذبية وقائمة الجاهزية تُحسبان من أرقامك الفعلية؛ بلا إيرادات وتكاليف مُدخَلة تكون كل المؤشرات أصفاراً معوَّضة لا نتائج. أكمل:</p>
                            <ul class="text-sm mt-2" style="list-style: disc; padding-right: 20px;">
                                <li>مصادر الإيرادات (خطوة "مصادر الإيرادات")</li>
                                <li>التكاليف الرأسمالية (خطوة "الدراسة الفنية")</li>
                                <li>التكاليف التشغيلية (خطوات "الموارد البشرية" و"اللوجستية" و"الإدارية")</li>
                                <li>هيكل التمويل (خطوة "مصادر وهيكلة التمويل")</li>
                            </ul>
                        </div>
                    </div>
                </div>`;
            return;
        }

        let results = null;
        try {
            results = runFullModel(state);
        } catch (e) {
            console.warn('InvestorAnalysis: runFullModel failed', e);
        }

        const ind = results?.indicators || {};
        const npv = ind.npv ?? 0;
        const irr = ind.irr ?? null; // نُبقي null (لا نسحقه لصفر): الدوال المستهلِكة تحرس بـ irr != null
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

        // القرار الرسمي من المحرك — المصدر الوحيد لجواب «هل أعرضه على مستثمر؟».
        const decision = results?.decision || null;
        const decisionReasons = (results?.decisionReasons || [])
            .map(r => (typeof r === 'string' ? r : (r?.text || r?.reason || '')))
            .filter(Boolean);

        // كاسرات القرار من المحرك مفهرسة بالمقياس — تُسقِط بند الشاشة المقابل مهما قال
        // حسابه المحلي، وما لا يقابله بند يُضاف بنداً/صفاً مستقلاً غير مُحقَّق.
        const blockers = this.buildEngineBlockers(results);

        const score = this.calcInvestabilityScore({ npv, irr, payback, roi, profitMargin, hasMarket, hasRisks, hasProjectInfo, discountRate, maxPayback, minROI, decision });
        const checklist = this.buildReadinessChecklist(state, results, { npv, irr, payback, hasMarket, hasRisks, discountRate, maxPayback, blockers, decision, decisionReasons });
        const criteria = this.buildInvestorCriteriaTable({ npv, irr, payback, roi, profitMargin, tam, som, discountRate, maxPayback, minROI, blockers, decision, decisionReasons });

        this.container.innerHTML = `
            <div class="investor-analysis animate-entry">
                <h2 class="section-title">تحليل الجدوى الاستثمارية</h2>
                <p class="text-muted mb-4">تقييم المشروع من منظور المستثمر: درجة الجاذبية، قائمة الجاهزية، ومعايير القرار.</p>

                ${this.renderDecisionBanner(decision, decisionReasons)}

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
                            <div class="flex items-start gap-2 text-sm ${c.ok ? 'text-success' : 'text-muted'}">
                                <span>${c.ok ? icon('i-check') : '○'}</span>
                                <span>${c.label}${c.blocker ? `<span class="block text-xs text-danger mt-1">${esc(c.blocker.explanation)}</span>` : ''}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- معايير المستثمر vs مشروعك -->
                <div class="card mb-4">
                    <h3 class="text-gold mb-3">${icon('i-clipboard')} معايير المستثمر مقابل مشروعك</h3>
                    <div class="table-wrapper">
                        <table class="service-comparison-table investor-criteria-table" style="font-size:0.8rem;">
                            <thead><tr><th>المعيار</th><th>عتبة نموذجية</th><th>وضعك</th><th>ملاحظة</th></tr></thead>
                            <tbody>
                                ${criteria.map(c => `
                                    <tr>
                                        <td>${c.name}</td>
                                        <td class="text-mono">${c.threshold}</td>
                                        <td class="text-mono ${c.ok ? 'text-success' : 'text-muted'}">${c.yours}</td>
                                        <td class="${c.blocker ? 'text-danger' : 'text-muted'}" style="font-size:0.75rem;">${c.note}</td>
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
                    <p>${this.getEvidenceBasedRecommendation(results, { npv, decision }, state)}</p>
                </div>
            </div>
        `;
    }

    /**
     * قرار المحرك وأسبابه حرفياً أعلى الشاشة — نفس المصدر الذي تقرأه
     * FinancialDashboard.js ولوحة القرار. بدونه كانت الشاشة تُخفي أسباب الرفض تماماً
     * (فجوة تمويل بالملايين، DSCR، ميزانية غير متوازنة) وتعرض «مؤهل لعرضه على مستثمرين».
     */
    renderDecisionBanner(decision, reasons) {
        if (!decision) return '';
        const label = decisionLabel(decision);
        const cls = decision === 'GO' ? 'is-go' : (decision === 'REVISE' ? 'is-revise' : 'is-nogo');
        const showReasons = decision !== 'GO' && reasons.length > 0;
        return `
            <div class="decision-banner ${cls}"><div class="decision-label">${label}</div></div>
            ${showReasons ? `
                <div class="card mb-4 investor-decision-reasons">
                    <h3 class="text-gold mb-2">${icon('i-warning')} ما يمنع عرض المشروع على مستثمر الآن</h3>
                    <ul class="text-sm space-y-2" style="list-style:disc;padding-right:1.25rem;">
                        ${reasons.map(r => `<li>${esc(r)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        `;
    }

    calcInvestabilityScore(ctx) {
        let p = 0;
        const gaps = [];
        if (ctx.npv > 0) p += 20; else gaps.push('تحسين NPV (صافي القيمة الحالية)');
        // rateOrDefault لا `||`: معدل خصم 0 صريح كان يُرفع إلى 10% هنا وحده، بينما بقية
        // الملف (buildReadinessChecklist/buildInvestorCriteriaTable) يحترمه بـ`??` —
        // فيتناقض «IRR فوق معدل الخصم» بين درجة الجاذبية وجدول المعايير في الصفحة نفسها.
        if (ctx.irr > rateOrDefault(ctx.discountRate, 0.10)) p += 15; else if (ctx.irr != null) gaps.push('رفع IRR فوق معدل الخصم');
        // عتبة الاسترداد موحّدة فعلياً مع maxPayback الحقيقي في محرك القرار (engine.js عبر
        // assumptionsApplied.thresholds) — لا رقم مستقل (كانت 7 ثابتة هنا بينما الفعلية 3.5).
        if (ctx.payback < ctx.maxPayback && ctx.payback >= 0) p += 15; else if (ctx.payback >= 0) gaps.push('تقليل فترة الاسترداد');
        if (ctx.roi > (ctx.minROI ?? 0.20)) p += 10; else if (ctx.roi != null && ctx.roi > 0) gaps.push('تحسين العائد على الاستثمار');
        if (ctx.profitMargin > 0.10) p += 10; else gaps.push('تحسين هامش الربح');
        if (ctx.hasMarket) p += 15; else gaps.push('تحديد حجم السوق TAM/SAM/SOM');
        if (ctx.hasRisks) p += 10; else gaps.push('توثيق تحليل المخاطر');
        if (ctx.hasProjectInfo) p += 5;
        // سقف مقيَّد بقرار المحرك: الدرجة كانت تُجمَع من المؤشرات وحدها، ولا تمرّ بأيٍّ من
        // بوابات التخفيض التسع في محرك القرار (فجوة التمويل، تجاوز الطاقة/SOM، ميزانية غير
        // متوازنة، DSCR، NPV متشائم سالب، اختبار التحمل، مونت كارلو، خطر حرج بلا خطة) —
        // فتمنح 100% و«مؤهل لعرضه على مستثمرين» لدراسة قرارها REVISE بفجوة تمويل بالملايين.
        // الأسقف مشتقّة من عتبات التسمية نفسها، فالتسمية لا تستطيع تجاوز القرار بنيوياً.
        const cap = ctx.decision === 'GO'
            ? 100
            : (ctx.decision === 'NO-GO' ? MEDIUM_ATTRACTIVENESS_MIN - 1 : GOOD_ATTRACTIVENESS_MIN - 1);
        const percent = Math.min(Math.min(100, Math.round(p)), cap);
        let color = '#22c55e';
        if (percent < 40) color = '#ef4444';
        else if (percent < GOOD_ATTRACTIVENESS_MIN) color = '#8a5f1c';
        let label = 'جاذبية منخفضة — يحتاج تعزيز عدة معايير';
        if (percent >= GOOD_ATTRACTIVENESS_MIN) label = 'جاذبية جيدة — المشروع مؤهل لعرضه على مستثمرين مدروسين';
        else if (percent >= MEDIUM_ATTRACTIVENESS_MIN) label = 'جاذبية متوسطة — التركيز على الفجوات أعلاه يرفع الفرص';
        return { percent, color, label, gaps };
    }

    /**
     * كاسرات القرار من المحرك (result.decisionExplanation.issues) مفهرسة بالمقياس.
     * هذه هي الحقيقة الوحيدة عن «هل يقبل المحرك هذا البند؟» — الشاشة لا تُصدر حكماً
     * موازياً بعتبة خاصة بها. أول ظهور لكل مقياس يُحتفظ به (القائمة مرتّبة بالخطورة
     * في DecisionExplainer.js، فالأول هو الأشد).
     */
    buildEngineBlockers(results) {
        const map = new Map();
        for (const issue of (results?.decisionExplanation?.issues || [])) {
            const metric = String(issue?.metric || '').trim();
            if (metric && !map.has(metric)) map.set(metric, issue);
        }
        return map;
    }

    /**
     * يدمج قائمة بنود الشاشة مع كاسرات المحرك: البند ذو المقياس المرفوض يسقط إلى
     * «غير مُحقَّق» مهما قال حسابه المحلي (اقتران AND لا يُرخّي شيئاً أبداً)، وكل كاسر
     * بلا بند مقابل يُضاف بنداً غير مُحقَّق. النتيجة: يستحيل بنيوياً أن تكتمل القائمة
     * خضراء بالكامل فوق قرار REVISE/NO-GO — وهو بالضبط ما كان يحدث (8/8 و6/6 خضراء
     * لدراسة مصنع قرارها REVISE بفجوة تمويل ٢٬٤٧٥٬٣٠٠ ريال).
     * @param {Array<{metric?: string, ok: boolean}>} items
     * @param {Map<string, Object>} blockers
     * @param {(issue: Object) => Object} makeExtra بناء البند المُضاف لكاسر بلا مقابل
     */
    applyEngineBlockers(items, blockers, makeExtra) {
        const merged = items.map(it => {
            const blocker = it.metric ? blockers.get(it.metric) : null;
            return { ...it, ok: it.ok && !blocker, blocker: blocker || it.blocker || null };
        });
        const covered = new Set(items.map(it => it.metric).filter(Boolean));
        for (const [metric, issue] of blockers) {
            if (covered.has(metric)) continue;
            merged.push({ ...makeExtra(issue), metric, ok: false, blocker: issue });
        }
        return merged;
    }

    /**
     * سبب سقوط «بند القرار» — أقوى سبب من decisionReasons حرفياً كما صاغه المحرك.
     * يعود null للقرار GO (البند مُحقَّق فلا سبب).
     */
    decisionBlocker(ctx) {
        if (ctx.decision === 'GO') return null;
        const reason = (ctx.decisionReasons || [])[0];
        return { explanation: reason || 'راجع أسباب القرار المعروضة أعلاه قبل عرض الدراسة على مستثمر.' };
    }

    buildReadinessChecklist(state, results, ctx) {
        const rev = (results?.incomeStatement || [])[0]?.revenue;
        const items = [
            // بند القرار نفسه أولاً. ليست كل بوابات engine.js ممثَّلة في
            // decisionExplanation.issues (المؤشرات غير المعقولة، الميزانية غير المتوازنة،
            // اختبار التحمل، مونت كارلو، الخطر الحرج تُضاف إلى decisionReasons فقط) —
            // فلولا هذا البند لأمكن أن تعود القائمة خضراء بالكامل فوق قرار REVISE من
            // إحدى تلك البوابات. وجوده يجعل «قرار غير GO ⟹ بند غير أخضر» ثابتةً بنيوية
            // لا تعتمد على تغطية أي خريطة مقاييس.
            { metric: null, label: 'قرار المحرك النهائي: المشروع مجدٍ', ok: ctx.decision === 'GO', blocker: this.decisionBlocker(ctx) },
            // كان الشرط `typeof rev === 'number'` يقيس «هل الحقل رقم؟» لا «هل يوجد
            // نموذج؟» — والمحرك يُخرِج revenue = 0 وهو عدد، فيتحقق البند دائماً ويمنح ✓
            // خضراء على «إيرادات وتكاليف» لدراسة بلا ريال واحد من أيّهما.
            { metric: null, label: 'نموذج مالي مكتمل (إيرادات وتكاليف)', ok: Number(rev) > 0 && Number(results?.opex?.totalAnnual) > 0 },
            { metric: 'npv', label: 'صافي القيمة الحالية (NPV) موجب', ok: ctx.npv > 0 },
            { metric: 'irr', label: 'معدل العائد الداخلي (IRR) فوق معدل الخصم', ok: ctx.irr != null && ctx.irr > (ctx.discountRate ?? 0.10) },
            { metric: 'paybackPeriod', label: `فترة استرداد معقولة (&lt; ${ctx.maxPayback} سنوات)`, ok: ctx.payback >= 0 && ctx.payback < ctx.maxPayback },
            // الفرع الثالث السابق `projectionYears > 0` يتحقق دائماً (المخطط يضع 5
            // افتراضياً) فكان يمنح ✓ لأي دراسة مهما خلت من تعادل محسوب فعلاً.
            { metric: 'breakEvenSafetyMargin', label: 'وجود نقطة تعادل محسوبة', ok: Number(results?.indicators?.breakEvenUnits) > 0 || Number(results?.indicators?.breakevenUnitsPerMonth) > 0 },
            { metric: 'REVENUE_EXCEEDS_SOM', label: 'تحليل منافسين أو سوق', ok: ctx.hasMarket || (state.marketing?.competitors || []).length > 0 },
            { metric: null, label: 'سجل مخاطر أو تحليل مخاطر', ok: ctx.hasRisks },
            { metric: null, label: 'بيانات مشروع وتعريف واضح', ok: !!(state.projectInfo?.name || state.projectInfo?.concept) },
        ];
        // العنوان فقط في السطر الأول؛ الشرح الرقمي يُعرض تحته كسطر فرعي (نفس معاملة أي
        // بند سقط بكاسر)، فلا يتكرر النص مرتين في البند الواحد.
        return this.applyEngineBlockers(items, ctx.blockers || new Map(), issue => ({ label: esc(issue.title) }));
    }

    buildInvestorCriteriaTable(ctx) {
        const dr = ((ctx.discountRate ?? 0.10) * 100).toFixed(1);
        const rows = [
            // صف القرار — نفس الثابتة البنيوية المشروحة في buildReadinessChecklist:
            // الجدول لا يكتمل أخضر فوق قرار غير GO مهما كانت البوابة التي أسقطته.
            { metric: null, name: 'قرار المحرك النهائي', threshold: 'مجدٍ', yours: ctx.decision ? decisionLabel(ctx.decision) : '—', ok: ctx.decision === 'GO', note: 'الحكم الرسمي على أرقامك — أعلى من أي معيار مفرد أدناه', blocker: this.decisionBlocker(ctx) },
            { metric: 'npv', name: 'NPV', threshold: '> 0', yours: (ctx.npv ?? 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 }), ok: (ctx.npv ?? 0) > 0, note: (ctx.npv ?? 0) > 0 ? 'مقبول' : 'يُفضّل تحسين التدفقات أو تخفيف التكاليف' },
            { metric: 'irr', name: 'IRR', threshold: `> ${dr}% (معدل الخصم)`, yours: ctx.irr != null ? (ctx.irr * 100).toFixed(1) + '%' : '--', ok: (ctx.irr ?? 0) > (ctx.discountRate ?? 0.1), note: 'المستثمر يفضّل عائداً أعلى من تكلفة رأس المال' },
            { metric: 'paybackPeriod', name: 'فترة الاسترداد', threshold: `< ${ctx.maxPayback} سنوات`, yours: ctx.payback != null && ctx.payback < 100 ? ctx.payback.toFixed(1) + ' سنة' : '--', ok: ctx.payback >= 0 && ctx.payback < ctx.maxPayback, note: 'استرداد أطول يقلل الجاذبية لرأس المال الجريء' },
            { metric: 'roi', name: 'العائد على الاستثمار (ROI)', threshold: `> ${((ctx.minROI ?? 0.20) * 100).toFixed(0)}%`, yours: ctx.roi != null ? (ctx.roi * 100).toFixed(1) + '%' : '--', ok: (ctx.roi ?? 0) > (ctx.minROI ?? 0.20), note: 'مؤشر على كفاءة استخدام رأس المال' },
            { metric: null, name: 'هامش الربح (تقريبي)', threshold: '> 10%', yours: ctx.profitMargin != null ? (ctx.profitMargin * 100).toFixed(1) + '%' : '--', ok: (ctx.profitMargin ?? 0) > 0.1, note: 'يعكس قوة نموذج الإيرادات والتكاليف' },
            { metric: 'REVENUE_EXCEEDS_SOM', name: 'حجم السوق (TAM/SOM)', threshold: 'محدّد وواقعي', yours: (ctx.tam > 0 || ctx.som > 0) ? 'مُدخل' : 'غير محدد', ok: ctx.tam > 0 || ctx.som > 0, note: 'المستثمر يقدّر السوق القابل للتحقق' },
        ];
        // الملاحظة تُستبدل بشرح المحرك الرقمي لأي صف كسره المحرك — سواء صف قائم سقط
        // (فلا تبقى ملاحظته «مقبول») أو صف مُضاف لا يقابله معيار على الشاشة.
        return this.applyEngineBlockers(rows, ctx.blockers || new Map(), issue => ({
            name: esc(issue.title),
            threshold: issueNum(issue.threshold),
            yours: issueNum(issue.value)
        })).map(r => r.blocker ? { ...r, note: esc(r.blocker.explanation) } : r);
    }

    getEvidenceBasedRecommendation(results, ctx, state) {
        const npv = ctx.npv ?? 0;
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

        // خارج GO: النص يُبنى من كاسر المحرك الأقوى نفسه (decisionExplanation مرتّبة
        // بالخطورة) لا من عتبات NPV/الاسترداد المحلية. النسخة السابقة كانت تسقط لجملة
        // «ركّز على تعزيز النموذج المالي وإكمال قائمة الجاهزية أعلاه» كلما كان NPV موجباً
        // والقرار REVISE — أي بالضبط حين تكون القائمة أعلاه مكتملة، فتناقضها حرفياً
        // وتُخفي السبب الحقيقي (فجوة تمويل ٢٬٤٧٥٬٣٠٠ ريال في دراسة المصنع).
        const issues = results?.decisionExplanation?.issues || [];
        const primary = issues[0] || null;
        const head = decision === 'GO'
            ? 'قرار المحرك <strong>مجدٍ</strong>، لكن قبل العرض على مستثمر عالج'
            : (decision === 'NO-GO'
                ? 'قرار المحرك على أرقامك الحالية: <strong>المشروع غير مجدٍ</strong> — لا يُعرض على مستثمر قبل معالجة'
                : 'قرار المحرك على أرقامك الحالية: <strong>يحتاج مراجعة</strong> — لا يُعرض على مستثمر قبل معالجة');
        if (!primary) {
            return `${head} أسباب القرار المعروضة أعلاه. راجعها ثم أعد تشغيل النموذج قبل تحديد مصدر التمويل الأنسب.`;
        }
        const others = issues.length - 1;
        const rest = others <= 0 ? ''
            : (others === 1 ? ' وهناك ملاحظة أخرى في قائمة الجاهزية وجدول المعايير أعلاه.'
                : ` وهناك ${others} ملاحظات أخرى في قائمة الجاهزية وجدول المعايير أعلاه.`);
        return `${head} <strong>${esc(primary.title)}</strong>: ${esc(primary.explanation)} ${esc(primary.action)}${rest}`;
    }
}

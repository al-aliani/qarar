/**
 * المستشار الذكي التفاعلي (AI Chat)
 * دردشة مع الذكاء الاصطناعي للحصول على توصيات وتحليلات مبنية على دراسة الجدوى
 */

import { aiConnector } from '../services/AIConnector.js';
import { calculateStudy as runFullModel } from '../core/engine.js';
import { SmartAdvisor } from '../services/SmartAdvisor.js';
import { generateSWOT, generateAdvisorFallback, generateFinancialImprovementAdvice } from '../services/InternalAIGenerator.js';
import { escapeHtml } from '../utils/escape.js';
import { CATEGORY_TIPS } from '../core/categoryTips.js';
import { hasMinimumRevenueData } from '../utils/dataSufficiency.js';

// رسالة موحّدة تُعرض بدل أي استنتاج مبني على مؤشرات مالية (توصية/جدوى) حين لا تتوفر
// بيانات إيرادات كافية بعد — بدل حكم سلبي قاطع («صافي القيمة الحالية غير إيجابي...
// القرار يشير إلى عدم جدوى المشروع») على دراسة لا تزال فارغة (نفس فحص hasMinimumRevenueData
// المستخدم في ExecutiveSummary.js وDecisionDashboard.js وFinancialDashboard.js).
const INSUFFICIENT_DATA_MSG = 'بيانات دراستك المالية غير مكتملة بعد — لا توجد مصادر إيرادات مُدخلة. أكمل خطوة "مصادر الإيرادات" أولاً حتى أقدر أحلّل الجدوى وأقدّم توصية مبنية على أرقام حقيقية بدل استنتاج من بيانات فارغة.';

const SUGGESTED_PROMPTS = [
    { label: 'ما توصياتك لمشروعي؟', type: 'advisor' },
    { label: 'حلل نقاط القوة والضعف (SWOT)', type: 'swot' },
    { label: 'كيف أحسن النتائج المالية؟', type: 'financial_improvement' },
    { label: 'هل مشروعي مجدٍ إذا زاد الإيجار؟ (اختبار الضغط)', type: 'stress' },
    { label: 'ملخص تنفيذي للمشروع', type: 'summary' },
    { label: 'ما هي المخاطر وكيف أواجهها؟', type: 'mitigation' },
    { label: 'نصائح عامة للبدء', type: 'advisor_fallback' },
];

export class AIChatModal {
    constructor(store) {
        this.store = store;
        this.messages = [];
        this.isOpen = false;
        this.isLoading = false;
        this.container = null;
        this.fab = null;
        this.currentTip = null;
        this._lastTipCategoryId = null;
    }

    /**
     * يُستدعى من app.js عند كل تنقّل بين تصنيفات الدراسة — يعرض نصيحة القسم
     * كشريط ثابت أعلى الدردشة (لا كرسالة في السجل، كي لا يتضخم السجل بتكرارها
     * عند التنقل ذهاباً وإياباً بين الأقسام).
     */
    setCategoryContext(categoryId, categoryLabel) {
        const tip = CATEGORY_TIPS[categoryId];
        if (!tip || this._lastTipCategoryId === categoryId) return;
        this._lastTipCategoryId = categoryId;
        this.currentTip = { label: categoryLabel, text: tip };
        if (this.isOpen) this.render();
    }

    addProactiveBadge() {
        const badge = document.getElementById('aiChatBadge');
        if (badge) badge.style.display = 'block';
    }

    clearProactiveBadge() {
        const badge = document.getElementById('aiChatBadge');
        if (badge) badge.style.display = 'none';
    }

    /**
     * إنشاء زر عائم وتهيئة الـ modal
     */
    mount() {
        if (document.getElementById('aiChatFab')) return;

        this.fab = document.createElement('button');
        this.fab.id = 'aiChatFab';
        this.fab.type = 'button';
        this.fab.className = 'ai-chat-fab';
        this.fab.setAttribute('aria-label', 'فتح المستشار الذكي');
        this.fab.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.6 0-3.1-.4-4.4-1.2L3 20.5l1.7-4.9A8.5 8.5 0 1 1 21 11.5Z"/></svg><span class="ai-chat-fab-label">المستشار الذكي</span><span id="aiChatBadge" class="ai-chat-badge" style="display: none;"></span>';
        this.fab.addEventListener('click', () => {
            this.clearProactiveBadge();
            this.toggle();
        });
        document.body.appendChild(this.fab);
        this._bindFabAvoidance();

        // Panel container
        this.container = document.createElement('div');
        this.container.id = 'aiChatPanel';
        this.container.className = 'ai-chat-panel';
        this.container.style.cssText = `
            position: fixed; bottom: 0; left: 0; right: 0; top: auto;
            max-height: 480px; z-index: 9999; background: var(--c-bg-card, #fff);
            border-radius: 16px 16px 0 0; box-shadow: var(--shadow-lg, 0 -4px 24px rgba(0,0,0,0.15));
            display: none; flex-direction: column; font-family: inherit;
        `;
        if (!document.getElementById('ai-chat-styles')) {
            const style = document.createElement('style');
            style.id = 'ai-chat-styles';
            // ألوان الهوية (--c-p-500 أخضر / --c-gold-500 نحاسي) بدل الكحلي #1e3a5f
            // المُقحَم سابقاً بلا علاقة بهوية «قرار» — تتبع الوضع الداكن تلقائياً
            // لأنها متغيرات CSS من web/css/variables.css، لا قيم صلبة.
            style.textContent = `
                .ai-chat-msg.user { text-align: right; }
                .ai-chat-msg.user .ai-chat-bubble { background: var(--c-p-500, #0e5b44); color: var(--c-p-contrast, #fff); margin-right: 0; margin-left: auto; }
                .ai-chat-msg.assistant { text-align: right; }
                .ai-chat-msg.assistant .ai-chat-bubble { background: var(--c-surface-2, #f1f5f9); color: var(--c-text-main, #1e293b); border: 1px solid var(--c-border, #e2e8f0); }
                .ai-chat-msg.system { padding: 12px; background: var(--c-surface-2, #f8fafc); color: var(--c-text-muted, #64748b); font-size: 13px; border-radius: 8px; margin-bottom: 12px; }
                .ai-chat-bubble { display: inline-block; max-width: 90%; padding: 12px 16px; border-radius: 12px; margin: 6px 0; text-align: right; }
                .ai-chat-suggest { padding: 8px 14px; background: var(--c-surface-2, #f1f5f9); border: 1px solid var(--c-border, #e2e8f0); border-radius: 8px; font-size: 12px; cursor: pointer; color: var(--c-text-main); }
                .ai-chat-suggest:hover { background: var(--c-surface-3, #e2e8f0); }
                .ai-chat-tip { margin: 12px 16px 0; padding: 10px 12px; border-radius: 10px; background: var(--c-gold-subtle); border-inline-start: 3px solid var(--c-gold-500); font-size: 12.5px; color: var(--c-text-main); line-height: 1.6; }
                .ai-chat-tip b { color: var(--c-gold-500); }
                .ai-chat-badge { position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; background: var(--c-danger-500, #ef4444); border-radius: 50%; border: 2px solid var(--c-bg-card, #fff); }
                .ai-chat-fab { position: relative; }
            `;
            document.head.appendChild(style);
        }
        document.body.appendChild(this.container);

        this.render();
    }

    /**
     * تدقيق اختبار عميل 2026-07-12: الزر العائم (حبة عريضة ~170px) كان يتداخل مع
     * صفوف جداول الإدخال أسفل الشاشة على سطح المكتب فيُنقر بالخطأ بدل الخلية
     * المطلوبة. نصغّره لدائرة أثناء التمرير، ونخفت/نعطّل نقره أثناء التركيز على أي
     * حقل إدخال — دون المساس بمسار الجوال (مخفي أصلاً بـCSS) أو openWithPrompt.
     */
    _bindFabAvoidance() {
        let rafPending = false;
        // body { overflow:hidden } — التمرير الفعلي داخل حاويات فرعية (.main-stage
        // وأمثالها) لا على window (تحقّق حي 2026-07-12: window.scrollY يبقى 0 دوماً).
        // حدث scroll لا يصعد (bubble) فنستمع في طور الالتقاط (capture) على document
        // ليصلنا من أي عنصر تمرير فرعي دون معرفة اسم الحاوية سلفاً.
        const onScroll = (e) => {
            if (rafPending) return;
            rafPending = true;
            const scrollTop = e.target === document ? (window.scrollY || document.documentElement.scrollTop) : (e.target.scrollTop || 0);
            requestAnimationFrame(() => {
                this.fab.classList.toggle('is-compact', scrollTop > 200);
                rafPending = false;
            });
        };
        document.addEventListener('scroll', onScroll, { passive: true, capture: true });

        let blurTimer = null;
        const isFormField = (el) => el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
        const onFocusIn = (e) => {
            if (!isFormField(e.target) || e.target === this.fab) return;
            if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
            this.fab.classList.add('is-editing');
        };
        const onFocusOut = (e) => {
            if (!isFormField(e.target)) return;
            // تأخير قصير كي لا يومض الزر أثناء التنقل بـTab بين خلايا الجدول
            blurTimer = setTimeout(() => {
                if (!isFormField(document.activeElement)) this.fab.classList.remove('is-editing');
            }, 150);
        };
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.container.style.display = this.isOpen ? 'flex' : 'none';
        if (this.isOpen) {
            if (this.messages.length === 0) {
                this.addSystemMessage('مرحباً! أنا المستشار الذكي. اسألني عن مشروعك، التوصيات، تحليل SWOT، أو أي استفسار عن دراسة الجدوى.');
            }
            this.render();
            this.container.querySelector('.ai-chat-input')?.focus();
        }
    }

    /**
     * فتح الدردشة مع سؤال أولي (مثلاً من اختبار الضغط) والحصول على رد AI فوراً (KPI-10.4).
     */
    async openWithPrompt(initialPrompt) {
        if (!this.container) return;
        this.isOpen = true;
        this.container.style.display = 'flex';
        this.addMessage('user', initialPrompt);
        this.isLoading = true;
        this.render();
        try {
            const responseText = await this.getAIResponse(initialPrompt);
            
            this.addMessage('assistant', '');
            const msgIndex = this.messages.length - 1;
            
            const { InternalAIGenerator } = await import('../services/InternalAIGenerator.js');
            const stream = InternalAIGenerator.simulateStream(responseText, 10);
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                this.messages[msgIndex].content += decoder.decode(value);
                this.render();
            }
        } catch (e) {
            console.error('AI openWithPrompt error', e);
            this.addMessage('assistant', 'عذراً، حدث خطأ. حاول مرة أخرى أو راجع اكتمال بيانات الدراسة.');
        } finally {
            this.isLoading = false;
            this.render();
        }
        this.container.querySelector('.ai-chat-input')?.focus();
    }

    close() {
        this.isOpen = false;
        this.container.style.display = 'none';
    }

    addMessage(role, content) {
        this.messages.push({ role, content, ts: Date.now() });
    }

    addSystemMessage(content) {
        this.messages.push({ role: 'system', content, ts: Date.now() });
    }

    async sendUserMessage(text, promptType = null) {
        if (!text?.trim()) return;

        this.addMessage('user', text.trim());
        this.isLoading = true;
        this.render();

        try {
            const responseText = await this.getAIResponse(text.trim(), promptType);
            
            this.addMessage('assistant', '');
            const msgIndex = this.messages.length - 1;
            
            const { InternalAIGenerator } = await import('../services/InternalAIGenerator.js');
            const stream = InternalAIGenerator.simulateStream(responseText, 10);
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                this.messages[msgIndex].content += decoder.decode(value);
                this.render();
            }
        } catch (e) {
            console.error('AI Chat error:', e);
            this.addMessage('assistant', 'عذراً، حدث خطأ. حاول مرة أخرى أو راجع اكتمال بيانات الدراسة.');
        } finally {
            this.isLoading = false;
            this.render();
        }
    }

    /**
     * تحديد نوع السؤال واستدعاء المولّد المناسب
     * @param {string} userText
     * @param {string|null} promptType - نوع الاقتراح إن كان الاستدعاء من زر جاهز (dataset.type)؛
     *   يُستخدم للتوجيه الحتمي بدل الاعتماد فقط على مطابقة النص الحرة (regex)، والتي تبقى
     *   السبيل الوحيد عند الكتابة الحرة (promptType = null).
     */
    async getAIResponse(userText, promptType = null) {
        const state = this.store.getState();
        let results = null;
        try {
            results = runFullModel(state);
        } catch (_) {}

        const text = userText.toLowerCase().trim();

        // توجيه حتمي لسؤال «كيف أحسن النتائج المالية؟» لمولّد مخصص مبني على نسب التكلفة
        // الفعلية ومعيار القطاع (getCostRatios + sectorBenchmarks) — بدل تفريغ SmartAdvisor
        // العام الذي كان يُستخدم سابقاً لأي سؤال لا يطابق SWOT/الملخص/المخاطر/اختبار الضغط.
        if (promptType === 'financial_improvement') {
            try {
                return generateFinancialImprovementAdvice(state, results || {});
            } catch (e) {
                console.error('generateFinancialImprovementAdvice error', e);
            }
        }

        // خريطة الكلمات المفتاحية → النوع (مع توجيه حتمي عبر promptType عند القادم من زر جاهز)
        if (promptType === 'swot' || /swot|قوة|ضعف|فرص|تهديد|نقاط/i.test(text)) {
            const swot = generateSWOT(state);
            if (swot && typeof swot === 'object') {
                return `**تحليل SWOT لمشروعك:**\n\n` +
                    `**نقاط القوة:**\n${(swot.strengths || []).map(s => '• ' + s).join('\n')}\n\n` +
                    `**نقاط الضعف:**\n${(swot.weaknesses || []).map(w => '• ' + w).join('\n')}\n\n` +
                    `**الفرص:**\n${(swot.opportunities || []).map(o => '• ' + o).join('\n')}\n\n` +
                    `**التهديدات:**\n${(swot.threats || []).map(t => '• ' + t).join('\n')}`;
            }
        }

        if (promptType === 'summary' || /ملخص|تنفيذي|summary/i.test(text)) {
            const summary = await aiConnector.generateExecutiveSummary(state, results || {});
            if (summary == null) return 'تعذر توليد الملخص حالياً — أكمل بيانات المشروع (الاسم، النشاط، الإيرادات) ثم جرّب مرة أخرى.';
            return typeof summary === 'string' ? summary : (summary?.content || JSON.stringify(summary));
        }

        if (promptType === 'mitigation' || /مخاطر|خطر|مواجهة|mitigation/i.test(text)) {
            const risks = state?.riskAnalysis?.risks || [];
            const mit = await aiConnector.getRiskMitigation(risks);
            return typeof mit === 'string' ? mit : (Array.isArray(mit) ? mit.map(m => typeof m === 'string' ? m : (m?.action || m?.message || '')).join('\n• ') : String(mit));
        }

        if (promptType === 'stress' || /اختبار الضغط|ضغط|صدمة|تغير الإيراد|تغير التكلفة|بعد الصدمة/i.test(text)) {
            return '**تفسير سيناريو اختبار الضغط:**\n\n' +
                'بناءً على الأرقام التي ذكرتها: إن كان صافي القيمة الحالية (NPV) لا يزال موجباً فالمشروع يحتمل الصدمة في حدود التغيّر المطبّق. إن أصبح سالباً فالمشروع حساس لهذا السيناريو ويُوصى بمراجعة الافتراضات (تقليل التكاليف الثابتة، تنويع الإيرادات، أو تأمين تمويل احتياطي).\n\n' +
                '• راجع **نقطة التعادل** و**فترة الاسترداد** — كلما كانت الفترة أقصر كان التحمل أفضل.\n' +
                '• يُوصى بمراقبة المتغيرات الأكثر حساسية (الإيجار، تكلفة المواد، حجم المبيعات) ووضع خطط بديلة.';
        }

        // اقتراح جاهز «نصائح عامة للبدء» (promptType='advisor_fallback') — نصائح عامة من
        // بيانات المشروع الوصفية (الاسم/المدينة/القطاع)، لا تستنتج من مؤشرات مالية، فلا
        // تحتاج فحص كفاية بيانات الإيرادات.
        if (promptType === 'advisor_fallback') {
            const fallback = generateAdvisorFallback(state);
            return fallback || 'لا توجد نصائح إضافية متاحة حالياً.';
        }

        // اقتراح جاهز «ما توصياتك لمشروعي؟» (promptType='advisor'). كان هذا السؤال يسقط
        // دائماً في المسار الافتراضي "لم أفهم سؤالك" لأنه لا يطابق أياً من كلمات
        // SWOT/الملخص/المخاطر/اختبار الضغط المفتاحية أعلاه رغم أنه سؤال واضح المعنى —
        // يُفهم الآن صراحة (توجيه promptType الحتمي من الزر، أو مطابقة نصية حرة). ونطبّق
        // hasMinimumRevenueData قبل أي استنتاج من المؤشرات المالية (SmartAdvisor.analyze
        // يستنتج «القرار يشير إلى عدم جدوى المشروع» من دراسة لا تزال فارغة تماماً).
        if (promptType === 'advisor' || /توصي|تنصح/i.test(text)) {
            if (!hasMinimumRevenueData(state)) return INSUFFICIENT_DATA_MSG;

            const analyzed = SmartAdvisor.analyze(results || {}, state);
            if (analyzed?.insights?.length > 0) {
                const insightsText = analyzed.insights.map(i =>
                    `• [${i.category}] ${i.message}\n  **الإجراء:** ${i.action || '—'}`
                ).join('\n\n');
                return `**توصياتي لمشروعك بناءً على بيانات دراستك:**\n\n${insightsText}`;
            }
            const fallback = generateAdvisorFallback(state);
            return fallback ? `مؤشراتك المالية ضمن النطاق الصحي حالياً ولا توجد ملاحظات سلبية.\n\n${fallback}` : 'مؤشراتك المالية ضمن النطاق الصحي حالياً ولا توجد ملاحظات سلبية.';
        }

        // افتراضي: لم يُطابَق سؤالٌ محدد — نُفصح بصدق أننا لم نفهم السؤال بعينه، ثم نعرض
        // ملاحظات المستشار المبنية على بيانات المشروع (لا ندّعي أننا أجبنا عن سؤاله الحر).
        const notUnderstood = 'لم أفهم سؤالك تحديداً — هذا مساعد قواعد يجيب عن مواضيع محددة. جرّب: «حلّل SWOT»، «اكتب الملخص التنفيذي»، «اقترح مخاطر»، أو «فسّر اختبار الضغط».';
        if (!hasMinimumRevenueData(state)) return `${notUnderstood}\n\n${INSUFFICIENT_DATA_MSG}`;

        const analyzed = SmartAdvisor.analyze(results || {}, state);
        if (analyzed?.insights?.length > 0) {
            const insightsText = analyzed.insights.map(i =>
                `• [${i.category}] ${i.message}\n  **الإجراء:** ${i.action || '—'}`
            ).join('\n\n');
            return `${notUnderstood}\n\n**وفي الأثناء، ملاحظات المستشار بناءً على بيانات مشروعك:**\n\n${insightsText}`;
        }

        const fallback = generateAdvisorFallback(state);
        return fallback ? `${notUnderstood}\n\n${fallback}` : notUnderstood;
    }

    render() {
        if (!this.container) return;

        const suggestedHtml = SUGGESTED_PROMPTS.map(p =>
            `<button type="button" class="ai-chat-suggest" data-type="${p.type}">${p.label}</button>`
        ).join('');

        const messagesHtml = this.messages
            .map(m => {
                if (m.role === 'system') {
                    return `<div class="ai-chat-msg system">${escapeHtml(m.content)}</div>`;
                }
                const cls = m.role === 'user' ? 'user' : 'assistant';
                // تهريب HTML أولاً ثم تطبيق تنسيق آمن (**عريض** وأسطر) — يمنع حقن السكربت
                // مع إبقاء التنسيق البسيط يعمل.
                const content = escapeHtml(m.content).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                return `<div class="ai-chat-msg ${cls}"><div class="ai-chat-bubble">${content}</div></div>`;
            })
            .join('');

        const tipHtml = this.currentTip
            ? `<div class="ai-chat-tip"><b>نصيحة قسم «${escapeHtml(this.currentTip.label)}»:</b> ${escapeHtml(this.currentTip.text)}</div>`
            : '';

        this.container.innerHTML = `
            <div class="ai-chat-header" style="padding:16px 20px;border-bottom:1px solid var(--c-border, #e2e8f0);">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;font-size:18px;font-weight:700;color:var(--c-text-main);">المستشار</h3>
                    <button type="button" class="ai-chat-close" aria-label="إغلاق">×</button>
                </div>
                <div style="font-size:12px;color:var(--c-text-muted, #64748b);margin-top:4px;">مساعد قواعد محلي — يجيب عن مواضيع محددة (SWOT، الملخص، المخاطر، اختبار الضغط) من بيانات دراستك، لا نموذج محادثة عام.</div>
            </div>
            ${tipHtml}
            <div class="ai-chat-messages" style="flex:1;overflow-y:auto;padding:16px;min-height:180px;">
                ${messagesHtml}
                ${this.isLoading ? '<div class="ai-chat-msg assistant"><div class="ai-chat-bubble typing">جارٍ التحليل…</div></div>' : ''}
            </div>
            <div class="ai-chat-suggestions" style="padding:8px 16px;display:flex;flex-wrap:wrap;gap:8px;">
                ${suggestedHtml}
            </div>
            <div class="ai-chat-input-row" style="padding:16px;border-top:1px solid var(--c-border, #e2e8f0);display:flex;gap:8px;">
                <input type="text" class="ai-chat-input" placeholder="اكتب سؤالك..." dir="rtl"
                    style="flex:1;padding:12px 16px;border:1px solid var(--c-border, #e2e8f0);border-radius:12px;font-size:14px;background:var(--c-bg-card);color:var(--c-text-main);">
                <button type="button" class="ai-chat-send" style="padding:12px 20px;background:var(--c-p-500, #0e5b44);color:var(--c-p-contrast, #fff);border:none;border-radius:12px;font-weight:600;cursor:pointer;">إرسال</button>
            </div>
        `;

        this.container.querySelector('.ai-chat-close').addEventListener('click', () => this.close());
        this.container.querySelectorAll('.ai-chat-suggest').forEach(btn => {
            // نقرأ dataset.type فعلياً للتوجيه الحتمي (بدل الاعتماد فقط على مطابقة نص الزر
            // بتعابير نمطية داخل getAIResponse، والتي كانت تُغفل أنواعاً كـ«كيف أحسن النتائج
            // المالية؟» لا تحوي أياً من كلمات SWOT/الملخص/المخاطر/اختبار الضغط المفتاحية).
            btn.addEventListener('click', () => this.sendUserMessage(btn.textContent, btn.dataset.type || null));
        });
        const input = this.container.querySelector('.ai-chat-input');
        const sendBtn = this.container.querySelector('.ai-chat-send');
        const doSend = () => {
            const v = input.value.trim();
            if (v) {
                this.sendUserMessage(v);
                input.value = '';
            }
        };
        sendBtn.addEventListener('click', doSend);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); doSend(); }
        });

        this.container.querySelector('.ai-chat-messages').scrollTop = 99999;
    }

    unmount() {
        if (this.fab) this.fab.remove();
        if (this.container) this.container.remove();
        this.fab = null;
        this.container = null;
    }
}

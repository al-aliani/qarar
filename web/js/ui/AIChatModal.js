/**
 * المستشار الذكي التفاعلي (AI Chat)
 * دردشة مع الذكاء الاصطناعي للحصول على توصيات وتحليلات مبنية على دراسة الجدوى
 */

import { aiConnector } from '../services/AIConnector.js';
import { calculateStudy as runFullModel } from '../core/engine.js';
import { SmartAdvisor } from '../services/SmartAdvisor.js';
import { generateSWOT, generateAdvisorFallback } from '../services/InternalAIGenerator.js';
import { escapeHtml } from '../utils/escape.js';

const SUGGESTED_PROMPTS = [
    { label: 'ما توصياتك لمشروعي؟', type: 'advisor' },
    { label: 'حلل نقاط القوة والضعف (SWOT)', type: 'swot' },
    { label: 'كيف أحسن النتائج المالية؟', type: 'advisor' },
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
        this.fab.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.6 0-3.1-.4-4.4-1.2L3 20.5l1.7-4.9A8.5 8.5 0 1 1 21 11.5Z"/></svg><span class="ai-chat-fab-label">المستشار الذكي</span>';
        this.fab.addEventListener('click', () => this.toggle());
        document.body.appendChild(this.fab);

        // Panel container
        this.container = document.createElement('div');
        this.container.id = 'aiChatPanel';
        this.container.className = 'ai-chat-panel';
        this.container.style.cssText = `
            position: fixed; bottom: 0; left: 0; right: 0; top: auto;
            max-height: 480px; z-index: 9999; background: #fff;
            border-radius: 16px 16px 0 0; box-shadow: 0 -4px 24px rgba(0,0,0,0.15);
            display: none; flex-direction: column; font-family: inherit;
        `;
        if (!document.getElementById('ai-chat-styles')) {
            const style = document.createElement('style');
            style.id = 'ai-chat-styles';
            style.textContent = `
                .ai-chat-msg.user { text-align: right; }
                .ai-chat-msg.user .ai-chat-bubble { background: #1e3a5f; color: #fff; margin-right: 0; margin-left: auto; }
                .ai-chat-msg.assistant { text-align: right; }
                .ai-chat-msg.assistant .ai-chat-bubble { background: #f1f5f9; color: #1e293b; border: 1px solid #e2e8f0; }
                .ai-chat-msg.system { padding: 12px; background: #f8fafc; color: #64748b; font-size: 13px; border-radius: 8px; margin-bottom: 12px; }
                .ai-chat-bubble { display: inline-block; max-width: 90%; padding: 12px 16px; border-radius: 12px; margin: 6px 0; text-align: right; }
                .ai-chat-suggest { padding: 8px 14px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; cursor: pointer; }
                .ai-chat-suggest:hover { background: #e2e8f0; }
            `;
            document.head.appendChild(style);
        }
        document.body.appendChild(this.container);

        this.render();
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

    async sendUserMessage(text) {
        if (!text?.trim()) return;

        this.addMessage('user', text.trim());
        this.isLoading = true;
        this.render();

        try {
            const responseText = await this.getAIResponse(text.trim());
            
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
     */
    async getAIResponse(userText) {
        const state = this.store.getState();
        let results = null;
        try {
            results = runFullModel(state);
        } catch (_) {}

        const text = userText.toLowerCase().trim();

        // خريطة الكلمات المفتاحية → النوع
        if (/swot|قوة|ضعف|فرص|تهديد|نقاط/i.test(text)) {
            const swot = generateSWOT(state);
            if (swot && typeof swot === 'object') {
                return `**تحليل SWOT لمشروعك:**\n\n` +
                    `**نقاط القوة:**\n${(swot.strengths || []).map(s => '• ' + s).join('\n')}\n\n` +
                    `**نقاط الضعف:**\n${(swot.weaknesses || []).map(w => '• ' + w).join('\n')}\n\n` +
                    `**الفرص:**\n${(swot.opportunities || []).map(o => '• ' + o).join('\n')}\n\n` +
                    `**التهديدات:**\n${(swot.threats || []).map(t => '• ' + t).join('\n')}`;
            }
        }

        if (/ملخص|تنفيذي|summary/i.test(text)) {
            const summary = await aiConnector.generateExecutiveSummary(state, results || {});
            if (summary == null) return 'تعذر توليد الملخص حالياً — أكمل بيانات المشروع (الاسم، النشاط، الإيرادات) ثم جرّب مرة أخرى.';
            return typeof summary === 'string' ? summary : (summary?.content || JSON.stringify(summary));
        }

        if (/مخاطر|خطر|مواجهة|mitigation/i.test(text)) {
            const risks = state?.riskAnalysis?.risks || [];
            const mit = await aiConnector.getRiskMitigation(risks);
            return typeof mit === 'string' ? mit : (Array.isArray(mit) ? mit.map(m => typeof m === 'string' ? m : (m?.action || m?.message || '')).join('\n• ') : String(mit));
        }

        if (/اختبار الضغط|ضغط|صدمة|تغير الإيراد|تغير التكلفة|بعد الصدمة/i.test(text)) {
            return '**تفسير سيناريو اختبار الضغط:**\n\n' +
                'بناءً على الأرقام التي ذكرتها: إن كان صافي القيمة الحالية (NPV) لا يزال موجباً فالمشروع يحتمل الصدمة في حدود التغيّر المطبّق. إن أصبح سالباً فالمشروع حساس لهذا السيناريو ويُوصى بمراجعة الافتراضات (تقليل التكاليف الثابتة، تنويع الإيرادات، أو تأمين تمويل احتياطي).\n\n' +
                '• راجع **نقطة التعادل** و**فترة الاسترداد** — كلما كانت الفترة أقصر كان التحمل أفضل.\n' +
                '• يُوصى بمراقبة المتغيرات الأكثر حساسية (الإيجار، تكلفة المواد، حجم المبيعات) ووضع خطط بديلة.';
        }

        // افتراضي: لم يُطابَق سؤالٌ محدد — نُفصح بصدق أننا لم نفهم السؤال بعينه، ثم نعرض
        // ملاحظات المستشار المبنية على بيانات المشروع (لا ندّعي أننا أجبنا عن سؤاله الحر).
        const notUnderstood = 'لم أفهم سؤالك تحديداً — هذا مساعد قواعد يجيب عن مواضيع محددة. جرّب: «حلّل SWOT»، «اكتب الملخص التنفيذي»، «اقترح مخاطر»، أو «فسّر اختبار الضغط».';
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

        this.container.innerHTML = `
            <div class="ai-chat-header" style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;font-size:18px;font-weight:700;">المستشار</h3>
                    <button type="button" class="ai-chat-close" aria-label="إغلاق">×</button>
                </div>
                <div style="font-size:12px;color:#64748b;margin-top:4px;">مساعد قواعد محلي — يجيب عن مواضيع محددة (SWOT، الملخص، المخاطر، اختبار الضغط) من بيانات دراستك، لا نموذج محادثة عام.</div>
            </div>
            <div class="ai-chat-messages" style="flex:1;overflow-y:auto;padding:16px;min-height:180px;">
                ${messagesHtml}
                ${this.isLoading ? '<div class="ai-chat-msg assistant"><div class="ai-chat-bubble typing">جارٍ التحليل…</div></div>' : ''}
            </div>
            <div class="ai-chat-suggestions" style="padding:8px 16px;display:flex;flex-wrap:wrap;gap:8px;">
                ${suggestedHtml}
            </div>
            <div class="ai-chat-input-row" style="padding:16px;border-top:1px solid #e2e8f0;display:flex;gap:8px;">
                <input type="text" class="ai-chat-input" placeholder="اكتب سؤالك..." dir="rtl"
                    style="flex:1;padding:12px 16px;border:1px solid #e2e8f0;border-radius:12px;font-size:14px;">
                <button type="button" class="ai-chat-send" style="padding:12px 20px;background:#1e3a5f;color:#fff;border:none;border-radius:12px;font-weight:600;cursor:pointer;">إرسال</button>
            </div>
        `;

        this.container.querySelector('.ai-chat-close').addEventListener('click', () => this.close());
        this.container.querySelectorAll('.ai-chat-suggest').forEach(btn => {
            btn.addEventListener('click', () => this.sendUserMessage(btn.textContent));
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

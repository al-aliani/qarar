import { calculateStudy } from '../core/engine.js';
import { buildDecisionActionPlan } from '../core/decisionActionPlan.js';
import { escapeHtml } from '../utils/escape.js';
import { toast } from '../utils/toast.js';
import { trackEvent } from '../utils/analytics.js';
import { compareStudyChange, formatImpactValue } from '../core/changeImpact.js';
import {
    acceptSupplierQuote,
    createStudyVersion,
    createWorkRequest,
    decideSuggestion,
    listConnectedWorkspace,
    listRequestThread,
    listParties,
    sendRequestMessage,
    syncDecisionTasks,
    updateTaskStatus
} from '../services/ConnectedWorkspaceService.js';

const STATUS_LABEL = {
    new: 'جديد', received: 'تم الاستلام', processing: 'قيد المعالجة', waiting_customer: 'بانتظارك',
    offered: 'عرض مقدّم', accepted: 'مقبول', rejected: 'مرفوض', completed: 'مكتمل', cancelled: 'ملغي',
    todo: 'للعمل', doing: 'جارٍ', blocked: 'متعثر', done: 'مكتمل', dismissed: 'مستبعد', pending: 'بانتظار القرار'
};

function money(value) {
    return `${Number(value || 0).toLocaleString('ar-SA')} ريال`;
}

function valueText(value) {
    if (value == null) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export class ConnectedWorkspaceView {
    constructor(containerId, store, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onBack = options.onBack || (() => {});
        this.data = null;
        this.parties = [];
    }

    async render() {
        if (!this.container) return;
        const state = this.store?.getState?.() || {};
        const studyId = state.projectInfo?.id;
        if (!studyId) {
            this.container.innerHTML = '<div class="card p-6"><h2>مساحة المشروع المتصلة</h2><p class="text-muted mt-2">احفظ المشروع أولاً حتى يمكن ربط الطلبات والعروض والمراجعات والنسخ به.</p><button id="connectedBack" class="btn btn--secondary mt-4">العودة</button></div>';
            this.container.querySelector('#connectedBack')?.addEventListener('click', this.onBack);
            return;
        }
        this.container.innerHTML = '<p class="text-muted p-6">جاري جمع كل ما يرتبط بالمشروع…</p>';
        const [workspace, parties] = await Promise.all([listConnectedWorkspace(studyId), listParties()]);
        if (!workspace.ok) {
            this.container.innerHTML = `<div class="card p-6"><p class="text-danger">${escapeHtml(workspace.error || 'تعذر تحميل مساحة المشروع.')}</p><button id="connectedBack" class="btn btn--secondary mt-4">العودة</button></div>`;
            this.container.querySelector('#connectedBack')?.addEventListener('click', this.onBack);
            return;
        }
        this.data = workspace.data;
        this.parties = parties.ok ? parties.data : [];
        this._renderContent(state);
    }

    _renderContent(state) {
        const d = this.data;
        const projectName = state.projectInfo?.name || state.projectInfo?.concept || 'المشروع الحالي';
        const searchable = [
            ...d.requests.map(x => ({ kind: 'طلب', title: x.title, detail: x.details || '', target: 'requests' })),
            ...d.quotes.map(x => ({ kind: 'عرض سعر', title: x.item_label, detail: money(x.amount_sar), target: 'quotes' })),
            ...d.suggestions.map(x => ({ kind: 'مراجعة', title: x.field_path, detail: x.rationale, target: 'reviews' })),
            ...d.tasks.map(x => ({ kind: 'مهمة', title: x.title, detail: x.details || '', target: 'tasks' })),
            ...this.parties.map(x => ({ kind: 'جهة', title: x.name, detail: x.description || '', target: 'parties' }))
        ];
        this.container.innerHTML = `<div class="animate-entry p-6 max-w-5xl mx-auto" dir="rtl">
            <button id="connectedBack" class="btn btn--ghost mb-4">← العودة</button>
            <div class="card glass-card p-6 mb-5">
                <span class="text-xs text-gold">مركز الربط</span><h1 class="text-2xl font-bold mt-1">${escapeHtml(projectName)}</h1>
                <p class="text-muted mt-2">الطلبات، عروض الأسعار، مراجعات الخبراء، مهام القرار ونسخ الدراسة في مكان واحد.</p>
                <div class="grid grid-cols-5 gap-3 mt-5">
                    ${this._metric('الطلبات', d.requests.length)}${this._metric('العروض', d.quotes.length)}${this._metric('اقتراحات المراجعة', d.suggestions.length)}${this._metric('المهام المفتوحة', d.tasks.filter(x => !['done', 'dismissed'].includes(x.status)).length)}${this._metric('النسخ', d.versions.length)}
                </div>
                <label class="block mt-5"><span class="text-sm">بحث شامل داخل المشروع</span><input id="connectedSearch" class="form-input w-full mt-2" placeholder="ابحث في الطلبات والعروض والمهام والجهات…"></label>
                <div id="connectedSearchResults" class="mt-3"></div>
            </div>
            <div class="grid grid-cols-2 gap-5">
                ${this._tasks(d.tasks)}
                ${this._requests(d.requests)}
                ${this._quotes(d.quotes)}
                ${this._suggestions(d.suggestions)}
                ${this._versions(d.versions)}
                ${this._parties(this.parties)}
                ${this._recommendations(state)}
            </div>
        </div>`;
        this._bind(state, searchable);
    }

    _metric(label, value) { return `<div class="card p-3 text-center"><strong class="block text-xl">${value}</strong><span class="text-xs text-muted">${label}</span></div>`; }
    _empty(text) { return `<p class="text-sm text-muted">${text}</p>`; }

    _tasks(items) {
        return `<section class="card p-5" data-connected-section="tasks"><div class="flex justify-between gap-2"><h2 class="font-bold">خطة التنفيذ</h2><button id="syncDecisionTasks" class="btn btn--secondary btn--sm">توليدها من القرار</button></div><div class="mt-4 space-y-3">${items.length ? items.map(x => `<article class="card p-3"><div class="flex justify-between gap-3"><div><strong>${escapeHtml(x.title)}</strong><p class="text-xs text-muted mt-1">${escapeHtml(x.details || '')}</p></div><select class="form-input" data-task-status="${escapeHtml(x.id)}"><option value="todo" ${x.status === 'todo' ? 'selected' : ''}>للعمل</option><option value="doing" ${x.status === 'doing' ? 'selected' : ''}>جارٍ</option><option value="blocked" ${x.status === 'blocked' ? 'selected' : ''}>متعثر</option><option value="done" ${x.status === 'done' ? 'selected' : ''}>مكتمل</option></select></div></article>`).join('') : this._empty('لم تُنشأ مهام بعد.')}</div></section>`;
    }

    _requests(items) {
        return `<section class="card p-5" data-connected-section="requests"><div class="flex justify-between gap-2"><h2 class="font-bold">الطلبات الموحدة</h2><button id="newConnectedRequest" class="btn btn--secondary btn--sm">طلب جديد</button></div><div class="mt-4 space-y-3">${items.length ? items.map(x => `<article class="card p-3"><div class="flex justify-between gap-2"><strong>${escapeHtml(x.title)}</strong><span class="badge">${escapeHtml(STATUS_LABEL[x.status] || x.status)}</span></div><p class="text-xs text-muted mt-1">${escapeHtml(x.details || '')}</p>${x.next_action ? `<p class="text-sm mt-2"><strong>المطلوب الآن:</strong> ${escapeHtml(x.next_action)}</p>` : ''}<button class="btn btn--ghost btn--sm mt-2" data-request-thread="${escapeHtml(x.id)}">السجل والرسائل</button><div data-thread-host="${escapeHtml(x.id)}"></div></article>`).join('') : this._empty('لا توجد طلبات مرتبطة بالمشروع.')}</div></section>`;
    }

    _quotes(items) {
        return `<section class="card p-5" data-connected-section="quotes"><h2 class="font-bold">عروض الموردين المرتبطة بالتكلفة</h2><div class="mt-4 space-y-3">${items.length ? items.map(x => `<article class="card p-3"><strong>${escapeHtml(x.item_label)}</strong><div class="text-sm mt-1">${money(x.amount_sar)}</div><div class="text-xs text-muted">${escapeHtml(x.section_key)}${x.valid_until ? ` · صالح حتى ${escapeHtml(x.valid_until)}` : ''}</div>${x.accepted_at ? '<span class="badge mt-2">مقبول</span>' : `<button class="btn btn--secondary btn--sm mt-2" data-accept-quote="${escapeHtml(x.id)}">اعتماد العرض</button>`}</article>`).join('') : this._empty('لا توجد عروض أسعار بعد. أنشئ طلب مورد من الطلبات الموحدة.')}</div></section>`;
    }

    _suggestions(items) {
        return `<section class="card p-5" data-connected-section="reviews"><h2 class="font-bold">اقتراحات الخبير داخل الحقول</h2><div class="mt-4 space-y-3">${items.length ? items.map(x => `<article class="card p-3"><strong>${escapeHtml(x.field_path)}</strong><p class="text-xs text-muted mt-1">${escapeHtml(x.rationale)}</p><div class="text-sm mt-2"><del>${escapeHtml(valueText(x.old_value))}</del> ← <strong>${escapeHtml(valueText(x.proposed_value))}</strong></div>${x.status === 'pending' ? `<div class="flex gap-2 mt-3"><button class="btn btn--primary btn--sm" data-suggestion="${escapeHtml(x.id)}" data-decision="accepted">قبول وتطبيق</button><button class="btn btn--ghost btn--sm" data-suggestion="${escapeHtml(x.id)}" data-decision="rejected">رفض</button></div>` : `<span class="badge mt-2">${escapeHtml(STATUS_LABEL[x.status] || x.status)}</span>`}</article>`).join('') : this._empty('لا توجد اقتراحات حقول من المراجع حاليًا.')}</div></section>`;
    }

    _versions(items) {
        return `<section class="card p-5" data-connected-section="versions"><div class="flex justify-between gap-2"><h2 class="font-bold">نسخ الدراسة</h2><button id="createConnectedVersion" class="btn btn--secondary btn--sm">حفظ نسخة الآن</button></div><div class="mt-4">${items.length ? items.map(x => `<div class="flex justify-between py-2"><span>نسخة ${x.version_number} · ${escapeHtml(x.change_summary || 'حفظ يدوي')}</span><small class="text-muted">${new Date(x.created_at).toLocaleDateString('ar-SA')}</small></div>`).join('') : this._empty('لا توجد نسخة ثابتة محفوظة بعد.')}</div></section>`;
    }

    _parties(items) {
        return `<section class="card p-5" data-connected-section="parties"><h2 class="font-bold">دليل الجهات الموحد</h2><div class="mt-4 space-y-3">${items.length ? items.slice(0, 12).map(x => `<article class="card p-3"><div class="flex justify-between"><strong>${escapeHtml(x.name)}</strong><span class="badge">${escapeHtml(x.party_type)}</span></div><p class="text-xs text-muted mt-1">${escapeHtml(x.description || '')}</p><button class="btn btn--secondary btn--sm mt-2" data-request-party="${escapeHtml(x.id)}" data-party-name="${escapeHtml(x.name)}" data-party-type="${escapeHtml(x.party_type)}">إنشاء طلب</button></article>`).join('') : this._empty('لا توجد جهات موثقة مفعلة حتى الآن.')}</div></section>`;
    }

    _recommendations(state) {
        let results = state.results || {}; try { results = calculateStudy(state); } catch { /* use cached */ }
        const actions = buildDecisionActionPlan(state, results);
        const links = actions.slice(0, 4).map(item => `<a class="btn btn--ghost btn--sm" href="#/${item.route ? escapeHtml(item.route) : `step/${item.stepIndex}`}">${escapeHtml(item.title)}</a>`).join('');
        return `<section class="card p-5"><h2 class="font-bold">محتوى وأدوات تناسب وضع المشروع</h2><p class="text-xs text-muted mt-1">اقتراحات تتغير وفق نتيجة القرار والفجوات الحالية.</p><div class="flex flex-wrap gap-2 mt-4">${links || '<a class="btn btn--ghost btn--sm" href="./blog.html">مركز المعرفة</a>'}<a class="btn btn--ghost btn--sm" href="./breakeven-calculator.html">حاسبة التعادل</a><button id="connectedShareStudy" class="btn btn--ghost btn--sm">مشاركة الدراسة</button></div></section>`;
    }

    _bind(state, searchable) {
        this.container.querySelector('#connectedBack')?.addEventListener('click', this.onBack);
        this.container.querySelector('#connectedSearch')?.addEventListener('input', event => {
            const query = event.target.value.trim().toLowerCase();
            const target = this.container.querySelector('#connectedSearchResults');
            if (!query) { target.innerHTML = ''; return; }
            const matches = searchable.filter(x => `${x.title} ${x.detail} ${x.kind}`.toLowerCase().includes(query)).slice(0, 12);
            target.innerHTML = matches.length ? matches.map(x => `<button class="btn btn--ghost btn--sm" data-search-target="${x.target}">${escapeHtml(x.kind)}: ${escapeHtml(x.title)}</button>`).join(' ') : '<span class="text-sm text-muted">لا توجد نتيجة.</span>';
            target.querySelectorAll('[data-search-target]').forEach(button => button.addEventListener('click', () => this.container.querySelector(`[data-connected-section="${button.dataset.searchTarget}"]`)?.scrollIntoView({ behavior: 'smooth' })));
        });
        this.container.querySelector('#syncDecisionTasks')?.addEventListener('click', async () => {
            let results = state.results || {}; try { results = calculateStudy(state); } catch { /* use cached */ }
            const response = await syncDecisionTasks(state.projectInfo.id, buildDecisionActionPlan(state, results));
            if (!response.ok) return toast.error(response.error);
            trackEvent('decision_tasks_created', { study_id: state.projectInfo.id }); toast.success('تم ربط خطة القرار بمدير المهام'); await this.render();
        });
        this.container.querySelectorAll('[data-task-status]').forEach(select => select.addEventListener('change', async () => {
            const result = await updateTaskStatus(select.dataset.taskStatus, select.value); if (!result.ok) toast.error(result.error); else toast.success('تم تحديث المهمة');
        }));
        this.container.querySelector('#createConnectedVersion')?.addEventListener('click', async () => {
            const result = await createStudyVersion(state.projectInfo.id, state, 'نسخة يدوية من مركز الربط'); if (!result.ok) return toast.error(result.error); toast.success('تم حفظ نسخة ثابتة'); await this.render();
        });
        this.container.querySelectorAll('[data-suggestion]').forEach(button => button.addEventListener('click', async () => this._handleSuggestion(button, state)));
        this.container.querySelectorAll('[data-accept-quote]').forEach(button => button.addEventListener('click', async () => this._handleQuote(button, state)));
        this.container.querySelector('#newConnectedRequest')?.addEventListener('click', () => this._promptRequest(state));
        this.container.querySelectorAll('[data-request-thread]').forEach(button => button.addEventListener('click', async () => this._openRequestThread(button.dataset.requestThread)));
        this.container.querySelector('#connectedShareStudy')?.addEventListener('click', () => document.getElementById('btnShareStudy')?.click());
        this.container.querySelectorAll('[data-request-party]').forEach(button => button.addEventListener('click', () => this._promptRequest(state, button.dataset)));
    }

    async _openRequestThread(requestId) {
        const host = this.container.querySelector(`[data-thread-host="${requestId}"]`);
        if (!host) return;
        host.innerHTML = '<p class="text-xs text-muted mt-2">جاري التحميل…</p>';
        const result = await listRequestThread(requestId);
        if (!result.ok) { host.innerHTML = `<p class="text-danger">${escapeHtml(result.error)}</p>`; return; }
        host.innerHTML = `<div class="mt-3 space-y-2">${result.data.events.map(item => `<p class="text-xs text-muted">${new Date(item.created_at).toLocaleString('ar-SA')} · ${escapeHtml(item.event_type)} ${item.to_status ? `→ ${escapeHtml(STATUS_LABEL[item.to_status] || item.to_status)}` : ''}</p>`).join('')}${result.data.messages.map(item => `<div class="card p-2 text-sm">${escapeHtml(item.body || 'مرفق')}</div>`).join('')}<button class="btn btn--secondary btn--sm" data-send-request-message>إضافة رسالة</button></div>`;
        host.querySelector('[data-send-request-message]')?.addEventListener('click', async () => {
            const body = window.prompt('اكتب رسالتك'); if (!body) return;
            const sent = await sendRequestMessage(requestId, body); if (!sent.ok) return toast.error(sent.error);
            toast.success('تم إرسال الرسالة'); await this._openRequestThread(requestId);
        });
    }

    async _handleSuggestion(button, state) {
        const suggestion = this.data.suggestions.find(item => item.id === button.dataset.suggestion);
        if (!suggestion) return;
        const accepted = button.dataset.decision === 'accepted';
        if (accepted) {
            const [section, ...path] = suggestion.field_path.split('.');
            if (!section || !path.length) return toast.error('مسار الحقل المقترح غير صالح.');
            const approved = await this._confirmImpactChange(state, { section, path: path.join('.'), value: suggestion.proposed_value }, suggestion.rationale);
            if (!approved) return;
            const version = await createStudyVersion(state.projectInfo.id, state, `قبل تطبيق اقتراح الخبير: ${suggestion.field_path}`);
            if (!version.ok) return toast.error(version.error);
        }
        const result = await decideSuggestion(suggestion.id, accepted ? 'accepted' : 'rejected');
        if (!result.ok) return toast.error(result.error);
        if (accepted) {
            const [section, ...path] = suggestion.field_path.split('.');
            this.store.updatePath(section, path.join('.'), suggestion.proposed_value);
        }
        trackEvent('review_suggestion_decided', { outcome: accepted ? 'accepted' : 'rejected', study_id: state.projectInfo.id });
        toast.success(accepted ? 'طُبق اقتراح الخبير وأعيد حفظ نسخة سابقة' : 'تم رفض الاقتراح'); await this.render();
    }

    async _handleQuote(button, state) {
        const quote = this.data.quotes.find(item => item.id === button.dataset.acceptQuote);
        if (!quote) return;
        if (quote.item_key) {
            const approved = await this._confirmImpactChange(state, { section: quote.section_key, path: quote.item_key, value: Number(quote.amount_sar) }, `اعتماد عرض ${quote.item_label}`);
            if (!approved) return;
            const version = await createStudyVersion(state.projectInfo.id, state, `قبل اعتماد عرض المورد: ${quote.item_label}`);
            if (!version.ok) return toast.error(version.error);
        }
        const result = await acceptSupplierQuote(quote.id);
        if (!result.ok) return toast.error(result.error);
        if (quote.item_key) this.store.updatePath(quote.section_key, quote.item_key, Number(quote.amount_sar));
        toast.success(quote.item_key ? 'تم اعتماد العرض وتحديث بند التكلفة' : 'تم اعتماد عرض السعر');
        await this.render();
    }

    async _confirmImpactChange(state, change, reason) {
        let impact;
        try { impact = compareStudyChange(state, change); } catch { return window.confirm('تعذر حساب الأثر الكامل. هل تريد متابعة التغيير؟'); }
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-card p-6 max-w-3xl" role="dialog" aria-modal="true" dir="rtl"><h2 class="text-xl font-bold">قارن الأثر قبل الاعتماد</h2><p class="text-muted mt-2">${escapeHtml(reason || 'تغيير مقترح')}</p><div class="overflow-auto mt-4"><table class="w-full"><thead><tr><th>المؤشر</th><th>قبل</th><th>بعد</th><th>الفرق</th></tr></thead><tbody>${impact.rows.map(row => `<tr><td>${escapeHtml(row.label)}</td><td>${formatImpactValue(row.before, row.type)}</td><td>${formatImpactValue(row.after, row.type)}</td><td>${formatImpactValue(row.after - row.before, row.type)}</td></tr>`).join('')}</tbody></table></div><p class="mt-4"><strong>القرار:</strong> ${escapeHtml(impact.beforeDecision || '—')} ← ${escapeHtml(impact.afterDecision || '—')}</p><div class="flex gap-2 mt-5"><button class="btn btn--primary" data-impact-approve>اعتماد التغيير</button><button class="btn btn--ghost" data-impact-cancel>إلغاء</button></div></div>`;
        document.body.appendChild(overlay);
        return new Promise(resolve => {
            const finish = value => { overlay.remove(); resolve(value); };
            overlay.querySelector('[data-impact-approve]').addEventListener('click', () => finish(true));
            overlay.querySelector('[data-impact-cancel]').addEventListener('click', () => finish(false));
        });
    }

    async _promptRequest(state, party = {}) {
        const partyType = party.partyType || 'expert';
        const typeMap = { supplier: 'supplier_quote', expert: 'expert_review', partner: 'partnership', financier: 'financing' };
        const title = window.prompt('عنوان الطلب', party.partyName ? `طلب من ${party.partyName}` : 'طلب جديد للمشروع');
        if (!title) return;
        const details = window.prompt('تفاصيل الطلب', '') || '';
        const result = await createWorkRequest({ studyId: state.projectInfo.id, partyId: party.requestParty || null, requestType: typeMap[partyType] || 'expert_review', title, details });
        if (!result.ok) return toast.error(result.error);
        trackEvent('work_request_created', { type: typeMap[partyType] || 'expert_review', study_id: state.projectInfo.id }); toast.success('تم إنشاء الطلب'); await this.render();
    }
}

import { submitConsultationRequest, listMyConsultations } from '../services/ConsultationService.js';
import { toast } from '../utils/toast.js';
import { escapeHtml } from '../utils/escape.js';

const LEVELS = {
    specialist: { label: 'أخصائي', price: 190, desc: 'مساعدة تنفيذية وجمع وترتيب البيانات' },
    consultant: { label: 'مستشار', price: 490, desc: 'مراجعة القطاع والافتراضات وخطة العمل' },
    advisor: { label: 'استشاري', price: 990, desc: 'توجيه استراتيجي ومالي للحالات المعقدة' }
};
const STATUS = { submitted: 'تم الاستلام', reviewing: 'قيد المراجعة', quoted: 'تم التسعير', awaiting_payment: 'بانتظار الدفع', paid: 'مدفوع', scheduled: 'تم تحديد الموعد', completed: 'مكتمل', cancelled: 'ملغي' };

export class AdvisoryView {
    constructor(containerId, store, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onBack = options.onBack || (() => {});
    }

    async render() {
        if (!this.container) return;
        const requests = await listMyConsultations();
        const state = this.store?.getState?.() || {};
        this.container.innerHTML = `
            <div class="advisory-view animate-entry p-6 max-w-4xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="advisoryBack">← رجوع</button>
                <div class="mb-6"><h1 class="text-2xl font-bold mb-2">طلب استشارة</h1><p class="text-muted">حدد نوع المساعدة والخبرة المناسبة، وسيتحول الطلب إلى سجل يمكنك متابعته والدفع عليه داخل المنصة.</p></div>
                <div class="grid grid-cols-3 gap-3 mb-5">
                    ${Object.entries(LEVELS).map(([id, item]) => `<label class="card p-4" style="cursor:pointer"><input type="radio" name="consultLevel" value="${id}" ${id === 'consultant' ? 'checked' : ''}><strong class="block mt-2">${item.label}</strong><span class="text-sm text-muted block">${item.desc}</span><span class="text-gold font-bold block mt-2">${item.price} ريال</span></label>`).join('')}
                </div>
                <div class="card p-6 mb-6" id="advisoryRequestForm">
                    <div class="form-group mb-3"><label class="flex items-center gap-2"><input type="checkbox" id="consultFromStart"><span>أحتاج مختصًا يساعدني من بداية كتابة دراسة الجدوى</span></label></div>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="form-group"><label class="block text-sm mb-1">المجال المطلوب</label><input id="consultSpecialty" class="form-input w-full" placeholder="مثال: مالي، تسويقي، تشغيلي" required></div>
                        <div class="form-group"><label class="block text-sm mb-1">قطاع المشروع</label><input id="consultSector" class="form-input w-full" value="${escapeHtml(state.projectInfo?.sector || '')}" placeholder="مثال: تقنية، تجارة، صحة" required></div>
                    </div>
                    <div class="form-group mt-3"><label class="block text-sm mb-1">الفكرة الأساسية</label><textarea id="consultIdea" class="form-input w-full" rows="5" minlength="10" placeholder="صف الفكرة والمرحلة الحالية وما الذي تحتاج مساعدة فيه">${escapeHtml(state.projectInfo?.concept || '')}</textarea></div>
                    <div class="form-group mt-3"><label class="block text-sm mb-1">ملاحظات إضافية</label><textarea id="consultNotes" class="form-input w-full" rows="3"></textarea></div>
                    <div id="consultError" class="text-danger text-sm mt-2" style="display:none"></div>
                    <button type="button" id="consultSubmit" class="btn btn--primary mt-4">إرسال الطلب</button>
                </div>
                <div class="card p-6"><h2 class="text-lg font-bold mb-4">طلبات الاستشارة</h2>${requests.length ? requests.map(r => `<div class="flex items-center justify-between gap-3 py-3" style="border-bottom:1px solid var(--c-border)"><div><strong>${escapeHtml(LEVELS[r.consultant_level]?.label || r.consultant_level)} — ${escapeHtml(r.specialty)}</strong><div class="text-xs text-muted">${escapeHtml(r.sector)} · ${new Date(r.created_at).toLocaleDateString('ar-SA')}</div></div><div class="text-end"><span class="badge">${escapeHtml(STATUS[r.status] || r.status)}</span><div class="text-sm font-bold mt-1">${Number(r.amount_sar).toLocaleString('ar-SA')} ريال</div></div></div>`).join('') : '<p class="text-muted">لا توجد طلبات استشارة بعد.</p><button type="button" id="advisoryEmptyNewRequestBtn" class="btn btn--secondary mt-2">بدء طلب استشارة جديد</button>'}</div>
            </div>`;
        this.container.querySelector('#advisoryBack')?.addEventListener('click', () => this.onBack());
        this.container.querySelector('#consultSubmit')?.addEventListener('click', () => this.submit());
        this.container.querySelector('#advisoryEmptyNewRequestBtn')?.addEventListener('click', () => {
            this.container.querySelector('#advisoryRequestForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            this.container.querySelector('#consultSpecialty')?.focus();
        });
    }

    async submit() {
        const errorEl = this.container.querySelector('#consultError');
        const button = this.container.querySelector('#consultSubmit');
        errorEl.style.display = 'none'; button.disabled = true; button.textContent = 'جاري الإرسال...';
        const result = await submitConsultationRequest({
            studyId: this.store?.getState?.()?.projectInfo?.id,
            helpFromStart: this.container.querySelector('#consultFromStart')?.checked,
            level: this.container.querySelector('input[name="consultLevel"]:checked')?.value,
            specialty: this.container.querySelector('#consultSpecialty')?.value,
            sector: this.container.querySelector('#consultSector')?.value,
            idea: this.container.querySelector('#consultIdea')?.value,
            notes: this.container.querySelector('#consultNotes')?.value
        });
        if (!result.ok) { errorEl.textContent = result.error || 'تعذر إرسال الطلب'; errorEl.style.display = 'block'; button.disabled = false; button.textContent = 'إرسال الطلب'; return; }
        toast.success('تم استلام طلب الاستشارة');
        await this.render();
    }
}

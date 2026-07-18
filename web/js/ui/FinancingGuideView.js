/**
 * صفحة "الجدوى وطلب التمويل" — شرح كيف تُستخدم مخرجات المنصة عند التقديم لبنك أو صندوق أو مستثمر.
 * + قائمة تحقق "جاهزية التقديم للتمويل" (FasterCapital — ملخص، مالي، مخاطر، ضمانات، بيانات الاتصال).
 * + فقرة استشارة تمويل متخصصة / ربط شركاء دون التعهد بنتائج.
 */
import { APP_CONFIG, RESOURCES_GUIDANCE_LINKS } from '../config.js';
import { calculateStudy } from '../core/engine.js';

/** قائمة تحقق جاهزية التقديم — بنود عامة (بنك التنمية وغيره). تُحمّل من الـ store إن وُجدت. */
const DEFAULT_READINESS_ITEMS = [
    { id: 'projectIdentity', label: 'هوية المشروع (اسم، قطاع، موقع)', done: false },
    { id: 'summary', label: 'ملخص تنفيذي جاهز', done: false },
    { id: 'financial', label: 'جداول مالية مكتملة', done: false },
    { id: 'risks', label: 'تحليل مخاطر موثّق', done: false },
    { id: 'guarantees', label: 'ضمانات إن وُجدت', done: false },
    { id: 'contact', label: 'بيانات الاتصال', done: false }
];

export class FinancingGuideView {
    constructor(containerId, store, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onBack = options.onBack || (() => {});
        this.onOpenExport = options.onOpenExport || null;
        const state = store?.getState?.() || {};
        const saved = state.financingReadinessChecklist;
        this.checklist = Array.isArray(saved) && saved.length > 0
            ? saved.map(i => ({ id: i.id, label: i.label || i.id, done: !!i.done }))
            : DEFAULT_READINESS_ITEMS.map(i => ({ ...i }));
    }

    isAllComplete() {
        return this.checklist.every(i => i.done);
    }

    updateCompletionMessage() {
        const el = this.container.querySelector('#financingReadinessMessage');
        if (!el) return;
        if (this.isAllComplete()) {
            el.textContent = 'جميع البنود مكتملة — يمكنك تصدير التقرير للتقديم.';
            el.classList.add('text-success');
            el.classList.remove('text-muted');
            el.setAttribute('role', 'status');
        } else {
            el.textContent = 'حدّد البنود المكتملة. عند إكمالها كلها ستظهر رسالة جاهزية التصدير.';
            el.classList.remove('text-success');
            el.classList.add('text-muted');
        }
    }

    async render() {
        if (!this.container) return;

        const listHtml = this.checklist.map((item, idx) => `
            <tr class="border-b border-white/10">
                <td class="p-3">${item.label}</td>
                <td class="p-3 text-center">
                    <label class="inline-flex items-center gap-1">
                        <input type="checkbox" data-idx="${idx}" class="check-readiness" ${item.done ? 'checked' : ''} aria-label="${item.label}">
                        <span class="text-xs">تم</span>
                    </label>
                </td>
            </tr>
        `).join('');

        const consultationUrl = APP_CONFIG?.consultationBookingUrl || '';
        const fundingLinks = (RESOURCES_GUIDANCE_LINKS || []).filter(l => (l.name || '').includes('بنك') || (l.name || '').includes('تمويل') || (l.url || '').includes('sdb') || (l.url || '').includes('monshaat'));
        const partnerLink = consultationUrl ? { url: consultationUrl, name: 'صفحة حجز الاستشارة' } : (fundingLinks[0] ? { url: fundingLinks[0].url, name: fundingLinks[0].name } : null);
        const consultationParagraph = partnerLink
            ? `للحصول على استشارة تمويل متخصصة أو ربط بمصادر تمويل، يمكنك التواصل مع <a href="${partnerLink.url}" target="_blank" rel="noopener" class="text-gold underline">${partnerLink.name}</a>. المنصة لا تتعهد بنتائج أو اعتماد من جهات التمويل.`
            : 'للحصول على استشارة تمويل متخصصة أو ربط بمصادر تمويل، يمكنك التواصل مع إدارة المنصة أو الجهات المعنية في بلدك. المنصة لا تتعهد بنتائج أو اعتماد من جهات التمويل.';

        let partnerNeeds = [];
        try {
            partnerNeeds = calculateStudy(this.store?.getState?.() || {})?.partnerNeeds || [];
        } catch (e) {
            console.error('[FinancingGuideView] تعذّر حساب احتياجات الشريك الاستراتيجي:', e);
        }
        const fundingNeed = partnerNeeds.find(n => n.type === 'financial_equity');

        this.container.innerHTML = `
            <div class="financing-guide-view animate-entry p-6 max-w-3xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="financingGuideBack">← رجوع</button>
                <h1 class="text-2xl font-bold mb-2">الجدوى وطلب التمويل</h1>
                <p class="text-muted mb-6">كيف تُستخدم مخرجات المنصة عند التقديم لبنك أو صندوق أو مستثمر.</p>

                <div class="card card-hover mb-6 p-6">
                    <h2 class="text-lg font-bold mb-4 text-gold">كيف تُستخدم مخرجات المنصة عند طلب التمويل؟</h2>
                    <p class="text-sm text-muted mb-4">جهات التمويل (مثل بنك التنمية الاجتماعية، صندوق، مستثمر) تطلب عادةً مستنداً يوضح جدوى المشروع. مخرجات منصتنا توفّر ما يلي بشكل واضح وقابل للمراجعة — دون ادعاء اعتماد رسمي من أي جهة:</p>
                    <ul class="text-sm text-muted mb-4 list-disc list-inside space-y-2">
                        <li><strong>ملخص تنفيذي</strong> — تعريف المشروع، المشكلة والحل، أبرز المؤشرات والتوصية.</li>
                        <li><strong>جداول مالية</strong> — قائمة دخل، تدفقات نقدية، مؤشرات (NPV، IRR، فترة الاسترداد، نقطة التعادل).</li>
                        <li><strong>تحليل مخاطر</strong> — أبرز المخاطر وخطط المواجهة.</li>
                        <li><strong>استخدامات الطلب</strong> — تفصيل مبلغ التمويل المطلوب وكيفية استخدامه (أصول، تشغيل، رأس مال عامل).</li>
                    </ul>
                    <p class="text-sm text-muted mb-4">التقرير المُصدّر (PDF أو نسخة للممول) يجمع هذه العناصر ويمكنك تقديمه للبنك أو المؤسسة التمويلية أو المستثمر. المتطلبات الفعلية تختلف حسب كل جهة.</p>
                    ${this.onOpenExport ? `
                    <button type="button" class="btn btn--primary mt-2" id="financingGuideExport">
                        <svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg> تصدير تقرير للمؤسسة التمويلية
                    </button>
                    ` : ''}
                </div>

                <div class="card card-hover mb-6 p-6" id="financingChecklistSection">
                    <h2 class="text-lg font-bold mb-4 text-gold">جاهزية التقديم للتمويل (قائمة تحقق)</h2>
                    <p class="text-xs text-muted mb-4">حدّد البنود المكتملة قبل التصدير أو التقديم. عند إكمال جميع البنود ستظهر رسالة تأكيد.</p>
                    <table class="w-full text-sm" style="border-collapse: collapse;">
                        <thead>
                            <tr class="border-b border-white/10">
                                <th class="text-right p-3 font-bold text-gold">البند</th>
                                <th class="text-center p-3 font-bold text-gold w-24">تم</th>
                            </tr>
                        </thead>
                        <tbody>${listHtml}</tbody>
                    </table>
                    <p id="financingReadinessMessage" class="text-sm mt-4 text-muted" role="status">حدّد البنود المكتملة. عند إكمالها كلها ستظهر رسالة جاهزية التصدير.</p>
                    <p class="text-xs text-muted mt-2">المتطلبات الفعلية تختلف حسب كل جهة. يُوصى بمراجعة بوابة الجهة قبل التقديم.</p>
                    <div class="flex gap-2 mt-4">
                        <button type="button" class="btn btn--secondary btn--sm" id="financingChecklistPrint" aria-label="طباعة أو تصدير قائمة التحقق كـ PDF"><svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg> طباعة / تصدير القائمة</button>
                    </div>
                </div>

                <div class="card card-hover mb-6 p-4">
                    ${fundingNeed ? `<p class="text-sm mb-3">${fundingNeed.reason}</p>` : ''}
                    <p class="text-sm text-muted">${consultationParagraph}</p>
                </div>

                <p class="text-xs text-muted">التقرير المُصدّر من المنصة مُنشأ بمعايير دراسات جدوى قابلة للمراجعة والتدقيق. لا ادعاء اعتماد رسمي من بنك أو جهة تمويل إلا بموجب اتفاق.</p>
            </div>
        `;

        this.container.querySelector('#financingGuideBack')?.addEventListener('click', () => this.onBack());
        this.container.querySelector('#financingGuideExport')?.addEventListener('click', () => {
            if (this.onOpenExport) this.onOpenExport('financier');
        });
        this.container.querySelector('#financingChecklistPrint')?.addEventListener('click', () => this.printChecklist());

        this.container.querySelectorAll('.check-readiness').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx, 10);
                if (!isNaN(idx)) {
                    this.checklist[idx].done = e.target.checked;
                    this.updateCompletionMessage();
                    if (this.store?.setState) this.store.setState({ financingReadinessChecklist: [...this.checklist] });
                }
            });
        });

        this.updateCompletionMessage();
    }

    printChecklist() {
        const win = window.open('', '_blank');
        if (!win) {
            import('../utils/toast.js').then(({ toast }) => toast.error('تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.'));
            return;
        }
        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>جاهزية التقديم للتمويل — قائمة تحقق</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 24px; font-size: 12pt; }
                    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
                    th, td { padding: 10px 14px; text-align: right; border: 1px solid #ddd; }
                    th { background: #1a365d; color: #fff; }
                    .note { font-size: 10pt; color: #666; margin-top: 16px; }
                </style>
            </head>
            <body>
                <h1>جاهزية التقديم للتمويل — قائمة تحقق</h1>
                <p class="note">بنود عامة للمراجعة قبل التصدير أو التقديم. المتطلبات الفعلية تختلف حسب الجهة (بنك التنمية الاجتماعية، صندوق، مستثمر). يُوصى بمراجعة بوابة الجهة قبل التقديم.</p>
                <table>
                    <thead><tr><th>البند</th><th>تم</th></tr></thead>
                    <tbody>
                        ${this.checklist.map(i => `
                            <tr>
                                <td>${i.label}</td>
                                <td>${i.done ? '✓' : ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <p class="note">محاكي الجدوى — قائمة تحقق عامة للمراجعة قبل التقديم.</p>
            </body>
            </html>`;
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
    }
}

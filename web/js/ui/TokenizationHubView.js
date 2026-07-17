/**
 * مخطط توزيع الحصص (تخطيط داخلي فقط) — إعادة بناء كاملة (2026-07-17).
 * النسخة السابقة كانت "منصة ترميز حصص/تمويل جماعي" وهمية بالكامل: أزرار "إصدار أسهم
 * رقمية (Mint Tokens)" و"بدء جولة التمويل" لا تنفّذ شيئاً حقيقياً، وجميع الأرقام (القيمة
 * السوقية، جدول Vesting للموظفين، نسب Cap Table) كانت مكتوبة يدوياً بلا أي حقل بيانات
 * فعلي في المخطط. إصدار أسهم رقمية قابلة للتداول وطرحها للجمهور نشاط مالي منظّم يتطلب
 * ترخيصاً من هيئة السوق المالية (CMA) — قرار عمل/ترخيص خارج نطاق هذه الأداة، وليس شيئاً
 * يمكن بناؤه أو محاكاته هنا.
 *
 * هذه النسخة أداة تخطيط بحتة (worksheet) على بيانات حقيقية فقط:
 * - هيكل الملكية الفعلي: state.keyPeople.partnershipContracts (جدول قابل للتعديل فعلياً
 *   في خطوة «الأشخاص الرئيسون» — wizardSteps.js، ومعروض في لوحة فحص مخاطر العقد بـ Wizard.js).
 * - مزيج مصادر التمويل الفعلي: state.financing.sources (تمويل ذاتي/قرض/مستثمرون/دعم
 *   حكومي) — نفس الحقول الحية في FinancingStructure.js.
 * - حاسبة "ماذا-لو" للتخفيف: حساب حسابي محلي بحت (لا يُحفظ، لا يعدّل عقود الشراكة
 *   الفعلية) على نسبة يُدخلها المستخدم — لا يوجد حقل ESOP/vesting في المخطط فلا يُعرض
 *   أي جدول استحقاق وهمي.
 */
import { formatCurrency, formatFractionAsPercent } from '../utils/formatters.js';
import { escapeHtml } from '../utils/escape.js';

export class TokenizationHubView {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.poolPercent = 0; // حاسبة "ماذا-لو" — قيمة محلية غير محفوظة في الدراسة
    }

    async render() {
        if (!this.container) return;

        const state = this.store.get();
        const partners = state?.keyPeople?.partnershipContracts || [];

        if (partners.length === 0) {
            this.container.innerHTML = `
                <div class="cap-table-view" style="max-width:860px;margin:0 auto;padding:var(--s-4) 0;">
                    <button type="button" id="btnCapTableBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>
                    <h2 class="section-title"><svg class="ic" aria-hidden="true"><use href="#i-users"/></svg> مخطط توزيع الحصص (ESOP)</h2>
                    <div class="alert alert--info mt-4">
                        <p class="mb-0">أضف الشركاء ونسبهم في جدول «عقود الشراكة» ضمن خطوة «الأشخاص الرئيسون» لعرض هيكل الملكية وحاسبة التخفيف هنا.</p>
                    </div>
                </div>`;
            this.container.querySelector('#btnCapTableBack')?.addEventListener('click', () => {
                window.location.hash = '#/home';
            });
            return this.container;
        }

        this.partners = partners;
        this.financing = state?.financing || {};

        this.container.innerHTML = `
            <div class="cap-table-view" style="max-width:860px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnCapTableBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>
                <h2 class="section-title"><svg class="ic" aria-hidden="true"><use href="#i-users"/></svg> مخطط توزيع الحصص (ESOP)</h2>
                <p class="text-muted mb-4">أداة تخطيط داخلية لهيكل الملكية والتخفيف المستقبلي — على بياناتك الفعلية فقط.</p>

                <div class="alert alert--info mb-4">
                    <p class="mb-0">أداة تخطيط داخلي فقط: حساب حسابي على نسب تُدخلها أنت. إصدار أسهم حقيقية أو طرحها للجمهور نشاط مالي منظّم يتطلب ترخيصاً من هيئة السوق المالية (CMA) وليس جزءاً من هذه الأداة، ولا تُنشئ هذه الشاشة أي سجل ملكية رسمي.</p>
                </div>

                <div id="capTableBody"></div>
            </div>
        `;
        this.container.querySelector('#btnCapTableBack')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        this.renderBody();
        return this.container;
    }

    renderBody() {
        const body = this.container.querySelector('#capTableBody');
        if (!body) return;

        const partners = this.partners;
        const totalShare = partners.reduce((sum, p) => sum + (Number(p.sharePercent) || 0), 0);
        const shareWarning = Math.abs(totalShare - 100) > 0.5
            ? `<div class="alert alert--warning mb-3"><p class="mb-0">مجموع نسب الشركاء الحالي <strong>${formatFractionAsPercent(totalShare / 100, 1)}</strong> ${totalShare > 100 ? 'يتجاوز' : 'أقل من'} 100% — راجع جدول «عقود الشراكة» في خطوة «الأشخاص الرئيسون».</p></div>`
            : '';

        const partnerRows = partners.map(p => `
            <tr style="border-bottom:1px solid var(--c-border);">
                <td style="padding:8px 12px;">${escapeHtml(p.partnerName || 'شريك بلا اسم')}</td>
                <td style="padding:8px 12px;">${escapeHtml(p.role || '—')}</td>
                <td style="padding:8px 12px;" class="text-mono">${formatFractionAsPercent((Number(p.sharePercent) || 0) / 100, 1)}</td>
            </tr>
        `).join('');

        const sources = this.financing.sources || {};
        const FUNDING_LABELS = [
            { key: 'equity', label: 'تمويل ذاتي' },
            { key: 'bankLoan', label: 'قرض بنكي' },
            { key: 'investors', label: 'مستثمرون' },
            { key: 'governmentSupport', label: 'دعم حكومي' }
        ];
        const totalFinancing = FUNDING_LABELS.reduce((sum, { key }) => sum + (Number(sources[key]?.amount) || 0), 0);
        const equityShare = Number(sources.investors?.equityShare) || 0;

        const financingRows = FUNDING_LABELS.map(({ key, label }) => {
            const amount = Number(sources[key]?.amount) || 0;
            if (amount === 0) return '';
            return `
                <tr style="border-bottom:1px solid var(--c-border);">
                    <td style="padding:8px 12px;">${label}</td>
                    <td style="padding:8px 12px;" class="text-mono">${formatCurrency(amount)}</td>
                    <td style="padding:8px 12px;" class="text-mono">${totalFinancing > 0 ? formatFractionAsPercent(amount / totalFinancing, 1) : '—'}</td>
                </tr>`;
        }).join('');

        body.innerHTML = `
            <div class="card mb-4">
                <h3 class="card-title mb-2">هيكل الملكية الحالي</h3>
                ${shareWarning}
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="text-align:right;border-bottom:1px solid var(--c-border);">
                                <th style="padding:8px 12px;">الشريك</th>
                                <th style="padding:8px 12px;">الدور</th>
                                <th style="padding:8px 12px;">النسبة</th>
                            </tr>
                        </thead>
                        <tbody>${partnerRows}</tbody>
                    </table>
                </div>
                <p class="text-xs text-muted mt-2 mb-0">لتعديل الشركاء أو نسبهم، عُد لجدول «عقود الشراكة» في خطوة «الأشخاص الرئيسون».</p>
            </div>

            ${totalFinancing > 0 ? `
            <div class="card mb-4">
                <h3 class="card-title mb-2">مزيج مصادر التمويل</h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="text-align:right;border-bottom:1px solid var(--c-border);">
                                <th style="padding:8px 12px;">المصدر</th>
                                <th style="padding:8px 12px;">المبلغ</th>
                                <th style="padding:8px 12px;">النسبة من التمويل</th>
                            </tr>
                        </thead>
                        <tbody>${financingRows}</tbody>
                    </table>
                </div>
                ${equityShare > 0 ? `<p class="text-sm mt-2 mb-0">حصة الملكية المُتنازل عنها للمستثمرين حسب هيكل التمويل الحالي: <strong class="text-mono">${formatFractionAsPercent(equityShare / 100, 1)}</strong> (مُدخلة في خطوة «هيكل التمويل»).</p>` : ''}
                <p class="text-xs text-muted mt-2 mb-0">لتعديل مصادر التمويل، عُد لخطوة «هيكل التمويل».</p>
            </div>` : ''}

            <div class="card glass-card">
                <h3 class="card-title mb-2">حاسبة التخفيف (ماذا-لو)</h3>
                <p class="text-sm text-muted mb-3">أدخل نسبة تريد تخصيصها لمجمّع حوافز موظفين جديد أو مستثمر جديد لترى أثرها الحسابي على نسب الشركاء الحاليين. حساب حسابي بحت محلي — لا يُحفظ في دراستك ولا يعدّل عقود الشراكة الفعلية.</p>
                <label class="text-sm" style="display:flex;align-items:center;gap:8px;max-width:280px;">
                    نسبة التخصيص الجديدة %
                    <input type="number" id="dilutionPoolInput" class="form-control" min="0" max="99" step="1" value="${this.poolPercent}">
                </label>
                <div id="dilutionResult" class="mt-3"></div>
            </div>
        `;

        body.querySelector('#dilutionPoolInput')?.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            this.poolPercent = Number.isFinite(v) ? Math.min(Math.max(v, 0), 99) : 0;
            this.renderDilution();
        });

        this.renderDilution();
    }

    renderDilution() {
        const resultEl = this.container.querySelector('#dilutionResult');
        if (!resultEl) return;

        const pool = this.poolPercent;
        if (!pool) {
            resultEl.innerHTML = `<p class="text-sm text-muted mb-0">أدخل نسبة أعلاه لعرض أثر التخفيف.</p>`;
            return;
        }

        const factor = 1 - (pool / 100);
        const rows = this.partners.map(p => {
            const original = Number(p.sharePercent) || 0;
            const diluted = original * factor;
            return `
                <tr style="border-bottom:1px solid var(--c-border);">
                    <td style="padding:8px 12px;">${escapeHtml(p.partnerName || 'شريك بلا اسم')}</td>
                    <td style="padding:8px 12px;" class="text-mono">${formatFractionAsPercent(original / 100, 1)}</td>
                    <td style="padding:8px 12px;" class="text-mono">${formatFractionAsPercent(diluted / 100, 1)}</td>
                </tr>`;
        }).join('');

        resultEl.innerHTML = `
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="text-align:right;border-bottom:1px solid var(--c-border);">
                            <th style="padding:8px 12px;">الشريك</th>
                            <th style="padding:8px 12px;">النسبة الحالية</th>
                            <th style="padding:8px 12px;">النسبة بعد التخصيص</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <p class="text-xs text-muted mt-2 mb-0">حساب مبسّط: كل نسبة حالية × (1 − ${formatFractionAsPercent(pool / 100, 0)}) — لا يأخذ بعين الاعتبار تفاصيل قانونية كأنواع الأسهم أو حقوق الأولوية أو أثر التخفيف على المستثمرين الحاليين.</p>
        `;
    }
}

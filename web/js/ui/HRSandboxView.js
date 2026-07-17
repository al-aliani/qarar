/**
 * محاكي الموارد البشرية والرواتب — يعيد استخدام buildNitaqatHrCardData()
 * (nitaqatHrCard.js) بلا أي حساب موازٍ: نفس تصنيف نطاقات ونفس مقارنة تكلفة
 * سعودي/وافد المستخدمة فعلاً أسفل جدول «الوظائف والرواتب» في معالج الدراسة
 * (Wizard.js)، بما فيها إفصاح "تقريبي" الإلزامي لأن classifyNitaqatTier ليس
 * المعادلة الرسمية لمنصة قوى.
 */
import { buildNitaqatHrCardData } from '../core/nitaqatHrCard.js';
import { formatCurrency, formatFractionAsPercent } from '../utils/formatters.js';
import { escapeHtml } from '../utils/escape.js';

export class HRSandboxView {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    async render() {
        if (!this.container) return;

        const state = this.store.get();
        const positions = state?.hr?.positions || [];

        if (positions.length === 0) {
            this.container.innerHTML = `
                <div class="hr-sandbox-view" style="max-width:760px;margin:0 auto;padding:var(--s-4) 0;">
                    <button type="button" id="btnHrSandboxBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>
                    <h2 class="section-title"><svg class="ic" aria-hidden="true"><use href="#i-users"/></svg> محاكي الموارد البشرية والرواتب</h2>
                    <div class="alert alert--info mt-4">
                        <p>أضف موظفين في خطوة «الوظائف والرواتب» لعرض تصنيف نطاقك التقريبي ومقارنة تكلفة التوظيف.</p>
                    </div>
                </div>`;
            this.container.querySelector('#btnHrSandboxBack')?.addEventListener('click', () => {
                window.location.hash = '#/home';
            });
            return this.container;
        }

        const data = buildNitaqatHrCardData(state);

        const tierHtml = data.tierInfo ? `
            <p class="mb-1">نسبة التوطين الحالية <strong>${formatFractionAsPercent(data.rate, 0)}</strong>
                تقع تقريبياً ضمن نطاق «<strong>${escapeHtml(data.tierInfo.label)}</strong>»${data.sectorLabel ? ` (تقدير مبسّط لقطاع «${escapeHtml(data.sectorLabel)}»)` : ''}.
                ${!data.tierInfo.isCompliant ? `<span class="text-danger">هذا أقل من الحد الأدنى التقريبي للالتزام (${formatFractionAsPercent(data.tierInfo.minCompliantRate, 0)}) — راجع حسابك في منصة قوى.</span>` : ''}
            </p>
            <p class="text-xs text-muted mb-0">تصنيف تقريبي تعليمي وليس رقماً رسمياً منشوراً — النسبة الملزمة الدقيقة تُحسب بمعادلة رسمية تختلف حسب نشاطك وحجم منشأتك، راجعها في منصة قوى (qiwa.sa).</p>
        ` : `<p class="mb-0 text-muted">لا يمكن تصنيف النطاق بعد.</p>`;

        const positionRows = positions.map(p => `
            <tr style="border-bottom:1px solid var(--c-border);">
                <td style="padding:8px 12px;">${escapeHtml(p.position || 'بلا مسمى')}</td>
                <td style="padding:8px 12px;">${p.nationality === 'saudi' ? 'سعودي' : 'وافد'}</td>
                <td style="padding:8px 12px;" class="text-mono">${Number(p.count) || 1}</td>
                <td style="padding:8px 12px;" class="text-mono">${p.salary ? formatCurrency(p.salary) : '—'}</td>
            </tr>
        `).join('');

        this.container.innerHTML = `
            <div class="hr-sandbox-view" style="max-width:760px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnHrSandboxBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>
                <h2 class="section-title"><svg class="ic" aria-hidden="true"><use href="#i-users"/></svg> محاكي الموارد البشرية والرواتب</h2>
                <p class="text-muted mb-4">نطاقات، ومقارنة تكلفة سعودي/وافد على بياناتك الفعلية.</p>

                <div class="card glass-card mb-4">
                    <h3 class="card-title mb-2">تصنيف نطاقات (تقريبي)</h3>
                    ${tierHtml}
                </div>

                <div class="card glass-card mb-4">
                    <h3 class="card-title mb-2">مقارنة التكلفة السنوية</h3>
                    <p class="text-sm mb-1">${data.avgSalaryIsAssumed ? 'مثال توضيحي براتب أساسي شهري' : 'بمتوسط الراتب الأساسي الشهري المُدخل'} ${formatCurrency(data.avgSalary)}:</p>
                    <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
                        <div><div class="text-xs text-muted">موظف سعودي / سنة</div><div class="text-mono" style="font-weight:700;">${formatCurrency(data.saudiAnnualCost)}</div></div>
                        <div><div class="text-xs text-muted">موظف وافد / سنة</div><div class="text-mono" style="font-weight:700;">${formatCurrency(data.expatAnnualCost)}</div></div>
                    </div>
                    <p class="text-xs text-muted mt-2 mb-0">معدل التأمينات الاجتماعية (GOSI) المستخدم كما بتاريخ 2026 — لا تغذية حية، راجع gosi.gov.sa لأي تحديث رسمي لاحق.</p>
                </div>

                <div class="card" style="padding:0;overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="text-align:right;border-bottom:1px solid var(--c-border);">
                                <th style="padding:8px 12px;">المنصب</th>
                                <th style="padding:8px 12px;">الجنسية</th>
                                <th style="padding:8px 12px;">العدد</th>
                                <th style="padding:8px 12px;">الراتب الأساسي</th>
                            </tr>
                        </thead>
                        <tbody>${positionRows}</tbody>
                    </table>
                </div>
                <p class="text-xs text-muted mt-2">لتعديل المناصب أو الرواتب، عُد لخطوة «الوظائف والرواتب» في معالج الدراسة.</p>
            </div>
        `;

        this.container.querySelector('#btnHrSandboxBack')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        return this.container;
    }
}

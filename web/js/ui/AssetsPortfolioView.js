/**
 * محفظة الأصول وجدول الإهلاك — نطاق مُضيَّق عمداً للإهلاك الحقيقي فقط
 * (state.technical.equipment/buildings/furniture + مخرجات calculateStudy الرسمية).
 * النسخة السابقة كانت تخترع "عقود إيجار/فروع" (فرع الملقا، تنبيهات تجديد...) بلا أي
 * حقل بيانات فعلي في المخطط — حُذف ذلك المحتوى بالكامل بدل تركه وهمياً.
 */
import { calculateStudy } from '../core/engine.js';
import { formatCurrency } from '../utils/formatters.js';
import { escapeHtml } from '../utils/escape.js';

const DEFAULT_RATES = { equipment: 0.15, buildings: 0.05, furniture: 0.20 };
const CATEGORY_LABELS = { equipment: 'معدات', buildings: 'مباني وتشطيبات', furniture: 'أثاث' };

export class AssetsPortfolioView {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    async render() {
        if (!this.container) return;

        const state = this.store.get();
        const technical = state?.technical || {};
        const items = [
            ...(technical.equipment || []).map(i => ({ ...i, category: 'equipment' })),
            ...(technical.buildings || []).map(i => ({ ...i, category: 'buildings' })),
            ...(technical.furniture || []).map(i => ({ ...i, category: 'furniture' }))
        ];

        this.container.innerHTML = `
            <div class="assets-portfolio-view" style="max-width:860px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnAssetsBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>
                <h2 class="section-title"><svg class="ic" aria-hidden="true"><use href="#i-box"/></svg> محفظة الأصول وجدول الإهلاك</h2>
                <p class="text-muted mb-4">متى تحتاج لاستبدال معداتك وأثاثك، على بياناتك الفعلية.</p>
                <div id="assetsBody"></div>
            </div>
        `;
        this.container.querySelector('#btnAssetsBack')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        const body = this.container.querySelector('#assetsBody');

        if (items.length === 0) {
            body.innerHTML = `
                <div class="alert alert--info">
                    <p>أضف معدات أو مباني أو أثاث في خطوة «خطة المشتريات والأصول» لعرض جدول الإهلاك.</p>
                </div>`;
            return this.container;
        }

        let result = null;
        try { result = calculateStudy(state); } catch (_) { result = null; }

        const summaryHtml = result?.capex?.breakdown ? `
            <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px;">
                <div class="card"><div class="text-xs text-muted">القيمة الدفترية الحالية</div><div class="text-mono" style="font-size:1.3rem;font-weight:700;">${formatCurrency((result.capex.breakdown.equipment || 0) + (result.capex.breakdown.buildings || 0) + (result.capex.breakdown.furniture || 0))}</div></div>
                <div class="card"><div class="text-xs text-muted">الإهلاك السنوي الرسمي</div><div class="text-mono" style="font-size:1.3rem;font-weight:700;">${formatCurrency(result.depreciation)}</div></div>
            </div>
            <p class="text-xs text-muted mb-4">القيمة الدفترية أعلاه من مؤشرات دراستك الرسمية وقد لا تساوي مجموع الجدول أدناه تماماً (المؤشرات الرسمية تطبّق استراتيجية الإطلاق ووفورات التكلفة، والجدول أدناه أرقام الأصول الخام).</p>
        ` : `<div class="alert alert--warning mb-4"><p>أكمل بيانات دراستك المالية لعرض القيمة الدفترية الإجمالية الرسمية — الجدول أدناه لا يزال متاحاً من بيانات الأصول الخام.</p></div>`;

        const itemRows = items.map(it => {
            const rate = Number.isFinite(Number(it.depreciationRate)) && it.depreciationRate !== '' ? Number(it.depreciationRate) : DEFAULT_RATES[it.category];
            const isDefault = it.depreciationRate === '' || it.depreciationRate == null;
            const life = rate > 0 ? Math.round(1 / rate) : null;
            const value = (Number(it.price) || 0) * (Number(it.quantity) || 1);
            return `
                <tr style="border-bottom:1px solid var(--c-border);">
                    <td style="padding:8px 12px;">${escapeHtml(it.name || 'بند بلا اسم')}</td>
                    <td style="padding:8px 12px;">${CATEGORY_LABELS[it.category]}</td>
                    <td style="padding:8px 12px;" class="text-mono">${formatCurrency(value)}</td>
                    <td style="padding:8px 12px;" class="text-mono">${(rate * 100).toFixed(0)}%${isDefault ? ' <span class="text-xs text-muted">(افتراضي)</span>' : ''}</td>
                    <td style="padding:8px 12px;" class="text-mono">${life ? `${life} سنة` : '—'}</td>
                </tr>`;
        }).join('');

        // جدول الإحلال: مجموع سنوي حقيقي من incomeStatement — يشمل المعدات والأثاث فقط
        // (لا المباني)، لأن buildDepreciationModel لا يُدرج المباني في دورة الإحلال أصلاً
        // (تُجدَّد/تُصان لا تُستبدَل بدورة ثابتة).
        const replacementYears = (result?.incomeStatement || [])
            .filter(y => (y.replacementCost || 0) > 0)
            .map(y => `<li>السنة ${y.year}: <strong class="text-mono">${formatCurrency(y.replacementCost)}</strong></li>`)
            .join('');

        body.innerHTML = `
            ${summaryHtml}
            <div class="card" style="padding:0;overflow-x:auto;margin-bottom:16px;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="text-align:right;border-bottom:1px solid var(--c-border);">
                            <th style="padding:8px 12px;">البند</th>
                            <th style="padding:8px 12px;">الفئة</th>
                            <th style="padding:8px 12px;">القيمة</th>
                            <th style="padding:8px 12px;">% استهلاك</th>
                            <th style="padding:8px 12px;">العمر الافتراضي</th>
                        </tr>
                    </thead>
                    <tbody>${itemRows}</tbody>
                </table>
            </div>
            <div class="card glass-card">
                <h3 class="card-title mb-2">متى ستحتاج لاستبدال أصولك؟</h3>
                ${replacementYears
                    ? `<ul class="text-sm mb-0">${replacementYears}</ul><p class="text-xs text-muted mt-2 mb-0">السنوات مُعدّة من إطلاق مشروعك (السنة 1، 2...) لا سنوات تقويمية — لا يوجد تاريخ شراء مُدخل بعد. تشمل المعدات والأثاث فقط؛ المباني عادة تُصان/تُجدَّد لا تُستبدَل بدورة ثابتة.</p>`
                    : `<p class="text-sm text-muted mb-0">لا حاجة إحلال متوقعة خلال أفق دراستك الحالي.</p>`}
            </div>
        `;

        return this.container;
    }
}

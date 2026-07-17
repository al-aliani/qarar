/**
 * رادار الذكاء التنافسي — نطاق مُضيَّق عمداً لبيانات المنافسين الحقيقية فقط
 * (state.marketing.competitors + state.marketing.competitorBenchmarking، نفس مصدر
 * خطوة «تحليل السوق» MarketAnalysis.js). النسخة السابقة كانت تعرض منافسين وهميين
 * ("المنافس (أ)"، "المنافس (ب)") ونصاً تحليلياً مكتوباً يدوياً بأرقام ثابتة — حُذف
 * ذلك المحتوى بالكامل بدل تركه وهمياً (نفس مبدأ AssetsPortfolioView.js).
 */
import { escapeHtml } from '../utils/escape.js';

export class CompetitorIntelligenceView {
    constructor(containerOrId, store) {
        this.container = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
        this.store = store;
    }

    async render() {
        if (!this.container) return;

        const state = this.store?.get ? this.store.get() : (this.store?.getState ? this.store.getState() : {});
        const competitors = (state?.marketing?.competitors || [])
            .filter(c => c && (c.name || c.strengths || c.weaknesses));
        const benchmarking = (state?.marketing?.competitorBenchmarking || [])
            .filter(b => b && b.criterion);

        this.container.innerHTML = `
            <div class="intelligence-view" style="max-width:960px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnCompetitorsBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>
                <h2 class="section-title"><svg class="ic" aria-hidden="true"><use href="#i-crosshair"/></svg> رادار الذكاء التنافسي</h2>
                <p class="text-muted mb-4">تحليل المنافسين ومقارنة المعايير — من بياناتك الفعلية المُدخلة في خطوة «تحليل السوق».</p>
                <div id="competitorsBody"></div>
            </div>
        `;

        this.container.querySelector('#btnCompetitorsBack')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        const body = this.container.querySelector('#competitorsBody');
        if (competitors.length === 0 && benchmarking.length === 0) {
            body.innerHTML = `
                <div class="alert alert--info">
                    <p class="mb-2">لا يوجد منافسون مضافون بعد.</p>
                    <p class="text-sm mb-0">أضف بيانات المنافسين ومصفوفة المقارنة في خطوة «تحليل السوق» لعرض الرادار هنا.</p>
                </div>`;
            return this.container;
        }

        body.innerHTML = `
            ${competitors.length ? this.renderCompetitorsTable(competitors) : ''}
            ${benchmarking.length ? this.renderBenchmarkTable(benchmarking) : ''}
        `;

        return this.container;
    }

    renderCompetitorsTable(competitors) {
        const rows = competitors.map(c => `
            <tr style="border-bottom:1px solid var(--c-border);">
                <td style="padding:8px 12px;">${escapeHtml(c.name || 'منافس بلا اسم')}</td>
                <td style="padding:8px 12px;" class="text-mono">${c.marketShare ? Number(c.marketShare).toLocaleString('ar-SA') + '%' : '—'}</td>
                <td style="padding:8px 12px;">${escapeHtml(c.strengths || '—')}</td>
                <td style="padding:8px 12px;">${escapeHtml(c.weaknesses || '—')}</td>
                <td style="padding:8px 12px;" class="text-mono">${c.estimatedDailyCustomers ? Number(c.estimatedDailyCustomers).toLocaleString('ar-SA') : '—'}</td>
                <td style="padding:8px 12px;" class="text-mono">${c.estimatedAvgTicket ? Number(c.estimatedAvgTicket).toLocaleString('ar-SA') : '—'}</td>
            </tr>`).join('');
        return `
            <div class="card" style="padding:0;overflow-x:auto;margin-bottom:16px;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="text-align:right;border-bottom:1px solid var(--c-border);">
                            <th style="padding:8px 12px;">المنافس</th>
                            <th style="padding:8px 12px;">الحصة السوقية</th>
                            <th style="padding:8px 12px;">نقاط القوة</th>
                            <th style="padding:8px 12px;">نقاط الضعف</th>
                            <th style="padding:8px 12px;">عملاء/يوم (تقديري)</th>
                            <th style="padding:8px 12px;">متوسط الفاتورة</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }

    renderBenchmarkTable(benchmarking) {
        const rows = benchmarking.map(b => {
            const mine = Number(b.myRank);
            const winning = Number.isFinite(mine) && mine === 1;
            return `
                <tr style="border-bottom:1px solid var(--c-border);">
                    <td style="padding:8px 12px;">${escapeHtml(b.criterion || '—')}</td>
                    <td style="padding:8px 12px;" class="text-mono ${winning ? 'text-success' : ''}">${Number.isFinite(mine) ? mine : '—'}</td>
                    <td style="padding:8px 12px;" class="text-mono">${b.comp1Rank ?? '—'}</td>
                    <td style="padding:8px 12px;" class="text-mono">${b.comp2Rank ?? '—'}</td>
                    <td style="padding:8px 12px;">${escapeHtml(b.notes || '—')}</td>
                </tr>`;
        }).join('');
        // ملخص صادق من الرتب المُدخلة فعلياً — لا نص تحليلي مكتوب يدوياً بأرقام ثابتة
        const winningCount = benchmarking.filter(b => Number(b.myRank) === 1).length;
        const summary = `أنت في المرتبة الأولى في ${winningCount} من أصل ${benchmarking.length} معايير مقارنة مُدخلة.`;
        return `
            <div class="card" style="padding:16px;margin-bottom:16px;">
                <p class="text-sm mb-0">${escapeHtml(summary)}</p>
            </div>
            <div class="card" style="padding:0;overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="text-align:right;border-bottom:1px solid var(--c-border);">
                            <th style="padding:8px 12px;">معيار المقارنة</th>
                            <th style="padding:8px 12px;">ترتيبك</th>
                            <th style="padding:8px 12px;">منافس 1</th>
                            <th style="padding:8px 12px;">منافس 2</th>
                            <th style="padding:8px 12px;">ملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }
}

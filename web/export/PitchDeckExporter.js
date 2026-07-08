/**
 * Pitch Deck Exporter — مُؤكّد الاستخدام
 * يصدر عرض المستثمر كـ HTML قابل للطباعة كـ PDF (شريحة واحدة لكل صفحة).
 * مُربوط من: لوحة القرار (زر "📥 تصدير Pitch Deck") وقائمة التصدير (data-type="pitch").
 * العرض على الشاشة: PresentationView (زر "📽️ عرض المستثمر").
 * ترتيب الشرائح: يُطبَّق state.reportSectionOrder عند وجوده (المهمة 74 — توحيد مع ReportGenerator).
 */

import { calculateStudy as runFullModel } from '../js/core/engine.js';
import { calculateProjectScore } from '../js/core/scoring.js';
import { SAFE } from './utils.js';

/** معرّفات شرائح المحتوى (بعد الغلاف وقبل شريحة الختام) — قابلة للربط مع reportSectionOrder. */
const PITCH_CONTENT_SLIDE_IDS = ['executive_summary', 'market', 'financial_kpis', 'recommendation'];

function formatCurrency(n) {
    if (!n && n !== 0) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + ' مليون';
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
}

function safe(s) {
    return (s || '').toString().replace(/</g, '&lt;');
}

export class PitchDeckExporter {

    /** ترتيب شرائح المحتوى: يتبع reportSectionOrder إن وُجد، مع إلحاق أي شريحة غير مذكورة. */
    static getPitchSlideOrder(state) {
        const userOrder = (state.reportSectionOrder && state.reportSectionOrder.length) ? state.reportSectionOrder : [];
        const ordered = userOrder.filter(id => PITCH_CONTENT_SLIDE_IDS.includes(id));
        for (const id of PITCH_CONTENT_SLIDE_IDS) {
            if (!ordered.includes(id)) ordered.push(id);
        }
        return ordered;
    }

    /** يُرجع HTML لشريحة محتوى واحدة حسب المعرّف. */
    static getSlideHtml(slideId, project, exec, market, financing, ind, results, score) {
        switch (slideId) {
            case 'executive_summary':
                return `<div class="slide" style="min-height:100vh;padding:48px;display:flex;gap:24px;align-items:stretch;">
                <div style="flex:1;padding:32px;background:rgba(127,29,29,0.2);border:1px solid rgba(239,68,68,0.3);border-radius:16px;">
                    <h2 style="font-size:28px;font-weight:700;color:#f87171;margin-bottom:24px;">🛑 المشكلة</h2>
                    <p style="font-size:18px;color:#e5e7eb;line-height:1.7;">${safe(exec.problemStatement || 'لم يتم تحديد المشكلة بعد...')}</p>
                </div>
                <div style="flex:1;padding:32px;background:rgba(6,95,70,0.2);border:1px solid rgba(52,211,153,0.3);border-radius:16px;">
                    <h2 style="font-size:28px;font-weight:700;color:#4ade80;margin-bottom:24px;">💡 الحل المقترح</h2>
                    <p style="font-size:18px;color:#e5e7eb;line-height:1.7;">${safe(project.concept || exec.solutionStatement || 'لم يتم تحديد الحل...')}</p>
                    <div style="margin-top:24px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);">
                        <h4 style="color:#86efac;font-weight:700;margin-bottom:8px;">✨ القيمة المميزة:</h4>
                        <p style="color:#d1d5db;">${safe(exec.uniqueValueProposition || '—')}</p>
                    </div>
                </div>
            </div>`;
            case 'market':
                return `<div class="slide" style="min-height:100vh;padding:48px;background:#0f172a;">
                <h2 style="font-size:36px;font-weight:700;text-align:center;margin-bottom:48px;color:#fff;">حجم السوق والفرصة</h2>
                <div style="display:flex;justify-content:center;align-items:flex-end;gap:32px;height:320px;">
                    <div style="display:flex;flex-direction:column;align-items:center;width:140px;">
                        <div style="font-size:18px;margin-bottom:16px;color:#94a3b8;">TAM</div>
                        <div style="width:100%;height:200px;background:rgba(30,64,175,0.5);border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;">${formatCurrency(market.tam?.value)}</div>
                        <div style="margin-top:16px;font-size:14px;color:#94a3b8;">إجمالي السوق</div>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:center;width:140px;">
                        <div style="font-size:18px;margin-bottom:16px;color:#94a3b8;">SAM</div>
                        <div style="width:100%;height:120px;background:rgba(37,99,235,0.5);border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;">${formatCurrency(market.sam?.value)}</div>
                        <div style="margin-top:16px;font-size:14px;color:#94a3b8;">السوق المستهدف</div>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:center;width:140px;">
                        <div style="font-size:18px;margin-bottom:16px;color:#fbbf24;">SOM</div>
                        <div style="width:100%;height:50px;background:#fbbf24;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;color:#1f2937;">${formatCurrency(market.som?.value)}</div>
                        <div style="margin-top:16px;font-size:14px;color:#fbbf24;font-weight:600;">حصتنا السوقية</div>
                    </div>
                </div>
            </div>`;
            case 'financial_kpis':
                return `<div class="slide" style="min-height:100vh;padding:48px;background:#0f172a;">
                <h2 style="font-size:36px;font-weight:700;text-align:center;margin-bottom:48px;color:#fff;">أبرز المؤشرات المالية</h2>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:800px;margin:0 auto;">
                    <div style="padding:32px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;text-align:center;">
                        <div style="font-size:14px;color:#94a3b8;margin-bottom:12px;">صافي القيمة الحالية</div>
                        <div style="font-size:36px;font-weight:800;color:#4ade80;">${formatCurrency(ind.npv)}</div>
                    </div>
                    <div style="padding:32px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;text-align:center;">
                        <div style="font-size:14px;color:#94a3b8;margin-bottom:12px;">معدل العائد الداخلي</div>
                        <div style="font-size:36px;font-weight:800;color:#60a5fa;">${((ind.irr || 0) * 100).toFixed(1)}%</div>
                    </div>
                    <div style="padding:32px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;text-align:center;">
                        <div style="font-size:14px;color:#94a3b8;margin-bottom:12px;">فترة الاسترداد</div>
                        <div style="font-size:36px;font-weight:800;color:#a78bfa;">${SAFE.payback(ind.paybackPeriod ?? ind.payback)}</div>
                    </div>
                    <div style="padding:32px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;text-align:center;">
                        <div style="font-size:14px;color:#94a3b8;margin-bottom:12px;">هامش الربح</div>
                        <div style="font-size:36px;font-weight:800;color:#fbbf24;">${((results.incomeStatement?.[0]?.netMargin || 0) * 100).toFixed(1)}%</div>
                    </div>
                </div>
            </div>`;
            case 'recommendation':
                return `<div class="slide" style="min-height:100vh;padding:48px;background:linear-gradient(to top,#064e3b,#000);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
                <h2 style="font-size:36px;font-weight:700;color:#d1d5db;margin-bottom:48px;">التمويل المطلوب</h2>
                <div style="font-size:72px;font-weight:800;color:#10b981;margin-bottom:32px;">${formatCurrency(financing.totalInvestment || (financing.sources?.equity?.amount || 0) + (financing.sources?.bankLoan?.amount || 0))}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;max-width:400px;margin:0 auto;">
                    <div style="padding:24px;background:rgba(255,255,255,0.1);border-radius:16px;">
                        <div style="font-size:14px;color:#9ca3af;">رأس المال</div>
                        <div style="font-size:24px;font-weight:700;">${formatCurrency(financing.sources?.equity?.amount || 0)}</div>
                    </div>
                    <div style="padding:24px;background:rgba(255,255,255,0.1);border-radius:16px;">
                        <div style="font-size:14px;color:#9ca3af;">القروض</div>
                        <div style="font-size:24px;font-weight:700;">${formatCurrency(financing.sources?.bankLoan?.amount || 0)}</div>
                    </div>
                </div>
                <div style="margin-top:48px;padding:16px 32px;background:rgba(255,255,255,0.1);border-radius:999px;border:1px solid rgba(255,255,255,0.2);">
                    <span style="font-weight:700;">قرار النظام: ${safe(score.recommendationLabel || 'يحتاج مراجعة')}</span>
                </div>
            </div>`;
            default:
                return '';
        }
    }

    static generateHTML(store) {
        const state = store.getState ? store.getState() : store.get();
        let results;
        try {
            results = runFullModel(state);
        } catch (e) {
            results = {};
        }
        const score = calculateProjectScore(state, results);

        const project = state.projectInfo || {};
        const market = state.marketSizing || {};
        const financing = state.financing || {};
        const exec = state.executiveSummary || {};
        const ind = results.indicators || {};

        const titleSlide = `<div class="slide slide-title" style="background:linear-gradient(135deg,#312e81,#000);padding:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:100vh;">
                <div style="font-size:80px;margin-bottom:24px;">🚀</div>
                <h1 style="font-size:48px;font-weight:800;color:#60a5fa;margin-bottom:16px;">${safe(project.name || 'مشروع جديد')}</h1>
                <p style="font-size:24px;color:#d1d5db;max-width:600px;line-height:1.6;">${safe(project.description || 'فرصة استثمارية واعدة')}</p>
                <p style="margin-top:48px;font-size:14px;color:#9ca3af;">${new Date().toLocaleDateString('ar-SA')} | عرض تقديمي للمستثمرين</p>
            </div>`;

        const contentOrder = this.getPitchSlideOrder(state);
        const contentSlides = contentOrder.map(id => this.getSlideHtml(id, project, exec, market, financing, ind, results, score)).filter(Boolean);

        const ctaSlide = `<div class="slide" style="min-height:100vh;padding:48px;background:linear-gradient(135deg,#4c1d95,#312e81,#000);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
                <div style="font-size:80px;margin-bottom:32px;">🤝</div>
                <h1 style="font-size:48px;font-weight:800;background:linear-gradient(90deg,#60a5fa,#a78bfa,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:24px;">لنبدأ معاً</h1>
                <p style="font-size:24px;color:#d1d5db;margin-bottom:48px;">نبحث عن شركاء استراتيجيين يؤمنون برؤيتنا</p>
                <p style="font-size:14px;color:#9ca3af;">شكراً لوقتك</p>
            </div>`;

        const slides = [titleSlide, ...contentSlides, ctaSlide];

        return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pitch Deck — ${(project.name || 'المشروع').replace(/</g, '&lt;')}</title>
    <link href="/fonts/fonts.css" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'IBM Plex Sans Arabic', sans-serif; background: #000; color: #fff; }
        .slide { page-break-after: always; }
        .slide:last-child { page-break-after: auto; }
        @page { size: A4 landscape; margin: 1cm; }
        @media print {
            body { background: #000; }
            .slide { min-height: 100vh !important; page-break-after: always; }
        }
    </style>
</head>
<body>
    ${slides.join('\n')}
    <script>
        setTimeout(function(){ window.print(); }, 500);
    </script>
</body>
</html>`;
    }
}

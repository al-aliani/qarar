/**
 * PowerPoint (PPTX) Exporter
 * تصدير دراسة الجدوى كعرض تقديمي احترافي بصيغة PPTX
 * مُربوط من: قائمة التصدير (ExportMenu)
 * ترتيب الشرائح: يُطبَّق state.reportSectionOrder عند وجوده (المهمة 68 — توحيد مع ReportGenerator).
 */

import pptxgen from 'pptxgenjs';
import { calculateStudy as runFullModel } from '../js/core/engine.js';
import { calculateProjectScore } from '../js/core/scoring.js';
import { SAFE } from './utils.js';

/** معرّفات شرائح المحتوى (بعد الغلاف) — قابلة للربط مع reportSectionOrder. */
const PPT_SLIDE_IDS = [
    'executive_summary',
    'market',
    'financial',
    'financial_kpis',
    'risks',
    'recommendation'
];

function formatCurrency(n) {
    if (!n && n !== 0) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + ' مليون ريال';
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
}

function safeText(s) {
    return String(s || '').trim() || '—';
}

export class PPTXExporter {
    constructor(store) {
        this.store = store;
        const state = store.getState ? store.getState() : store;
        this.state = state;
        this.results = null;
        try {
            this.results = runFullModel(state);
        } catch (_) {
            this.results = {};
        }
        this.score = calculateProjectScore(state, this.results);
        this.pptx = new pptxgen();
        this.colors = {
            primary: '1E40AF',
            secondary: '3B82F6',
            success: '10B981',
            warning: 'F59E0B',
            danger: 'EF4444',
            text: '1F2937',
            lightGray: 'F3F4F6'
        };
    }

    async export() {
        try {
            this.pptx.layout = 'LAYOUT_16x9';
            // عرض عربي: اتجاه RTL + خط الهوية (كانا غائبين فتنكسر علامات الترقيم العربية)
            this.pptx.rtlMode = true;
            this.pptx.theme = { headFontFace: 'IBM Plex Sans Arabic', bodyFontFace: 'IBM Plex Sans Arabic' };
            this.pptx.author = 'منصة دراسات الجدوى';
            this.pptx.title = safeText(this.state.projectInfo?.name) || 'دراسة جدوى';
            this.pptx.subject = 'تقرير دراسة الجدوى الاقتصادية';

            this.addSlideCover();
            const slideOrder = this.getSlideOrder();
            for (const id of slideOrder) {
                this.addSlideById(id);
            }

            const projName = (this.state.projectInfo?.name || 'دراسة').replace(/[/\\*?:[\]<>|]/g, '_');
            const fileName = `${projName}_عرض_تقديمي.pptx`;
            await this.pptx.writeFile({ fileName });
            return { success: true, fileName };
        } catch (error) {
            console.error('[PPTX Export]', error);
            return { success: false, error: error?.message || 'فشل التصدير' };
        }
    }

    addSlideCover() {
        const slide = this.pptx.addSlide();
        slide.background = { color: this.colors.primary };

        slide.addText(safeText(this.state.projectInfo?.name) || 'دراسة جدوى', {
            x: 0.5, y: 2, w: '90%', h: 1.2,
            fontSize: 40, bold: true, color: 'FFFFFF',
            align: 'center', fontFace: 'IBM Plex Sans Arabic', valign: 'middle'
        });

        slide.addText(safeText(this.state.projectInfo?.description) || 'تقرير دراسة الجدوى الاقتصادية', {
            x: 0.5, y: 3.2, w: '90%', h: 0.8,
            fontSize: 18, color: 'E5E7EB',
            align: 'center', fontFace: 'IBM Plex Sans Arabic'
        });

        slide.addText(new Date().toLocaleDateString('ar-SA'), {
            x: 0.5, y: 5.2, w: '90%', h: 0.5,
            fontSize: 14, color: '9CA3AF',
            align: 'center', fontFace: 'IBM Plex Sans Arabic'
        });
    }

    /** ترتيب شرائح المحتوى: يتبع reportSectionOrder إن وُجد، مع إلحاق أي شريحة غير مذكورة. */
    getSlideOrder() {
        const state = this.state;
        const userOrder = (state.reportSectionOrder && state.reportSectionOrder.length) ? state.reportSectionOrder : [];
        const ordered = userOrder.filter(id => PPT_SLIDE_IDS.includes(id));
        for (const id of PPT_SLIDE_IDS) {
            if (!ordered.includes(id)) ordered.push(id);
        }
        return ordered;
    }

    /** يضيف شريحة واحدة حسب المعرّف. */
    addSlideById(id) {
        switch (id) {
            case 'executive_summary': this.addSlideSummary(); break;
            case 'market': this.addSlideMarket(); break;
            case 'financial': this.addSlideFinancial(); break;
            case 'financial_kpis': this.addSlideKPIs(); break;
            case 'risks': this.addSlideRisks(); break;
            case 'recommendation': this.addSlideDecision(); break;
            default: break;
        }
    }

    addSlideSummary() {
        const slide = this.pptx.addSlide();
        const exec = this.state.executiveSummary || {};
        const project = this.state.projectInfo || {};

        this.addSlideTitle(slide, 'الملخص التنفيذي');

        slide.addText('المشكلة', { x: 0.5, y: 1.2, w: 4, fontSize: 16, bold: true, color: this.colors.danger });
        slide.addText(safeText(exec.problemStatement), { x: 0.5, y: 1.7, w: 9, fontSize: 12, color: this.colors.text });

        slide.addText('الحل المقترح', { x: 0.5, y: 2.8, w: 4, fontSize: 16, bold: true, color: this.colors.success });
        slide.addText(safeText(project.concept || exec.solutionStatement), { x: 0.5, y: 3.3, w: 9, fontSize: 12, color: this.colors.text });

        slide.addText('القيمة المميزة', { x: 0.5, y: 4.2, w: 4, fontSize: 16, bold: true, color: this.colors.primary });
        slide.addText(safeText(exec.uniqueValueProposition), { x: 0.5, y: 4.7, w: 9, fontSize: 12, color: this.colors.text });
    }

    addSlideMarket() {
        const slide = this.pptx.addSlide();
        const market = this.state.marketSizing || {};

        this.addSlideTitle(slide, 'حجم السوق');

        const tam = market.tam?.value ?? 0;
        const sam = market.sam?.value ?? 0;
        const som = market.som?.value ?? 0;

        const rows = [
            [{ text: 'المؤشر', options: { bold: true, fill: this.colors.lightGray } }, { text: 'القيمة', options: { bold: true, fill: this.colors.lightGray } }, { text: 'الوصف', options: { bold: true, fill: this.colors.lightGray } }],
            [{ text: 'TAM' }, { text: formatCurrency(tam) }, { text: 'إجمالي السوق المتاح' }],
            [{ text: 'SAM' }, { text: formatCurrency(sam) }, { text: 'السوق المستهدف' }],
            [{ text: 'SOM' }, { text: formatCurrency(som) }, { text: 'الحصة السوقية المتوقعة' }]
        ];

        slide.addTable(rows, {
            x: 1, y: 1.5, w: 8, colW: [1.5, 2.5, 4],
            fontSize: 12, border: { pt: 1, color: this.colors.primary },
            align: 'center', valign: 'middle'
        });
    }

    addSlideFinancial() {
        const slide = this.pptx.addSlide();
        const ind = this.results?.indicators || {};
        const inc = this.results?.incomeStatement?.[0] || {};

        this.addSlideTitle(slide, 'الملخص المالي');

        const rows = [
            [{ text: 'المؤشر', options: { bold: true, fill: this.colors.lightGray } }, { text: 'القيمة', options: { bold: true, fill: this.colors.lightGray } }],
            [{ text: 'صافي القيمة الحالية (NPV)' }, { text: formatCurrency(ind.npv) }],
            [{ text: 'معدل العائد الداخلي (IRR)' }, { text: `${((ind.irr ?? 0) * 100).toFixed(1)}%` }],
            [{ text: 'فترة الاسترداد' }, { text: SAFE.payback(ind.paybackPeriod ?? ind.payback) }],
            [{ text: 'العائد على الاستثمار (ROI)' }, { text: `${((ind.roi ?? 0) * 100).toFixed(1)}%` }],
            [{ text: 'الإيرادات (السنة 1)' }, { text: formatCurrency(inc.revenue) }],
            [{ text: 'صافي الربح (السنة 1)' }, { text: formatCurrency(inc.netIncome) }]
        ];

        slide.addTable(rows, {
            x: 1, y: 1.5, w: 8, colW: [5, 3],
            fontSize: 12, border: { pt: 1, color: this.colors.primary },
            align: 'right', valign: 'middle'
        });
    }

    addSlideKPIs() {
        const slide = this.pptx.addSlide();
        const ind = this.results?.indicators || {};
        const inc = this.results?.incomeStatement?.[0] || {};

        this.addSlideTitle(slide, 'أبرز المؤشرات');

        const kpis = [
            { label: 'NPV', value: formatCurrency(ind.npv), color: (ind.npv ?? 0) >= 0 ? this.colors.success : this.colors.danger },
            { label: 'IRR', value: `${((ind.irr ?? 0) * 100).toFixed(1)}%`, color: this.colors.primary },
            { label: 'الاسترداد', value: SAFE.payback(ind.paybackPeriod ?? ind.payback), color: this.colors.secondary },
            { label: 'هامش الربح', value: `${(((inc.netIncome || 0) / (inc.revenue || 1)) * 100).toFixed(1)}%`, color: this.colors.warning }
        ];

        kpis.forEach((kpi, i) => {
            const x = 0.8 + (i % 2) * 4.5;
            const y = 1.5 + Math.floor(i / 2) * 2.2;
            slide.addShape(pptxgen.ShapeType.rect, {
                x, y, w: 4.2, h: 2,
                fill: { color: kpi.color, transparency: 85 },
                line: { color: kpi.color, width: 2 }
            });
            slide.addText(kpi.label, { x, y: y + 0.2, w: 4.2, fontSize: 12, color: kpi.color, align: 'center' });
            slide.addText(kpi.value, { x, y: y + 0.9, w: 4.2, fontSize: 20, bold: true, color: kpi.color, align: 'center' });
        });
    }

    addSlideRisks() {
        const slide = this.pptx.addSlide();
        const risks = this.state.riskAnalysis?.risks || [];
        this.addSlideTitle(slide, 'تحليل المخاطر');

        if (risks.length === 0) {
            slide.addText('لم يتم إدخال مخاطر محددة. يُنصح بتوثيق أبرز المخاطر وخطط المواجهة في قسم تحليل المخاطر.', {
                x: 0.5, y: 1.5, w: 9, fontSize: 12, color: this.colors.text
            });
            return;
        }

        const rows = [
            [{ text: 'المخاطرة', options: { bold: true, fill: this.colors.lightGray } }, { text: 'الاحتمال', options: { bold: true, fill: this.colors.lightGray } }, { text: 'التأثير', options: { bold: true, fill: this.colors.lightGray } }, { text: 'خطة المواجهة', options: { bold: true, fill: this.colors.lightGray } }]
        ];
        risks.slice(0, 5).forEach(r => {
            rows.push([
                safeText(r.name || r.description),
                safeText(r.probability === 'high' ? 'عالي' : r.probability === 'low' ? 'منخفض' : 'متوسط'),
                safeText(r.impact === 'high' ? 'عالي' : r.impact === 'low' ? 'منخفض' : 'متوسط'),
                safeText(r.mitigation)
            ]);
        });

        slide.addTable(rows, {
            x: 0.5, y: 1.3, w: 9, colW: [2.2, 1.2, 1.2, 4.4],
            fontSize: 10, border: { pt: 1, color: this.colors.primary },
            align: 'right', valign: 'middle'
        });
    }

    addSlideDecision() {
        const slide = this.pptx.addSlide();
        this.addSlideTitle(slide, 'التوصية النهائية');

        const rec = this.score?.recommendationLabel || 'يحتاج مراجعة';
        const decision = this.score?.recommendation || 'revise';
        const color = decision === 'go' ? this.colors.success : decision === 'nogo' ? this.colors.danger : this.colors.warning;

        slide.addShape(pptxgen.ShapeType.rect, {
            x: 2, y: 2, w: 6, h: 2,
            fill: { color: color, transparency: 80 },
            line: { color: color, width: 4 }
        });

        slide.addText(rec, {
            x: 2, y: 2.4, w: 6, h: 1.2,
            fontSize: 28, bold: true, color: color,
            align: 'center', valign: 'middle'
        });

        if (this.score?.details?.length) {
            const reasons = this.score.details.filter(d => d.issue).map(d => `• ${d.label}`).slice(0, 3);
            if (reasons.length) {
                slide.addText('ملاحظات:', { x: 0.5, y: 4.5, fontSize: 14, bold: true, color: this.colors.text });
                slide.addText(reasons.join('\n'), { x: 0.5, y: 5, w: 9, fontSize: 11, color: this.colors.text });
            }
        }
    }

    addSlideTitle(slide, title) {
        slide.addText(title, {
            x: 0.5, y: 0.3, w: 9, h: 0.6,
            fontSize: 24, bold: true, color: this.colors.primary,
            align: 'center'
        });
        slide.addShape(pptxgen.ShapeType.line, {
            x: 1, y: 0.95, w: 8, h: 0,
            line: { color: this.colors.secondary, width: 2 }
        });
    }
}

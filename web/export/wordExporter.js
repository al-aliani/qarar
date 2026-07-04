/**
 * Word (DOCX) Exporter
 * تصدير دراسة الجدوى كتقرير نصي احترافي بصيغة DOCX
 * يستخدم مكتبة 'docx'
 * ترتيب الأقسام: يُطبَّق state.reportSectionOrder عند وجوده (المهمة 70 — توحيد مع ReportGenerator).
 */

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } from 'docx';
import { calculateStudy as runFullModel } from '../js/core/engine.js';
import { calculateProjectScore } from '../js/core/scoring.js';

/** أقسام تقرير Word (معرّفات قابلة للربط مع reportSectionOrder). */
const WORD_SECTION_IDS = ['executive_summary', 'market', 'financial_kpis', 'recommendation'];

function formatCurrency(n) {
    if (!n && n !== 0) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + ' مليون ريال';
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
}

function safeText(s) {
    return String(s || '').trim() || '—';
}

export class WordExporter {
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
    }

    /** ترتيب أقسام تقرير Word: يتبع reportSectionOrder إن وُجد، مع إلحاق أي قسم غير مذكور. */
    getWordSectionOrder() {
        const state = this.state;
        const userOrder = (state.reportSectionOrder && state.reportSectionOrder.length) ? state.reportSectionOrder : [];
        const ordered = userOrder.filter(id => WORD_SECTION_IDS.includes(id));
        for (const id of WORD_SECTION_IDS) {
            if (!ordered.includes(id)) ordered.push(id);
        }
        return ordered;
    }

    /** يُرجع مصفوفة عناصر docx لقسم واحد (حسب المعرّف). */
    buildSectionBlocks(sectionId) {
        const project = this.state.projectInfo || {};
        const exec = this.state.executiveSummary || {};
        switch (sectionId) {
            case 'executive_summary':
                return [
                    this.createHeading("الملخص التنفيذي"),
                    this.createSubHeading("المشكلة"),
                    this.createParagraph(exec.problemStatement),
                    this.createSubHeading("الحل المقترح"),
                    this.createParagraph(project.concept || exec.solutionStatement),
                    this.createSubHeading("القيمة المميزة"),
                    this.createParagraph(exec.uniqueValueProposition)
                ];
            case 'market':
                return [
                    this.createHeading("حجم السوق"),
                    this.createMarketTable()
                ];
            case 'financial_kpis':
                return [
                    this.createHeading("المؤشرات المالية"),
                    this.createFinancialTable()
                ];
            case 'recommendation':
                return [
                    this.createHeading("التوصية النهائية"),
                    new Paragraph({
                        text: this.score?.recommendationLabel || "يحتاج مراجعة",
                        bold: true,
                        alignment: AlignmentType.CENTER,
                        bidirectional: true,
                        spacing: { before: 200, after: 200 }
                    })
                ];
            default:
                return [];
        }
    }

    async export() {
        try {
            const project = this.state.projectInfo || {};

            const headerBlocks = [
                new Paragraph({
                    text: safeText(project.name),
                    heading: HeadingLevel.TITLE,
                    alignment: AlignmentType.CENTER,
                    bidirectional: true
                }),
                new Paragraph({
                    text: "تقرير دراسة الجدوى الاقتصادية",
                    alignment: AlignmentType.CENTER,
                    bidirectional: true,
                    spacing: { after: 400 }
                }),
                new Paragraph({
                    text: `تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`,
                    alignment: AlignmentType.CENTER,
                    bidirectional: true,
                    spacing: { after: 800 }
                })
            ];

            const sectionOrder = this.getWordSectionOrder();
            const sectionBlocks = sectionOrder.flatMap(id => this.buildSectionBlocks(id));

            const doc = new Document({
                sections: [{
                    properties: {
                        page: {
                            margin: {
                                top: 1440,
                                right: 1440,
                                bottom: 1440,
                                left: 1440
                            }
                        }
                    },
                    children: [...headerBlocks, ...sectionBlocks]
                }]
            });

            // Pack to Blob
            const blob = await Packer.toBlob(doc);
            const projName = (project.name || 'study').replace(/[/\\*?:[\]<>|]/g, '_');
            const fileName = `${projName}_تقرير_دراسة.docx`;

            return { success: true, fileName, blob };
        } catch (error) {
            console.error('[Word Export]', error);
            return { success: false, error: error?.message || 'فشل التصدير' };
        }
    }

    createHeading(text) {
        return new Paragraph({
            text: text,
            heading: HeadingLevel.HEADING_1,
            bidirectional: true,
            spacing: { before: 400, after: 200 }
        });
    }

    createSubHeading(text) {
        return new Paragraph({
            text: text,
            heading: HeadingLevel.HEADING_2,
            bidirectional: true,
            spacing: { before: 200, after: 100 }
        });
    }

    createParagraph(text) {
        return new Paragraph({
            children: [new TextRun({ text: safeText(text), size: 24 })], // size is half-points (24 = 12pt)
            bidirectional: true,
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 }
        });
    }

    createMarketTable() {
        const market = this.state.marketSizing || {};
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                this.createTableRow(["الوصف", "القيمة", "المؤشر"], true),
                this.createTableRow(["إجمالي السوق المتاح", formatCurrency(market.tam?.value), "TAM"]),
                this.createTableRow(["السوق المستهدف", formatCurrency(market.sam?.value), "SAM"]),
                this.createTableRow(["الحصة السوقية", formatCurrency(market.som?.value), "SOM"])
            ]
        });
    }

    createFinancialTable() {
        const ind = this.results?.indicators || {};
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                this.createTableRow(["القيمة", "المؤشر"], true),
                this.createTableRow([formatCurrency(ind.npv), "صافي القيمة الحالية (NPV)"]),
                this.createTableRow([`${((ind.irr ?? 0) * 100).toFixed(1)}%`, "معدل العائد الداخلي (IRR)"]),
                this.createTableRow([`${(ind.paybackPeriod ?? 0).toFixed(1)} سنة`, "فترة الاسترداد"]),
                this.createTableRow([`${((ind.roi ?? 0) * 100).toFixed(1)}%`, "العائد على الاستثمار (ROI)"])
            ]
        });
    }

    createTableRow(cells, isHeader = false) {
        return new TableRow({
            children: cells.map(text => new TableCell({
                children: [new Paragraph({
                    text: text,
                    bold: isHeader,
                    alignment: AlignmentType.CENTER,
                    bidirectional: true
                })],
                // Simple styling
                shading: isHeader ? { fill: "F3F4F6", color: "auto", val: "clear" } : undefined
            }))
        });
    }
}

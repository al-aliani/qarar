/**
 * Section-level Excel Exporter (Enhanced)
 * Exports individual sections from the wizard to Excel
 * Handles all data structures in the store
 */

import { calculateStudy as runFullModel } from '../core/engine.js';
import { loadXLSX, sanitizeSheetName, sanitizeFilename, formatExportDateTime, exportDateISO, SAFE, formatDscr } from '../../export/utils.js';

export async function exportSectionToExcel(studyData, sectionId, sectionLabel) {
    await loadXLSX();

    const workbook = XLSX.utils.book_new();
    const projectName = studyData.projectInfo?.name || studyData.projectInfo?.projectName || 'مشروع';

    // Get section data - handle special cases
    let sectionData = studyData[sectionId];

    // Build sheet based on section type
    let sheetData = [];

    // Header
    sheetData.push([sectionLabel]);
    sheetData.push([`المشروع: ${projectName}`]);
    sheetData.push([`تاريخ ووقت التصدير: ${formatExportDateTime()}`]);
    sheetData.push([]);

    // Special handling for different section types
    if (sectionId === 'technical') {
        sheetData = sheetData.concat(handleTechnicalSection(sectionData));
    } else if (sectionId === 'hr') {
        sheetData = sheetData.concat(handleHRSection(sectionData));
    } else if (sectionId === 'revenue' || sectionId === 'financial') {
        sheetData = sheetData.concat(handleRevenueSection(sectionData));
    } else if (sectionId === 'financing') {
        sheetData = sheetData.concat(handleFinancingSection(sectionData));
    } else if (sectionId === 'assumptions') {
        sheetData = sheetData.concat(handleAssumptionsSection(sectionData));
    } else if (sectionId === 'marketSizing') {
        sheetData = sheetData.concat(handleMarketSizingSection(sectionData));
    } else if (sectionId === 'riskAnalysis') {
        sheetData = sheetData.concat(handleRiskAnalysisSection(sectionData));
    } else if (sectionId === 'timeline') {
        sheetData = sheetData.concat(handleTimelineSection(sectionData, studyData));
    } else if (sectionId === 'scenarios') {
        sheetData = sheetData.concat(handleScenariosSection(sectionData));
    } else if (sectionId === 'techResources') {
        sheetData = sheetData.concat(handleTechResourcesSection(sectionData));
    } else if (sectionId === 'keyPeople') {
        sheetData = sheetData.concat(handleKeyPeopleSection(sectionData));
    } else if (sectionId === 'projectIntro') {
        sheetData = sheetData.concat(handleProjectIntroSection(studyData.projectInfo || {}));
    } else if (sectionId === 'marketing') {
        sheetData = sheetData.concat(handleMarketingSection(sectionData));
    } else if (sectionId === 'appendices') {
        sheetData = sheetData.concat(handleAppendicesSection(sectionData));
    } else if (sectionId === 'orgStructure') {
        sheetData = sheetData.concat(handleOrgStructureSection(sectionData));
    } else if (sectionId === 'preliminaryCheck') {
        sheetData = sheetData.concat(handlePreliminaryCheckSection(studyData.preliminaryCheck || {}));
    } else if (sectionId === 'projectAlternatives') {
        sheetData = sheetData.concat(handleProjectAlternativesSection(studyData.projectAlternatives || {}));
    } else if (sectionId === 'projectInfo') {
        sheetData = sheetData.concat(handleProjectInfoSection(sectionData));
    } else if (sectionId === 'financial_eval' || sectionId === 'financialStatements') {
        // Run financial model and export results
        try {
            const results = runFullModel(studyData);
            sheetData = sheetData.concat(handleFinancialResults(results));
        } catch (e) {
            sheetData.push(['خطأ في حساب النتائج المالية']);
        }
    } else if (Array.isArray(sectionData)) {
        sheetData = sheetData.concat(arrayToSheetData(sectionData));
    } else if (typeof sectionData === 'object' && sectionData !== null) {
        sheetData = sheetData.concat(handleGenericObject(sectionData));
    } else {
        sheetData.push(['لا توجد بيانات في هذا القسم']);
        sheetData.push([]);
        sheetData.push(['ملاحظة: تأكد من إدخال البيانات وحفظها أولاً']);
    }

    sheetData.push([]);
    sheetData.push(['مُنشأ بواسطة', 'محاكي الجدوى | دراسة الجدوى الذكية']);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Auto-fit columns
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

    const cleanLabel = sanitizeSheetName(sectionLabel || 'قسم');
    XLSX.utils.book_append_sheet(workbook, ws, cleanLabel);

    const base = sanitizeFilename(projectName || 'مشروع');
    const section = sanitizeFilename(sectionLabel || 'قسم');
    const filename = `${base}_${section}_${exportDateISO()}.xlsx`;
    await XLSX.writeFile(workbook, filename);
    return filename;
}

// ═══════════════════════════════════════════════════════════════
// SECTION HANDLERS
// ═══════════════════════════════════════════════════════════════

function handleTechnicalSection(data) {
    const result = [];

    const estCosts = data?.establishmentCosts || [];
    if (estCosts.length > 0) {
        result.push(['نفقات التأسيس']);
        result.push(['البند', 'المبلغ', '% إطفاء/سنة']);
        estCosts.forEach(item => {
            result.push([(item.name || '').toString(), item.amount ?? 0, ((item.amortizationRate ?? 0.20) * 100).toFixed(0) + '%']);
        });
        result.push([]);
    }

    if (data?.buildings?.length > 0) {
        result.push(['المباني والإنشاءات']);
        result.push(['البند', 'الكمية', 'السعر', 'الإجمالي', 'نسبة الاستهلاك']);
        data.buildings.forEach(item => {
            const total = (item.quantity || 1) * (item.price || 0);
            const rate = item.depreciationRate != null ? Number(item.depreciationRate) : 0;
            result.push([
                item.name || '',
                item.quantity || 1,
                item.price || 0,
                total,
                (rate * 100).toFixed(1) + '%'
            ]);
        });
        result.push([]);
    }

    if (data?.equipment?.length > 0) {
        result.push(['المعدات والأجهزة']);
        result.push(['البند', 'الكمية', 'السعر', 'الإجمالي', 'نسبة الاستهلاك']);
        data.equipment.forEach(item => {
            const total = (item.quantity || 1) * (item.price || 0);
            const rate = item.depreciationRate != null ? Number(item.depreciationRate) : 0;
            result.push([
                item.name || '',
                item.quantity || 1,
                item.price || 0,
                total,
                (rate * 100).toFixed(1) + '%'
            ]);
        });
        result.push([]);
    }

    const cap = data?.productionCapacity || {};
    if (cap.annualCapacity || cap.unitOrMeasure || cap.marketShareLink) {
        result.push(['الطاقة الإنتاجية']);
        result.push(['السعة السنوية', cap.annualCapacity ?? '—']);
        result.push(['وحدة القياس', (cap.unitOrMeasure || '—').toString()]);
        result.push(['ربط بالسوق المستهدف', (cap.marketShareLink || '—').toString()]);
        result.push([]);
    }

    if (data?.furniture?.length > 0) {
        result.push(['الأثاث']);
        result.push(['البند', 'الكمية', 'السعر', 'الإجمالي', 'نسبة الاستهلاك']);
        data.furniture.forEach(item => {
            const total = (item.quantity || 1) * (item.price || 0);
            const rate = item.depreciationRate != null ? Number(item.depreciationRate) : 0;
            result.push([
                item.name || '',
                item.quantity || 1,
                item.price || 0,
                total,
                (rate * 100).toFixed(1) + '%'
            ]);
        });
    }

    const tse = data?.technicalSpecialistEvaluation || {};
    if (tse.specialistName || tse.adequacyOfNeeds || tse.equipmentQuality || tse.recommendations) {
        result.push([]);
        result.push(['تقييم المختص الفني']);
        result.push(['اسم المختص', (tse.specialistName || '—').toString()]);
        result.push(['التاريخ', (tse.date || '—').toString()]);
        if (tse.adequacyOfNeeds) result.push(['كفاية الاحتياجات', (tse.adequacyOfNeeds || '').toString()]);
        if (tse.equipmentQuality) result.push(['جودة المعدات', (tse.equipmentQuality || '').toString()]);
        if (tse.staffAdequacy) result.push(['كفاية الكوادر', (tse.staffAdequacy || '').toString()]);
        if (tse.costRevenueAssessment) result.push(['تقييم التكاليف والإيرادات', (tse.costRevenueAssessment || '').toString()]);
        if (tse.recommendations) result.push(['التوصيات', (tse.recommendations || '').toString()]);
    }

    if (result.length === 0) {
        result.push(['لا توجد بيانات - أضف البنود في الجداول']);
    }

    return result;
}

function handleHRSection(data) {
    const result = [];

    if (data?.positions?.length > 0) {
        result.push(['الوظائف والرواتب']);
        result.push(['الوظيفة', 'العدد', 'الراتب الشهري', 'عدد الأشهر', 'الإجمالي السنوي', 'تكلفة متغيرة']);

        let totalAnnual = 0;
        data.positions.forEach(pos => {
            const annual = (pos.count || 1) * (pos.salary || 0) * (pos.months || 12);
            totalAnnual += annual;
            result.push([
                pos.position || '',
                pos.count || 1,
                pos.salary || 0,
                pos.months || 12,
                annual,
                pos.isVariable ? 'نعم' : 'لا'
            ]);
        });

        result.push([]);
        result.push(['إجمالي الرواتب السنوي', '', '', '', totalAnnual]);

        const gosiRate = data.gosiRate != null ? Number(data.gosiRate) : 0;
        if (gosiRate > 0) {
            const gosi = totalAnnual * gosiRate;
            result.push(['التأمينات الاجتماعية (' + (gosiRate * 100).toFixed(1) + '%)', '', '', '', gosi]);
        }
    } else {
        result.push(['لا توجد وظائف مضافة']);
    }

    return result;
}

function handleRevenueSection(data) {
    const result = [];
    const streams = data?.streams || [];

    if (streams.length > 0) {
        result.push(['مصادر الإيرادات']);
        result.push(['الخدمة', 'عملاء/شهر', 'متوسط السعر', 'الإيراد الشهري', 'الإيراد السنوي', 'نسبة النمو']);

        let totalMonthly = 0;
        streams.forEach(stream => {
            const monthly = (stream.customersPerMonth || 0) * (stream.avgPrice || 0);
            totalMonthly += monthly;
            const gr = stream.growthRate != null ? Number(stream.growthRate) : 0;
            result.push([
                stream.service || stream.name || '',
                stream.customersPerMonth || 0,
                stream.avgPrice || 0,
                monthly,
                monthly * 12,
                (gr * 100).toFixed(1) + '%'
            ]);
        });

        result.push([]);
        result.push(['إجمالي الإيرادات الشهرية', '', '', totalMonthly]);
        result.push(['إجمالي الإيرادات السنوية', '', '', totalMonthly * 12]);
    } else {
        result.push(['لا توجد مصادر إيرادات مضافة']);
    }

    return result;
}

function handleFinancingSection(data) {
    const result = [];

    result.push(['هيكل التمويل']);
    result.push([]);

    if (data?.totalInvestment) {
        result.push(['إجمالي الاستثمار المطلوب', data.totalInvestment]);
    }

    if (data?.sources) {
        result.push([]);
        result.push(['مصادر التمويل']);

        if (data.sources.equity) {
            result.push(['رأس المال الشخصي', data.sources.equity.amount || 0]);
        }

        if (data.sources.bankLoan) {
            const loan = data.sources.bankLoan;
            const ir = loan.interestRate != null ? Number(loan.interestRate) : 0;
            result.push([]);
            result.push(['القرض البنكي']);
            result.push(['المبلغ', loan.amount || 0]);
            result.push(['نسبة الفائدة', (ir * 100).toFixed(1) + '%']);
            result.push(['مدة السداد', (loan.termYears ?? 5) + ' سنوات']);
            result.push(['فترة السماح', (loan.gracePeriodMonths ?? 0) + ' شهر']);
        }
    }

    return result;
}

function handleAssumptionsSection(data) {
    const result = [];

    result.push(['الافتراضات المالية']);
    result.push([]);

    const assumptions = {
        inflationRate: 'معدل التضخم السنوي',
        taxRate: 'معدل الضريبة/الزكاة',
        discountRate: 'معدل الخصم',
        projectionYears: 'سنوات التوقع',
        workingCapitalMonths: 'أشهر رأس المال العامل',
        contingencyRate: 'نسبة الاحتياطي',
        revenueGrowthJustification: 'مبرر نمو/تثبيت/انخفاض المبيعات'
    };

    Object.entries(assumptions).forEach(([key, label]) => {
        if (data?.[key] !== undefined && data[key] !== '') {
            let value = data[key];
            if (key === 'revenueGrowthJustification') {
                result.push([label, (value || '').toString()]);
                return;
            }
            if (typeof value === 'number' && (key.includes('Rate') || key === 'taxRate')) {
                value = (value * 100).toFixed(1) + '%';
            }
            result.push([label, value]);
        }
    });

    return result;
}

function handleMarketSizingSection(data) {
    const result = [];
    const tam = data?.tam || {};
    const sam = data?.sam || {};
    const som = data?.som || {};
    const segments = data?.segments || [];
    const v2030 = data?.vision2030 || {};
    const economy = data?.nationalEconomy || {};

    result.push(['تحليل السوق']);
    result.push(['TAM (السوق الكلي)', tam.value ?? tam ?? '—', (tam.description || '').toString()]);
    result.push(['SAM (السوق المتاح)', sam.value ?? sam ?? '—', (sam.description || '').toString()]);
    result.push(['SOM (الحصة المستهدفة)', som.value ?? som ?? '—', (som.description || '').toString()]);
    result.push([]);

    if (v2030.alignment || v2030.relevantPrograms || v2030.impact) {
        result.push(['مواءمة رؤية 2030']);
        result.push(['ربط المشروع بالرؤية', (v2030.alignment || '—').toString()]);
        result.push(['البرامج ذات الصلة', (v2030.relevantPrograms || '—').toString()]);
        result.push(['الأثر المتوقع', (v2030.impact || '—').toString()]);
        result.push([]);
    }

    if (economy.gdpGrowth || economy.sectorGrowth || economy.keyIndicators || economy.trends) {
        result.push(['دراسة اقتصاد الدولة']);
        result.push(['النمو والاتجاه الاقتصادي', (economy.gdpGrowth || '—').toString()]);
        result.push(['نمو القطاع المستهدف', (economy.sectorGrowth || '—').toString()]);
        result.push(['مؤشرات وطنية ذات صلة', (economy.keyIndicators || '—').toString()]);
        result.push(['الاتجاهات المؤثرة', (economy.trends || '—').toString()]);
        result.push([]);
    }

    const pop = data?.populationDemographics || {};
    if (pop.totalPopulation || pop.source || pop.year || pop.youthPercentage || pop.targetSegmentSize || pop.notes) {
        result.push(['دراسة إحصائية للسكان']);
        result.push(['إجمالي السكان', pop.totalPopulation ?? '—']);
        result.push(['سنة التعداد', (pop.year || '—').toString()]);
        result.push(['المصدر', (pop.source || '—').toString()]);
        result.push(['نسبة الشباب', (pop.youthPercentage || '—').toString()]);
        result.push(['حجم الشريحة المستهدفة', (pop.targetSegmentSize || '—').toString()]);
        result.push(['ملاحظات', (pop.notes || '—').toString()]);
        result.push([]);
    }

    if (data.sectorAnalysis || data.industryAnalysis) {
        result.push(['تحليل القطاع والصناعة']);
        if (data.sectorAnalysis) result.push(['تحليل القطاع', (data.sectorAnalysis || '').toString()]);
        if (data.industryAnalysis) result.push(['تحليل الصناعة', (data.industryAnalysis || '').toString()]);
        result.push([]);
    }

    if (segments.length) {
        result.push(['شرائح العملاء']);
        result.push(['الشريحة', 'الديموغرافيا', 'تردد الشراء', 'طريقة الشراء', 'الحجم']);
        const freqLabels = { daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري', rarely: 'نادراً' };
        const methodLabels = { cash: 'نقدي', online: 'إلكتروني', delivery: 'توصيل', app: 'تطبيق' };
        segments.forEach((s) => {
            result.push([
                (s.name || s.segment || '').toString(),
                (s.demographics || s.description || '').toString(),
                (freqLabels[s.purchaseFrequency] || s.purchaseFrequency || '—').toString(),
                (methodLabels[s.purchaseMethod] || s.purchaseMethod || '—').toString(),
                s.size ?? s.percentage ?? '—'
            ]);
        });
    }

    return result.length ? result : [['لا توجد بيانات لتحليل السوق']];
}

function handleRiskAnalysisSection(data) {
    const result = [];
    const risks = data?.risks || [];

    result.push(['تحليل المخاطر']);
    result.push(['المخاطرة', 'التأثير', 'الاحتمال', 'خطة المواجهة']);
    (risks || []).forEach((r) => {
        result.push([
            (r.name || r.risk || '').toString(),
            (r.impact || r.level || '—').toString(),
            (r.probability || '—').toString(),
            (r.mitigation || r.plan || '').toString(),
        ]);
    });

    return result.length > 2 ? result : [['تحليل المخاطر'], [], ['لا توجد مخاطر مسجلة']];
}

function handleTimelineSection(data, studyData) {
    const tl = data || {};
    const pi = studyData?.projectInfo?.timeline || {};
    const result = [['الجدول الزمني'], []];

    const start = tl.projectStart ?? pi.projectStart;
    const opStart = tl.operationStart ?? pi.operationStart;
    const months = tl.constructionMonths ?? pi.constructionMonths;
    if (start != null || opStart != null || months != null) {
        result.push(['البند', 'القيمة']);
        result.push(['بداية المشروع', (start || '—').toString()]);
        result.push(['بداية التشغيل', (opStart || '—').toString()]);
        result.push(['مدة الإنشاء (شهر)', months ?? '—']);
        result.push([]);
    }

    const activities = tl.activities || [];
    if (activities.length) {
        result.push(['الأنشطة']);
        result.push(['النشاط', 'الشهر', 'المدة (شهر)', 'الفئة']);
        activities.forEach((a) => {
            result.push([(a.name || '').toString(), a.startMonth ?? '—', a.duration ?? '—', (a.category || '—').toString()]);
        });
    }

    if (result.length <= 2) result.push(['لا توجد بيانات للجدول الزمني']);
    return result;
}

function handleScenariosSection(data) {
    const result = [];
    const p = data?.pessimistic || {};
    const b = data?.base || {};
    const o = data?.optimistic || {};
    const sen = data?.sensitivity || {};

    result.push(['السيناريوهات']);
    result.push(['السيناريو', 'تغيّر الإيراد', 'تغيّر التكلفة', 'الوصف']);
    result.push(['متشائم', ((p.revenueChange ?? 0) * 100).toFixed(0) + '%', ((p.costChange ?? 0) * 100).toFixed(0) + '%', (p.description || '—').toString()]);
    result.push(['أساسي', ((b.revenueChange ?? 0) * 100).toFixed(0) + '%', ((b.costChange ?? 0) * 100).toFixed(0) + '%', (b.description || '—').toString()]);
    result.push(['متفائل', ((o.revenueChange ?? 0) * 100).toFixed(0) + '%', ((o.costChange ?? 0) * 100).toFixed(0) + '%', (o.description || '—').toString()]);
    result.push([]);
    result.push(['تحليل الحساسية']);
    result.push(['المتغير المختار', (sen.selectedVariable || '—').toString()]);
    const range = sen.range || [];
    result.push(['النطاق', Array.isArray(range) && range.length >= 2 ? `${(range[0] * 100).toFixed(0)}% .. ${(range[1] * 100).toFixed(0)}%` : '—']);

    return result;
}

function handlePreliminaryCheckSection(data) {
    const result = [['الدراسة المبدئية']];
    if (data?.isProjectFeasible) result.push(['هل المشروع ممكن؟', (data.isProjectFeasible || '').toString()]);
    if (data?.suitableForEnvironment) result.push(['مناسب للبيئة؟', (data.suitableForEnvironment || '').toString()]);
    if (data?.hasInitialResources) result.push(['موارد أولية؟', (data.hasInitialResources || '').toString()]);
    if (data?.readyForDetailedStudy) result.push(['جاهز للتفصيل؟', (data.readyForDetailedStudy || '').toString()]);
    return result.length > 1 ? result : [['الدراسة المبدئية'], [], ['لم يتم تعبئتها']];
}

function handleProjectAlternativesSection(data) {
    const result = [['اختيار المشروع — مقارنة الأفكار المبدئية']];
    const ideas = data?.ideas || [];
    const RISK_AR = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية' };
    const filledIdeas = ideas.filter(idea => idea.name || idea.estimatedCost || idea.estimatedReturn || idea.notes);
    if (filledIdeas.length > 0) {
        result.push(['اسم الفكرة', 'تكلفة تقريبية', 'عائد متوقع', 'المخاطرة', 'الاسترداد (سنة)', 'ملاحظة']);
        filledIdeas.forEach((idea) => {
            const cost = Number(idea.estimatedCost) || 0;
            const ret = Number(idea.estimatedReturn) || 0;
            const payback = cost > 0 && ret > 0 ? Number((cost / ret).toFixed(1)) : '-';
            result.push([
                (idea.name || '-').toString(),
                idea.estimatedCost ?? 0,
                idea.estimatedReturn ?? 0,
                RISK_AR[idea.risk] || '-',
                payback,
                (idea.notes || '-').toString()
            ]);
        });
        const sel = data?.selectedIndex ?? 0;
        if (ideas[sel]) result.push([], ['المختار للمتابعة', (ideas[sel].name || '-').toString()]);
    } else {
        result.push([], ['لم تتم إضافة أفكار للمقارنة']);
    }
    return result;
}

function handleProjectInfoSection(data) {
    const result = [['معلومات المشروع ونموذج العمل']];
    if (data?.name) result.push(['اسم المشروع', (data.name || '').toString()]);
    if (data?.city) result.push(['المدينة', (data.city || '').toString()]);
    if (data?.district) result.push(['المنطقة/الحي', (data.district || '').toString()]);
    if (data?.concept) result.push(['نوع النشاط', (data.concept || '').toString()]);
    if (data?.businessModel) result.push(['نموذج العمل', (data.businessModel === 'Franchise' ? 'فرنشايز' : 'مستقل')]);
    const ipLabels = { conservative: 'محافظ', speculator: 'مضارب', balanced: 'متوازن' };
    if (data?.investorProfile) result.push(['ملف المستثمر', (ipLabels[data.investorProfile] || data.investorProfile)]);
    if (data?.techInvestmentLevel) result.push(['استثمار التكنولوجيا', (data.techInvestmentLevel === 'high' ? 'عالية' : data.techInvestmentLevel === 'medium' ? 'متوسطة' : 'منخفضة')]);
    if (data?.nationalEconomicImportance) result.push(['أهمية اقتصادية/أمنية', (data.nationalEconomicImportance || '').toString()]);
    const checklist = data?.dataGatheringChecklist || [];
    if (checklist.length > 0) {
        result.push([]);
        result.push(['خطوات جمع المعلومات (زيارات ميدانية)']);
        result.push(['الخطوة', 'تم؟', 'ملاحظات']);
        checklist.forEach((c) => result.push([
            (c.step || '').toString(),
            c.done ? 'نعم' : 'لا',
            (c.notes || '').toString()
        ]));
    }
    const glossary = data?.glossary || [];
    if (glossary.length > 0) {
        result.push([]);
        result.push(['تعريف المصطلحات']);
        result.push(['المصطلح', 'التعريف']);
        glossary.forEach((g) => result.push([(g.term || '').toString(), (g.definition || '').toString()]));
    }
    return result.length > 1 ? result : [['معلومات المشروع'], [], ['لا توجد بيانات']];
}

export function handleProjectIntroSection(pi) {
    const result = [['مقدمة الجدوى الموحدة']];
    const ic = pi.ideaCriteria || {};
    const la = pi.locationAnalysis || {};
    const products = pi.products || [];

    if (ic.feasibility || ic.uniqueness || ic.marketFit || ic.resourceAvailability) {
        result.push(['معايير صياغة فكرة المشروع']);
        result.push(['الإمكانية التنفيذية', (ic.feasibility || '—').toString()]);
        result.push(['التميز والتفرد', (ic.uniqueness || '—').toString()]);
        result.push(['ملاءمة السوق', (ic.marketFit || '—').toString()]);
        result.push(['توفر الموارد', (ic.resourceAvailability || '—').toString()]);
        result.push([]);
    }

    if (pi.identityStatement || pi.valueProposition) {
        result.push(['الهوية والقيمة']);
        if (pi.identityStatement) result.push(['الهوية', (pi.identityStatement || '').toString()]);
        if (pi.valueProposition) result.push(['القيمة المقترحة', (pi.valueProposition || '').toString()]);
        result.push([]);
    }

    if (products.length > 0) {
        result.push(['المنتجات']);
        // تدقيق دفعة 3 (2026-07-12): «خصائص فريدة» و«قيمة مضافة» دُمجا في عمود واحد
        // (schema.js products.uniqueFeatures) — عمود valueAdded المنفصل لم يعد جزءاً
        // من المخطط. يُدمج هنا مع uniqueFeatures عرضاً فقط لدراسات محفوظة قبل هذا
        // التغيير كانت تملأ الحقلين منفصلين، فلا يضيع نص أُدخل سابقاً.
        result.push(['النوع', 'المنتج', 'الوصف', 'الميزة الفريدة / القيمة المضافة', 'فائدة للعميل']);
        products.forEach((p) => {
            const typeLabel = p.type === 'primary' ? 'أولي' : p.type === 'semi' ? 'نصف مصنع' : 'نهائي';
            const uniqueFeatures = [p.uniqueFeatures, p.valueAdded]
                .filter((v) => v && String(v).trim())
                .join(' — ');
            result.push([
                typeLabel,
                (p.name || '').toString(),
                (p.description || '').toString(),
                uniqueFeatures,
                (p.customerBenefit || '').toString()
            ]);
        });
        result.push([]);
    }

    const introServices = pi.introServices || [];
    if (introServices.length > 0) {
        result.push(['الخدمات']);
        result.push(['النوع', 'الخدمة', 'الوصف']);
        introServices.forEach((s) => {
            const typeLabel = s.type === 'essential' ? 'أساسية' : s.type === 'secondary' ? 'ثانوية' : 'داعمة';
            result.push([typeLabel, (s.name || '').toString(), (s.description || '').toString()]);
        });
        result.push([]);
    }

    const customerValues = pi.customerValues || [];
    if (customerValues.length > 0) {
        result.push(['القيمة لكل عميل']);
        result.push(['نوع العميل', 'ماذا يريد', 'القيمة التي نقدمها']);
        customerValues.forEach((c) => result.push([
            (c.customerType || '').toString(),
            (c.customerNeed || '').toString(),
            (c.valueWeProvide || '').toString()
        ]));
        result.push([]);
    }

    if (la.selectionFactors || la.chosenReason || la.address || la.coordinates?.lat || (la.locationAlternatives || []).length > 0) {
        result.push(['تحليل اختيار الموقع']);
        if (la.address) result.push(['العنوان', (la.address || '').toString()]);
        if (la.coordinates?.lat != null && la.coordinates?.lng != null) result.push(['الإحداثيات', `${la.coordinates.lat}, ${la.coordinates.lng}`]);
        if (la.selectionFactors) result.push(['عوامل الاختيار', (la.selectionFactors || '').toString()]);
        if (la.chosenReason) result.push(['سبب الاختيار', (la.chosenReason || '').toString()]);
        const alts = la.locationAlternatives || [];
        if (alts.length > 0) {
            result.push(['المواقع البديلة']);
            alts.forEach(a => result.push([(a.name || '').toString(), (a.address || '').toString(), (a.notes || '').toString()]));
        }
        result.push([]);
    }

    const sh = pi.startupHypothesis || {};
    const ua = pi.unfairAdvantage || { types: [], insightText: '' };
    if (sh.problem || sh.solution || sh.insight || (ua.types || []).length > 0 || ua.insightText) {
        result.push(['الفرضية ولماذا سنربح (تقييم الفكرة)']);
        if (sh.problem) result.push(['المشكلة (الظروف الأولية)', (sh.problem || '').toString()]);
        if (sh.solution) result.push(['الحل (التجربة/المنتج أو الخدمة)', (sh.solution || '').toString()]);
        if (sh.insight) result.push(['الاستبصار (لماذا سنربح؟)', (sh.insight || '').toString()]);
        const uaLabels = { founder: 'مؤسس', market: 'سوق نامٍ', product10x: 'منتج 10x', acquisition: 'اكتساب (كلمة شفاهية)', network: 'تأثير شبكي' };
        if ((ua.types || []).length > 0) result.push(['المزايا غير العادلة', (ua.types || []).map(t => uaLabels[t] || t).join('؛ ')]);
        if (ua.insightText) result.push(['شرح موجز للاستبصار', (ua.insightText || '').toString()]);
        result.push([]);
    }

    return result.length > 1 ? result : [['مقدمة الجدوى الموحدة'], [], ['لا توجد بيانات']];
}

function handleMarketingSection(data) {
    const result = [['الدراسة التسويقية']];
    const ma = data?.marketAnalysis || {};
    const elastLabels = { elastic: 'مرنة (كمالية)', inelastic: 'غير مرنة (ضرورية)', unitary: 'وحدة مرونة' };
    if (ma?.demandElasticity) result.push(['مرونة الطلب', (elastLabels[ma.demandElasticity] || ma.demandElasticity)]);
    const mix = data?.marketingMix || {};
    if (mix.product || mix.price || mix.place || mix.promotion) {
        result.push(['المزيج التسويقي (4P)']);
        result.push(['المنتج', (mix.product || '—').toString()]);
        result.push(['السعر', (mix.price || '—').toString()]);
        result.push(['المكان', (mix.place || '—').toString()]);
        result.push(['الترويج', (mix.promotion || '—').toString()]);
        result.push([]);
    }
    const comps = data?.competitors || [];
    if (comps.length > 0) {
        result.push(['المنافسون']);
        result.push(['المنافس', 'نقاط القوة', 'نقاط الضعف', 'الحصة %', 'عدد عملاء/يوم', 'متوسط فاتورة']);
        comps.forEach((c) => result.push([
            (c.name || '').toString(),
            (c.strengths || '').toString(),
            (c.weaknesses || '').toString(),
            c.marketShare ?? '—',
            c.estimatedDailyCustomers ?? '—',
            c.estimatedAvgTicket ?? '—'
        ]));
    }
    const bench = data?.competitorBenchmarking || [];
    if (bench.length > 0) {
        result.push([]);
        result.push(['مقارنة المشروع مع المنافسين (جدول معايير)']);
        result.push(['عنصر المقارنة', 'الأهمية', 'ترتيب المشروع', 'ترتيب منافس 1', 'ترتيب منافس 2', 'ترتيب منافس 3']);
        bench.forEach((b) => result.push([
            (b.criterion || '').toString(),
            (b.importance || '—').toString(),
            b.myRank ?? '—',
            b.comp1Rank ?? '—',
            b.comp2Rank ?? '—',
            b.comp3Rank ?? '—'
        ]));
    }
    const suppliers = data?.suppliers || [];
    if (suppliers.length > 0) {
        result.push([]);
        result.push(['الموردون']);
        result.push(['اسم المورد', 'طبيعة التوريدات', 'إمكانية الحصول', 'فترة التوريد (يوم)', 'ملاحظات']);
        suppliers.forEach((s) => result.push([
            (s.name || '').toString(),
            (s.supplyNature || '').toString(),
            (s.availability || '').toString(),
            s.avgDeliveryDays ?? '—',
            (s.notes || '').toString()
        ]));
    }
    const hist = data?.marketAnalysis?.historicalData || [];
    if (hist.length > 0) {
        result.push([]);
        result.push(['اتجاهات الطلب التاريخية (5 سنوات)']);
        result.push(['السنة', 'الطلب/الحجم', 'ملاحظات']);
        hist.forEach((h) => result.push([h.year ?? '—', h.demand ?? '—', (h.notes || '').toString()]));
    }
    const sdb = data?.supplyDemandBalance || [];
    if (sdb.length > 0) {
        result.push([]);
        result.push(['توازن العرض والطلب']);
        result.push(['العامل', 'العرض المقدر', 'الطلب المقدر', 'الخلاصة', 'ملاحظات']);
        sdb.forEach((r) => result.push([
            (r.factor || '').toString(),
            (r.estimatedSupply || '').toString(),
            (r.estimatedDemand || '').toString(),
            (r.balanceConclusion || '').toString(),
            (r.notes || '').toString()
        ]));
    }
    return result.length > 1 ? result : [['الدراسة التسويقية'], [], ['لا توجد بيانات']];
}

function handleAppendicesSection(data) {
    const result = [['الملاحق والمصادر والمراجع']];
    if (data?.investorProfile) {
        result.push([]);
        result.push(['نبذة عن المستثمر']);
        result.push([(data.investorProfile || '').toString()]);
    }
    const refs = data?.references || [];
    if (refs.length > 0) {
        result.push([]);
        result.push(['المصادر والمراجع']);
        result.push(['المؤلف', 'العنوان', 'الناشر', 'سنة النشر', 'ملاحظات']);
        refs.forEach((r) => result.push([
            (r.author || '').toString(),
            (r.title || '').toString(),
            (r.publisher || '').toString(),
            (r.year || '').toString(),
            (r.notes || '').toString()
        ]));
    }
    const reviewers = data?.reviewers || [];
    if (reviewers.length > 0) {
        result.push([]);
        result.push(['المحكمون والمختصون الفنيون']);
        result.push(['الاسم', 'الدور', 'المؤهلات']);
        reviewers.forEach((r) => result.push([
            (r.name || '').toString(),
            (r.role || '').toString(),
            (r.qualifications || '').toString()
        ]));
    }
    const surveys = data?.surveys || [];
    if (surveys.length > 0 || (typeof data?.surveys === 'string' && data.surveys)) {
        result.push([]);
        result.push(['الاستطلاعات والاستبيانات']);
        const s = Array.isArray(surveys) ? surveys.join('\n') : (data.surveys || '');
        result.push([s.toString()]);
    }
    const quotes = data?.priceQuotes || [];
    if (quotes.length > 0 || (typeof data?.priceQuotes === 'string' && data.priceQuotes)) {
        result.push([]);
        result.push(['عروض الأسعار والتقارير الفنية']);
        const q = Array.isArray(quotes) ? quotes.join('\n') : (data.priceQuotes || '');
        result.push([q.toString()]);
    }
    return result.length > 1 ? result : [['الملاحق'], [], ['لا توجد بيانات']];
}

function handleOrgStructureSection(data) {
    const result = [['الهيكل التنظيمي والحوكمة']];
    const advisors = data?.advisoryBoard || [];
    if (advisors.length > 0) {
        result.push([]);
        result.push(['المجلس الاستشاري']);
        result.push(['الاسم', 'الدور/التخصص']);
        advisors.forEach((a) => result.push([(a.name || '').toString(), (a.role || '').toString()]));
    }
    const kpis = data?.operationalKpis || [];
    if (kpis.length > 0) {
        result.push([]);
        result.push(['مؤشرات قياس الأداء التشغيلية']);
        result.push(['الهدف الاستراتيجي', 'المؤشر', 'طريقة الحساب', 'وحدة القياس', 'القيمة المعيارية', 'ملاحظات']);
        kpis.forEach((k) => result.push([
            (k.strategicGoal || '').toString(),
            (k.indicator || '').toString(),
            (k.calculationMethod || '').toString(),
            (k.unit || '').toString(),
            (k.targetValue || '').toString(),
            (k.notes || '').toString()
        ]));
    }
    return result.length > 2 ? result : [['الهيكل التنظيمي'], [], ['لا توجد بيانات إضافية']];
}

function handleKeyPeopleSection(data) {
    const items = data?.keyPeople || [];
    const partners = data?.partnershipContracts || [];
    const result = [['الأشخاص الرئيسون (الفريق المؤسس)']];
    if (items.length === 0) {
        result.push([]);
        result.push(['لا توجد بيانات']);
    } else {
        result.push(['الاسم', 'الدور/المسمى', 'الخبرة', 'المؤهلات']);
        items.forEach((item) => {
            result.push([
                (item.name || '').toString(),
                (item.role || '').toString(),
                (item.experience || '').toString(),
                (item.qualifications || '').toString(),
            ]);
        });
    }
    if (partners.length > 0) {
        result.push([]);
        result.push(['عقود الشراكة']);
        result.push(['اسم الشريك', 'الدور/المسؤولية', 'النسبة %', 'ملاحظات']);
        partners.forEach((p) => result.push([
            (p.partnerName || '').toString(),
            (p.role || '').toString(),
            p.sharePercent ?? '—',
            (p.notes || '').toString()
        ]));
    }
    return result;
}

function handleTechResourcesSection(data) {
    const result = [];
    const items = data?.techResources || [];

    if (items.length === 0) {
        return [['الموارد التقنية'], [], ['لا توجد بنود مضافة']];
    }

    result.push(['الموارد التقنية']);
    result.push(['البند', 'الكمية', 'السعر', 'الإجمالي', 'نسبة الاستهلاك']);
    items.forEach((item) => {
        const total = (item.quantity || 1) * (item.price || 0);
        const rate = item.depreciationRate != null ? Number(item.depreciationRate) : 0;
        result.push([
            item.name || '',
            item.quantity || 1,
            item.price || 0,
            total,
            (rate * 100).toFixed(1) + '%',
        ]);
    });

    return result;
}

function handleFinancialResults(results) {
    const result = [];

    // CAPEX Summary
    result.push(['ملخص التكاليف الرأسمالية (CAPEX)']);
    result.push(['البند', 'المبلغ']);
    result.push(['الإجمالي الفرعي', SAFE.num(results.capex?.subtotal)]);
    result.push(['الاحتياطي', SAFE.num(results.capex?.contingency)]);
    result.push(['رأس المال العامل', SAFE.num(results.capex?.workingCapital)]);
    result.push(['الإجمالي الكلي', SAFE.num(results.capex?.total)]);
    result.push([]);

    // OPEX Summary
    result.push(['ملخص التكاليف التشغيلية (OPEX)']);
    result.push(['التكاليف الثابتة السنوية', SAFE.num(results.opex?.fixedAnnual)]);
    result.push(['التكاليف المتغيرة السنوية', SAFE.num(results.opex?.variableAnnual)]);
    result.push(['الإجمالي السنوي', SAFE.num(results.opex?.totalAnnual)]);
    result.push([]);

    // Income Statement
    if (results.incomeStatement?.length > 0) {
        result.push(['قائمة الدخل التقديرية']);
        result.push(['البند', ...results.incomeStatement.map(s => 'السنة ' + s.year)]);
        result.push(['الإيرادات', ...results.incomeStatement.map(s => SAFE.num(s.revenue))]);
        result.push(['التكاليف المتغيرة', ...results.incomeStatement.map(s => -SAFE.num(s.variableCosts))]);
        result.push(['مجمل الربح', ...results.incomeStatement.map(s => SAFE.num(s.grossProfit))]);
        result.push(['التكاليف الثابتة', ...results.incomeStatement.map(s => -SAFE.num(s.fixedCosts))]);
        result.push(['EBITDA', ...results.incomeStatement.map(s => SAFE.num(s.ebitda))]);
        result.push(['الاستهلاك', ...results.incomeStatement.map(s => -SAFE.num(s.depreciation))]);
        result.push(['EBIT', ...results.incomeStatement.map(s => SAFE.num(s.ebit))]);
        result.push(['الفوائد', ...results.incomeStatement.map(s => -SAFE.num(s.interestExpense ?? s.interest))]);
        result.push(['الضرائب', ...results.incomeStatement.map(s => -SAFE.num(s.tax))]);
        result.push(['صافي الربح', ...results.incomeStatement.map(s => SAFE.num(s.netIncome))]);
        result.push([]);
    }

    // KPIs
    result.push(['المؤشرات المالية']);
    const ind = results.indicators || {};
    result.push(['صافي القيمة الحالية (NPV)', SAFE.num(ind.npv)]);
    result.push(['معدل العائد الداخلي (IRR)', (SAFE.pct(ind.irr) || 0).toFixed(1) + '%']);
    result.push(['فترة الاسترداد', (SAFE.num(ind.paybackPeriod ?? ind.payback)).toFixed(2) + ' سنة']);
    result.push(['نسبة DSCR', formatDscr(ind.dscr)]);
    result.push([]);
    result.push(['القرار', results.decision || '']);

    return result;
}

function handleGenericObject(data) {
    const result = [];

    Object.entries(data).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0) {
            result.push([getArabicLabel(key)]);
            result.push(...arrayToSheetData(value));
            result.push([]);
        } else if (typeof value === 'object' && value !== null) {
            result.push([getArabicLabel(key)]);
            Object.entries(value).forEach(([k, v]) => {
                if (typeof v !== 'object') {
                    result.push([getArabicLabel(k), formatValue(v)]);
                }
            });
            result.push([]);
        } else {
            result.push([getArabicLabel(key), formatValue(value)]);
        }
    });

    return result;
}

function arrayToSheetData(arr) {
    if (!arr || arr.length === 0) return [['لا توجد بيانات']];

    const headers = Object.keys(arr[0]).map(k => getArabicLabel(k));
    const data = [headers];

    arr.forEach(row => {
        data.push(Object.values(row).map(v => formatValue(v)));
    });

    return data;
}

function formatValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
    if (typeof value === 'number') {
        return isNaN(value) ? '' : value;
    }
    return String(value);
}

function getArabicLabel(key) {
    const labels = {
        name: 'الاسم',
        description: 'الوصف',
        city: 'المدينة',
        district: 'الحي',
        areaSize: 'المساحة (م²)',
        buildings: 'المباني',
        equipment: 'المعدات',
        furniture: 'الأثاث',
        quantity: 'الكمية',
        price: 'السعر',
        total: 'الإجمالي',
        depreciationRate: 'نسبة الاستهلاك',
        positions: 'الوظائف',
        position: 'الوظيفة',
        count: 'العدد',
        salary: 'الراتب',
        months: 'عدد الأشهر',
        isVariable: 'تكلفة متغيرة',
        streams: 'مصادر الإيرادات',
        service: 'الخدمة',
        customersPerMonth: 'العملاء/شهر',
        avgPrice: 'متوسط السعر',
        growthRate: 'نسبة النمو',
        sources: 'مصادر التمويل',
        equity: 'رأس المال',
        bankLoan: 'القرض البنكي',
        amount: 'المبلغ',
        interestRate: 'نسبة الفائدة',
        termYears: 'مدة السداد',
        inflationRate: 'معدل التضخم',
        taxRate: 'معدل الضريبة',
        discountRate: 'معدل الخصم',
        projectionYears: 'سنوات التوقع',
        notes: 'ملاحظات'
    };

    return labels[key] || key;
}

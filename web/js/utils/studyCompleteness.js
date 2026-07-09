/**
 * Study Completeness Calculator
 * Calculates the completion percentage of a feasibility study
 */

export function calculateStudyCompleteness(studyData) {
    if (!studyData) return { percentage: 0, details: {} };

    // الافتراضات المنهجية (معدل خصم، سيناريوهات، هيكل تمويل...) موجودة في المخطط
    // منذ الإنشاء — لا تُحتسب نقاطها إلا بعد أول إدخال فعلي من المستخدم، وإلا
    // يعرض مشروع فارغ نسبة اكتمال وهمية (~17%).
    const hasAnyUserInput = Boolean(
        studyData.projectInfo?.name ||
        studyData.projectInfo?.description ||
        studyData.revenue?.streams?.length ||
        studyData.technical?.equipment?.length ||
        studyData.technical?.buildings?.length ||
        studyData.hr?.positions?.length
    );

    const weights = {
        // الأساسيات (31%) — projectInfo(8)+keyPeople(3)+technical(8)+hr(5)+assumptions(7)=31
        projectInfo: 8,
        keyPeople: 3,
        technical: 8,
        hr: 5,
        assumptions: 7,

        // التشغيل (25%)
        techResources: 5,
        logistics: 5,
        administrative: 5,
        legal: 5,
        revenue: 5,

        // التسويق والاستراتيجية (27%) — marketing(9)+marketSizing(8)+strategic(5)+services(5)=27
        marketing: 9,
        marketSizing: 8,
        strategic: 5,
        services: 5,

        // التحليل والمخاطر (20%)
        riskAnalysis: 10,
        scenarios: 5,
        financing: 5
    };

    const details = {};
    let totalScore = 0;
    let maxScore = 0;

    // Helper to add section details
    const addDetail = (key, score, max, missing = []) => {
        details[key] = {
            score,
            max,
            percentage: max > 0 ? (score / max) * 100 : 0,
            missing
        };
        totalScore += score;
        maxScore += max;
    };

    // 1. Project Info (10%)
    {
        const p = studyData.projectInfo || {};
        let score = 0;
        const missing = [];

        if (p.name) score += 2; else missing.push('اسم المشروع');
        if (p.description) score += 1; else missing.push('وصف المشروع');
        // المدينة لها قيمة افتراضية — تُحتسب فقط بعد تسمية المشروع
        if (p.city && p.name) score += 1; else missing.push('المدينة');
        if (p.district) score += 1; else missing.push('الحي');
        if (p.concept) score += 1; else missing.push('فكرة المشروع');
        if (p.areaSize > 0) score += 2; else missing.push('المساحة');
        if (p.timeline?.projectStart) score += 1; else missing.push('تاريخ البدء');
        if (p.timeline?.operationStart) score += 1; else missing.push('تاريخ التشغيل');
        if (p.identityStatement || p.valueProposition) score += 1;
        const la = p.locationAnalysis || {};
        if (la.coordinates?.lat != null && la.coordinates?.lng != null) score += 0.5;
        if (la.address || la.selectionFactors) score += 0.5;
        const checklist = p.dataGatheringChecklist || [];
        // خطوات الجمع الافتراضية لا تُحتسب — يلزم إنجاز خطوة أو تدوين ملاحظة
        if (checklist.length > 0 && checklist.some(c => c.done || (c.notes && String(c.notes).trim()))) score += 0.5;

        addDetail('projectInfo', Math.min(score, weights.projectInfo), weights.projectInfo, missing);
    }

    // 1b. Key People (3%)
    {
        const kp = studyData.keyPeople?.keyPeople || [];
        let score = 0;
        const missing = [];
        if (kp.length > 0) score = weights.keyPeople;
        else missing.push('الأشخاص الرئيسون');
        addDetail('keyPeople', score, weights.keyPeople, missing);
    }

    // 2. Technical (8%)
    {
        const t = studyData.technical || {};
        let score = 0;
        const missing = [];

        if (t.buildings?.length > 0) score += 2; else missing.push('المباني والإنشاءات');
        if (t.equipment?.length > 0) score += 2; else missing.push('المعدات والآلات');
        if (t.furniture?.length > 0) score += 1; else missing.push('الأثاث والمفروشات');
        if (t.productionCapacity?.annualCapacity > 0 || t.productionCapacity?.unitOrMeasure) score += 1.5;
        if (t.locationAssessment?.length > 0) score += 1.5; else missing.push('تقييم الموقع (عوامل جغرافية)');

        addDetail('technical', Math.min(score, weights.technical), weights.technical, missing);
    }

    // 3. HR (5%)
    {
        let score = 0;
        const missing = [];
        if (studyData.hr?.positions?.length > 0) {
            score = weights.hr;
        } else {
            missing.push('المسميات الوظيفية والرواتب');
        }
        addDetail('hr', score, weights.hr, missing);
    }

    // 4. Assumptions (7%)
    {
        const a = hasAnyUserInput ? (studyData.assumptions || {}) : {};
        let score = 0;
        const missing = [];

        if (a.inflationRate !== undefined) score += 1; else missing.push('معدل التضخم');
        if (a.taxRate !== undefined) score += 1; else missing.push('نسبة الضريبة');
        if (a.discountRate !== undefined) score += 1; else missing.push('معدل الخصم');
        if (a.workingCapitalMonths !== undefined) score += 1; else missing.push('أشهر رأس المال العامل');
        if (a.contingencyRate !== undefined) score += 1; else missing.push('نسبة احتياطي الطوارئ');
        if (a.projectionYears !== undefined) score += 1; else missing.push('سنوات التوقعات');
        if (a.thresholds) score += 1;

        addDetail('assumptions', score, weights.assumptions, missing);
    }

    // 5. Tech Resources (5%)
    {
        const techRes = studyData.techResources?.techResources || studyData.techResources;
        let score = 0;
        const missing = [];
        if (Array.isArray(techRes) && techRes.length > 0) {
            score = weights.techResources;
        } else {
            missing.push('البرمجيات والأنظمة التقنية');
        }
        addDetail('techResources', score, weights.techResources, missing);
    }

    // 6. Logistics (5%)
    {
        const logistics = studyData.logistics?.logistics || studyData.logistics;
        let score = 0;
        const missing = [];
        if (Array.isArray(logistics) && logistics.length > 0) {
            score = weights.logistics;
        } else {
            missing.push('السيارات ووسائل النقل');
        }
        addDetail('logistics', score, weights.logistics, missing);
    }

    // 7. Administrative (5%)
    {
        const admin = studyData.administrative?.administrative || studyData.administrative;
        let score = 0;
        const missing = [];
        if (Array.isArray(admin) && admin.length > 0) {
            score = weights.administrative;
        } else {
            missing.push('الأدوات المكتبية والمصاريف الإدارية');
        }
        addDetail('administrative', score, weights.administrative, missing);
    }

    // 8. Legal (5%)
    {
        let score = 0;
        const missing = [];
        if (studyData.legal?.licenses?.length > 0) {
            score = weights.legal;
        } else {
            missing.push('التراخيص والرسوم الحكومية');
        }
        addDetail('legal', score, weights.legal, missing);
    }

    // 9. Revenue (5%)
    {
        let score = 0;
        const missing = [];
        if (studyData.revenue?.streams?.length > 0) {
            score = weights.revenue;
        } else {
            missing.push('مصادر الإيرادات');
        }
        addDetail('revenue', score, weights.revenue, missing);
    }

    // 10. Marketing (8%)
    {
        const m = studyData.marketing || {};
        let score = 0;
        const missing = [];

        if (m.competitors?.length > 0) score += 2; else missing.push('المنافسين');
        if (m.campaigns?.length > 0) score += 1.5; else missing.push('الحملات التسويقية');
        const mix = m.marketingMix || {};
        if (mix.product || mix.price || mix.place || mix.promotion) score += 2; else missing.push('المزيج التسويقي (4P)');
        if (m.swot?.strengths || m.swot?.weaknesses) score += 0.5;
        if (m.marketAnalysis?.marketSize > 0 || m.marketAnalysis?.growthRate > 0) score += 0.5;
        if ((m.marketAnalysis?.historicalData || []).length > 0) score += 0.5;
        if ((m.supplyDemandBalance || []).length > 0) score += 0.5;

        addDetail('marketing', Math.min(score, weights.marketing), weights.marketing, missing);
    }

    // 11. Market Sizing (7%)
    {
        const ms = studyData.marketSizing || {};
        let score = 0;
        const missing = [];

        if (ms.segments?.length > 0) score += 2.5; else missing.push('شرائح العملاء');
        if (ms.tam?.value > 0) score += 1; else missing.push('TAM');
        if (ms.sam?.value > 0) score += 1; else missing.push('SAM');
        if (ms.som?.value > 0) score += 1; else missing.push('SOM');
        if (ms.vision2030?.alignment || ms.nationalEconomy?.gdpGrowth) score += 0.5;
        if (ms.sectorAnalysis || ms.industryAnalysis) score += 0.5;
        if (ms.targetDistrict || ms.targetNeighborhood) score += 0.5;

        addDetail('marketSizing', Math.min(score, weights.marketSizing), weights.marketSizing, missing);
    }

    // 12. Strategic (5%)
    {
        const s = studyData.strategic || {};
        let score = 0;
        const missing = [];

        if (s.pestel?.length > 0 && s.pestel.some(p => p.description)) score += 2; else missing.push('تحليل بيستل (PESTEL)');
        if (s.swot?.strengths?.length > 0 || s.swot?.weaknesses?.length > 0) score += 2; else missing.push('تحليل نقاط القوة والضعف');
        // بنية porter الافتراضية موجودة دائماً — تُحتسب فقط عند تعبئة وصف واحد على الأقل
        if (s.porter && Object.values(s.porter).some(f => f && String(f.description || '').trim())) score += 1;

        addDetail('strategic', score, weights.strategic, missing);
    }

    // 13. Services (5%)
    {
        let score = 0;
        const missing = [];
        if (studyData.services?.items?.length > 0 || studyData.services?.breakdown?.length > 0) {
            score = weights.services;
        } else {
            missing.push('تفاصيل المنتجات/الخدمات');
        }
        addDetail('services', score, weights.services, missing);
    }

    // 14. Risk Analysis (10%)
    {
        let score = 0;
        const missing = [];
        if (studyData.riskAnalysis?.risks?.length > 0) {
            score = weights.riskAnalysis;
        } else {
            missing.push('سجل المخاطر');
        }
        addDetail('riskAnalysis', score, weights.riskAnalysis, missing);
    }

    // 15. Scenarios (5%)
    {
        let score = 0;
        const missing = [];
        if (hasAnyUserInput && studyData.scenarios?.base && studyData.scenarios?.pessimistic && studyData.scenarios?.optimistic) {
            score = weights.scenarios;
        } else {
            missing.push('إعداد السيناريوهات (متشائم، متفائل)');
        }
        addDetail('scenarios', score, weights.scenarios, missing);
    }

    // 16. Financing (5%)
    {
        let score = 0;
        const missing = [];
        // بنية sources موجودة افتراضياً — يلزم مبلغ تمويل فعلي واحد على الأقل
        const fin = studyData.financing || {};
        const srcs = fin.sources || {};
        const hasFinancingAmount = (Number(fin.totalInvestment) || 0) > 0 ||
            Object.values(srcs).some(s => (Number(s?.amount) || 0) > 0);
        if (hasFinancingAmount) {
            score = weights.financing;
        } else {
            missing.push('هيكل التمويل (رأس المال/القروض)');
        }
        addDetail('financing', score, weights.financing, missing);
    }

    // 17. Enloop: نصوص الأقسام الرئيسية (الملخص، السوق، المخاطر) — جودة المسودة
    const narrativeWeight = 9; // 9% إجمالي للنصوص
    {
        let score = 0;
        const missing = [];
        const execText = (studyData.executiveSummary?.projectOverview || studyData.executiveSummary?.text || '').trim();
        if (execText.length >= 50) score += 3; else missing.push('الملخص التنفيذي (نص)');
        const marketText = (studyData.marketing?.marketAnalysis?.summary || studyData.marketing?.marketAnalysis?.description || '').trim();
        if (marketText.length >= 50) score += 3; else missing.push('وصف السوق');
        const risks = studyData.riskAnalysis?.risks || [];
        const hasRiskText = risks.some(r => (r.description || r.name || '').trim().length >= 20);
        if (hasRiskText) score += 3; else missing.push('تحليل المخاطر (نص)');
        details.narrativeSections = {
            score,
            max: narrativeWeight,
            percentage: narrativeWeight > 0 ? (score / narrativeWeight) * 100 : 0,
            missing
        };
        totalScore += score;
        maxScore += narrativeWeight;
    }

    const percentage = maxScore > 0 ? Math.min(100, Math.round((totalScore / maxScore) * 100)) : 0;

    return {
        percentage,
        score: totalScore,
        maxScore,
        details,
        // Helper: نصائح لرفع النقاط (Enloop)
        getTipsToRaiseScore: () => {
            const tips = [];
            const execText = (studyData.executiveSummary?.projectOverview || studyData.executiveSummary?.text || '').trim();
            if (execText.length < 50) tips.push('أضِف ملخصاً تنفيذياً لرفع النقاط');
            const marketText = (studyData.marketing?.marketAnalysis?.summary || studyData.marketing?.marketAnalysis?.description || '').trim();
            if (marketText.length < 50) tips.push('أضِف وصف السوق لرفع النقاط');
            const risks = studyData.riskAnalysis?.risks || [];
            const hasRiskText = risks.some(r => (r.description || r.name || '').trim().length >= 20);
            if (!hasRiskText) tips.push('أضِف تحليل المخاطر (نصاً) لرفع النقاط');
            const missingSections = Object.entries(details)
                .filter(([k, d]) => k !== 'narrativeSections' && d.percentage < 100 && d.missing && d.missing.length > 0)
                .slice(0, 2);
            missingSections.forEach(([key, d]) => {
                const label = (d.missing && d.missing[0]) ? d.missing[0] : key;
                if (!tips.includes('أكمِل ' + label)) tips.push('أكمِل ' + label + ' لرفع النقاط');
            });
            return tips.slice(0, 4); // أعلى 4 نصائح
        },
        // Helper: Get missing sections with Arabic labels
        getMissingSections: () => {
            const sectionLabels = {
                projectInfo: 'بيانات المشروع',
                keyPeople: 'الأشخاص الرئيسون',
                technical: 'الدراسة الفنية',
                hr: 'الموارد البشرية',
                assumptions: 'الافتراضات المالية',
                techResources: 'الموارد التقنية',
                logistics: 'الموارد اللوجستية',
                administrative: 'الموارد الإدارية',
                legal: 'الدراسة القانونية',
                revenue: 'مصادر الإيرادات',
                marketing: 'الدراسة التسويقية',
                marketSizing: 'تحليل حجم السوق',
                strategic: 'التحليل الاستراتيجي',
                services: 'تحليل الخدمات',
                riskAnalysis: 'تحليل المخاطر',
                scenarios: 'السيناريوهات',
                financing: 'مصادر التمويل',
                narrativeSections: 'نصوص الأقسام (ملخص، سوق، مخاطر)'
            };

            return Object.entries(details)
                .filter(([_, d]) => d.percentage < 100)
                .map(([key, d]) => ({
                    key,
                    label: sectionLabels[key] || key,
                    percentage: d.percentage,
                    score: d.score,
                    max: d.max,
                    missing: d.missing // Include missing items in the helper output
                }))
                .sort((a, b) => b.max - a.max); // Sort by importance (max weight)
        }
    };
}

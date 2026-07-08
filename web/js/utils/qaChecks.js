/**
 * فحص الجودة (QA) للدراسة — موحّد للوحة القرار وقائمة التصدير.
 * @param {Object} state
 * @param {Object} results - مخرجات المحرك (indicators/kpis، incomeStatement)
 * @returns {Promise<{ passed: boolean, hardErrors: Array, softWarnings: Array, validationErrors: Array, validationWarnings: Array }>}
 */
import { validateInputs } from '../../../lib/calc/validateInputs.js';
import { checkDriversAgainstBenchmarks } from '../core/sectorBenchmarks.js';

export async function runQAChecks(state, results) {
    const qaResults = {
        passed: true,
        hardErrors: [],
        softWarnings: [],
        validationErrors: [],
        validationWarnings: []
    };

    try {
        const validation = validateInputs(state);
        qaResults.validationErrors = validation.errors || [];
        qaResults.validationWarnings = validation.warnings || [];

        try {
            const { qaGate } = await import('../../../lib/calc/qaGate.js');
            if (qaGate && typeof qaGate === 'function') {
                const qaGateResult = qaGate(state, results, null, { strictMode: false });
                qaResults.hardErrors = qaGateResult.hardErrors || [];
                qaResults.softWarnings = qaGateResult.softWarnings || [];
            }
        } catch (e) {
            console.warn('QA Gate not available:', e);
        }

        if (!results || !results.incomeStatement || results.incomeStatement.length === 0) {
            qaResults.hardErrors.push({
                code: 'MISSING_FINANCIAL_STATEMENTS',
                message: 'القوائم المالية غير مكتملة. يرجى إكمال المدخلات المالية الأساسية.',
                path: 'financial'
            });
        }

        const kpis = results?.indicators || results?.kpis;
        if (!kpis || (kpis.npv === undefined && kpis.irr === undefined)) {
            qaResults.hardErrors.push({
                code: 'MISSING_KPIS',
                message: 'مؤشرات الأداء الرئيسية (NPV, IRR) غير محسوبة.',
                path: 'kpis'
            });
        }

        // فحوص تماسك صارمة — تمنع خروج دراسة هشّة أو متناقضة تُسيء لسمعة المنصة.
        try {
            const y1 = results?.incomeStatement?.[0] || null;
            const revenue1 = Number(y1?.revenue ?? NaN);
            const opexAnnual = Number(results?.opex?.totalAnnual ?? NaN);
            const capexTotal = Number(results?.capex?.total ?? NaN);

            // حجب: لا توجد إيرادات مُقدّرة إطلاقاً
            if (results && Number.isFinite(revenue1) && revenue1 <= 0) {
                qaResults.hardErrors.push({
                    code: 'NO_REVENUE',
                    message: 'لا توجد إيرادات مُقدّرة (إيراد السنة الأولى = صفر). أضِف مصادر الإيراد أو توقعات المبيعات قبل التصدير.',
                    path: 'revenue'
                });
            }
            // حجب: إيرادات دون أي تكاليف تشغيل = نتيجة غير منطقية
            if (results && Number.isFinite(revenue1) && revenue1 > 0 && Number.isFinite(opexAnnual) && opexAnnual <= 0) {
                qaResults.hardErrors.push({
                    code: 'REVENUE_WITHOUT_COSTS',
                    message: 'توجد إيرادات دون أي تكاليف تشغيل — نتيجة غير منطقية. أدخِل التكاليف الثابتة والمتغيرة.',
                    path: 'opex'
                });
            }
            // تنبيه: لا يوجد استثمار رأسمالي
            if (results && Number.isFinite(capexTotal) && capexTotal <= 0) {
                qaResults.softWarnings.push({
                    code: 'NO_CAPEX',
                    message: 'لا توجد تكاليف تأسيسية (استثمار رأسمالي = صفر). تأكّد أن هذا مقصود.',
                    path: 'capex'
                });
            }
            // تنبيه: اسم المشروع فارغ (يظهر فارغاً في التقرير)
            const projName = String(state?.projectInfo?.name || '').trim();
            if (!projName) {
                qaResults.softWarnings.push({
                    code: 'PROJECT_NAME_MISSING',
                    message: 'اسم المشروع غير محدد — سيظهر فارغاً في ترويسة التقرير.',
                    path: 'projectInfo.name'
                });
            }

            // جاهزية النسخة للبيع/التمويل: هذه البنود لا تكسر الحسابات، لكنها تخفض جودة الدراسة أمام مستشار أو ممول.
            {
                const marketText = String(state?.marketing?.marketAnalysis?.summary || state?.marketing?.marketAnalysis?.description || '').trim();
                if (marketText.length < 80) {
                    qaResults.softWarnings.push({
                        code: 'MARKET_NARRATIVE_MISSING',
                        message: 'تحليل السوق النصي مختصر أو غير موجود — أضف وصفاً مدعوماً للطلب، الشريحة المستهدفة، واتجاهات السوق قبل بيع الدراسة كنسخة مخصصة.',
                        path: 'marketing.marketAnalysis.summary'
                    });
                }

                const competitors = state?.marketing?.competitors || [];
                if (competitors.length < 2) {
                    qaResults.softWarnings.push({
                        code: 'COMPETITORS_MISSING',
                        message: 'تحليل المنافسين غير كافٍ — أضف منافسين محليين على الأقل مع نقاط القوة والضعف والأسعار/الحركة التقريبية. هذا من أهم ما يرفع الدراسة من 7/10 إلى مستوى تمويلي.',
                        path: 'marketing.competitors'
                    });
                }

                const district = String(state?.projectInfo?.district || state?.marketSizing?.targetNeighborhood || state?.marketSizing?.targetDistrict || '').trim();
                if (!district) {
                    qaResults.softWarnings.push({
                        code: 'TARGET_LOCATION_MISSING',
                        message: 'النطاق الجغرافي غير محدد بدقة (حي/منطقة مستهدفة) — دراسة مقهى بلا حي واضح تجعل أرقام السوق والمنافسين عامة أكثر من اللازم.',
                        path: 'marketSizing.targetNeighborhood'
                    });
                }

                const licenses = state?.legal?.licenses || [];
                if (licenses.length === 0) {
                    qaResults.softWarnings.push({
                        code: 'LICENSES_MISSING',
                        message: 'التراخيص والرسوم غير موثقة — أضف السجل التجاري، رخصة البلدية، الدفاع المدني، وأي اشتراطات غذائية/تشغيلية حسب النشاط.',
                        path: 'legal.licenses'
                    });
                } else {
                    // تدقيق 2026-07-08 (ملاحظة حرجة، خبير السوق): وجود أي تراخيص لا يعني
                    // اكتمالها — مشروع مطعم بلا رخصة هيئة الغذاء والدواء (SFDA) يمر هذا
                    // الفحص سابقاً لمجرد طول المصفوفة > 0. تحقق مخصص لقطاع الأغذية.
                    const sectorText = String(state?.projectInfo?.concept || state?.projectInfo?.sector || '').trim();
                    const isFandB = /مطعم|كافي|قهوة|وجبات|فود|طعام|مأكولات|مشروبات/i.test(sectorText);
                    const hasSfda = licenses.some(l => /الغذاء والدواء|SFDA/i.test(String(l?.name || '')));
                    if (isFandB && !hasSfda) {
                        qaResults.softWarnings.push({
                            code: 'SFDA_LICENSE_MISSING',
                            message: 'مشروع أغذية/مشروبات بلا رخصة هيئة الغذاء والدواء (SFDA) في قائمة التراخيص — إلزامية لمنشآت الأغذية في السعودية.',
                            path: 'legal.licenses'
                        });
                    }
                }

                const appendices = state?.appendices || {};
                if (!(appendices.references || []).length) {
                    qaResults.softWarnings.push({
                        code: 'REFERENCES_MISSING',
                        message: 'لا توجد مصادر ومراجع في الملاحق — أضف مصادر السوق/السكان/القطاع أو روابط الجهات الرسمية لرفع مصداقية الدراسة.',
                        path: 'appendices.references'
                    });
                }
                if (!(appendices.priceQuotes || []).length && Number(results?.capex?.total || 0) > 0) {
                    qaResults.softWarnings.push({
                        code: 'PRICE_QUOTES_MISSING',
                        message: 'لا توجد عروض أسعار أو مرفقات أسعار للمعدات والتجهيزات — النسخة التمويلية القوية تحتاج عروض موردين أو مصادر أسعار واضحة.',
                        path: 'appendices.priceQuotes'
                    });
                }

                const risks = state?.riskAnalysis?.risks || [];
                const weakRisks = risks.filter(r => !String(r?.mitigation || '').trim());
                if (risks.length < 5 || weakRisks.length > 0) {
                    qaResults.softWarnings.push({
                        code: 'RISK_PLAN_WEAK',
                        message: 'خطة المخاطر تحتاج تفصيلاً أكثر — وثّق 5 مخاطر رئيسية على الأقل مع خطة تخفيف واضحة ومسؤول/إجراء لكل خطر.',
                        path: 'riskAnalysis.risks'
                    });
                }
            }

            // ═══ فحوصات الاتساق الداخلي (تدقيق 2026-07-04) ═══
            // تتحقق أن أعمدة قائمة الدخل «تُجمَع» فعلاً وأن الميزانية متوازنة —
            // أي كسر هنا يعني تناقضاً سيصل للعميل في الملف المُصدَّر.

            // 1) هوية قائمة الدخل لكل سنة: المكونات = الصافي (± ريال واحد)
            (results?.incomeStatement || []).forEach((y) => {
                const computed = (y.revenue || 0) - (y.variableCosts || 0) - (y.fixedCosts || 0)
                    - (y.franchiseFees || 0) - (y.builderSuccessFee || 0) - (y.depreciation || 0)
                    - (y.interest || 0) - (y.zakat || 0) - (y.tax || 0);
                if (Number.isFinite(computed) && Math.abs(computed - (y.netIncome || 0)) > 1) {
                    qaResults.hardErrors.push({
                        code: 'INCOME_STATEMENT_MISMATCH',
                        message: `قائمة الدخل لا تُجمَع في السنة ${y.year}: مجموع البنود لا يساوي صافي الربح (فرق ${Math.round(computed - y.netIncome)} ريال).`,
                        path: 'incomeStatement'
                    });
                }
            });

            // 2) توازن الميزانية العمومية (± 2 ريال تقريب)
            (results?.balanceSheets || []).forEach((bs) => {
                const assets = Number(bs?.assets?.total ?? NaN);
                const liabEq = Number(bs?.totalLiabilitiesAndEquity ?? ((bs?.liabilities?.total || 0) + (bs?.equity?.total || 0)));
                if (Number.isFinite(assets) && Number.isFinite(liabEq) && Math.abs(assets - liabEq) > 2) {
                    qaResults.hardErrors.push({
                        code: 'BALANCE_SHEET_UNBALANCED',
                        message: `الميزانية العمومية غير متوازنة في السنة ${bs.year ?? '؟'} (فرق ${Math.round(assets - liabEq)} ريال).`,
                        path: 'balanceSheets'
                    });
                }
            });

            // 3) قرار GO مع استرداد غير محقق = تناقض
            const payback = kpis?.paybackPeriod;
            if (results?.decision === 'GO' && (payback == null || !Number.isFinite(payback) || payback <= 0)) {
                qaResults.hardErrors.push({
                    code: 'GO_WITHOUT_PAYBACK',
                    message: 'القرار GO بينما رأس المال لا يُسترد خلال فترة الدراسة — تناقض يجب مراجعته.',
                    path: 'decision'
                });
            }

            // 4) مؤشرات مبالغ فيها = افتراضات غير واقعية على الأرجح (تنبيه للمراجعة)
            const irr = Number(kpis?.irr ?? NaN);
            if (Number.isFinite(irr) && irr >= 1) {
                qaResults.softWarnings.push({
                    code: 'IRR_UNREALISTIC',
                    message: `معدل العائد الداخلي ${(irr * 100).toFixed(0)}% مرتفع بشكل غير معتاد — راجع اكتمال التكاليف (إيجار، رواتب، تشغيل) قبل تقديمه لممول.`,
                    path: 'kpis.irr'
                });
            }
            const netMargin = Number(kpis?.netMargin ?? NaN);
            if (Number.isFinite(netMargin) && netMargin > 0.30) {
                qaResults.softWarnings.push({
                    code: 'MARGIN_UNREALISTIC',
                    message: `هامش الربح الصافي ${(netMargin * 100).toFixed(0)}% أعلى من المعتاد لمعظم الأنشطة (10–25%) — تأكد أن كل التكاليف مُدخلة.`,
                    path: 'kpis.netMargin'
                });
            }
            const payback2 = Number(payback ?? NaN);
            if (Number.isFinite(payback2) && payback2 > 0 && payback2 < 1.2 && Number(results?.capex?.total || 0) > 100000) {
                qaResults.softWarnings.push({
                    code: 'PAYBACK_TOO_FAST',
                    message: `فترة استرداد ${payback2.toFixed(1)} سنة سريعة بشكل استثنائي — ممول متمرس سيشكك في الافتراضات. راجع الإيرادات والتكاليف.`,
                    path: 'kpis.paybackPeriod'
                });
            }
            // 5) DSCR أقل من 1 مع وجود قرض = خطر رفض تمويلي
            const dscr = Number(kpis?.dscr ?? NaN);
            if (Number.isFinite(dscr) && dscr > 0 && dscr < 1) {
                qaResults.softWarnings.push({
                    code: 'DSCR_BELOW_ONE',
                    message: `نسبة تغطية خدمة الدين ${dscr.toFixed(2)} أقل من 1 — التدفق لا يغطي أقساط القرض؛ أعد هيكلة التمويل قبل التقديم للبنك.`,
                    path: 'kpis.dscr'
                });
            }

            // ═══ فحوصات الجاهزية التمويلية (إطار معايير دراسات الجدوى + أعراف البنوك) ═══

            // 6) نسبة الإيرادات التراكمية للاستثمار حسب القطاع (معيار 4 في الإطار المعياري)
            //    النسبة = مجموع إيرادات سنوات الدراسة ÷ إجمالي الاستثمار
            const sectorText = String(state?.projectInfo?.sector || state?.projectInfo?.concept || '');
            const cumRevenue = (results?.incomeStatement || []).reduce((a, y) => a + (Number(y.revenue) || 0), 0);
            if (Number.isFinite(capexTotal) && capexTotal > 0 && cumRevenue > 0) {
                const ratio = cumRevenue / capexTotal;
                const SECTOR_RATIOS = [
                    { test: /saas|منصة|تطبيق|برمجي|تقني/i, label: 'منصة رقمية/SaaS', min: 2, max: 10, red: 20 },
                    { test: /تجارة إلكترونية|متجر إلكتروني|ecommerce/i, label: 'تجارة إلكترونية', min: 5, max: 15, red: 30 },
                    { test: /مطعم|كافيه|مقهى|قهوة|فود|مأكولات|برجر|مطاعم/i, label: 'مطعم/مقهى', min: 10, max: 30, red: 50 },
                    { test: /رياضي|ترفيه|نادي|صالة|بادل|ملعب/i, label: 'نادي رياضي/ترفيهي', min: 20, max: 50, red: 100 },
                    { test: /مصنع|صناع|إنتاج|تصنيع/i, label: 'مصنع/إنتاج', min: 30, max: 80, red: 150 }
                ];
                const bench = SECTOR_RATIOS.find(s => s.test.test(sectorText));
                if (bench) {
                    if (ratio > bench.red) {
                        qaResults.softWarnings.push({
                            code: 'REVENUE_TO_CAPEX_EXTREME',
                            message: `إيرادات الدراسة التراكمية = ${ratio.toFixed(1)}× الاستثمار — فوق الخط الأحمر لقطاع ${bench.label} (${bench.red}×). ممول متمرس سيعتبرها غير مبررة؛ راجع توقعات المبيعات أو اكتمال الاستثمار.`,
                            path: 'revenue'
                        });
                    } else if (ratio > bench.max) {
                        qaResults.softWarnings.push({
                            code: 'REVENUE_TO_CAPEX_HIGH',
                            message: `إيرادات الدراسة التراكمية = ${ratio.toFixed(1)}× الاستثمار — أعلى من نطاق قطاع ${bench.label} المعتاد (${bench.min}–${bench.max}×). وثّق مبررات النمو قبل التقديم.`,
                            path: 'revenue'
                        });
                    } else if (ratio < bench.min) {
                        qaResults.softWarnings.push({
                            code: 'REVENUE_TO_CAPEX_LOW',
                            message: `إيرادات الدراسة التراكمية = ${ratio.toFixed(1)}× الاستثمار فقط — أدنى من نطاق قطاع ${bench.label} (${bench.min}–${bench.max}×). راجع الطاقة التشغيلية أو التسعير أو حجم الاستثمار.`,
                            path: 'revenue'
                        });
                    }
                }
            }

            // 6.5) B1: تطابق مصادر التمويل المُدخلة مع إجمالي الاستثمار المطلوب.
            //    الميزانية تشتق «رأس المال المدفوع» كموازِن (إجمالي الاستثمار − القرض)، فإن أدخل
            //    المستخدم مصادر تمويل لا تساوي إجمالي الاستثمار ظهر رقم رأس مال مختلف عمّا أدخله
            //    دون تفسير. ننبّهه ليطابقهما بدل ترك التناقض الظاهري في الميزانية.
            if (Number.isFinite(capexTotal) && capexTotal > 0) {
                const src = state?.financing?.sources || {};
                const enteredSources =
                    (Number(src.equity?.amount) || 0) +
                    (Number(src.bankLoan?.amount) || 0) +
                    (Number(src.investors?.amount) || 0) +
                    (Number(src.governmentSupport?.amount) || 0);
                if (enteredSources > 0 && Math.abs(enteredSources - capexTotal) > 0.01 * capexTotal) {
                    const fmt = (n) => Math.round(n).toLocaleString('ar-SA');
                    qaResults.softWarnings.push({
                        code: 'FUNDING_SOURCES_MISMATCH',
                        message: `مصادر التمويل المُدخلة (${fmt(enteredSources)} ريال) لا تساوي إجمالي الاستثمار المطلوب (${fmt(capexTotal)} ريال) — فرق ${fmt(Math.abs(enteredSources - capexTotal))}. طابِق المصدرين كي يعكس «رأس المال المدفوع» في الميزانية مساهمتك الفعلية.`,
                        path: 'financing.sources'
                    });
                }
            }

            // 7) توثيق مصادر بنود CAPEX الكبيرة (معيار التتبعية — SIDF والبنوك تطلب عروض أسعار)
            {
                const tech = state?.technical || {};
                const techRes = state?.techResources || {};
                const assetGroups = [
                    ['المباني/الإنشاءات', tech.buildings],
                    ['المعدات', tech.equipment],
                    ['الأثاث', tech.furniture],
                    ['المركبات', tech.vehicles],
                    ['الموارد التقنية', techRes.techResources]
                ];
                const bigThreshold = Math.max(50000, 0.15 * (Number(results?.capex?.subtotal) || 0));
                const undocumented = [];
                assetGroups.forEach(([groupLabel, arr]) => {
                    (Array.isArray(arr) ? arr : []).forEach(item => {
                        const cost = (Number(item?.price ?? item?.cost) || 0) * (Number(item?.quantity ?? item?.count) || 1);
                        const hasSource = String(item?.source || item?.notes || '').trim().length > 0;
                        if (cost >= bigThreshold && !hasSource) {
                            undocumented.push(`${item?.name || groupLabel} (${Math.round(cost).toLocaleString('ar-SA')} ريال)`);
                        }
                    });
                });
                if (undocumented.length) {
                    qaResults.softWarnings.push({
                        code: 'CAPEX_SOURCE_MISSING',
                        message: `بنود رأسمالية كبيرة بلا مصدر سعر موثق (عرض سعر مورد/رابط): ${undocumented.slice(0, 3).join('، ')}${undocumented.length > 3 ? ` و${undocumented.length - 3} أخرى` : ''} — جهات التمويل تطلب تتبع كل رقم كبير لمصدره.`,
                        path: 'technical'
                    });
                }
            }

            // 8) مساهمة التمويل الذاتي — البنوك تتوقع 20–30% على الأقل بجانب القرض
            {
                const sources = state?.financing?.sources || {};
                const loanAmt = Number(sources.bankLoan?.amount || 0);
                const equityAmt = Number(sources.equity?.amount || 0) + Number(sources.investors?.amount || 0);
                const totalFunding = loanAmt + equityAmt;
                if (loanAmt > 0 && totalFunding > 0) {
                    const equityShare = equityAmt / totalFunding;
                    if (equityShare < 0.20) {
                        qaResults.softWarnings.push({
                            code: 'EQUITY_SHARE_LOW',
                            message: `المساهمة الذاتية ${(equityShare * 100).toFixed(0)}% فقط من هيكل التمويل — البنوك تتوقع عادة 20–30% كحد أدنى («جلد في اللعبة»)؛ طلب دين شبه كامل علامة حمراء ائتمانية.`,
                            path: 'financing'
                        });
                    }
                }
            }

            // 9) نسبة التوطين (السعودة) — صفر سعوديين مع فريق عامل = خطر نطاقات أمام الجهات
            {
                const saud = results?.saudization;
                if (saud && saud.totalHeads >= 3 && saud.saudiHeads === 0) {
                    qaResults.softWarnings.push({
                        code: 'SAUDIZATION_ZERO',
                        message: `فريق من ${saud.totalHeads} موظفين بلا أي سعودي — راجع متطلبات نطاقات لنشاطك؛ جهات التمويل الحكومية تسأل عن خطة التوطين.`,
                        path: 'hr'
                    });
                }
            }

            // 10) مصالحة الطاقة — سقف مادي للمبيعات (أول سؤال يطرحه مدقق SIDF)
            {
                const cc = results?.capacityCheck;
                if (cc && cc.exceeded) {
                    qaResults.hardErrors.push({
                        code: 'CAPACITY_EXCEEDED',
                        message: `مبيعات مستحيلة مادياً: الخطة تتطلب ${cc.plannedUnitsPerMonth.toLocaleString('ar-SA')} عميلاً/شهرياً بينما طاقتك القصوى ${cc.maxUnitsPerMonth.toLocaleString('ar-SA')} (${Math.round(cc.utilizationOfMax * 100)}% من الطاقة). خفّض توقعات المبيعات أو وسّع الطاقة (مقاعد/دورات/أيام).`,
                        path: 'technical.capacityModel'
                    });
                } else if (cc && cc.utilizationOfMax > 0.85) {
                    qaResults.softWarnings.push({
                        code: 'CAPACITY_TIGHT',
                        message: `الخطة تستهلك ${Math.round(cc.utilizationOfMax * 100)}% من الطاقة القصوى منذ السنة الأولى — لا هامش لذروة الطلب أو النمو؛ المدقق سيعتبرها متفائلة.`,
                        path: 'technical.capacityModel'
                    });
                }
                // مشروع بمبيعات كبيرة بلا نموذج طاقة أصلاً — لا يمكن إثبات القابلية للتحقيق
                const plannedMonthly = cc ? null : (() => {
                    const streams = state?.revenue?.streams || [];
                    const items = state?.services?.items || [];
                    const src = items.length ? items : streams;
                    return src.reduce((a, s) => a + (Number(s.customersPerMonth) || 0), 0);
                })();
                if (!cc && plannedMonthly > 1000) {
                    qaResults.softWarnings.push({
                        code: 'CAPACITY_MODEL_MISSING',
                        message: `تخطط لـ ${plannedMonthly.toLocaleString('ar-SA')} عميل/شهر دون نموذج طاقة (مقاعد × دورات × أيام) — أضِفه في الدراسة الفنية لإثبات أن المبيعات قابلة للتحقيق مادياً.`,
                        path: 'technical.capacityModel'
                    });
                }
            }

            // 11) منحنى التصاعد — مشروع جديد يبيع بكامل الخطة من الشهر الأول = غير واقعي
            {
                const ramp = Number(results?.rampUpMonths || 0);
                const util1 = Number(results?.incomeStatement?.[0]?.utilizationRate ?? 1);
                if (ramp <= 1 && util1 >= 1) {
                    qaResults.softWarnings.push({
                        code: 'NO_RAMP_UP',
                        message: 'الإيراد يبدأ بكامل الخطة من الشهر الأول — غير واقعي لمشروع جديد. حدد «أشهر التصاعد» في الافتراضات (المعتاد 6–12 شهراً) أو استغلال طاقة أقل للسنة الأولى.',
                        path: 'assumptions.rampUpMonths'
                    });
                }
            }

            // 12) معايير «السائقين» القطاعية (تكلفة متغيرة، إيجار/مبيعات، عمالة/مبيعات)
            try {
                checkDriversAgainstBenchmarks(state, results).forEach(w => qaResults.softWarnings.push(w));
            } catch (benchErr) {
                console.warn('Benchmark checks failed:', benchErr);
            }
        } catch (coherenceErr) {
            console.warn('Coherence checks failed:', coherenceErr);
        }

        qaResults.passed = qaResults.hardErrors.length === 0;
    } catch (e) {
        console.error('QA Check error:', e);
        qaResults.hardErrors.push({
            code: 'QA_CHECK_ERROR',
            message: 'حدث خطأ أثناء فحص الجودة: ' + (e && e.message ? e.message : String(e)),
            path: 'system'
        });
        qaResults.passed = false;
    }

    return qaResults;
}

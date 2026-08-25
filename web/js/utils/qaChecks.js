/**
 * فحص الجودة (QA) للدراسة — موحّد للوحة القرار وقائمة التصدير.
 * @param {Object} state
 * @param {Object} results - مخرجات المحرك (indicators/kpis، incomeStatement)
 * @returns {Promise<{ passed: boolean, hardErrors: Array, softWarnings: Array, validationErrors: Array, validationWarnings: Array }>}
 */
import { validateInputs } from '../../../lib/calc/validateInputs.js';
import { checkDriversAgainstBenchmarks } from '../core/sectorBenchmarks.js';
import { deriveRevenueFromStreams } from '../core/engine.js';

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
                impact: 'لا يمكن تصدير التقرير، ستظهر الجداول المالية كأصفار.',
                suggestion: 'الانتقال إلى خطوة الإيرادات والتكاليف وتعبئة التقديرات الأولية.',
                path: 'financial'
            });
        }

        const kpis = results?.indicators || results?.kpis;
        if (!kpis || (kpis.npv === undefined && kpis.irr === undefined)) {
            qaResults.hardErrors.push({
                code: 'MISSING_KPIS',
                message: 'مؤشرات الأداء الرئيسية (NPV, IRR) غير محسوبة.',
                impact: 'صفحة المؤشرات المالية في التقرير ستكون فارغة، مما يمنع اتخاذ قرار استثماري.',
                suggestion: 'حساب المؤشرات عبر محرك التحليل.',
                path: 'kpis'
            });
        }

        const assumptions = state?.assumptions || {};
        if (assumptions.discountRate == null || assumptions.discountRate === '' || assumptions.workingCapitalMonths == null || assumptions.workingCapitalMonths === '') {
            qaResults.softWarnings.push({
                code: 'FINANCIAL_ASSUMPTIONS_MISSING',
                message: 'معدل الخصم وأشهر رأس المال العامل غير مكتملين؛ قد تكون مؤشرات NPV والسيولة مبنية على قيم افتراضية.',
                impact: 'دقة تقييم المشروع (NPV) ستكون منخفضة لاعتمادها على افتراضات عامة وليست مخصصة.',
                suggestion: 'تعيين معدل خصم (12%) ورأس مال عامل (3 أشهر).',
                suggestionAction: { type: 'patch', path: 'assumptions', value: { discountRate: 12, workingCapitalMonths: 3 } },
                path: 'assumptions'
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
                    impact: 'قائمة الدخل ستكون خاسرة بالكامل ولا يمكن تقييم الجدوى الاقتصادية للمشروع.',
                    suggestion: 'تعيين إيراد شهري افتراضي (50,000 ريال) للتجربة.',
                    suggestionAction: { type: 'patch', path: 'revenue', value: { streams: [{ name: 'مبيعات تقديرية', amount: 50000, frequency: 'monthly' }] } },
                    path: 'revenue'
                });
            }
            // حجب: إيرادات دون أي تكاليف تشغيل = نتيجة غير منطقية
            if (results && Number.isFinite(revenue1) && revenue1 > 0 && Number.isFinite(opexAnnual) && opexAnnual <= 0) {
                qaResults.hardErrors.push({
                    code: 'REVENUE_WITHOUT_COSTS',
                    message: 'توجد إيرادات دون أي تكاليف تشغيل — نتيجة غير منطقية. أدخِل التكاليف الثابتة والمتغيرة.',
                    impact: 'نسبة هامش الربح ستكون 100% وهي نتيجة مستحيلة اقتصادياً، مما يفقد الدراسة مصداقيتها.',
                    suggestion: 'إضافة تكلفة رواتب وإيجار شهرية تقديرية.',
                    suggestionAction: { type: 'patch', path: 'opex', value: { items: [{ name: 'إيجار وتكاليف تشغيلية', amount: 15000, frequency: 'monthly' }] } },
                    path: 'opex'
                });
            }
            // تنبيه: لا يوجد استثمار رأسمالي
            if (results && Number.isFinite(capexTotal) && capexTotal <= 0) {
                qaResults.softWarnings.push({
                    code: 'NO_CAPEX',
                    message: 'لا توجد تكاليف تأسيسية (استثمار رأسمالي = صفر). تأكّد أن هذا مقصود.',
                    impact: 'لا يوجد رأس مال مطلوب لبدء المشروع، وهذا غير واقعي لمعظم المشاريع ويثير قلق الممول.',
                    suggestion: 'إضافة ميزانية تأسيس وتجهيزات تقديرية (100,000 ريال).',
                    suggestionAction: { type: 'patch', path: 'capex', value: { items: [{ name: 'تجهيزات ومعدات', amount: 100000 }] } },
                    path: 'capex'
                });
            }
            // تنبيه: اسم المشروع فارغ (يظهر فارغاً في التقرير)
            const projName = String(state?.projectInfo?.name || '').trim();
            if (!projName) {
                qaResults.softWarnings.push({
                    code: 'PROJECT_NAME_MISSING',
                    message: 'اسم المشروع غير محدد — سيظهر فارغاً في ترويسة التقرير.',
                    impact: 'يظهر "دراسة جديدة" أو مساحة فارغة في كافة صفحات التقرير المصدر.',
                    suggestion: 'تسمية المشروع بـ "مشروع تجاري مقترح".',
                    suggestionAction: { type: 'patch', path: 'projectInfo.name', value: 'مشروع تجاري مقترح' },
                    path: 'projectInfo.name'
                });
            }

            // تنبيه: نص إرشادي بين أقواس مربعة لم يُستبدل (من اقتراحات «العصا السحرية»
            // مثل «[صف ميزة موقعك]») قد يتسرّب حرفياً إلى التقرير المُصدَّر إن قبله المستخدم
            // دون تحرير. نمسح كل القيم النصية للحالة بحثاً عن بقايا [...] (لا يحجب — تنبيه فقط).
            try {
                const bracketRe = /\[[^\][]{5,}\]/;
                const seen = new Set();
                const walk = (obj) => {
                    if (!obj || typeof obj !== 'object') return;
                    for (const val of Object.values(obj)) {
                        if (typeof val === 'string') {
                            const m = val.match(bracketRe);
                            if (m) seen.add(m[0]);
                        } else if (val && typeof val === 'object') {
                            walk(val);
                        }
                    }
                };
                walk(state);
                if (seen.size > 0) {
                    const placeholder = [...seen][0];
                    qaResults.softWarnings.push({
                        code: 'UNREPLACED_PLACEHOLDER_TEXT',
                        message: `يوجد نص إرشادي بين أقواس لم تستبدله بعد (مثل: «${placeholder}»). استبدله بمحتوى مشروعك الفعلي قبل التصدير حتى لا يظهر حرفياً في التقرير.`,
                        impact: 'ظهور نصوص استرشادية حرفياً في التقرير يظهر عدم احترافية ويضعف مصداقية الدراسة.',
                        suggestion: `البحث عن "${placeholder}" في الأقسام واستبدالها بالمعلومة المطلوبة.`,
                        path: 'content'
                    });
                }
            } catch (_) { /* لا نُفشل الـQA بسبب فحص إرشادي */ }

            // جاهزية النسخة للبيع/التمويل: هذه البنود لا تكسر الحسابات، لكنها تخفض جودة الدراسة أمام مستشار أو ممول.
            {
                const marketText = String(state?.marketing?.marketAnalysis?.summary || state?.marketing?.marketAnalysis?.description || '').trim();
                if (marketText.length < 80) {
                    qaResults.softWarnings.push({
                        code: 'MARKET_NARRATIVE_MISSING',
                        message: 'تحليل السوق النصي مختصر أو غير موجود — أضف وصفاً مدعوماً للطلب، الشريحة المستهدفة، واتجاهات السوق قبل بيع الدراسة كنسخة مخصصة.',
                        impact: 'يبدو التقرير مفرغاً من سياق السوق للممول مما يضعف الثقة بالطلب المتوقع.',
                        suggestion: 'كتابة نص تسويقي أولي حول قوة الطلب والفرصة المتاحة في السوق.',
                        suggestionAction: { type: 'patch', path: 'marketing.marketAnalysis.summary', value: 'يشهد السوق المستهدف نمواً مطرداً مع زيادة وعي المستهلكين. هناك فرصة كبيرة لتغطية الفجوة في الطلب من خلال تقديم خدمات عالية الجودة بأسعار تنافسية تلبي تطلعات الشريحة المستهدفة.' },
                        path: 'marketing.marketAnalysis.summary'
                    });
                }

                const competitors = state?.marketing?.competitors || [];
                if (competitors.length < 2) {
                    qaResults.softWarnings.push({
                        code: 'COMPETITORS_MISSING',
                        message: 'تحليل المنافسين غير كافٍ — أضف منافسين محليين على الأقل مع نقاط القوة والضعف والأسعار/الحركة التقريبية. هذا من أهم ما يرفع الدراسة من 7/10 إلى مستوى تمويلي.',
                        impact: 'نقص في دراسة البيئة التنافسية يعطي انطباعاً بعدم الإلمام بالسوق.',
                        suggestion: 'إضافة منافسين افتراضيين كنموذج أولي.',
                        suggestionAction: { type: 'patch', path: 'marketing.competitors', value: [{ name: 'المنافس أ', strength: 'انتشار واسع', weakness: 'أسعار مرتفعة' }, { name: 'المنافس ب', strength: 'أسعار منخفضة', weakness: 'جودة متوسطة' }] },
                        path: 'marketing.competitors'
                    });
                }

                const district = String(state?.projectInfo?.district || state?.marketSizing?.targetNeighborhood || state?.marketSizing?.targetDistrict || '').trim();
                if (!district) {
                    qaResults.softWarnings.push({
                        code: 'TARGET_LOCATION_MISSING',
                        message: 'النطاق الجغرافي غير محدد بدقة (حي/منطقة مستهدفة) — دراسة مقهى بلا حي واضح تجعل أرقام السوق والمنافسين عامة أكثر من اللازم.',
                        impact: 'فقدان دقة تقديرات حجم السوق الجغرافية.',
                        suggestion: 'تحديد النطاق بـ "منطقة الرياض - حي العليا".',
                        suggestionAction: { type: 'patch', path: 'marketSizing.targetNeighborhood', value: 'الرياض - حي العليا' },
                        path: 'marketSizing.targetNeighborhood'
                    });
                }

                const licenses = state?.legal?.licenses || [];
                if (licenses.length === 0) {
                    qaResults.softWarnings.push({
                        code: 'LICENSES_MISSING',
                        message: 'التراخيص والرسوم غير موثقة — أضف السجل التجاري، رخصة البلدية، الدفاع المدني، وأي اشتراطات غذائية/تشغيلية حسب النشاط.',
                        impact: 'يعتبر الممول المشروع مخاطرة قانونية إذا لم تُدرج التراخيص وتكاليفها.',
                        suggestion: 'إضافة التراخيص الأساسية (سجل تجاري، رخصة بلدية).',
                        suggestionAction: { type: 'patch', path: 'legal.licenses', value: [{ name: 'سجل تجاري', cost: 1200 }, { name: 'رخصة البلدية', cost: 3000 }] },
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
                            impact: 'دراسة قطاع أغذية بلا ترخيص بلدي وSFDA تُرفض فوراً من صناديق التمويل.',
                            suggestion: 'إضافة "ترخيص هيئة الغذاء والدواء".',
                            suggestionAction: { type: 'push', path: 'legal.licenses', value: { name: 'ترخيص هيئة الغذاء والدواء SFDA', cost: 1000 } },
                            path: 'legal.licenses'
                        });
                    }
                }

                const appendices = state?.appendices || {};
                if (!(appendices.references || []).length) {
                    qaResults.softWarnings.push({
                        code: 'REFERENCES_MISSING',
                        message: 'لا توجد مصادر ومراجع في الملاحق — أضف مصادر السوق/السكان/القطاع أو روابط الجهات الرسمية لرفع مصداقية الدراسة.',
                        impact: 'يعتبر الممول الأرقام غير المرجعية افتراضات شخصية مما يقلل احتمالية قبول التمويل.',
                        suggestion: 'إضافة "بيانات الهيئة العامة للإحصاء" كمرجع.',
                        suggestionAction: { type: 'patch', path: 'appendices.references', value: [{ title: 'الهيئة العامة للإحصاء', link: 'https://stats.gov.sa/' }] },
                        path: 'appendices.references'
                    });
                }
                if (!(appendices.priceQuotes || []).length && Number(results?.capex?.total || 0) > 0) {
                    qaResults.softWarnings.push({
                        code: 'PRICE_QUOTES_MISSING',
                        message: 'لا توجد عروض أسعار أو مرفقات أسعار للمعدات والتجهيزات — النسخة التمويلية القوية تحتاج عروض موردين أو مصادر أسعار واضحة.',
                        impact: 'تكاليف التأسيس تعتبر غير موثوقة وقد تُرفض الميزانية المقترحة.',
                        suggestion: 'إضافة ملاحظة "الأسعار استرشادية بناءً على السوق المحلي".',
                        suggestionAction: { type: 'patch', path: 'appendices.priceQuotes', value: [{ title: 'متوسط أسعار السوق المحلي (استرشادي)', file: null }] },
                        path: 'appendices.priceQuotes'
                    });
                }

                const risks = state?.riskAnalysis?.risks || [];
                const weakRisks = risks.filter(r => !String(r?.mitigation || '').trim());
                if (risks.length < 5 || weakRisks.length > 0) {
                    qaResults.softWarnings.push({
                        code: 'RISK_PLAN_WEAK',
                        message: 'خطة المخاطر تحتاج تفصيلاً أكثر — وثّق 5 مخاطر رئيسية على الأقل مع خطة تخفيف واضحة ومسؤول/إجراء لكل خطر.',
                        impact: 'خطة إدارة المخاطر ستبدو ضعيفة أو منسوخة مما يدل على قلة دراسة لواقع المشروع.',
                        suggestion: 'إضافة مخاطر وتدابير تخفيف نموذجية للمخاطر المالية والتشغيلية.',
                        suggestionAction: { type: 'patch', path: 'riskAnalysis.risks', value: [{ title: 'ضعف السيولة', impact: 'High', mitigation: 'تأمين احتياطي نقدي وتسهيلات ائتمانية' }, { title: 'دخول منافسين جدد', impact: 'Medium', mitigation: 'تقديم جودة أعلى وبناء ولاء للعملاء' }, { title: 'تأخر التوريد', impact: 'Medium', mitigation: 'تعدد الموردين' }, { title: 'نقص العمالة', impact: 'Low', mitigation: 'عقود استقدام وحوافز أداء' }, { title: 'تغير التشريعات', impact: 'Medium', mitigation: 'المتابعة القانونية المستمرة' }] },
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
                // خطة 2026-07-12 (بند 1.2): capacityCheck قد يأتي الآن من annualCapacity (السعة
                // السنوية العامة) لا فقط capacityModel (مقاعد/دورات) — الرسالة/المسار يوجّهان
                // المستخدم للحقل الفعلي الذي بُني عليه الفحص بدل الإيحاء دائماً بـ«مقاعد ودورات».
                const capacitySourceLabel = cc?.source === 'annualCapacity' ? 'السعة السنوية' : 'مقاعد/دورات/أيام';
                const capacitySourcePath = cc?.source === 'annualCapacity' ? 'technical.productionCapacity.annualCapacity' : 'technical.capacityModel';
                if (cc && cc.exceeded) {
                    qaResults.hardErrors.push({
                        code: 'CAPACITY_EXCEEDED',
                        message: `مبيعات مستحيلة مادياً: الخطة تتطلب ${cc.plannedUnitsPerMonth.toLocaleString('ar-SA')} عميلاً/شهرياً بينما طاقتك القصوى ${cc.maxUnitsPerMonth.toLocaleString('ar-SA')} (${Math.round(cc.utilizationOfMax * 100)}% من الطاقة). خفّض توقعات المبيعات أو وسّع الطاقة (${capacitySourceLabel}).`,
                        path: capacitySourcePath
                    });
                } else if (cc && cc.utilizationOfMax > 0.85) {
                    qaResults.softWarnings.push({
                        code: 'CAPACITY_TIGHT',
                        message: `الخطة تستهلك ${Math.round(cc.utilizationOfMax * 100)}% من الطاقة القصوى منذ السنة الأولى — لا هامش لذروة الطلب أو النمو؛ المدقق سيعتبرها متفائلة.`,
                        path: capacitySourcePath
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

            // 12) الهدف المالي الذكي المتزامن خرج عن مزامنته مع جدول الإيرادات (بند 1.2،
            // خطة 2026-07-12): manualOverride=false يعني أن المستخدم اختار تتبّع الإيراد
            // المحسوب تلقائياً (زر «استخدم القيمة المحسوبة» في SmartGoals.js) — إن تغيّر
            // جدول الإيرادات بعدها وابتعد الهدف بأكثر من 10% فهذا انحراف حقيقي يستحق تنبيهاً.
            // أهداف مالية بقيمة يدوية واعية (manualOverride=true، كطموح أعلى من الخطة
            // الحالية) لا تُنبَّه عمداً — وإلا صار الفحص عقاباً على طموح مشروع لا خللاً فعلياً.
            {
                const goals = state?.smartGoals?.goals || [];
                const { year1Revenue } = deriveRevenueFromStreams(state?.revenue?.streams);
                if (year1Revenue > 0) {
                    goals
                        .filter(g => g.category === 'financial' && g.manualOverride === false && Number(g.targetValue) > 0)
                        .forEach(g => {
                            const deviation = Math.abs(Number(g.targetValue) - year1Revenue) / year1Revenue;
                            if (deviation > 0.10) {
                                qaResults.softWarnings.push({
                                    code: 'SMART_GOAL_INCONSISTENT',
                                    message: `الهدف المالي «${g.specific || 'هدف مالي'}» (${Number(g.targetValue).toLocaleString('ar-SA')} ريال) لم يعد يطابق الإيراد المحسوب حالياً من جدول الإيرادات (${Math.round(year1Revenue).toLocaleString('ar-SA')} ريال) — فارق ${Math.round(deviation * 100)}%. أعد المزامنة أو راجع الهدف.`,
                                    path: 'smartGoals.goals'
                                });
                            }
                        });
                }
            }

            // 13) معايير «السائقين» القطاعية (تكلفة متغيرة، إيجار/مبيعات، عمالة/مبيعات)
            try {
                checkDriversAgainstBenchmarks(state, results).forEach(w => qaResults.softWarnings.push(w));
            } catch (benchErr) {
                console.warn('Benchmark checks failed:', benchErr);
            }

            // 14) «نسبة التوفير» للأصول المؤسسية خارج النطاق العشري [0, 1] (2026-08-25)
            // الحقل كسر عشري (labels.js: «نسبة التوفير (0.1 - 1.0)») ويدخل المحرك كـ
            // (1 − saving) على أساس الأصل وعلى الرواتب/الإيجار/التسويق. مُدخَل «40» بنيّة
            // 40% كان يُنتج معامل −39 ⇒ أصول وcapex سالبة ونقد إحلال سالب يدخل التدفق
            // النقدي كأنه إيراد (NPV 721,352 ⟶ 12,897,050 على نفس المُعطى). المحرك يُقيّد
            // الآن إلى [0, 1] (engine.js: getSaving)، والتقييد وحده صامت — فهذا التحذير
            // يجعله مرئياً. عمداً لا نقسم على 100 نيابةً عن المستخدم: تخمين النية صامتاً
            // يُنتج رقماً خاطئاً بثقة، والتقييد المُعلَن يُنتج رقماً محافظاً قابلاً للتصحيح.
            {
                const isCorporateVenture = state?.projectInfo?.businessModel === 'Corporate_Venture';
                const corpAssets = Array.isArray(state?.projectInfo?.corporateAssets) ? state.projectInfo.corporateAssets : [];
                const outOfRange = isCorporateVenture ? corpAssets.filter(a => {
                    const raw = Number(a?.savingPercentage);
                    return Number.isFinite(raw) && (raw < 0 || raw > 1);
                }) : [];
                if (outOfRange.length) {
                    const listed = outOfRange
                        .map(a => `${a?.name || a?.costSavingType || 'أصل مؤسسي'}: ${Number(a.savingPercentage)}`)
                        .join('، ');
                    qaResults.softWarnings.push({
                        code: 'CORPORATE_SAVING_OUT_OF_RANGE',
                        message: `«نسبة التوفير» تُقرأ ككسر عشري لا كنسبة مئوية — 0.4 تعني 40%. القيم التالية خارج النطاق [0 – 1]: ${listed}. قُيِّدت آلياً عند 0 أو 1 لحماية الحسابات (قيمة مثل 40 كانت تُنتج تكاليف سالبة وأرباحاً وهمية)، ولم يُقسَم أي رقم على 100 نيابةً عنك — صحّح القيمة يدوياً.`,
                        path: 'projectInfo.corporateAssets'
                    });
                }
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

/**
 * فحص الجودة (QA) للدراسة — موحّد للوحة القرار وقائمة التصدير.
 * @param {Object} state
 * @param {Object} results - مخرجات المحرك (indicators/kpis، incomeStatement)
 * @returns {Promise<{ passed: boolean, hardErrors: Array, softWarnings: Array, validationErrors: Array, validationWarnings: Array }>}
 */
import { validateInputs } from '../../../lib/calc/validateInputs.js';

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
            if (Number.isFinite(netMargin) && netMargin > 0.40) {
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

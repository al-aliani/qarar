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

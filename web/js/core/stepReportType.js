/**
 * stepReportType — مصدر واحد لتصنيف نوع خطوة الدراسة (تدقيق 2026-07-11).
 * ─────────────────────────────────────────────────────────────────────────────
 * كل خطوة من الـ41 تُصنَّف إلى:
 *   'analysis' — تعرض تحليلاً/مخرجات محسوبة (مرشّحة لإصدار تقرير خاص بها)
 *   'mixed'    — إدخال + بعض التحليل/التنظيم (مرشّحة أيضاً لتقرير)
 *   'input'    — نموذج إدخال بيانات بحت (لا تنتج تقريراً)
 *
 * يُستهلك في مكانين يجب ألا ينحرفا: شارات الأدوات في DashboardView، وحقن زر
 * «إصدار تقرير» في stepComponentRegistry/StudyCategoryView. لذلك مركزيّ هنا.
 */

/** يُرجع نوع الخطوة: 'analysis' | 'mixed' | 'input'. */
export function stepReportType(step) {
    if (!step) return 'input';
    const analysis = step.isPreliminaryCheck || step.isProjectAlternatives || step.isComparison
        || step.isMarketAnalysis || step.isStrategic || step.isServiceAnalysis || step.isOperationalSim
        || step.isFinancialStatements || step.isBalanceSheet || step.isBreakEven || step.isZakatTax
        || step.isInvestorAnalysis || step.isValuation || step.isRiskMatrix || step.isScenarios
        || step.isScenario || step.isSensitivity || step.isStressTest || step.isMonteCarlo
        || step.isBusinessModel || step.isDashboard || step.isDecisionDashboard
        || step.isExecutiveSummary || step.isReportBuilder;
    if (analysis) return 'analysis';
    const mixed = step.isIntroduction || step.isOrgStructure || step.id === 'legal'
        || step.isTimeline || step.isFinancing;
    if (mixed) return 'mixed';
    return 'input';
}

/** الأدوات التحليلية والمختلطة تنتج مخرجات قابلة للتقرير؛ الإدخال لا. */
export function stepCanReport(step) {
    return stepReportType(step) !== 'input';
}

/** تسميات الشارات العربية لكل نوع (للعرض في DashboardView). */
export const STEP_TYPE_BADGE = {
    analysis: { label: 'تحليل', cls: 'is-analysis' },
    input: { label: 'إدخال', cls: 'is-input' },
    mixed: { label: 'مختلط', cls: 'is-mixed' },
};

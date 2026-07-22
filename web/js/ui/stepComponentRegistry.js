/**
 * stepComponentRegistry — موزّع «علَم الخطوة → المكوّن» الموحّد (تدقيق 2026-07-11).
 * ─────────────────────────────────────────────────────────────────────────────
 * قبل هذا الملف كان هذا المنطق مكرَّراً حرفياً في مكانين مستقلين: سلسلة if/else في
 * app.js (navigateTo) وأخرى في StudyCategoryView.js (renderStepInto) — يجب أن
 * يتطابقا يدوياً للأبد. اكتشف تدقيق حي أن StudyCategoryView (المسار النشط فعلياً،
 * لأن categoryNavigationEnabled=true افتراضياً يجعل سلسلة app.js كوداً شبه ميت)
 * كانت ناقصة 3 فروع حقيقية: isComparison، isLoanSchedule (+ runFullModel)، والتحقق
 * المتداخل لـ scenarioSwitcher — أي هذه أعطال حية كانت تصل المستخدم فعلياً، لا نظرية.
 *
 * الآن: مصدر واحد. أي خطوة جديدة تُضاف هنا تلقائياً متاحة لكلا المستهلكين.
 *
 * عقد الاستدعاء:
 *   renderStepComponent(step, containerId, index, ctx) → Promise<{ instance, rendered?, isGenericFallback? }>
 *   ctx = { store, tableSchemas, onNavigate, onGoHome, isCurrent, cache, wizardFactory, runFullModel }
 *     - cache: كائن تخزين مؤقت (app.js يمرّر `components` فتُخزَّن النسخ وتُعاد عبر
 *       التنقلات — نمط `cache[key] ??= new X(...)`)، أو `null` لبناء نسخة جديدة دائماً
 *       (سلوك StudyCategoryView: كل رسم صفحة فئة يبني نسخاً طازجة لكل خطوة).
 *     - wizardFactory: () => Wizard — يُستدعى لكل من المسار العام (renderStep) وخطوتي
 *       isOfferingView/isOperatingCosts. app.js يمرّر `() => wizard` (النسخة المشتركة
 *       الدائمة)، بينما StudyCategoryView يمرّر دالة تبني Wizard جديداً مربوطاً
 *       بحاوية الخطوة الفرعية الخاصة به في كل استدعاء.
 *     - runFullModel: دالة المحرّك المالي (calculateStudy) — يمرّرها المستدعي بدل
 *       استيرادها هنا مجدداً، تجنباً لمصدرين للحقيقة.
 *   القيمة المرجعة: `rendered` (إن وُجدت) تعكس نجاح الرسم (مثل DecisionDashboard حين
 *   يتجاوزه سباق تنقّل) — القرار في كيفية التعامل معها (إيقاف appendNav مثلاً) يبقى
 *   عند المستدعي، لا هنا، لأن كل مستدعٍ له سياسة ما-بعد-الرسم الخاصة به.
 */

function makeCache(cache) {
    return (key, Ctor, ...args) => {
        if (!cache) return new Ctor(...args);
        if (!cache[key]) cache[key] = new Ctor(...args);
        return cache[key];
    };
}

export async function renderStepComponent(step, containerId, index, ctx) {
    const { store, onNavigate, isCurrent, cache, wizardFactory, runFullModel } = ctx;
    const get = makeCache(cache);

    if (step.isDashboard) {
        const { FinancialDashboard } = await import('./FinancialDashboard.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('dashboard', FinancialDashboard, containerId, store);
        instance.render();
        return { instance };
    }
    if (step.isZakatTax) {
        const { ZakatView } = await import('./ZakatView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('zakat', ZakatView, containerId, store);
        instance.render();
        return { instance };
    }
    if (step.isPreliminaryCheck || step.id === 'preliminaryCheck') {
        const { PreliminaryCheckView } = await import('./PreliminaryCheckView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('preliminaryCheck', PreliminaryCheckView, containerId, store, onNavigate);
        instance.render();
        return { instance };
    }
    if (step.isProjectAlternatives || step.id === 'projectAlternatives') {
        const { ProjectAlternativesView } = await import('./ProjectAlternativesView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('projectAlternatives', ProjectAlternativesView, containerId, store, onNavigate);
        instance.render();
        return { instance };
    }
    if (step.isTimeline || step.id === 'timeline') {
        const { Timeline } = await import('./Timeline.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('timeline', Timeline, containerId, store);
        instance.render();
        return { instance };
    }
    if (step.isMonteCarlo) {
        const { MonteCarloAnalysis } = await import('./MonteCarloAnalysis.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('monteCarlo', MonteCarloAnalysis, containerId, store);
        instance.render();
        return { instance };
    }
    if (step.isValuation) {
        const { ValuationAnalysis } = await import('./ValuationAnalysis.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('valuation', ValuationAnalysis, containerId, store);
        instance.render();
        return { instance };
    }
    if (step.isScenario || step.isScenarios) {
        if (step.id === 'scenarioSwitcher') {
            const { ScenarioSwitcher } = await import('./ScenarioSwitcher.js');
            if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
            const instance = get('scenarioSwitcher', ScenarioSwitcher, containerId, store);
            instance.render();
            return { instance };
        }
        const { ScenarioAnalysis } = await import('./ScenarioAnalysis.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('scenarioAnalysis', ScenarioAnalysis, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isBusinessModel) {
        const { BusinessModelView } = await import('./BusinessModelView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('businessModel', BusinessModelView, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isComparison) {
        const { StudyComparison } = await import('./StudyComparison.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('studyComparison', StudyComparison, containerId, store, onNavigate);
        await instance.render();
        return { instance };
    }
    if (step.isDecisionDashboard) {
        const { DecisionDashboard } = await import('./DecisionDashboard.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('decisionDashboard', DecisionDashboard, containerId, store, onNavigate);
        let rendered = true;
        try {
            rendered = await instance.render({ isCurrent: isCurrent || (() => true) });
        } catch (err) {
            console.error('Failed to render DecisionDashboard:', err);
        }
        return { instance, rendered };
    }
    if (step.isExecutiveSummary) {
        const { ExecutiveSummary } = await import('./ExecutiveSummary.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('executiveSummary', ExecutiveSummary, containerId, store, onNavigate);
        // خطوة «مؤشرات التقييم المالي» المبكرة تعرض النسخة المختصرة (مؤشرات فقط).
        instance.render(index, step.id === 'financial_eval' ? 'indicators' : 'full');
        return { instance };
    }
    if (step.isReportBuilder) {
        const { ReportBuilderView } = await import('./ReportBuilderView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('reportBuilder', ReportBuilderView, containerId, store);
        instance.render();
        return { instance };
    }
    if (step.id === 'services') {
        const { ServiceAnalysis } = await import('./ServiceAnalysis.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('serviceAnalysis', ServiceAnalysis, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.id === 'legal') {
        const { LegalStudy } = await import('./LegalStudy.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('legalStudy', LegalStudy, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isStrategic) {
        const { StrategicAnalysis } = await import('./StrategicAnalysis.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('strategicAnalysis', StrategicAnalysis, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isMarketAnalysis) {
        const { MarketAnalysis } = await import('./MarketAnalysis.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('marketAnalysis', MarketAnalysis, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isPricingOptimizer) {
        const { PricingOptimizerView } = await import('./PricingOptimizerView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('pricingOptimizer', PricingOptimizerView, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isRiskMatrix) {
        const { RiskMatrix } = await import('./RiskMatrix.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('riskMatrix', RiskMatrix, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isFinancing) {
        const { FinancingStructure } = await import('./FinancingStructure.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('financing', FinancingStructure, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isOrgStructure) {
        const { OrgStructure } = await import('./OrgStructure.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('orgStructure', OrgStructure, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isOperationalSim) {
        const { OperationalSim } = await import('./OperationalSim.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('operationalSim', OperationalSim, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isInvestorAnalysis) {
        const { InvestorAnalysis } = await import('./InvestorAnalysis.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('investorAnalysis', InvestorAnalysis, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isStressTest) {
        const { StressTest } = await import('./StressTest.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('stressTest', StressTest, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isAppendices) {
        const { AppendicesView } = await import('./AppendicesView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('appendices', AppendicesView, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isIntroduction || step.id === 'projectIntro') {
        const { IntroductionView } = await import('./IntroductionView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('introduction', IntroductionView, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isSmartGoals) {
        const { SmartGoals } = await import('./SmartGoals.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('smartGoals', SmartGoals, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isFinancialStatements) {
        const { FinancialStatements } = await import('./FinancialStatements.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('financialStatements', FinancialStatements, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isLoanSchedule) {
        const { LoanScheduleView } = await import('./LoanScheduleView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('loanSchedule', LoanScheduleView, containerId, store);
        const results = runFullModel(store.getState());
        instance.render(results.loanSchedule);
        return { instance };
    }
    if (step.isBalanceSheet) {
        const { BalanceSheetView } = await import('./BalanceSheetView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('balanceSheet', BalanceSheetView, containerId, store, onNavigate);
        const results = runFullModel(store.getState());
        instance.render(results.balanceSheets);
        return { instance };
    }
    if (step.isBreakEven) {
        const { BreakEvenAnalysis } = await import('./BreakEvenAnalysis.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('breakEvenAnalysis', BreakEvenAnalysis, containerId, store);
        instance.render();
        return { instance };
    }
    if (step.isSensitivity) {
        const { SensitivityAnalysis } = await import('./SensitivityAnalysis.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('sensitivityAnalysis', SensitivityAnalysis, containerId, store, onNavigate);
        instance.render(index);
        return { instance };
    }
    if (step.isOfferingView) {
        const { OfferingView } = await import('./OfferingView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('offering', OfferingView, containerId, store, onNavigate, wizardFactory());
        instance.render(index);
        return { instance };
    }
    if (step.isOperatingCosts) {
        const { OperatingCostsView } = await import('./OperatingCostsView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('operatingCosts', OperatingCostsView, containerId, store, onNavigate, wizardFactory());
        instance.render(index);
        return { instance };
    }
    if (step.isTechnicalAssetsView) {
        const { TechnicalAssetsView } = await import('./TechnicalAssetsView.js');
        if (isCurrent && !isCurrent()) return { instance: null, rendered: false };
        const instance = get('technicalAssets', TechnicalAssetsView, containerId, store, onNavigate, wizardFactory());
        instance.render(index);
        return { instance };
    }

    // المسار العام: لا علَم مخصّص — يُرسم عبر Wizard.renderStep (حقول/جداول تلقائية).
    const wizardInstance = wizardFactory();
    wizardInstance.renderStep(step.id, step, index);
    return { instance: wizardInstance, isGenericFallback: true };
}

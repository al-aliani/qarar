/**
 * Quality Gamification Utility
 * Calculates the "Health Score" or "Completeness" of the feasibility study.
 * Returns a score (0-100) and a list of "Next Best Actions" (NBAs).
 */
export const QualityCalculator = {
    calculate(state) {
        let score = 0;
        let maxScore = 0;
        const missing = [];

        // Helper to check and weigh
        const check = (condition, weight, label, sectionId) => {
            maxScore += weight;
            if (condition) {
                score += weight;
            } else {
                missing.push({ label, section: sectionId, weight });
            }
        };

        const pi = state.projectInfo || {};
        const m = state.marketing || {};
        const t = state.technical || {};
        const f = state.financials || {};

        // 1. Fundamentals (20 pts)
        check(pi.name && pi.name.length > 3, 5, 'اسم المشروع', 'intro');
        check(pi.concept && pi.concept.length > 10, 5, 'شرح الفكرة', 'intro');
        check(pi.city, 5, 'المدينة', 'intro');
        check(pi.startupHypothesis?.problem, 5, 'تحديد المشكلة (الفرضية)', 'intro');

        // 2. Market (30 pts)
        check(m.targetSegment?.length > 0, 10, 'الشريحة المستهدفة', 'market');
        check(m.competitors?.length > 0, 10, 'المنافسون', 'market');
        check(state.marketSizing?.tam > 0, 10, 'حجم السوق (TAM)', 'market');

        // 3. Technical (20 pts)
        check(t.products?.length > 0 || t.services?.length > 0, 10, 'المنتجات/الخدمات', 'technical');
        check(t.manpower?.length > 0, 10, 'القوى العاملة', 'technical');

        // 4. Financials (30 pts)
        check(f.startupCosts?.total > 0, 10, 'تكاليف التأسيس', 'financial');
        check(f.revenueDrivers?.length > 0, 10, 'مصادر الإيرادات', 'financial');
        check(f.opex?.length > 0, 10, 'التكاليف التشغيلية', 'financial');

        const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

        // Determine Badge
        let badge = 'مبتدئ 🥚';
        if (finalScore >= 30) badge = 'هاوي 🚀';
        if (finalScore >= 60) badge = 'رائد أعمال 💼';
        if (finalScore >= 90) badge = 'خبير جدوى 🏆';

        return {
            score: finalScore,
            totalPossible: 100, // Normalized
            missing: missing.sort((a, b) => b.weight - a.weight), // High impact first
            badge
        };
    }
};

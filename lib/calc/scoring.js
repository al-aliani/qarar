/**
 * Scoring Engine
 * Evaluates the project holistically to generate a confidence score (0-100)
 */

import { QA_CHECKS } from './qaGate.js';

export function calculateProjectScore(state, financialResults) {
    let score = 0;
    let maxScore = 100;
    const details = [];

    // 1. Financial Health (40 points)
    if (financialResults) {
        // NPV check
        if (financialResults.indicators?.npv > 0) {
            score += 15;
            details.push({ category: 'financial', label: 'NPV إيجابي', score: 15, max: 15 });
        } else {
            details.push({ category: 'financial', label: 'NPV سلبي', score: 0, max: 15, issue: true });
        }

        // IRR check (Benchmark > 10%)
        const irr = financialResults.indicators?.irr || 0;
        if (irr > 0.15) {
            score += 15;
            details.push({ category: 'financial', label: 'IRR ممتاز (>15%)', score: 15, max: 15 });
        } else if (irr > 0.10) {
            score += 10;
            details.push({ category: 'financial', label: 'IRR مقبول (>10%)', score: 10, max: 15 });
        } else {
            details.push({ category: 'financial', label: 'IRR منخفض', score: 0, max: 15, issue: true });
        }

        // Profitability (Net Margin Year 1)
        const margin = financialResults.incomeStatement?.[0]?.netMargin || 0;
        if (margin > 0.10) {
            score += 10;
            details.push({ category: 'financial', label: 'هامش ربح جيد (>10%)', score: 10, max: 10 });
        } else if (margin > 0) {
            score += 5;
            details.push({ category: 'financial', label: 'هامش ربح منخفض', score: 5, max: 10 });
        } else {
            details.push({ category: 'financial', label: 'خسارة في السنة الأولى', score: 0, max: 10, issue: true });
        }
    }

    // 2. Data Completeness & Quality (30 points)
    // We check if key sections are populated
    const hasMarketStudy = state.marketing?.marketAnalysis?.marketSize > 0;
    if (hasMarketStudy) {
        score += 10;
        details.push({ category: 'data', label: 'دراسة حجم السوق', score: 10, max: 10 });
    }

    const hasTeam = state.hr?.positions?.length > 0;
    if (hasTeam) {
        score += 10;
        details.push({ category: 'data', label: 'الهيكل الوظيفي', score: 10, max: 10 });
    } else {
        details.push({ category: 'data', label: 'الهيكل الوظيفي مفقود', score: 0, max: 10, issue: true });
    }

    const hasCapex = (state.technical?.equipment?.length > 0 || state.technical?.buildings?.length > 0);
    if (hasCapex) {
        score += 10;
        details.push({ category: 'data', label: 'خطة التأسيس (CAPEX)', score: 10, max: 10 });
    }

    // 3. Strategic Readiness (30 points)
    const hasCompetitors = state.marketing?.competitors?.length > 0;
    if (hasCompetitors) {
        score += 10;
        details.push({ category: 'strategy', label: 'تحليل المنافسين', score: 10, max: 10 });
    }

    const hasRisks = state.riskAnalysis?.risks?.length > 0;
    if (hasRisks) {
        score += 10;
        details.push({ category: 'strategy', label: 'تحليل المخاطر', score: 10, max: 10 });
    }

    const hasTimeline = state.timeline?.activities?.length > 0;
    if (hasTimeline) {
        score += 10;
        details.push({ category: 'strategy', label: 'الخطة الزمنية', score: 10, max: 10 });
    }

    // Recommendation Logic
    let recommendation = 'review';
    let recommendationLabel = 'يحتاج مراجعة';
    let color = 'text-warning';

    if (score >= 80) {
        recommendation = 'go';
        recommendationLabel = 'مشروع واعد (GO)';
        color = 'text-success';
    } else if (score < 50) {
        recommendation = 'no-go';
        recommendationLabel = 'عالي المخاطر (NO GO)';
        color = 'text-danger';
    }

    return {
        score,
        maxScore,
        details,
        recommendation,
        recommendationLabel,
        color
    };
}

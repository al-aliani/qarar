import { buildSectorText, detectSectorKey } from './marketSizingModel.js';

const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

function money(value) {
    return Math.round(num(value)).toLocaleString('ar-SA') + ' ريال';
}

// كسر 0-1 فقط (مثل foreignOwnershipRate) — لا تستخدمها مع حقول مخزَّنة كنسبة مئوية
// كاملة أصلاً (مثل franchiseDetails.royaltyRate، راجع engine.js:617 يقسمها على 100).
function fractionToPct(value) {
    return (num(value) * 100).toFixed(0) + '%';
}

function pushNeed(needs, need) {
    needs.push({ type: '', label: '', reason: '', priority: 'medium', action: 'attract', ...need });
}

const PHYSICAL_GOODS_SECTORS = new Set(['fnb', 'retail', 'retailHighMargin', 'industrial', 'logistics']);
const PRIORITY_RANK = { high: 0, medium: 1 };

/**
 * يصنّف نوع الشريك الاستراتيجي المطلوب من بيانات الدراسة الفعلية (فجوة تمويل،
 * ملكية أجنبية، نموذج العمل، مستوى التقنية، فراغ جدول الموردين) — قيمة مشتقة
 * حيّاً مثل results.financingCheck، لا نص عام يُنشأ بزر ويُخزَّن.
 */
export function analyzePartnerNeeds(study = {}, results = {}) {
    const needs = [];
    const info = study?.projectInfo || {};
    const assumptions = study?.assumptions || {};
    const marketing = study?.marketing || {};

    // 1) شريك مالي/حصص — نفس عتبة بوابة REVISE لفجوة التمويل (engine.js)
    const fundingGap = num(results?.financingCheck?.fundingGap);
    const totalInvestment = num(results?.financingCheck?.totalInvestment);
    const fundingGapThreshold = num(
        results?.financingCheck?.fundingGapMaterialityThreshold
        ?? Math.max(1000, totalInvestment * 0.01)
    );
    if (fundingGap > fundingGapThreshold) {
        pushNeed(needs, {
            type: 'financial_equity',
            label: 'شريك مالي / مستثمر حصص',
            priority: 'high',
            reason: `مصادر التمويل الحالية أقل من الاستثمار المطلوب (${money(totalInvestment)}) بفجوة ${money(fundingGap)} — تحتاج شريكاً مالياً أو مستثمر حصص لسدّها قبل اعتماد القرار.`
        });
    }

    // 2) شريك مورّد — قطاع سلعي فعلي + جدول الموردين فارغ (فجوة حقيقية لا تخمين)
    const sectorKey = detectSectorKey(buildSectorText(info, study?.marketSizing || {}));
    const suppliers = Array.isArray(marketing.suppliers) ? marketing.suppliers : [];
    if (PHYSICAL_GOODS_SECTORS.has(sectorKey) && suppliers.length === 0) {
        pushNeed(needs, {
            type: 'supplier',
            label: 'شريك مورّد',
            priority: 'medium',
            reason: `النشاط يعتمد على سلعة/مادة خام فعلية، وجدول الموردين في الدراسة التسويقية فارغ حالياً — تحتاج شريك/مورّد موثوق قبل الإطلاق التشغيلي.`
        });
    }

    // 3) شريك تقني — مستوى استفادة تقنية عالٍ أو قطاع رقمي/SaaS
    if (info.techInvestmentLevel === 'high' || sectorKey === 'saas') {
        const why = info.techInvestmentLevel === 'high'
            ? 'مستوى الاستفادة من التقنية المُختار "عالية"'
            : 'النشاط مصنّف ضمن قطاع منصة رقمية/SaaS';
        pushNeed(needs, {
            type: 'technology',
            label: 'شريك تقني',
            priority: 'medium',
            reason: `${why} — تحتاج شريكاً تقنياً (مطوّر منصة أو مزوّد بنية تحتية سحابية) بدل بناء كل القدرة التقنية داخلياً.`
        });
    }

    // 4) شريك دخول للسوق المحلي — تسريع عملي، ليس شرطاً نظامياً إلزامياً
    const foreignShare = Math.min(1, Math.max(0, num(assumptions.foreignOwnershipRate)));
    if (foreignShare > 0) {
        pushNeed(needs, {
            type: 'market_entry',
            label: 'شريك دخول للسوق المحلي',
            priority: 'medium',
            reason: `حصة الملكية الأجنبية المُدخلة في افتراضات الدراسة ${fractionToPct(foreignShare)} — شريك محلي مطّلع على السوق والتراخيص يسرّع الدخول التشغيلي (النظام السعودي يتيح تملكاً أجنبياً كاملاً في معظم القطاعات، فهذا تسريع عملي لا شرط نظامي إلزامي).`
        });
    }

    // 5) تفعيل علاقة المانح — فعل مختلف (formalize لا attract): علاقة قائمة لا شريك جديد
    if (info.businessModel === 'Franchise') {
        const fd = info.franchiseDetails || {};
        const royalty = num(fd.royaltyRate);
        const entryFee = num(fd.entryFee);
        // ⚠️ royalty مخزَّنة كنسبة مئوية كاملة أصلاً (schema.js + engine.js:617 يقسمها /100) —
        // لا تمرّرها على fractionToPct وإلا تضاعفت ×100 (نفس فخ سلايدرات النسب الموثّق سابقاً).
        const feeText = (entryFee > 0 || royalty > 0)
            ? ` (رسوم امتياز ${money(entryFee)}${royalty > 0 ? `، إتاوة ${royalty}% من المبيعات` : ''})`
            : '';
        pushNeed(needs, {
            type: 'franchise_relationship',
            label: 'تفعيل علاقة المانح (Franchisor)',
            priority: 'medium',
            action: 'formalize',
            reason: `نموذج العمل المُختار "امتياز تجاري (Franchise)"${feeText} — تحتاج تفعيل/إدارة رسمية لعلاقة المانح القائمة، وليس اجتذاب شريك جديد.`
        });
    }

    return needs.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));
}

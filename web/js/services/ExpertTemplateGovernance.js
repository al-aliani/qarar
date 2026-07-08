import { detectSectorBenchmark } from '../core/sectorBenchmarks.js';

const text = (value) => String(value ?? '').trim();
const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

export function validateExpertTemplateCertification(meta = {}, studyData = {}) {
    const blockers = [];
    const warnings = [];
    let score = 100;

    const title = text(meta.title);
    const expertName = text(meta.expertName);
    const specialty = text(meta.specialty);
    const scope = text(meta.scope);
    const reviewNotes = text(meta.reviewNotes);
    const years = num(meta.yearsExperience);

    if (!title) blockers.push('اكتب اسم القالب.');
    if (!expertName) blockers.push('اكتب اسم المختص المسؤول عن القالب.');
    if (!specialty) blockers.push('حدد تخصص القالب أو القطاع.');
    if (years < 1) blockers.push('سنوات خبرة المختص يجب أن تكون سنة واحدة على الأقل قبل الاعتماد.');
    if (scope.length < 20) blockers.push('اكتب نطاق استخدام واضح للقالب: القطاع، الحجم، المدينة/النطاق، وما لا يغطيه.');
    if (reviewNotes.length < 20) blockers.push('اكتب ملاحظات مراجعة توضّح ما الذي راجعه المختص ومصادر الأرقام.');

    // تدقيق 2026-07-08 (ملاحظة عالية #40): كانت البوابة تتحقق من طول النصوص فقط
    // بلا أي فحص لأن تخصص/نطاق القالب يقع فعلاً ضمن القطاعات الستة المعتمدة في
    // PRODUCT_CONSTITUTION.md v1.1 (مطاعم + تجزئة/خدمي/صناعي/لوجستي/SaaS) —
    // نفس قائمة sectorBenchmarks.js الموحّدة، لا قائمة مستقلة جديدة.
    const matchedSector = detectSectorBenchmark(specialty) || detectSectorBenchmark(scope);
    if (title && specialty && !matchedSector) {
        blockers.push('تخصص/نطاق القالب لا يقع ضمن القطاعات المعتمدة حالياً (مطاعم، تجزئة، خدمي، صناعي، لوجستي، SaaS) — راجع دستور المنتج أو حدِّد التخصص بلغة أوضح.');
    }

    const streams = studyData?.revenue?.streams || [];
    const capexItems = [
        ...(studyData?.technical?.equipment || []),
        ...(studyData?.technical?.furniture || []),
        ...(studyData?.technical?.establishmentCosts || []),
        ...(studyData?.techResources?.techResources || [])
    ];
    const positions = studyData?.hr?.positions || [];

    if (!Array.isArray(streams) || streams.length === 0) blockers.push('القالب لا يحتوي مصادر إيرادات قابلة للحساب.');
    if (!Array.isArray(capexItems) || capexItems.length === 0) blockers.push('القالب لا يحتوي بنود استثمار/أصول كافية.');
    if (!Array.isArray(positions) || positions.length === 0) warnings.push('القالب لا يحتوي فريق عمل؛ قد يكون مناسباً فقط للأعمال الفردية أو SaaS مبكر.');

    if (years < 3) {
        warnings.push('خبرة المختص أقل من 3 سنوات؛ اعرض القالب كقالب ناشئ أو مسودة مراجعة.');
        score -= 15;
    }
    if (scope.length < 60) score -= 10;
    if (reviewNotes.length < 60) score -= 10;
    if (warnings.length) score -= warnings.length * 5;
    if (blockers.length) score = Math.min(score, 59);

    const status = blockers.length ? 'blocked' : score >= 80 ? 'approved' : 'review';
    return {
        status,
        score: Math.max(0, Math.min(100, Math.round(score))),
        blockers,
        warnings,
        canPublish: blockers.length === 0
    };
}

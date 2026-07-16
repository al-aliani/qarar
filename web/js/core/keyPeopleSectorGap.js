/**
 * detectKeyPeopleSectorGap — هل يفتقر الفريق المؤسس (keyPeople) لخبرة موثّقة في
 * قطاع المشروع المكتشَف؟ وإن كان كذلك، هل يوجد قوالب خبراء مسجّلة بنفس القطاع؟
 *
 * يعيد استخدام sectorBenchmarks.js (نفس مصدر اكتشاف القطاع المستخدَم في SmartAdvisor
 * وبوابة QA) — لا كاشف قطاع ثالث. دالة نقية بلا قراءة localStorage/DOM هنا: المستدعي
 * يمرّر state وقائمة getExpertTemplates() الجاهزة لإبقائها قابلة للاختبار مباشرة.
 */
import { resolveSectorBenchmark, detectSectorBenchmark } from './sectorBenchmarks.js';

/**
 * @param {object} state - كامل حالة الدراسة
 * @param {Array<{id:string, expertName:string, specialty:string}>} [templates] - نتيجة getExpertTemplates()
 * @returns {{ sectorLabel:string, experts:Array<{id:string, name:string, specialty:string}> } | null}
 *          null إن تعذّر اكتشاف قطاع، أو وُجدت خبرة مطابقة في الفريق، أو لا خبراء مطابقون.
 */
export function detectKeyPeopleSectorGap(state, templates = []) {
    const bench = resolveSectorBenchmark(state);
    if (!bench || bench.isGeneric) return null; // لا قطاع مكتشَف — لا تخمين

    const rows = Array.isArray(state?.keyPeople?.keyPeople) ? state.keyPeople.keyPeople : [];
    const hasSectorExperience = rows.some(p => {
        const text = [p?.role, p?.experience, p?.qualifications].filter(Boolean).join(' ');
        return detectSectorBenchmark(text)?.label === bench.label;
    });
    if (hasSectorExperience) return null; // الفريق يغطي القطاع فعلاً

    const experts = (Array.isArray(templates) ? templates : [])
        .filter(t => detectSectorBenchmark(t?.specialty)?.label === bench.label)
        .map(t => ({ id: t.id, name: t.expertName, specialty: t.specialty }));

    if (experts.length === 0) return null; // سجل فارغ محلياً — صمت بلا "لا يوجد" مزعج

    return { sectorLabel: bench.label, experts };
}

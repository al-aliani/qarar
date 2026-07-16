/**
 * icsExport.js — توليد ملف تقويم .ics قياسي (RFC 5545) من مراحل خطة التنفيذ.
 * لا يحتاج أي مفتاح/حساب — يعمل مع Google Calendar/Outlook/Apple عبر استيراد
 * الملف مباشرة. المنطق هنا نقي (بلا DOM) لقابلية الاختبار؛ الاستدعاء الفعلي
 * لتنزيل الملف يبقى في الواجهة (Timeline.js).
 */

function pad(n) { return String(n).padStart(2, '0'); }

function toIcsDate(date) {
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function escapeIcsText(s) {
    return String(s ?? '').replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n');
}

/** يحوّل شهراً نسبياً (1-12 من بداية المشروع) لتاريخ تقويمي فعلي — يعيد null إن تعذّر تفسير تاريخ البداية. */
export function buildActivityDate(projectStartDate, startMonth) {
    if (!projectStartDate) return null;
    const base = new Date(projectStartDate);
    if (Number.isNaN(base.getTime())) return null;
    const monthOffset = Math.max(1, Number(startMonth) || 1) - 1;
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthOffset, base.getUTCDate()));
}

/**
 * يبني نص تقويم .ics كامل من قائمة أنشطة الجدول الزمني. أنشطة بلا تاريخ بداية
 * قابل للتفسير تُستبعد بصمت (لا نخترع تاريخاً).
 * @param {Array<{id, name, startMonth, duration?}>} activities
 * @param {string|Date} projectStartDate
 * @returns {string}
 */
export function buildIcsCalendar(activities, projectStartDate) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Qarar//Timeline//AR'];
    (activities || []).forEach(act => {
        const date = buildActivityDate(projectStartDate, act?.startMonth);
        if (!date) return;
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${act.id}@qarar-timeline`);
        lines.push(`DTSTART;VALUE=DATE:${toIcsDate(date)}`);
        lines.push(`SUMMARY:${escapeIcsText(act.name)}`);
        if (act.duration) lines.push(`DESCRIPTION:${escapeIcsText('المدة التقديرية: ' + act.duration + ' شهر')}`);
        lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}

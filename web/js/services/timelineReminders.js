/**
 * Upcoming milestone reminders for the Timeline plan.
 * Flags timeline.activities whose planned calendar month (derived from
 * projectInfo.timeline.projectStart + startMonth) falls within the next month.
 * Pure function — caller injects `today` instead of this module calling `new Date()`.
 */

function parseISODate(str) {
    if (typeof str !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(date, months) {
    return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

/**
 * @param {object} state - Study state (reads timeline.activities + projectInfo.timeline.projectStart)
 * @param {Date} today - Reference date
 * @returns {Array<{id, name, startMonth, milestoneDate: string, message: string}>}
 */
export function getUpcomingMilestoneReminders(state, today) {
    if (!(today instanceof Date) || Number.isNaN(today.getTime())) return [];

    const start = parseISODate(state?.projectInfo?.timeline?.projectStart);
    if (!start) return []; // لا تاريخ بدء صالح — تخطَّ الميزة بدل التخمين

    const activities = Array.isArray(state?.timeline?.activities) ? state.timeline.activities : [];
    if (!activities.length) return [];

    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const horizon = addMonths(todayDay, 1);

    const reminders = [];
    for (const activity of activities) {
        const startMonth = Number(activity?.startMonth);
        if (!Number.isFinite(startMonth) || startMonth < 1) continue;

        const milestoneDate = addMonths(start, startMonth - 1);
        if (milestoneDate.getTime() >= todayDay.getTime() && milestoneDate.getTime() <= horizon.getTime()) {
            const name = activity.name || '';
            reminders.push({
                id: activity.id,
                name,
                startMonth,
                milestoneDate: milestoneDate.toISOString().split('T')[0],
                message: `معلم قريب: ${name} خلال الأشهر القادمة`
            });
        }
    }
    return reminders;
}

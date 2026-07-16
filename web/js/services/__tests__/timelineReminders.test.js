import { describe, it, expect } from 'vitest';
import { getUpcomingMilestoneReminders } from '../timelineReminders.js';

function makeState(projectStart, activities) {
    return {
        projectInfo: { timeline: { projectStart } },
        timeline: { activities }
    };
}

describe('getUpcomingMilestoneReminders', () => {
    const today = new Date(2026, 6, 16); // 2026-07-16 (اليوم الحالي في هذه الجلسة)

    it('معلم يقع خلال الشهر القادم ⇒ يُدرَج في التذكيرات', () => {
        // بدء المشروع 2026-01-01 + شهر البدء 8 = 2026-08-01 (خلال شهر واحد من اليوم)
        const state = makeState('2026-01-01', [
            { id: 1, name: 'التدريب والحملة التسويقية', startMonth: 8, duration: 1, category: 'marketing' }
        ]);
        const reminders = getUpcomingMilestoneReminders(state, today);
        expect(reminders).toHaveLength(1);
        expect(reminders[0]).toMatchObject({ id: 1, name: 'التدريب والحملة التسويقية', startMonth: 8 });
        expect(reminders[0].message).toContain('التدريب والحملة التسويقية');
    });

    it('معلم بعيد زمنياً (أكثر من شهر) ⇒ لا يُدرَج', () => {
        // بدء المشروع 2026-01-01 + شهر البدء 12 = 2026-12-01 (بعيد عن اليوم بأكثر من شهر)
        const state = makeState('2026-01-01', [
            { id: 2, name: 'الإطلاق الرسمي', startMonth: 12, duration: 1, category: 'launch' }
        ]);
        expect(getUpcomingMilestoneReminders(state, today)).toEqual([]);
    });

    it('معلم مضى موعده بالفعل ⇒ لا يُدرَج (ليس تذكيراً "قادماً")', () => {
        // بدء المشروع 2026-01-01 + شهر البدء 1 = 2026-01-01 (في الماضي)
        const state = makeState('2026-01-01', [
            { id: 3, name: 'استخراج التراخيص', startMonth: 1, duration: 2, category: 'legal' }
        ]);
        expect(getUpcomingMilestoneReminders(state, today)).toEqual([]);
    });

    it('لا تاريخ بدء صالح للمشروع (فارغ) ⇒ مصفوفة فارغة دون خطأ', () => {
        const state = makeState('', [
            { id: 4, name: 'نشاط', startMonth: 1, duration: 1, category: 'legal' }
        ]);
        expect(() => getUpcomingMilestoneReminders(state, today)).not.toThrow();
        expect(getUpcomingMilestoneReminders(state, today)).toEqual([]);
    });

    it('تاريخ بدء غير صالح (نص عشوائي) ⇒ مصفوفة فارغة دون خطأ', () => {
        const state = makeState('غير تاريخ', [
            { id: 5, name: 'نشاط', startMonth: 1, duration: 1, category: 'legal' }
        ]);
        expect(() => getUpcomingMilestoneReminders(state, today)).not.toThrow();
        expect(getUpcomingMilestoneReminders(state, today)).toEqual([]);
    });

    it('لا أنشطة في الجدول الزمني إطلاقاً ⇒ مصفوفة فارغة', () => {
        const state = makeState('2026-01-01', []);
        expect(getUpcomingMilestoneReminders(state, today)).toEqual([]);
    });

    it('projectInfo.timeline مفقود بالكامل ⇒ مصفوفة فارغة دون خطأ', () => {
        const state = { timeline: { activities: [{ id: 6, name: 'نشاط', startMonth: 1, duration: 1 }] } };
        expect(() => getUpcomingMilestoneReminders(state, today)).not.toThrow();
        expect(getUpcomingMilestoneReminders(state, today)).toEqual([]);
    });
});

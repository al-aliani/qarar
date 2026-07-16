/**
 * @vitest-environment jsdom
 *
 * تغطية إضافة الربط بين مراقبة الأداء الفعلي (PostLaunchTracker) والجدول الزمني
 * المخطط (timeline.activities): مقارنة شهر الإنجاز الفعلي بالشهر المخطط
 * (startMonth + duration - 1)، وتنبيه عند تأخر نشاطين أو أكثر.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostLaunchTracker } from '../PostLaunchTracker.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { get: () => state, updatePath: vi.fn() };
}

function baseState(activities, timelineCompletions = {}) {
    const data = createEmptyStudy();
    data[SECTIONS.TIMELINE] = { activities };
    data[SECTIONS.ACTUALS] = { months: [], timelineCompletions };
    return data;
}

describe('PostLaunchTracker — مقارنة الجدول الزمني: المخطط مقابل الفعلي', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="c"></div>'; });

    it('لا توجد أنشطة في الجدول الزمني ⇒ رسالة فارغة بدل جدول مضلِّل', () => {
        const store = fakeStore(baseState([]));
        const tracker = new PostLaunchTracker('c', store);
        tracker.render();
        expect(document.querySelector('#timelineComparisonBody')).toBeNull();
        expect(document.body.textContent).toContain('لا توجد أنشطة في الجدول الزمني بعد');
    });

    it('إنجاز في نفس الشهر المخطط (نهاية المدة) ⇒ "على الموعد"', () => {
        // startMonth=1, duration=2 ⇒ الشهر المخطط للإنجاز = 2
        const activities = [{ id: 1, name: 'استخراج التراخيص', startMonth: 1, duration: 2, category: 'legal' }];
        const store = fakeStore(baseState(activities, { 1: 2 }));
        const tracker = new PostLaunchTracker('c', store);
        tracker.render();

        const row = document.querySelector('#timelineComparisonBody tr');
        expect(row.textContent).toContain('على الموعد');
        expect(row.querySelector('.status-badge').className).toContain('status-badge--positive');
    });

    it('إنجاز بعد الشهر المخطط ⇒ "متأخر" بعدد الأشهر الصحيح', () => {
        // startMonth=1, duration=2 ⇒ مخطط=2، أُنجز فعلياً في الشهر 5 ⇒ متأخر 3 أشهر
        const activities = [{ id: 1, name: 'استخراج التراخيص', startMonth: 1, duration: 2, category: 'legal' }];
        const store = fakeStore(baseState(activities, { 1: 5 }));
        const tracker = new PostLaunchTracker('c', store);
        tracker.render();

        const row = document.querySelector('#timelineComparisonBody tr');
        expect(row.textContent).toContain('متأخر 3 شهر');
        expect(row.querySelector('.status-badge').className).toContain('status-badge--negative');
    });

    it('إنجاز قبل الشهر المخطط ⇒ "مبكر" بعدد الأشهر الصحيح', () => {
        // startMonth=4, duration=4 ⇒ مخطط=7، أُنجز فعلياً في الشهر 5 ⇒ مبكر شهرين
        const activities = [{ id: 1, name: 'الديكور والتجهيز', startMonth: 4, duration: 4, category: 'technical' }];
        const store = fakeStore(baseState(activities, { 1: 5 }));
        const tracker = new PostLaunchTracker('c', store);
        tracker.render();

        const row = document.querySelector('#timelineComparisonBody tr');
        expect(row.textContent).toContain('مبكر 2 شهر');
        expect(row.querySelector('.status-badge').className).toContain('status-badge--positive');
    });

    it('لم يُسجَّل إنجاز فعلي بعد ⇒ حالة محايدة بدل افتراض تأخر/التزام', () => {
        const activities = [{ id: 1, name: 'نشاط', startMonth: 1, duration: 2, category: 'legal' }];
        const store = fakeStore(baseState(activities, {}));
        const tracker = new PostLaunchTracker('c', store);
        tracker.render();

        const row = document.querySelector('#timelineComparisonBody tr');
        expect(row.textContent).toContain('لم يُسجَّل الإنجاز بعد');
        expect(row.querySelector('.status-badge').className).toContain('status-badge--neutral');
    });

    it('نشاطان متأخران أو أكثر ⇒ تنبيه تحذيري إضافي يظهر', () => {
        const activities = [
            { id: 1, name: 'نشاط أ', startMonth: 1, duration: 2, category: 'legal' },   // مخطط=2
            { id: 2, name: 'نشاط ب', startMonth: 2, duration: 2, category: 'technical' }, // مخطط=3
            { id: 3, name: 'نشاط ج', startMonth: 4, duration: 4, category: 'technical' }  // مخطط=7
        ];
        // نشاط أ متأخر (فعلي 4 > مخطط 2)، نشاط ب متأخر (فعلي 6 > مخطط 3)، نشاط ج على الموعد
        const store = fakeStore(baseState(activities, { 1: 4, 2: 6, 3: 7 }));
        const tracker = new PostLaunchTracker('c', store);
        tracker.render();

        expect(document.body.textContent).toContain('أنشطة (أو أكثر) من الجدول الزمني متأخرة');
        const warningBox = document.querySelector('.alert--warning');
        expect(warningBox).toBeTruthy();
    });

    it('نشاط متأخر واحد فقط ⇒ لا يظهر تنبيه التأخر المتعدد', () => {
        const activities = [
            { id: 1, name: 'نشاط أ', startMonth: 1, duration: 2, category: 'legal' }, // مخطط=2
            { id: 2, name: 'نشاط ب', startMonth: 2, duration: 2, category: 'technical' } // مخطط=3
        ];
        const store = fakeStore(baseState(activities, { 1: 5, 2: 3 })); // أ متأخر، ب على الموعد
        const tracker = new PostLaunchTracker('c', store);
        tracker.render();

        expect(document.querySelector('.alert--warning')).toBeNull();
    });

    it('تعديل شهر الإنجاز الفعلي من الحقل يحفظ عبر updatePath بالمسار الصحيح', () => {
        const activities = [{ id: 7, name: 'الإطلاق الرسمي', startMonth: 12, duration: 1, category: 'launch' }];
        const store = fakeStore(baseState(activities, {}));
        const tracker = new PostLaunchTracker('c', store);
        tracker.render();

        const input = document.querySelector('[data-field="timelineActual"]');
        input.value = '12';
        input.dispatchEvent(new Event('change', { bubbles: true }));

        expect(store.updatePath).toHaveBeenCalledWith(SECTIONS.ACTUALS, 'timelineCompletions.7', 12);
    });
});

/**
 * تحقق حي 2026-07-15: دراسة جديدة فارغة 100% كانت تُظهر "أنجزت 4 من 7" في أول
 * تصنيف (preliminaryCheck/projectAlternatives/projectInfo/smartGoals) رغم عدم إدخال
 * أي بيانات، بينما الصفحة الرئيسية (QualityCalculator) أظهرت 0% بالمقابل — تناقض
 * ظاهري مربك. السبب: isStepComplete كانت تتحقق من Object.keys(section).length > 0
 * (أي "شكل" القسم فقط)، وcreateEmptyStudy() يملأ كل قسم بمفاتيحه الافتراضية دائماً.
 */
import { describe, it, expect } from 'vitest';
import { ProgressTracker } from '../progressTracker.js';
import { createEmptyStudy } from '../../core/schema.js';
import { STEPS, stepIndexById } from '../../core/wizardSteps.js';

describe('ProgressTracker.detectCompletion — دراسة جديدة فارغة 100%', () => {
    it('لا تُحتسب أي خطوة من أول تصنيف (السبع الأولى) كمكتملة', () => {
        const tracker = new ProgressTracker(STEPS.length);
        const blank = createEmptyStudy();

        tracker.detectCompletion(blank, STEPS);

        for (let index = 0; index <= 6; index++) {
            expect(tracker.isCompleted(index)).toBe(false);
        }
    });

    it('preliminaryCheck (كائن بمفاتيح فارغة افتراضياً) لا يُعتبر مكتملاً وهو فارغ', () => {
        const tracker = new ProgressTracker(STEPS.length);
        const blank = createEmptyStudy();
        tracker.detectCompletion(blank, STEPS);
        expect(tracker.isCompleted(stepIndexById('preliminaryCheck'))).toBe(false);
    });

    it('projectAlternatives (ideas فارغة + selectedIndex:0) لا يُعتبر مكتملاً وهو فارغ', () => {
        const tracker = new ProgressTracker(STEPS.length);
        const blank = createEmptyStudy();
        tracker.detectCompletion(blank, STEPS);
        expect(tracker.isCompleted(stepIndexById('projectAlternatives'))).toBe(false);
    });

    it('smartGoals ({goals: []}) لا يُعتبر مكتملاً وهو فارغ', () => {
        const tracker = new ProgressTracker(STEPS.length);
        const blank = createEmptyStudy();
        tracker.detectCompletion(blank, STEPS);
        expect(tracker.isCompleted(stepIndexById('smartGoals'))).toBe(false);
    });

    it('معلومات المشروع (تحتوي مفاتيح غير فارغة افتراضياً مثل businessModel:"Independent") لا تُعتبر مكتملة وهي فارغة', () => {
        const tracker = new ProgressTracker(STEPS.length);
        const blank = createEmptyStudy();
        tracker.detectCompletion(blank, STEPS);
        expect(tracker.isCompleted(stepIndexById('projectInfo'))).toBe(false);
    });

    it('الأشخاص الرئيسون (خطوة جدولية) تبقى غير مكتملة بلا صفوف فعلية — سلوك سابق دون تغيير', () => {
        const tracker = new ProgressTracker(STEPS.length);
        const blank = createEmptyStudy();
        tracker.detectCompletion(blank, STEPS);
        expect(tracker.isCompleted(stepIndexById('keyPeople'))).toBe(false);
    });

    it('إدخال قيمة فعلية واحدة (اسم المشروع) يجعل خطوة معلومات المشروع مكتملة', () => {
        const tracker = new ProgressTracker(STEPS.length);
        const study = createEmptyStudy();
        study.projectInfo.name = 'مطعم الاختبار';

        tracker.detectCompletion(study, STEPS);

        expect(tracker.isCompleted(stepIndexById('projectInfo'))).toBe(true);
    });

    it('إضافة هدف واحد فعلي يجعل خطوة الأهداف الذكية مكتملة', () => {
        const tracker = new ProgressTracker(STEPS.length);
        const study = createEmptyStudy();
        study.smartGoals.goals.push({ id: 'g1', specific: 'زيادة المبيعات' });

        tracker.detectCompletion(study, STEPS);

        expect(tracker.isCompleted(stepIndexById('smartGoals'))).toBe(true);
    });

    it('إضافة صف فعلي لجدول يجعل خطوة الأشخاص الرئيسون مكتملة (سلوك الجداول دون تغيير)', () => {
        const tracker = new ProgressTracker(STEPS.length);
        const study = createEmptyStudy();
        study.keyPeople.keyPeople.push({ name: 'أحمد', role: 'المدير العام' });

        tracker.detectCompletion(study, STEPS);

        expect(tracker.isCompleted(stepIndexById('keyPeople'))).toBe(true);
    });

    it('markCompleted اليدوي يبقى نافذاً حتى لو أعاد detectCompletion الحساب', () => {
        const tracker = new ProgressTracker(STEPS.length);
        const blank = createEmptyStudy();
        tracker.markCompleted(stepIndexById('preliminaryCheck'));

        tracker.detectCompletion(blank, STEPS);

        expect(tracker.isCompleted(stepIndexById('preliminaryCheck'))).toBe(true);
    });
});

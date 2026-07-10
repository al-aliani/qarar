/**
 * @vitest-environment jsdom
 *
 * دفعة 4 — يثبّت 4 إصلاحات في Wizard.js (المُرسم العام لأغلب حقول المعالج):
 *  1) XSS/حقن HTML: displayValue/safeVal كانت تُحقن بلا تهريب في textarea وinput (قيمة السمة).
 *  2) زر «العصا السحرية» يعلق دائماً معطّلاً إن ضغط المستخدم «إلغاء» على confirm() لأن
 *     btn.disabled=true كان يُضبط قبل فحص confirm() لا بعده.
 *  3) زر «الجلب الذكي» لكل جدول (smart fill) كان يعلق دائماً معطّلاً «جاري البحث…» إن
 *     رمى المُعالج (handler) استثناءً، لأن e.target.disabled=false لم يكن داخل finally.
 *  4) اتساق الأرقام: مؤشر المسار بالأعلى كان يعرض أرقاماً لاتينية بينما بقية التطبيق
 *     (الجداول) يعرض أرقاماً هندية عبر toLocaleString('ar-SA').
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Wizard } from '../Wizard.js';
import { StudyJourney } from '../StudyJourney.js';
import { SECTIONS, createEmptyStudy, TABLE_SCHEMAS } from '../../core/schema.js';
import { escapeHtml } from '../../utils/escape.js';
import { DataService } from '../../services/DataService.js';
import { toast } from '../../utils/toast.js';

function fakeStore(state) {
    return {
        get: () => state,
        getState: () => state,
        update: vi.fn(),
        updatePath: vi.fn()
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('Wizard batch-4 — XSS، الأزرار العالقة، اتساق الأرقام', () => {
    // ────────────────────────────────────────────────────────────────
    // 1) XSS / حقن HTML
    // ────────────────────────────────────────────────────────────────
    describe('البند 1 — تهريب HTML في الحقول النصية', () => {
        const payload = '<img src=x onerror=alert(1)>';

        it('حقل textarea (سردي/طويل مثل الوصف) يُهرّب المحتوى ولا يسمح بكسر الوسم', () => {
            const state = createEmptyStudy();
            const wizard = new Wizard('missing-container', fakeStore(state), {}, { steps: [] });

            const html = wizard.renderField('projectInfo', 'projectInfo.description', 'description', payload);

            expect(html).not.toContain(payload);
            expect(html).toContain('<textarea');
            expect(html).toContain(escapeHtml(payload));
            expect(html).toContain('&lt;img');
        });

        it('حقل input عام (سطر نصي واحد) يُهرّب قيمة السمة value ولا يسمح بكسر السمة', () => {
            const state = createEmptyStudy();
            const wizard = new Wizard('missing-container', fakeStore(state), {}, { steps: [] });

            // مفتاح عام غير مُدار عبر getFieldOptionSpec (لا select/datalist/yesno) —
            // يمر عبر مسار <input> العام في renderField مباشرة.
            const html = wizard.renderField('projectInfo', 'projectInfo.ownerNickname', 'ownerNickname', payload);

            expect(html).not.toContain(payload);
            expect(html).toContain('<input');
            expect(html).toContain(`value="${escapeHtml(payload)}"`);
        });

        it('اختبار تكامل: رسم خطوة كاملة تحوي وصفاً خبيثاً لا يُسرّب payload خام في innerHTML الحاوية', () => {
            const state = createEmptyStudy();
            state.projectInfo.description = payload;

            const wizard = new Wizard('c', fakeStore(state), {}, {
                steps: [{ id: SECTIONS.PROJECT_INFO, label: 'معلومات المشروع', isForm: true, tables: [] }]
            });
            document.body.innerHTML = `<div id="c"></div>`;
            wizard.container = document.getElementById('c');

            wizard.renderStep(SECTIONS.PROJECT_INFO, wizard.steps[0], 0);

            const rendered = wizard.container.innerHTML;
            expect(rendered).not.toContain(payload);
            expect(rendered).toContain('&lt;img');
        });
    });

    // ────────────────────────────────────────────────────────────────
    // 2) زر العصا السحرية — لا يعلق بعد إلغاء confirm()
    // ────────────────────────────────────────────────────────────────
    describe('البند 2 — زر العصا السحرية لا يعلق بعد الضغط على «إلغاء»', () => {
        it('disabled يبقى false بعد confirm() ⇒ false، ويمكن النقر عليه مجدداً', () => {
            const state = createEmptyStudy();
            state.projectInfo.description = 'نص وصف موجود بالفعل كتبه المستخدم';

            const wizard = new Wizard('c', fakeStore(state), {}, {
                steps: [{ id: SECTIONS.PROJECT_INFO, label: 'معلومات المشروع', isForm: true, tables: [] }]
            });
            document.body.innerHTML = `<div id="c"></div>`;
            wizard.container = document.getElementById('c');
            wizard.renderStep(SECTIONS.PROJECT_INFO, wizard.steps[0], 0);

            // ملاحظة: fullKey للحقول الأساسية (غير المتداخلة) هو المفتاح نفسه بلا بادئة
            // القسم (راجع renderEntry داخل renderStep) — لذا "description" لا "projectInfo.description".
            const wandBtn = wizard.container.querySelector('.btn-magic-wand[data-key="description"]');
            expect(wandBtn).toBeTruthy();
            expect(wandBtn.disabled).toBe(false);

            // المستخدم يضغط «إلغاء» على confirm() لأن الحقل يحوي نصاً بالفعل
            vi.spyOn(window, 'confirm').mockReturnValue(false);

            wandBtn.click();

            // BUG (قبل الإصلاح): كان btn.disabled يُضبط true قبل فحص confirm()، فيبقى
            // معطّلاً للأبد بعد الإلغاء. الإصلاح: الفحص قبل أي تعديل لحالة الزر.
            expect(wandBtn.disabled).toBe(false);
            expect(wandBtn.hasAttribute('aria-busy')).toBe(false);

            // إثبات إضافي: النقر مجدداً لا يُحجب بحارس `if (btn.disabled) return`
            wandBtn.click();
            expect(window.confirm).toHaveBeenCalledTimes(2);
        });
    });

    // ────────────────────────────────────────────────────────────────
    // 3) زر «الجلب الذكي» لكل جدول — لا يعلق إن رمى المُعالج استثناءً
    // ────────────────────────────────────────────────────────────────
    describe('البند 3 — زر الجلب الذكي لا يعلق إن فشل المُعالج', () => {
        it('disabled يعود false و toast.error يُستدعى إن رمى DataService.recommendStaffing استثناءً', () => {
            const state = createEmptyStudy();
            // hr.positions موجود افتراضياً كمصفوفة فارغة (schema.js)

            const wizard = new Wizard('c', fakeStore(state), { positions: TABLE_SCHEMAS.positions }, {
                steps: [{ id: SECTIONS.HR, label: 'الموارد البشرية', tables: ['positions'] }]
            });
            document.body.innerHTML = `<div id="c"></div>`;
            wizard.container = document.getElementById('c');

            // نجعل المُعالج الحقيقي (staffing → DataService.recommendStaffing) يرمي استثناءً
            vi.spyOn(DataService, 'recommendStaffing').mockImplementation(() => {
                throw new Error('فشل محاكى في التوصية بالتوظيف');
            });
            const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => {});

            wizard.renderStep(SECTIONS.HR, wizard.steps[0], 0);

            const smartBtn = document.getElementById('btn-smart-positions');
            expect(smartBtn).toBeTruthy();

            smartBtn.click();

            // BUG (قبل الإصلاح): e.target.disabled = false كان بعد استدعاء handler() مباشرة
            // بلا try/catch/finally، فاستثناء handler كان يوقف التنفيذ والزر يبقى معطّلاً
            // للأبد بنص «جاري البحث…».
            expect(smartBtn.disabled).toBe(false);
            expect(smartBtn.textContent).not.toBe('جاري البحث…');
            expect(toastErrorSpy).toHaveBeenCalled();
        });
    });

    // ────────────────────────────────────────────────────────────────
    // 4) اتساق نظام الأرقام في مؤشر المسار
    // ────────────────────────────────────────────────────────────────
    describe('البند 4 — مؤشر المسار يعرض أرقاماً هندية (ar-SA) لا لاتينية', () => {
        it('رقم الخطوة وإجمالي الخطوات يستخدمان الأرقام العربية', () => {
            document.body.innerHTML = `
                <div id="headerStageBar"></div>
                <div id="mobileStageIndicator"></div>
                <nav id="breadcrumbBar"><button id="btnOpenStudyMap"></button></nav>
                <dialog id="studyMapDialog"></dialog>`;
            const journey = new StudyJourney();
            journey.update(12);

            const header = document.getElementById('headerStageBar').textContent;
            const mobile = document.getElementById('mobileStageIndicator').textContent;
            expect(header).toMatch(/[٠-٩]/);
            expect(header).not.toMatch(/[0-9]/);
            expect(mobile).toMatch(/[٠-٩]/);
            expect(mobile).not.toMatch(/[0-9]/);
        });
    });
});

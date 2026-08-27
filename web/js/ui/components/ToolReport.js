/**
 * ToolReport — خانة «إصدار تقرير» لكل أداة تحليلية (تدقيق 2026-07-11).
 * ─────────────────────────────────────────────────────────────────────────────
 * تصدير عام واحد يخدم كل الأدوات التحليلية/المختلطة (الـ28): يُلحق شريطاً بزر
 * «إصدار تقرير هذه الأداة» أسفل الأداة، والضغط يطبع ما تعرضه الأداة فعلياً كملف
 * PDF (عبر طباعة المتصفح) مع ترويسة المشروع.
 *
 * لماذا الطباعة لا نسخ DOM: كثير من الأدوات ترسم رسوماً على <canvas> (مونت كارلو،
 * المخاطر، اللوحات) — و<canvas> لا تنجو من استنساخ innerHTML. الطباعة تعتمد شجرة
 * DOM الحيّة (بتقنية visibility) فتحافظ على الرسوم كما هي.
 *
 * الشريط يُلحق بالغلاف الثابت (.category-step) لا بحاوية المحتوى التي تعيد الأداة
 * رسمها عند تغيّر البيانات — وإلا كان يُمسح مع أول إعادة رسم.
 */

import { stepCanReport, stepReportType } from '../../core/stepReportType.js';

const reportIcon = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';

function projectName(store) {
    try {
        const s = store?.getState?.() || {};
        return s.projectInfo?.projectName || s.projectInfo?.name || s.projectInfo?.concept || 'دراسة الجدوى';
    } catch (_) {
        return 'دراسة الجدوى';
    }
}

function todayLabel() {
    try {
        return new Date().toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (_) {
        return new Date().toISOString().slice(0, 10);
    }
}

/** يطبع محتوى الأداة كتقرير PDF عبر طباعة المتصفح (يحافظ على الرسوم الحيّة). */
function printToolReport(section, title, store) {
    if (!section) return;

    const header = document.createElement('div');
    header.className = 'tool-report-print-header';
    header.innerHTML = `
        <div class="tool-report-print-brand">قرار — منصة دراسة الجدوى</div>
        <h1 class="tool-report-print-title">${title || 'تقرير الأداة'}</h1>
        <div class="tool-report-print-meta">${projectName(store)} · ${todayLabel()}</div>
    `;
    section.prepend(header);
    section.classList.add('tool-print-target');
    document.body.classList.add('is-printing-tool');

    const cleanup = () => {
        document.body.classList.remove('is-printing-tool');
        section.classList.remove('tool-print-target');
        header.remove();
        window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // احتياط: إن لم يُطلق afterprint (بعض المتصفحات) نظّف بعد مهلة قصيرة.
    setTimeout(() => { if (document.body.classList.contains('is-printing-tool')) cleanup(); }, 60000);

    window.print();
}

/**
 * يُلحق شريط «إصدار تقرير» بأداة تحليلية/مختلطة. آمن ومتكرر (idempotent) ولا يفعل
 * شيئاً لخطوات الإدخال. يجب استدعاؤه بعد رسم الأداة داخل حاويتها.
 * @param {object} step  كائن الخطوة (من STEPS) لتحديد النوع والعنوان.
 * @param {string} containerId  معرّف حاوية محتوى الأداة (category-step-content-N أو wizardContainer).
 * @param {object} store  مخزن الدراسة (لاسم المشروع في الترويسة).
 */
export function attachToolReport(step, containerId, store) {
    if (!stepCanReport(step)) return;
    const content = document.getElementById(containerId);
    if (!content) return;

    // الغلاف الثابت: قسم الخطوة في صفحة التصنيف، أو أب الحاوية في المسار القديم.
    const host = content.closest('.category-step') || content.parentElement || content;
    if (!host || host.querySelector(':scope > .tool-report-bar')) return; // idempotent

    const bar = document.createElement('div');
    bar.className = 'tool-report-bar';
    bar.dataset.reportType = stepReportType(step);
    bar.innerHTML = `
        <button type="button" class="btn btn--secondary btn--sm tool-report-btn">
            ${reportIcon}<span>إصدار تقرير هذه الأداة</span>
        </button>
        <span class="tool-report-hint">يُصدّر ما تعرضه الأداة كملف PDF عبر الطباعة</span>
    `;
    bar.querySelector('.tool-report-btn').addEventListener('click', () => {
        const section = content.closest('.category-step') || content;
        printToolReport(section, step.label, store);
    });
    host.appendChild(bar);
}

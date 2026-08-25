/**
 * Unified Export Menu (Modal)
 * Provides centralized export options: PDF, Excel, Bank Report, JSON.
 */
import { PDFGenerator } from '../../export/pdfGenerator.js';
import { ReportGenerator } from '../services/ReportGenerator.js';
import { BankReportGenerator } from '../../export/BankReportGenerator.js';
import { MonshaatReportGenerator } from '../../export/MonshaatReportGenerator.js';
import { sanitizeFilename, exportDateISO, downloadBlob, selectExcelExportPath } from '../../export/utils.js';
import { calculateStudy as runFullModel } from '../core/engine.js';
import { runQAChecks } from '../utils/qaChecks.js';
import { resolveQaStepIndex } from '../utils/qaStepMapper.js';
import { escapeHtml } from '../utils/escape.js';
import { toast } from '../utils/toast.js';
import { log as auditLog, ACTIONS } from '../utils/auditLogger.js';
import { trackEvent } from '../utils/analytics.js';
import { attachModalA11y } from '../utils/modalA11y.js';
import { APP_CONFIG, BANK_COMPLIANCE_SENTENCE } from '../config.js';
import { ConsultationModal } from './ConsultationModal.js';
import { PaywallModal } from './PaywallModal.js';
import { generatePitchScript } from '../services/AIConnector.js';
import { hasActivePayment } from '../services/PaymentService.js';
import { getCertificationForStudy } from '../services/ReviewerService.js';
import { renderReviewStatusBadge } from './components/ReviewStatusBadge.js';

const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

// batch_zip واستشارة الخبير غير مرتبطين بمسار معيّن (ممول/مستثمر/بيانات) — يُضافان
// لكل المجموعات الثلاث كي لا يختفيا كلياً (كانا مبنيَّين ويعملان لكن بلا أي طريق
// وصول بعد تبسيط القائمة لثلاثة مسارات فلترة).
const ALWAYS_VISIBLE_TYPES = ['batch_zip', 'consultation'];
const EXPORT_PATHS = {
    lending: new Set(['pdf', 'excel', 'word', 'pptx', 'lending_ready', 'monshaat', 'financier', 'review_copy', 'professional_review', ...ALWAYS_VISIBLE_TYPES]),
    investor: new Set(['pitch', 'pptx', 'accelerator_pitch', 'incubator_pitch', 'crowdfunding_pitch', 'grant', 'investor_one_pager', 'investor_dashboard', 'pitch_script', ...ALWAYS_VISIBLE_TYPES]),
    data: new Set(['json', 'csv', 'share_link', 'folder_json', 'gsheets', ...ALWAYS_VISIBLE_TYPES])
};

// تدقيق 2026-07-08 (ملاحظة عالية #39): صيغ التقرير النهائي الاحترافي (قرار المالك:
// قفلها فعلياً، لا مجرد رسائل تسويقية) — الأدوات الخام/المشاركة (JSON/CSV/Sheets/
// لوحة المستثمر) تبقى مجانية عمداً، وكذلك حجز الاستشارة (مسار منفصل أصلاً).
// ملاحظة: لا تكتب هنا اسم الصيغة الإنجليزي (PDF/Excel/Word/PowerPoint...) — installArabicUiGuard
// في app.js يستبدلها تلقائياً بترجمتها العربية في كل نص بالصفحة، فكتابتها هنا يدوياً
// بجانب ترجمتها العربية يُنتج تكراراً («تقرير PDF شامل» ← «تقرير تقرير شامل»).
export const PREMIUM_EXPORT_TYPES = new Map([
    ['pdf', 'التقرير الشامل'],
    ['excel', 'ملف الجداول المالية التفصيلي'],
    ['pptx', 'العرض التقديمي'],
    ['word', 'الملف القابل للتعديل'],
    ['bank', 'تقرير التمويل البنكي'],
    ['financier', 'نسخة الممول'],
    ['lending_ready', 'تقرير جاهز للإقراض'],
    ['review_copy', 'نسخة المراجعة'],
    ['professional_review', 'النسخة الاحترافية للمراجعة'],
    ['monshaat', 'الهيكل المتوافق مع منشآت'],
    ['pitch', 'عرض المستثمرين'],
    ['investor_one_pager', 'عرض المستثمر بصفحة واحدة'],
    ['accelerator_pitch', 'عرض المسرّعة'],
    ['incubator_pitch', 'عرض الحاضنة'],
    ['crowdfunding_pitch', 'عرض التمويل الجماعي'],
    ['feasibility_plan_summary', 'ملخص خطة العمل والجدوى'],
    ['pitch_script', 'نص العرض التقديمي'],
    ['grant', 'بطاقة المنح'],
]);

export class ExportMenu {
    constructor(overlayId, store) {
        this.overlay = document.getElementById(overlayId);
        // Create overlay if missing
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = overlayId || 'exportMenuOverlay';
            document.body.appendChild(this.overlay);
        }
        // index.html يُعرِّف مسبقاً <div id="exportMenuOverlay"></div> فارغاً بلا كلاس (خارج
        // app-shell) — الفرع أعلاه لا يُنفَّذ أبداً فعلياً، فتبقى النافذة بلا class="modal-overlay"
        // ولا تستجيب لـ.is-open إطلاقاً (X/الخلفية/Escape تزيل is-open لكن النافذة لا تُخفى، فقط
        // F5 "يحلها" لأنه يعيد تحميل الصفحة). نضبط الكلاس هنا دائماً، بصرف النظر عن مصدر العنصر.
        this.overlay.classList.add('modal-overlay');
        this.store = store;
        this.pdfGenerator = new PDFGenerator(store);
    }

    async open() {
        this.render();
        this.overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';

        // Escape + حبس Tab + إعادة التركيز للزر الفاتح — من المساعد المشترك بدل النسخة
        // اليدوية (كانت تحبس Tab لكنها لا تُعيد التركيز إطلاقاً عند الإغلاق).
        if (!this._a11y) {
            this._a11y = attachModalA11y({
                container: this.overlay,
                labelledBy: 'export-modal-title',
                initialFocus: '.export-card',
                onEscape: () => this.close()
            });
        }

        const state = this.store.getState();
        let results = null;
        try { results = runFullModel(state); } catch (_) { }
        const qa = await runQAChecks(state, results);
        this._lastQa = qa;
        const el = this.overlay?.querySelector('#export-qa-badge');
        if (el) this._renderQaSummary(el, qa);

        const studyId = state.projectInfo?.id || state.id || null;
        const reviewEl = this.overlay?.querySelector('#export-review-status-badge');
        if (reviewEl && studyId) {
            try {
                reviewEl.innerHTML = await renderReviewStatusBadge(studyId);
            } catch (_) { /* لا داعٍ لإيقاف بقية القائمة إن فشلت الشارة */ }
        }
    }

    _renderQaSummary(el, qa) {
        const extract = (x, type) => {
            if (typeof x === 'string') return { text: x, hard: type === 'hard' };
            return {
                text: x.message || x.code || '',
                impact: x.impact || '',
                suggestion: x.suggestion || '',
                suggestionAction: x.suggestionAction || null,
                stepIndex: resolveQaStepIndex(x),
                hard: type === 'hard'
            };
        };

        const items = [
            ...(qa.hardErrors || []).map(x => extract(x, 'hard')),
            ...(qa.validationErrors || []).map(x => extract(x, 'hard')),
            ...(qa.softWarnings || []).map(x => extract(x, 'soft')),
            ...(qa.validationWarnings || []).map(x => extract(x, 'soft')),
        ].filter(it => it.text);

        const hardCount = items.filter(it => it.hard).length;
        const softCount = items.length - hardCount;

        let summaryHtml = '';
        if (hardCount > 0) summaryHtml = `<span class="text-danger font-bold">${icon('i-x')} مركز الإصلاح: ${hardCount} عوائق حرجة${softCount ? ` و ${softCount} تحسين` : ''}</span>`;
        else if (softCount > 0) summaryHtml = `<span class="text-warning font-bold">${icon('i-warning')} مركز الإصلاح: ${softCount} تحسين مقترح لجودة التقرير</span>`;
        else summaryHtml = `<span class="text-success font-bold">${icon('i-check')} الدراسة مثالية واجتازت فحص الجودة 100%</span>`;

        if (items.length === 0) {
            el.innerHTML = `<div class="p-3 bg-success/10 border border-success/20 rounded-lg text-center">${summaryHtml}</div>`;
            return;
        }

        const li = (it) => {
            const cls = it.hard ? 'qa-detail-item qa-detail-item--hard' : 'qa-detail-item qa-detail-item--soft';
            if (it.stepIndex != null) {
                return `<li><button type="button" class="${cls}" data-step-index="${it.stepIndex}">${escapeHtml(it.text)}</button></li>`;
            }
            return `<li class="${cls} qa-detail-item--static">${escapeHtml(it.text)}</li>`;
        };

        el.innerHTML = `
            ${summaryHtml}
            <details class="qa-detail-list" ${hardCount > 0 ? 'open' : ''}>
                <summary>عرض تفاصيل فحص الجودة (${items.length})</summary>
                <ul>${items.map(li).join('')}</ul>
            </details>
        `;
    }

    close() {
        this.overlay.classList.remove('is-open');
        document.body.style.overflow = '';
        this._a11y?.release();
        this._a11y = null;
    }

    /**
     * يقفز لخطوة المعالج المسؤولة عن تحذير فحص جودة (دفعة 3، 2026-07-12) — عبر حدث
     * مخصّص (نفس نمط 'feasibility:showInvestorDashboard' الموجود) لأن app.js يملك
     * navigateTo() الفعلية داخل نطاقه الخاص ولا يُصدِّرها لوحدات أخرى.
     */
    _navigateToStep(stepIndex) {
        if (!Number.isInteger(stepIndex) || stepIndex < 0) return;
        this.close();
        window.dispatchEvent(new CustomEvent('feasibility:navigateToStep', { detail: { stepIndex } }));
    }

    render() {
        this.overlay.innerHTML = `
            <div class="modal-card export-modal animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
                <div class="modal-header">
                    <h3 id="export-modal-title">${icon('i-download')} تصدير الدراسة</h3>
                    <button type="button" class="btn-close" aria-label="إغلاق قائمة التصدير">×</button>
                </div>
                <div class="modal-body">
                    <div id="export-qa-badge" class="mb-4 text-sm text-muted">جاري فحص الجودة...</div>
                    <div id="export-confidence-panel" class="mb-4 p-3 rounded-lg border border-white/10 bg-white/5">
                        <strong>درجة موثوقية النتائج</strong>
                        <span class="text-sm text-muted"> تعتمد على اكتمال المدخلات وفحص الجودة الحالي.</span>
                    </div>
                    <div class="flex gap-2 flex-wrap mb-4" id="export-path-selector" aria-label="مسار التصدير">
                        <button type="button" class="export-path-card btn btn--sm btn--primary" data-export-path="lending">تمويل وبنوك</button>
                        <button type="button" class="export-path-card btn btn--sm btn--ghost" data-export-path="investor">مستثمرون ومسرعات</button>
                        <button type="button" class="export-path-card btn btn--sm btn--ghost" data-export-path="data">بيانات ومشاركة</button>
                    </div>
                    <div class="flex gap-2 flex-wrap mb-4">
                        <button type="button" id="btnOpenQaFixCenter" class="btn btn--sm btn--ghost">فتح مركز إصلاح الجودة</button>
                        <button type="button" id="btnOpenDownloadsCenter" class="btn btn--sm btn--ghost">سجل التنزيلات</button>
                    </div>
                    <div id="export-review-status-badge" class="mb-4 text-sm"></div>
                    <div id="export-auto-text-bar" class="mb-4 p-3 rounded-lg border border-white/10 bg-white/5">
                        <p class="text-xs text-muted mb-2">عند حفظ أو قبل التصدير: المنصة يمكنها توليد نصوص الأقسام (الملخص، السوق، المخاطر) من المدخلات تلقائياً. يمكنك مراجعتها وتعديلها بعد التوليد.</p>
                        <button type="button" id="btnExportAutoGenerateText" class="btn btn--sm btn--secondary">${icon('i-sparkle')} توليد النصوص تلقائياً</button>
                    </div>
                    <p class="text-sm text-muted mb-3">صدّر الدراسة — اختر PDF، Word، Excel، أو PPT (ملخص شرائح) حسب حاجتك.</p>
                    <p class="text-xs text-muted mb-2">نطاق التصدير: الدراسة الحالية فقط، أو جميع الدراسات في المجلد (إن وُجد).</p>
                    <p id="export-financing-checklist-hint" class="text-xs text-gold mb-2">للتقديم للتمويل: راجع قائمة تحقق متطلبات التقديم في صفحة «الجدوى والتمويل» من القائمة الرئيسية.</p>
                    <p id="export-accelerator-checklist-hint" class="text-xs text-gold mb-2">للتقديم للمسرّعات والحاضنات: راجع قائمة تحقق متطلبات التقديم في صفحة «نصائح المسرّعات» من لوحة التحكم.</p>
                    <p id="export-bank-report-hint" class="text-xs text-gold mb-2">تقرير جاهز للإقراض: اختر «نسخة للممول» أو «تقرير جاهز للإقراض» — ملخص، استخدام القرض، مالي، ضمانات.</p>
                    <p class="text-xs text-gold/90 mb-3 px-3 py-2 rounded-lg border border-gold/20 bg-gold/5" id="export-compliance-sentence">✓ ${BANK_COMPLIANCE_SENTENCE}</p>
                    <div class="export-category-title mt-4 mb-2 text-gold font-bold">التقارير الأساسية</div>
                    <div class="export-grid">
                        <button type="button" class="export-card" data-type="pdf" aria-label="تصدير تقرير PDF شامل جاهز للطباعة">
                            <div class="icon">${icon('i-doc')}</div>
                            <div class="info">
                                <h4>تقرير PDF شامل</h4>
                                <p>تقرير احترافي جاهز للطباعة مع الرسوم البيانية</p>
                            </div>
                        </button>
                        
                        <button type="button" class="export-card" data-type="excel" aria-label="تصدير ملف Excel بجداول مالية تفصيلية">
                            <div class="icon">${icon('i-chart')}</div>
                            <div class="info">
                                <h4>ملف Excel</h4>
                                <p>جداول مالية تفصيلية بصيغة XLSX</p>
                            </div>
                        </button>

                        <button type="button" class="export-card" data-type="word" aria-label="تصدير تقرير Word DOCX">
                            <div class="icon">${icon('i-pen')}</div>
                            <div class="info">
                                <h4>Word (DOCX)</h4>
                                <p>تقرير نصي قابل للتعديل</p>
                            </div>
                        </button>
                        
                        <button type="button" class="export-card" data-type="pptx" aria-label="تصدير عرض تقديمي PowerPoint PPTX">
                            <div class="icon">${icon('i-slides')}</div>
                            <div class="info">
                                <h4>PowerPoint (PPTX)</h4>
                                <p>عرض تقديمي 7 شرائح للمستثمرين</p>
                            </div>
                        </button>
                        <button type="button" class="export-card" data-type="batch_zip" aria-label="تنزيل حزمة المشروع كاملة (Word + Excel + PowerPoint) في ملف ZIP">
                            <div class="icon">${icon('i-download')}</div>
                            <div class="info">
                                <h4>حزمة المشروع (ZIP)</h4>
                                <p>Word + Excel + PowerPoint دفعة واحدة</p>
                            </div>
                        </button>
                    </div>

                    <div class="export-category-title mt-6 mb-2 text-gold font-bold">للمستثمرين والمسرّعات</div>
                    <div class="export-grid">
                        <button type="button" class="export-card" data-type="pitch" aria-label="تصدير Pitch Deck كـ PDF">
                            <div class="icon">${icon('i-slides')}</div>
                            <div class="info">
                                <h4>Pitch Deck (عرض المستثمر)</h4>
                                <p>شرائح جاهزة للطباعة PDF للمستثمرين</p>
                            </div>
                        </button>

                        <button type="button" class="export-card" data-type="investor_one_pager" aria-label="عرض للمستثمر/المسرّعة — صفحة واحدة">
                            <div class="icon">${icon('i-doc')}</div>
                            <div class="info">
                                <h4>ملخص صفحة واحدة (One Pager)</h4>
                                <p>للمستثمر والمسرعات: الطلب، المؤشرات، والمخاطر</p>
                            </div>
                        </button>

                        <button type="button" class="export-card" data-type="investor_dashboard" aria-label="عرض لوحة المستثمر التفاعلية">
                            <div class="icon">${icon('i-folder')}</div>
                            <div class="info">
                                <h4>لوحة المستثمر (تفاعلية)</h4>
                                <p>عرض ويب احترافي للقراءة والمشاركة المباشرة</p>
                            </div>
                        </button>

                        <button type="button" class="export-card" data-type="pitch_script" aria-label="توليد سكربت العرض التقديمي بالذكاء الاصطناعي">
                            <div class="icon">${icon('i-play')}</div>
                            <div class="info">
                                <h4>Pitch Script بالـ AI</h4>
                                <p>نص عرض تقديمي 1–2 دقيقة للمستثمرين</p>
                            </div>
                        </button>
                    </div>

                    <div class="export-category-title mt-6 mb-2 text-gold font-bold">البنوك وجهات الدعم</div>
                    <div class="export-grid">
                        <button type="button" class="export-card" data-type="lending_ready" aria-label="تقرير جاهز للإقراض — بنك التنمية والمؤسسات التمويلية">
                            <div class="icon">${icon('i-bank')}</div>
                            <div class="info">
                                <h4>جاهز للإقراض (بنك التنمية)</h4>
                                <p>استخدام التمويل، القوائم المالية، والضمانات</p>
                            </div>
                        </button>

                        <button type="button" class="export-card" data-type="monshaat" aria-label="تصدير بهيكل متوافق مع متطلبات منشآت">
                            <div class="icon">${icon('i-clipboard')}</div>
                            <div class="info">
                                <h4>متوافق مع «منشآت»</h4>
                                <p>بأقسام وعناوين مطابقة للنموذج الاسترشادي</p>
                            </div>
                        </button>

                        <button type="button" class="export-card" data-type="financier" aria-label="نسخة للممول — تقرير جاهز للتمويل PDF">
                            <div class="icon">${icon('i-doc')}</div>
                            <div class="info">
                                <h4>نسخة للممول العام</h4>
                                <p>ملخص، مالي، مخاطر، توصية (PDF)</p>
                            </div>
                        </button>

                        <button type="button" class="export-card" data-type="review_copy" aria-label="نسخة للمراجعة — للمراجعة من قبل استشاري">
                            <div class="icon">${icon('i-clipboard')}</div>
                            <div class="info">
                                <h4>نسخة احترافية للمراجعة</h4>
                                <p>تقرير نظيف ومُرقم لإرساله للاستشاري</p>
                            </div>
                        </button>
                    </div>

                    <div class="export-category-title mt-6 mb-2 text-gold font-bold">البيانات والمشاركة</div>
                    <div class="export-grid">
                        <button type="button" class="export-card" data-type="share_link" aria-label="مشاركة الدراسة برابط فعلي بصلاحية عرض">
                            <div class="icon">${icon('i-link')}</div>
                            <div class="info">
                                <h4>رابط مشاركة سريع</h4>
                                <p>رابط عرض مباشر (يُمكن إلغاؤه لاحقاً)</p>
                            </div>
                        </button>

                        <button type="button" class="export-card" data-type="json" aria-label="تنزيل ملف المشروع JSON للنسخ الاحتياطي">
                            <div class="icon">${icon('i-save')}</div>
                            <div class="info">
                                <h4>نسخة احتياطية (JSON)</h4>
                                <p>لحفظ المشروع واستعادته مستقبلاً</p>
                            </div>
                        </button>

                        <button type="button" class="export-card" data-type="csv" aria-label="تصدير ملخص CSV للإكسل أو الجداول">
                            <div class="icon">${icon('i-clipboard')}</div>
                            <div class="info">
                                <h4>تصدير بيانات CSV</h4>
                                <p>للاستيراد السريع في جداول البيانات</p>
                            </div>
                        </button>
                        
                        <button type="button" class="export-card export-card-consultation" data-type="consultation" aria-label="احجز استشارة Zoom مع خبير">
                            <div class="icon">${icon('i-users')}</div>
                            <div class="info">
                                <h4>استشارة مع خبير</h4>
                                <p>اجتماع Zoom مع محلل مالي معتمد</p>
                            </div>
                        </button>
                    </div>
                    <div class="export-grid" id="export-path-additional-options">
                        <button type="button" class="export-card" data-type="accelerator_pitch" aria-label="عرض مسرعة الأعمال">
                            <div class="icon">${icon('i-slides')}</div>
                            <div class="info"><h4>عرض المسرعة</h4><p>نسخة مختصرة لطلبات المسرعات</p></div>
                        </button>
                        <button type="button" class="export-card" data-type="grant" aria-label="بطاقة المنحة">
                            <div class="icon">${icon('i-doc')}</div>
                            <div class="info"><h4>بطاقة المنحة</h4><p>ملخص قابل للتقديم للمنح</p></div>
                        </button>
                        <button type="button" class="export-card" data-type="folder_json" aria-label="تصدير مجلد الدراسات">
                            <div class="icon">${icon('i-folder')}</div>
                            <div class="info"><h4>بيانات المجلد</h4><p>حزمة JSON للدراسات المرتبطة</p></div>
                        </button>
                        <button type="button" class="export-card" data-type="gsheets" aria-label="تصدير إلى Google Sheets">
                            <div class="icon">${icon('i-chart')}</div>
                            <div class="info"><h4>Google Sheets</h4><p>إرسال البيانات إلى جدول خارجي</p></div>
                        </button>
                    </div>
                    <div class="export-next-step mt-4 p-3 rounded-lg border border-border bg-card" style="font-size: 0.9rem;">
                        <strong class="text-gold">الخطوة التالية / استشارة بعد الدراسة:</strong>
                        <p class="text-muted mt-1 mb-0">للمراجعة من قبل استشاري، صدّر <strong>نسخة للمراجعة</strong> وأرسلها لمكتبك. يمكنك أيضاً الرجوع إلى لوحة التحكم وفتح قسم «ما بعد الجدوى» لمراجعة استشاري أو حجز جلسة.</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <p class="text-xs text-muted text-center w-full">تُعالَج ملفات التصدير محلياً على جهازك، باستثناء خياري Google Sheets والاستشارة. (Escape للإغلاق)</p>
                    <p class="text-xs text-muted text-center w-full mt-1">للاطلاع على فحص الجودة (QA) الكامل، راجع لوحة القرار قبل التصدير.</p>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Close actions
        const closeBtn = this.overlay.querySelector('.btn-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // قائمة تحذيرات فحص الجودة المفصّلة (دفعة 3، 2026-07-12) — تفويض الحدث لأن
        // القائمة تُحقن لاحقاً (بعد runQAChecks غير المتزامن) لا وقت bindEvents.
        this.overlay.addEventListener('click', (e) => {
            const btn = e.target.closest('.qa-detail-item[data-step-index]');
            if (btn) this._navigateToStep(Number(btn.dataset.stepIndex));
        });

        // Enloop: توليد النصوص تلقائياً (الملخص، السوق، المخاطر)
        const btnAutoText = this.overlay.querySelector('#btnExportAutoGenerateText');
        if (btnAutoText) {
            btnAutoText.addEventListener('click', async () => {
                btnAutoText.disabled = true;
                btnAutoText.textContent = 'جاري التوليد...';
                const state = this.store.getState();
                const { AIConnector } = await import('../services/AIConnector.js');
                const connector = new AIConnector();
                if (!connector) {
                    toast.warning('خدمة التوليد غير متاحة.');
                    btnAutoText.disabled = false;
                    btnAutoText.innerHTML = `${icon('i-sparkle')} توليد النصوص تلقائياً`;
                    return;
                }
                try {
                    let results = null;
                    try {
                        const { calculateStudy } = await import('../core/engine.js');
                        results = calculateStudy(state);
                    } catch (_) {}
                    const execText = await connector.generateExecutiveSummary(state, results);
                    if (typeof execText === 'string' && execText.trim()) {
                        const prev = (this.store.getState().executiveSummary || {});
                        this.store.update('executiveSummary', { ...prev, projectOverview: execText });
                    }
                    const marketText = await connector.generateMarketAnalysisText(state);
                    if (typeof marketText === 'string' && marketText.trim()) {
                        const marketing = this.store.getState().marketing || {};
                        const marketAnalysis = marketing.marketAnalysis || {};
                        this.store.update('marketing', { ...marketing, marketAnalysis: { ...marketAnalysis, summary: marketText } });
                    }
                    const risksData = await connector.generateRisksForReport(this.store.getState());
                    if (Array.isArray(risksData) && risksData.length > 0) {
                        const riskAnalysis = this.store.getState().riskAnalysis || {};
                        const existing = riskAnalysis.risks || [];
                        const merged = risksData.map(r => ({ ...r, id: r.id || crypto.randomUUID() }));
                        this.store.update('riskAnalysis', { ...riskAnalysis, risks: existing.length ? existing : merged });
                    }
                    if (this.store.notify) this.store.notify();
                    toast.success('تم توليد النصوص تلقائياً. راجع الأقسام أو صدّر التقرير.');
                } catch (err) {
                    console.error('Auto-generate text failed:', err);
                    toast.error('فشل التوليد: ' + (err?.message || 'خطأ'));
                } finally {
                    btnAutoText.disabled = false;
                    btnAutoText.innerHTML = `${icon('i-sparkle')} توليد النصوص تلقائياً`;
                }
            });
        }

        this.overlay.querySelectorAll('.export-path-card').forEach((pathButton) => {
            pathButton.addEventListener('click', () => this._applyExportPath(pathButton.dataset.exportPath));
        });
        this._applyExportPath('lending');

        this.overlay.querySelector('#btnOpenQaFixCenter')?.addEventListener('click', () => this._openQaFixCenter());
        this.overlay.querySelector('#btnOpenDownloadsCenter')?.addEventListener('click', () => {
            // مركز التنزيلات يُفتح عبر المسار الهاشي #/downloads (renderDownloadsRoute) —
            // لا يوجد مستمع لحدث feasibility:showDownloadsCenter فكان الزر ميتاً.
            window.location.hash = '#/downloads';
            this.close();
        });

        // Export actions
        this.overlay.querySelectorAll('.export-card').forEach(btn => {
            btn.addEventListener('click', async () => {
                const type = btn.dataset.type;
                if (!type) return;
                trackEvent('export_click', { format: type });
                if (type === 'consultation') {
                    this.close();
                    const modal = new ConsultationModal('consultationModalOverlay', this.store);
                    modal.open();
                    return;
                }
                if (type === 'share_link') {
                    this.close();
                    const { ShareModal } = await import('./ShareModal.js');
                    const modal = new ShareModal('shareModalOverlay', this.store);
                    await modal.open();
                    return;
                }
                await this.handleExport(type, btn);
            });
        });
    }

    _applyExportPath(path) {
        const allowed = EXPORT_PATHS[path] || EXPORT_PATHS.lending;
        this.overlay.querySelectorAll('.export-path-card').forEach((button) => {
            const active = button.dataset.exportPath === path;
            button.classList.toggle('btn--primary', active);
            button.classList.toggle('btn--ghost', !active);
            button.setAttribute('aria-pressed', String(active));
        });
        this.overlay.querySelectorAll('.export-card[data-type]').forEach((card) => {
            card.hidden = !allowed.has(card.dataset.type);
        });
    }

    async _suggestDraftTables(btn) {
        const originalLabel = btn?.innerHTML || '';
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'جاري تجهيز المسودات...';
        }
        try {
            const state = this.store.getState();
            const projectType = state.projectInfo?.projectType || state.projectInfo?.sector || 'general';
            const suffix = String(projectType).slice(0, 24);
            const draft = {
                revenue: {
                    id: `draft-revenue-${Date.now()}`,
                    service: state.projectInfo?.concept || `منتج ${suffix}`,
                    type: 'operating', customersPerMonth: 0, avgPrice: 0,
                    variableCostRate: 0, growthRate: 0, suggestedDraft: true
                },
                hr: {
                    id: `draft-position-${Date.now()}`,
                    position: 'مدير تشغيل', title: 'مدير تشغيل', count: 1,
                    salary: 0, months: 12, suggestedDraft: true
                },
                marketing: {
                    id: `draft-campaign-${Date.now()}`,
                    name: 'إطلاق أولي', channel: 'رقمي', budget: 0,
                    durationMonths: 1, suggestedDraft: true
                }
            };
            const sections = [
                ['revenue', 'streams', draft.revenue],
                ['hr', 'positions', draft.hr],
                ['marketing', 'campaigns', draft.marketing]
            ];
            for (const [section, path, row] of sections) {
                const existing = Array.isArray(state[section]?.[path]) ? state[section][path] : [];
                if (existing.length === 0) this.store.updatePath(section, path, [row]);
            }
            this.store.notify?.();
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalLabel;
            }
        }
    }

    _openQaFixCenter() {
        const state = this.store.getState();
        const qa = this._lastQa || {};
        const items = [
            ...(qa.hardErrors || []), ...(qa.validationErrors || []),
            ...(qa.softWarnings || []), ...(qa.validationWarnings || [])
        ];
        const overlay = document.createElement('div');
        overlay.id = 'qaFixCenterOverlay';
        overlay.className = 'modal-overlay is-open';
        const projectNeedsName = !String(state.projectInfo?.name || '').trim() && String(state.projectInfo?.concept || '').trim();
        const action = projectNeedsName
            ? `<button type="button" class="btn btn--sm btn--primary qa-fix-action" data-action="project_name">استخدام اسم الفكرة</button>`
            : '';
        const details = items.slice(0, 12).map((item) => {
            const message = typeof item === 'string' ? item : (item.message || item.code || 'مراجعة المدخل');
            const impact = typeof item === 'object' ? (item.impact || 'قد تقل دقة التقرير أو قابليته للتقديم.') : 'قد تقل دقة التقرير أو قابليته للتقديم.';
            return `<div class="qa-fix-item p-3 mb-2 border border-white/10 rounded"><strong>السبب:</strong> ${escapeHtml(message)}<br><strong>الأثر على التقرير:</strong> ${escapeHtml(impact)}</div>`;
        }).join('');
        overlay.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true"><div class="modal-header"><h3 id="qaFixCenterHeading">مركز إصلاح الجودة</h3><button type="button" class="btn-close" aria-label="إغلاق">×</button></div><div class="modal-body">${details || '<p class="text-muted">لا توجد ملاحظات مسجلة.</p>'}${action ? `<div class="mt-3">${action}</div>` : ''}</div></div>`;
        document.body.appendChild(overlay);

        // تدقيق 2026-08-25: هذا السطح يُفتح **فوق** قائمة التصدير المفتوحة، وكان يحمل
        // role="dialog" + aria-modal="true" بلا Escape ولا حبس تركيز ولا إعادة تركيز —
        // أي كذب على قارئ الشاشة. وبعد ترحيل قائمة التصدير إلى الحابس المشترك (يُسجَّل
        // على document بـcapture، بخلاف focusTrap القديم الذي كان على الحاوية) صار حابس
        // القائمة ينتزع التركيز من هذا السطح المتداخل. الترحيل يجعله أعلى openStack
        // فيتولّى مفاتيحه بنفسه، ويسقط الانحدار والعيب معاً.
        const closeFixCenter = () => {
            a11y.release();
            overlay.remove();
        };
        const a11y = attachModalA11y({
            container: overlay,
            labelledBy: 'qaFixCenterHeading',
            initialFocus: '.btn-close',
            onEscape: closeFixCenter
        });
        overlay.querySelector('.btn-close')?.addEventListener('click', closeFixCenter);
        overlay.querySelector('[data-action="project_name"]')?.addEventListener('click', () => {
            const name = String(state.projectInfo?.concept || '').trim();
            this.store.updatePath('projectInfo', 'name', name);
            toast.success('تم اقتراح اسم المشروع من الفكرة.');
        });
    }

    async handleExport(type, btn) {
        // بوابة الترقية (Paywall) — تسبق حتى بوابة الجودة: لا داعٍ لتشغيل المحرك
        // إن كانت الصيغة مقفلة أصلاً.
        // تدقيق 2026-07-09 (أتمتة الدفع): كانت تعرض PaywallModal دائماً بلا أي
        // تحقق فعلي من حالة الدفع — الآن تتحقق من orders.status='paid' الحقيقية
        // (محمية بـRLS، لا يمكن للعميل تزييفها) قبل عرض البوابة؛ دراسة دُفعت
        // فعلاً تتخطى البوابة وتصدّر مباشرة.
        if (PREMIUM_EXPORT_TYPES.has(type)) {
            const state = this.store.getState();
            const studyId = state.projectInfo?.id || state.id || null;
            const alreadyPaid = await hasActivePayment(studyId);
            if (!alreadyPaid) {
                this.close();
                const modal = new PaywallModal('paywallModalOverlay', this.store);
                // سبب القفل + ما سيحصل عليه المستخدم بعد الشراء (بند مراجعة 2026-08-22):
                // كانت الرسالة تكتفي باسم الصيغة المحجوبة بلا أي سياق يوضّح لماذا هي مدفوعة
                // أصلاً أو ماذا يكسبه المستخدم بالضبط بعد الدفع.
                const lockReason = 'هذه الصيغة تقرير نهائي احترافي جاهز للتقديم، وليست بيانات خام — لذلك ضمن الباقات المدفوعة. بعد إتمام الشراء يصبح تصديرها متاحاً فوراً لهذه الدراسة.';
                modal.open(PREMIUM_EXPORT_TYPES.get(type), lockReason);
                return;
            }
        }

        const state = this.store.getState();

        // احسب نتائج النموذج مرة واحدة (تُستخدم في بوابة الجودة وفي التصدير)
        let results = null;
        try { results = runFullModel(state); } catch (e) { }
        if (results && this.store?.update) this.store.update('results', results);

        // ═══ بوابة الجودة الصارمة (QA Gate) ═══
        // لا يخرج أي تقرير موجَّه للعميل/الممول إذا كانت الدراسة ناقصة أو متناقضة.
        // تُستثنى النسخ الاحتياطية للبيانات الخام فقط (JSON / مجلد / تصدير خارجي).
        // تدقيق جولة الموقع 2026-07-20 (بند #12): كان CSV غائباً عن هذه المجموعة فيدخل بوابة
        // الجودة ويُحجب للدراسة الناقصة، بينما JSON (نفس الفئة «مجاني/بيانات خام») يمرّ — تناقض.
        // CSV ملخّص بيانات خام للاستيراد لا تقرير نهائي، فيمرّ بلا حاجز كنيّة التصميم الموثّقة.
        const RAW_EXPORTS = new Set(['json', 'csv', 'folder_json', 'investor_dashboard', 'gsheets']);
        if (!RAW_EXPORTS.has(type)) {
            let qa = null;
            try { qa = await runQAChecks(state, results); } catch (e) { console.warn('QA gate error:', e); }
            if (qa) {
                const hasHard = (qa.hardErrors || []).length > 0;
                const hasSoft = (qa.softWarnings || []).length > 0
                    || (qa.validationErrors || []).length > 0
                    || (qa.validationWarnings || []).length > 0;
                if (hasHard || hasSoft) {
                    const proceed = await this._qaGate(qa, hasHard);
                    if (!proceed) return; // أُلغي التصدير — الأزرار لم تتغيّر بعد
                }
            }
        }

        const originalText = btn.innerHTML;
        const cards = this.overlay.querySelectorAll('.export-card');
        cards.forEach((c) => { c.disabled = true; c.setAttribute('aria-busy', 'true'); });
        btn.classList.add('loading');
        btn.innerHTML = `<div class="spinner"></div> جاري التصدير...`;

        try {

            // تفضيل اللغة المحفوظ من مفتاح اللغة في dvLanguageToggle — النطاق: القوائم المالية
            // والمؤشرات فقط تُصدَّر بعناوين إنجليزية (نفس نطاق النسخة الإنجليزية الفعلية لمنافس
            // حقيقي)، لا واجهة التطبيق نفسها ولا الأقسام النصية التي كتبها المستخدم بالعربية.
            const exportLang = localStorage.getItem('qarar_language') === 'en' ? 'en' : 'ar';

            switch (type) {
                case 'pdf': {
                    const pdfName = await this.pdfGenerator.generate({ lang: exportLang });
                    toast.success(pdfName ? `تم تصدير PDF: ${pdfName}` : 'تم تصدير PDF بنجاح!');
                    break;
                }

                case 'batch_zip':
                case 'pptx':
                case 'word':
                case 'excel': {
                    // Start Background Worker to avoid blocking Main Thread
                    const worker = new Worker(new URL('../../export/exportWorker.js', import.meta.url), { type: 'module' });
                    
                    const result = await new Promise((resolve, reject) => {
                        worker.onmessage = (e) => {
                            const { status, blob, fileName, error } = e.data;
                            if (status === 'success') resolve({ blob, fileName });
                            else reject(new Error(error));
                            worker.terminate();
                        };
                        worker.onerror = (e) => {
                            reject(e);
                            worker.terminate();
                        };
                        worker.postMessage({
                            type,
                            state: this.store.getState(),
                            options: { lang: exportLang }
                        });
                    });

                    const { downloadBlob } = await import('../../export/utils.js');
                    downloadBlob(result.blob, result.fileName);
                    toast.success(`تم التصدير بنجاح: ${result.fileName}`);
                    
                    const { trackExport } = await import('../../export/exportTracking.js');
                    trackExport(result.blob, { fileType: type, fileName: result.fileName, studyId: state.projectInfo?.id, studyName: state.projectInfo?.name });

                    // السجل المحلي (يعمل حتى للزائر غير المسجّل) يُسجَّل الآن مركزياً عبر مستمع
                    // لحدث feasibility:download في LocalExportHistory.js (يغطي كل الصيغ، لا هذا
                    // الفرع فقط) — استدعاء يدوي هنا يُكرِّر القيد مرتين لهذه الصيغة تحديداً.
                    break;
                }

                case 'bank': {
                    const certification = await getCertificationForStudy(state.projectInfo?.id || state.id || null);
                    const html = BankReportGenerator.generateHTML(this.store, { certification });
                    const win = window.open('', '_blank');
                    if (win) {
                        win.document.write(html);
                        win.document.close();
                        win.focus();
                    }
                    const projName = sanitizeFilename(state.projectInfo?.name || 'تقرير_تمويل_بنكي');
                    const bankName = `bank_report_${projName}_${exportDateISO()}.html`;
                    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                    downloadBlob(blob, bankName);
                    if (win) toast.success(`تم فتح التقرير وتنزيل: ${bankName}`);
                    else toast.warning(`تم تنزيل ${bankName}. لفتح التقرير، اسمح بالنوافذ المنبثقة ثم أعد التصدير.`);
                    break;
                }

                case 'financier': {
                    const financierCertification = await getCertificationForStudy(state.projectInfo?.id || state.id || null);
                    const finHtml = BankReportGenerator.generateHTML(this.store, { certification: financierCertification });
                    const finWin = window.open('', '_blank');
                    if (finWin) {
                        finWin.document.write(finHtml);
                        finWin.document.close();
                        finWin.focus();
                        setTimeout(() => finWin.print(), 350);
                        toast.success('تم فتح نسخة للممول — اختر «حفظ كـ PDF» في نافذة الطباعة');
                    } else {
                        toast.error('تعذر فتح النافذة. يرجى السماح بالنوافذ المنبثقة.');
                    }
                    break;
                }

                // تدقيق 2026-07-15: كانت هذه البطاقة تحمل data-type="financier" نفسه (خطأ
                // نسخ-لصق أثناء الإصدار التأسيسي — كلا الزرين أُضيفا بنفس الكوميت)، فتُظهر
                // رسالة "نسخة للممول" حتى عند نقر "تقرير جاهز للإقراض"، ويصعب تمييز الزرّين
                // في سجل التدقيق/الـwebhook. تستخدم نفس مولّد BankReportGenerator (يغطي فعلاً
                // ملخص/استخدام التمويل/القوائم المالية/الضمانات الموصوفة في بطاقتها) مع لافتة
                // مائزة (نفس نمط لافتة review_copy) بدل ناتج مطابق بلا أي تمييز.
                case 'lending_ready': {
                    const lendingCertification = await getCertificationForStudy(state.projectInfo?.id || state.id || null);
                    const lendingBaseHtml = BankReportGenerator.generateHTML(this.store, { certification: lendingCertification });
                    const lendingBanner = '<div style="background:#f0f4f8;border:1px solid #2c5282;padding:10px 20px;margin:0 0 16px;text-align:center;font-weight:600;font-size:11pt;">تقرير جاهز للإقراض — بنية متوافقة مع متطلبات بنك التنمية الاجتماعية</div>';
                    const lendingHtml = lendingBaseHtml.replace(/<body([^>]*)>/i, '<body$1>' + lendingBanner);
                    const lendingWin = window.open('', '_blank');
                    if (lendingWin) {
                        lendingWin.document.write(lendingHtml);
                        lendingWin.document.close();
                        lendingWin.focus();
                        setTimeout(() => lendingWin.print(), 350);
                        toast.success('تم فتح تقرير جاهز للإقراض — اختر «حفظ كـ PDF» في نافذة الطباعة');
                    } else {
                        toast.error('تعذر فتح النافذة. يرجى السماح بالنوافذ المنبثقة.');
                    }
                    const projName = sanitizeFilename(state.projectInfo?.name || 'إقراض');
                    const lendingName = `جاهز_للإقراض_${projName}_${exportDateISO()}.pdf`;
                    const { trackExport } = await import('../../export/exportTracking.js');
                    trackExport(null, { fileType: 'lending_ready', fileName: lendingName, studyId: state.projectInfo?.id, studyName: state.projectInfo?.name });
                    break;
                }

                case 'review_copy': {
                    const reviewCopyCertification = await getCertificationForStudy(state.projectInfo?.id || state.id || null);
                    const baseHtml = BankReportGenerator.generateHTML(this.store, { certification: reviewCopyCertification });
                    const reviewBanner = '<div style="background:#f0f4f8;border:1px solid #2c5282;padding:10px 20px;margin:0 0 16px;text-align:center;font-weight:600;font-size:11pt;">نسخة للمراجعة — للمراجعة من قبل استشاري. تاريخ التصدير: ' + new Date().toLocaleDateString('ar-SA', { dateStyle: 'long' }) + '</div>';
                    const reviewHtml = baseHtml.replace(/<body([^>]*)>/i, '<body$1>' + reviewBanner);
                    const reviewWin = window.open('', '_blank');
                    if (reviewWin) {
                        reviewWin.document.write(reviewHtml);
                        reviewWin.document.close();
                        reviewWin.focus();
                        setTimeout(() => reviewWin.print(), 350);
                        toast.success('تم فتح نسخة للمراجعة — أرسلها لمكتبك أو اختر «حفظ كـ PDF»');
                    } else {
                        toast.error('تعذر فتح النافذة. يرجى السماح بالنوافذ المنبثقة.');
                    }
                    const projName = sanitizeFilename(state.projectInfo?.name || 'مراجعة');
                    const reviewName = `نسخة_للمراجعة_${projName}_${exportDateISO()}.html`;
                    const reviewBlob = new Blob([reviewHtml], { type: 'text/html;charset=utf-8' });
                    downloadBlob(reviewBlob, reviewName);
                    const { trackExport } = await import('../../export/exportTracking.js');
                    trackExport(reviewBlob, { fileType: 'review_copy', fileName: reviewName, studyId: state.projectInfo?.id, studyName: state.projectInfo?.name });
                    break;
                }

                case 'professional_review': {
                    const { ProfessionalReviewReportGenerator } = await import('../../export/ProfessionalReviewReportGenerator.js');
                    const proHtml = ProfessionalReviewReportGenerator.generateHTML(this.store);
                    const proWin = window.open('', '_blank');
                    if (proWin) {
                        proWin.document.write(proHtml);
                        proWin.document.close();
                        proWin.focus();
                        setTimeout(() => proWin.print(), 350);
                        toast.success('تم فتح نسخة احترافية للمراجعة — هيكل مرقّم وفهرس؛ اطبع كـ PDF');
                    } else {
                        toast.error('تعذر فتح النافذة. يرجى السماح بالنوافذ المنبثقة.');
                    }
                    const projName = sanitizeFilename(state.projectInfo?.name || 'نسخة_مراجعة');
                    const proName = `نسخة_احترافية_للمراجعة_${projName}_${exportDateISO()}.html`;
                    downloadBlob(new Blob([proHtml], { type: 'text/html;charset=utf-8' }), proName);
                    const { trackExport } = await import('../../export/exportTracking.js');
                    trackExport(new Blob([proHtml], { type: 'text/html;charset=utf-8' }), { fileType: 'professional_review', fileName: proName, studyId: state.projectInfo?.id, studyName: state.projectInfo?.name });
                    break;
                }

                case 'monshaat': {
                    const monshaatHtml = MonshaatReportGenerator.generateHTML(this.store);
                    const monshaatWin = window.open('', '_blank');
                    if (monshaatWin) {
                        monshaatWin.document.write(monshaatHtml);
                        monshaatWin.document.close();
                        monshaatWin.focus();
                        setTimeout(() => monshaatWin.print(), 350);
                        toast.success('تم فتح تقرير بهيكل منشآت — اختر «حفظ كـ PDF». يُوصى بمراجعة المتطلبات على بوابة منشآت.');
                    } else {
                        toast.error('تعذر فتح النافذة. يرجى السماح بالنوافذ المنبثقة.');
                    }
                    const projName = sanitizeFilename(state.projectInfo?.name || 'منشآت');
                    const monshaatName = `تقرير_منشآت_${projName}_${exportDateISO()}.pdf`;
                    const { trackExport } = await import('../../export/exportTracking.js');
                    trackExport(null, { fileType: 'monshaat', fileName: monshaatName, studyId: state.projectInfo?.id, studyName: state.projectInfo?.name });
                    break;
                }

                case 'csv': {
                    const { exportToCSV } = await import('../../export/csvExporter.js');
                    const fn = state.projectInfo?.name || 'feasibility_study';
                    const csvName = exportToCSV(state, results, fn);
                    toast.success(csvName ? `تم تصدير CSV: ${csvName}` : 'تم تصدير CSV بنجاح!');
                    break;
                }

                case 'pitch': {
                    const { PitchDeckExporter } = await import('../../export/PitchDeckExporter.js');
                    const pitchHtml = PitchDeckExporter.generateHTML(this.store);
                    const win = window.open('', '_blank');
                    if (win) {
                        win.document.write(pitchHtml);
                        win.document.close();
                        win.focus();
                    }
                    const projName = sanitizeFilename(state.projectInfo?.name || 'pitch_deck');
                    const pitchName = `pitch_deck_${projName}_${exportDateISO()}.html`;
                    const pitchBlob = new Blob([pitchHtml], { type: 'text/html;charset=utf-8' });
                    downloadBlob(pitchBlob, pitchName);
                    toast.success(`تم فتح Pitch Deck وتنزيل: ${pitchName} — اختر "حفظ كـ PDF" عند الطباعة`);
                    break;
                }

                case 'investor_one_pager': {
                    const { InvestorAcceleratorOnePager } = await import('../../export/InvestorAcceleratorOnePager.js');
                    const onePagerHtml = InvestorAcceleratorOnePager.generateHTML(this.store, { audience: 'investor' });
                    const win = window.open('', '_blank');
                    if (win) {
                        win.document.write(onePagerHtml);
                        win.document.close();
                        win.focus();
                    }
                    const projName = sanitizeFilename(state.projectInfo?.name || 'investor_pitch');
                    const onePagerName = `عرض_مستثمر_${projName}_${exportDateISO()}.html`;
                    const onePagerBlob = new Blob([onePagerHtml], { type: 'text/html;charset=utf-8' });
                    downloadBlob(onePagerBlob, onePagerName);
                    toast.success(`تم فتح عرض المستثمر/المسرّعة وتنزيل: ${onePagerName} — اطبع كـ PDF`);
                    break;
                }

                case 'accelerator_pitch': {
                    const { InvestorAcceleratorOnePager } = await import('../../export/InvestorAcceleratorOnePager.js');
                    const accHtml = InvestorAcceleratorOnePager.generateHTML(this.store, { audience: 'accelerator' });
                    const accWin = window.open('', '_blank');
                    if (accWin) {
                        accWin.document.write(accHtml);
                        accWin.document.close();
                        accWin.focus();
                    }
                    const projName = sanitizeFilename(state.projectInfo?.name || 'عرض_مسرعة');
                    const accName = `عرض_مسرعة_${projName}_${exportDateISO()}.html`;
                    downloadBlob(new Blob([accHtml], { type: 'text/html;charset=utf-8' }), accName);
                    toast.success(`تم فتح عرض للمسرّعة وتنزيل: ${accName} — اطبع كـ PDF`);
                    break;
                }

                case 'incubator_pitch': {
                    const { InvestorAcceleratorOnePager } = await import('../../export/InvestorAcceleratorOnePager.js');
                    const incHtml = InvestorAcceleratorOnePager.generateHTML(this.store, { audience: 'incubator' });
                    const incWin = window.open('', '_blank');
                    if (incWin) {
                        incWin.document.write(incHtml);
                        incWin.document.close();
                        incWin.focus();
                    }
                    const projName = sanitizeFilename(state.projectInfo?.name || 'عرض_حاضنة');
                    const incName = `عرض_حاضنة_${projName}_${exportDateISO()}.html`;
                    downloadBlob(new Blob([incHtml], { type: 'text/html;charset=utf-8' }), incName);
                    toast.success(`تم فتح عرض للحاضنة وتنزيل: ${incName} — اطبع كـ PDF`);
                    break;
                }

                case 'crowdfunding_pitch': {
                    const { CrowdfundingPitchExporter } = await import('../../export/CrowdfundingPitchExporter.js');
                    const cfHtml = CrowdfundingPitchExporter.generateHTML(this.store);
                    const cfWin = window.open('', '_blank');
                    if (cfWin) {
                        cfWin.document.write(cfHtml);
                        cfWin.document.close();
                        cfWin.focus();
                    }
                    const projName = sanitizeFilename(state.projectInfo?.name || 'تمويل_جماعي');
                    const cfName = `عرض_تمويل_جماعي_${projName}_${exportDateISO()}.html`;
                    downloadBlob(new Blob([cfHtml], { type: 'text/html;charset=utf-8' }), cfName);
                    toast.success(`تم فتح عرض تمويل جماعي وتنزيل: ${cfName} — اطبع كـ PDF للرفع على المنصة`);
                    break;
                }

                case 'feasibility_plan_summary': {
                    const { BusinessPlanFeasibilityExporter } = await import('../../export/BusinessPlanFeasibilityExporter.js');
                    const combinedHtml = BusinessPlanFeasibilityExporter.generateHTML(this.store);
                    const win = window.open('', '_blank');
                    if (win) {
                        win.document.write(combinedHtml);
                        win.document.close();
                        win.focus();
                    }
                    const projName = sanitizeFilename(state.projectInfo?.name || 'خطة_جدوى');
                    const combinedName = `تقرير_جدوى_ملخص_خطة_${projName}_${exportDateISO()}.html`;
                    const combinedBlob = new Blob([combinedHtml], { type: 'text/html;charset=utf-8' });
                    downloadBlob(combinedBlob, combinedName);
                    toast.success(`تم فتح تقرير جدوى + ملخص خطة عمل وتنزيل: ${combinedName} — اطبع كـ PDF`);
                    break;
                }

                case 'pitch_script': {
                    const scriptText = await generatePitchScript(state, results);
                    if (!scriptText) {
                        toast.error('لم يتم توليد السكربت. تحقق من بيانات المشروع أو الخادم.');
                        break;
                    }
                    const scriptBlob = new Blob([scriptText], { type: 'text/plain;charset=utf-8' });
                    const scriptName = `pitch_script_${sanitizeFilename(state.projectInfo?.name || 'project')}_${exportDateISO()}.txt`;
                    downloadBlob(scriptBlob, scriptName);
                    toast.success('تم توليد Pitch Script وتنزيله: ' + scriptName);
                    break;
                }

                case 'grant': {
                    const { exportGrantCard } = await import('../../export/excelExporter.js');
                    const grantName = await exportGrantCard(state, results);
                    toast.success(grantName ? `تم تصدير بطاقة المنح: ${grantName}` : 'تم تصدير بطاقة المنح بنجاح!');
                    break;
                }

                case 'json': {
                    const projName = sanitizeFilename(state.projectInfo?.name || 'study');
                    const jsonName = `study_backup_${projName}_${exportDateISO()}.json`;
                    const json = JSON.stringify(state, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    downloadBlob(blob, jsonName);
                    toast.success(`تم تنزيل ملف المشروع: ${jsonName}`);
                    break;
                }

                case 'folder_json': {
                    const folderId = state.projectInfo?.folderId;
                    if (!folderId) {
                        toast.warning('هذه الدراسة غير مرتبطة بمجلد.');
                        break;
                    }
                    const { ProjectManager } = await import('../services/ProjectManager.js');
                    const all = await ProjectManager.getAllProjects();
                    const inFolder = (all || []).filter(p => (p.folderId || null) === folderId);
                    if (inFolder.length === 0) {
                        toast.warning('لا توجد دراسات أخرى في هذا المجلد.');
                        break;
                    }
                    let folders = [];
                    try {
                        folders = JSON.parse(localStorage.getItem('feas_folders') || '[]');
                    } catch (_) {}
                    const folderName = (folders.find(f => f.id === folderId)?.name || 'مجلد').replace(/\s+/g, '_');
                    const studies = [];
                    for (const p of inFolder) {
                        try {
                            const res = await ProjectManager.loadProject(p.id);
                            if (res?.data) studies.push({ id: p.id, name: p.name || 'بدون اسم', data: res.data });
                        } catch (_) {}
                    }
                    const payload = { folderId, folderName, exportedAt: new Date().toISOString(), count: studies.length, studies };
                    const jsonName = `folder_${sanitizeFilename(folderName)}_${exportDateISO()}.json`;
                    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                    downloadBlob(blob, jsonName);
                    toast.success(`تم تنزيل حزمة المجلد: ${studies.length} دراسة — ${jsonName}`);
                    break;
                }

                case 'gsheets': {
                    const { exportToGoogleSheets, showGoogleSheetsSetup } = await import('../services/GoogleSheetsService.js');
                    const hasUrl = localStorage.getItem('GOOGLE_SHEETS_WEB_APP_URL');
                    if (!hasUrl) {
                        this.close();
                        showGoogleSheetsSetup();
                        toast.info('يرجى إعداد Google Sheets أولاً');
                        break;
                    }
                    const result = await exportToGoogleSheets(state, results);
                    if (result.ok) {
                        toast.success('تم التصدير إلى Google Sheets');
                    } else {
                        toast.error('فشل التصدير: ' + result.error);
                    }
                    break;
                }

                case 'investor_dashboard': {
                    window.dispatchEvent(new CustomEvent('feasibility:showInvestorDashboard'));
                    this.close();
                    break;
                }
            }
            try {
                const { WebhookService } = await import('../services/WebhookService.js');
                WebhookService.triggerEvent('report.exported', {
                    format: type,
                    study_id: state.projectInfo?.id,
                    project_name: state.projectInfo?.name,
                });
            } catch (_) { }
            auditLog(ACTIONS.EXPORT, { type });
        } catch (error) {
            console.error('Export failed:', error);
            const msg = error?.message && /تحميل|Excel|load|فشل|مهلة/.test(String(error.message))
                ? 'فشل تحميل مكتبة التصدير أو اكتمال البيانات. تحقق من الاتصال وحاول مجدداً.'
                : 'حدث خطأ أثناء التصدير. إن استمر تحقق من اكتمال البيانات.';
            toast.error(msg);
        } finally {
            btn.innerHTML = originalText;
            btn.classList.remove('loading');
            const cards = this.overlay.querySelectorAll('.export-card');
            cards.forEach((c) => { c.disabled = false; c.removeAttribute('aria-busy'); });
            if (type !== 'bank') this.close();
        }
    }

    /**
     * بوابة الجودة: حوار يمنع التصدير عند وجود أخطاء جوهرية (hard)،
     * أو يطلب إقراراً صريحاً عند وجود تنبيهات (soft). تُرجع Promise<boolean> (true = أكمل).
     */
    _qaGate(qa, hasHard) {
        return new Promise((resolve) => {
            const esc = escapeHtml;
            // تدقيق دفعة 3 (2026-07-12): كل بند أصبح قابلاً للنقر يقفز لخطوته (نفس
            // resolveQaStepIndex المستخدم في شارة #export-qa-badge) بدل نص ثابت فقط.
            const objs = (arr) => (arr || [])
                .map((x) => ({
                    text: (typeof x === 'string' ? x : (x && (x.message || x.code)) || ''),
                    stepIndex: resolveQaStepIndex(typeof x === 'string' ? {} : x)
                }))
                .filter((it) => it.text);
            const hard = objs(qa.hardErrors);
            const soft = [...objs(qa.softWarnings), ...objs(qa.validationErrors), ...objs(qa.validationWarnings)];

            const li = (items, color) => items.map((it) => {
                const clickable = it.stepIndex != null;
                const dataAttr = clickable ? ` data-step-index="${it.stepIndex}"` : '';
                const hint = clickable ? ' <span style="opacity:.6;font-size:12px;">(انقر للانتقال إلى القسم)</span>' : '';
                return `<li${dataAttr} style="position:relative;padding:8px 20px 8px 0;font-size:14px;line-height:1.6;color:#3B463F;border-bottom:1px solid #ECEBE2;${clickable ? 'cursor:pointer;' : ''}"><span style="position:absolute;right:0;top:12px;width:7px;height:7px;border-radius:2px;background:${color};"></span>${esc(it.text)}${hint}</li>`;
            }).join('');

            const sections = [];
            if (hard.length) sections.push(
                `<div style="font-weight:800;font-size:13px;color:#B4453B;margin:6px 0 4px;">أخطاء تمنع التصدير — يجب إصلاحها:</div><ul style="list-style:none;margin:0 0 10px;padding:0;">${li(hard, '#B4453B')}</ul>`);
            if (soft.length) sections.push(
                `<div style="font-weight:800;font-size:13px;color:#C0982E;margin:10px 0 4px;">تنبيهات تحتاج مراجعتك:</div><ul style="list-style:none;margin:0;padding:0;">${li(soft, '#C0982E')}</ul>`);

            const title = hasHard ? `${icon('i-hand-stop')} لا يمكن تصدير الدراسة بعد` : `${icon('i-warning')} مراجعة الجودة قبل التصدير`;
            const subtitle = hasHard
                ? 'حمايةً لسمعتك: الدراسة غير مكتملة أو تحتوي تناقضاً. أصلِح النقاط التالية ثم أعِد التصدير.'
                : 'الدراسة قابلة للتصدير، لكن راجِع هذه التنبيهات أولاً. تقدر تُكمل إذا كنت متأكداً.';

            const buttons = hasHard
                ? `<button data-act="cancel" style="flex:1;font-family:inherit;font-size:14px;font-weight:800;padding:12px;border-radius:10px;border:0;background:#0E5B44;color:#fff;cursor:pointer;">الرجوع لإصلاح الدراسة</button>`
                : `<button data-act="cancel" style="flex:1;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:10px;border:1px solid #DBD9CE;background:#fff;color:#3B463F;cursor:pointer;">مراجعة أولاً</button><button data-act="proceed" style="flex:1;font-family:inherit;font-size:14px;font-weight:800;padding:12px;border-radius:10px;border:0;background:#0E5B44;color:#fff;cursor:pointer;">أوافق وأكمل التصدير</button>`;

            const ov = document.createElement('div');
            ov.className = 'qa-gate-overlay';
            ov.setAttribute('role', 'dialog');
            ov.setAttribute('aria-modal', 'true');
            ov.style.cssText = 'position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;background:rgba(10,33,28,.55);backdrop-filter:blur(4px);padding:20px;';
            ov.innerHTML =
                `<div dir="rtl" style="max-width:520px;width:100%;background:#FBFAF6;border-radius:16px;box-shadow:0 24px 60px -20px rgba(10,33,28,.6);overflow:hidden;font-family:inherit;">
                   <div style="padding:22px 24px 6px;">
                     <div style="font-size:18px;font-weight:800;color:#16211C;">${title}</div>
                     <div style="font-size:13.5px;color:#6C766E;margin-top:8px;line-height:1.7;">${subtitle}</div>
                   </div>
                   <div style="padding:8px 24px 4px;max-height:46vh;overflow-y:auto;">${sections.join('')}</div>
                   <div style="display:flex;gap:10px;padding:16px 24px 22px;">${buttons}</div>
                 </div>`;
            document.body.appendChild(ov);

            // تدقيق 2026-08-25: بوابة الجودة تُفتح **فوق** قائمة التصدير المفتوحة. بعد
            // ترحيل القائمة إلى الحابس المشترك (يُسجَّل على document بـcapture، بخلاف
            // focusTrap القديم الذي كان على الحاوية) صار حابس القائمة يرى Tab الصادر من
            // هذه البوابة فينتزع التركيز إليها — فيصبح زر «مراجعة أولاً» غير قابل للوصول
            // بلوحة المفاتيح إطلاقاً. الترحيل يجعل البوابة أعلى openStack فتتولّى مفاتيحها
            // بنفسها. (كانت أيضاً تُعلن aria-modal بلا حبس تركيز — ادّعاء غير صحيح.)
            const done = (val) => { a11y.release(); ov.remove(); resolve(val); };
            const a11y = attachModalA11y({
                container: ov,
                dialog: ov,
                label: hasHard ? 'لا يمكن تصدير الدراسة بعد' : 'مراجعة الجودة قبل التصدير',
                initialFocus: () => ov.querySelector('button[data-act="proceed"]') || ov.querySelector('button[data-act="cancel"]'),
                focusDelay: 0,
                onEscape: () => done(false)
            });
            ov.addEventListener('click', (e) => { if (e.target === ov) done(false); });
            ov.querySelectorAll('button[data-act]').forEach((b) => {
                b.addEventListener('click', () => done(b.dataset.act === 'proceed'));
            });
            ov.querySelectorAll('li[data-step-index]').forEach((liEl) => {
                liEl.addEventListener('click', () => {
                    const stepIndex = Number(liEl.dataset.stepIndex);
                    done(false);
                    this._navigateToStep(stepIndex);
                });
            });
            // التركيز الأولي يتولّاه attachModalA11y عبر initialFocus أعلاه.
        });
    }
}

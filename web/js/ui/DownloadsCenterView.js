/**
 * DownloadsCenterView — مركز التنزيلات (export_history + Supabase Storage
 * 'exports'، انظر migration 20260716000002_dashboard_experience.sql). محمية
 * بالدخول (نفس أسلوب BillingHistoryView.js). تصدير PDF غير مُغطّى هنا —
 * قيد معماري موثَّق في web/export/exportTracking.js (لا Blob يُنتَج إطلاقاً).
 */
import { getAuthUser, getSupabaseClient } from '../../supabaseClient.js';
import { listLocalExports } from '../services/LocalExportHistory.js';
import { escapeHtml } from '../utils/escape.js';
import { toast } from '../utils/toast.js';

const DOWNLOAD_FAILURE_MESSAGE = 'تعذّر تحضير رابط التنزيل — سجّل الدخول من جديد أو أعد التصدير من دراستك';

const FILE_TYPE_LABEL = { 
    word: 'Word', excel: 'Excel', pptx: 'PowerPoint', csv: 'CSV', json: 'JSON', html: 'HTML', pdf: 'PDF', file: 'ملف', batch_zip: 'حزمة (ZIP)',
    bank: 'تقرير بنكي', financier: 'للممول', lending_ready: 'جاهز للإقراض', 
    review_copy: 'للمراجعة', professional_review: 'مراجعة احترافية', monshaat: 'تقرير منشآت' 
};
const QA_LABEL = {
    ready: ['جاهز', 'badge--success'],
    warning: ['تنبيهات', 'badge--warning'],
    blocked: ['نواقص مانعة', 'badge--danger']
};

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', numberingSystem: 'latn' });
}

function formatSize(size) {
    const n = Number(size || 0);
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function qaBadge(qa) {
    if (!qa) return '<span class="badge badge--neutral">لم يُفحص</span>';
    const [label, cls] = QA_LABEL[qa.status] || QA_LABEL.warning;
    return `<span class="badge ${cls}">${label} ${Number.isFinite(qa.readiness) ? `${qa.readiness}%` : ''}</span>`;
}

export class DownloadsCenterView {
    /**
     * @param {HTMLElement} container
     * @param {object} options - { onBack: () => void, onRegenerate: () => void }
     */
    constructor(container, options = {}) {
        this.container = container;
        this.onBack = options.onBack || (() => {});
        this.onRegenerate = options.onRegenerate || (() => {});
    }

    async render() {
        if (!this.container) return;

        const { user } = await getAuthUser();
        const { supabase, ok } = await getSupabaseClient();
        
        let items = [];
        if (user && ok && supabase) {
            items = (await supabase.from('export_history').select('id, study_name, file_type, storage_path, created_at').order('created_at', { ascending: false })).data || [];
        }
        const localItems = listLocalExports();

        this.container.innerHTML = `
            <div class="downloads-center-page" style="max-width: 720px; margin: 0 auto; padding: var(--s-4) 0;">
                <button type="button" id="btnDownloadsBack" class="btn btn--ghost mb-4" style="display: inline-flex; align-items: center; gap: 8px;">
                    ← العودة للدراسة
                </button>

                <div class="card p-6">
                    <h2 class="text-xl font-bold mb-4" style="border-bottom: 1px solid var(--c-border); padding-bottom: var(--s-2);">مركز التنزيلات</h2>
                    <p class="text-xs text-muted mb-4">الملفات السحابية قابلة للتنزيل المباشر عند تسجيل الدخول. السجل المحلي يحفظ ما خرج من جهازك ويتيح إعادة توليد الملف من قائمة التصدير.</p>

                    <h3 class="text-base font-bold mb-2">محفوظ سحابياً</h3>
                    ${items.length === 0 ? `
                        <p class="text-muted mb-4">لا توجد تصديرات محفوظة سحابياً حتى الآن.</p>
                    ` : `
                        <div class="space-y-3 mb-5">
                            ${items.map((it) => `
                                <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                                    <div>
                                        <div class="font-bold">${escapeHtml(it.study_name || 'دراسة')} <span class="badge badge--neutral">${FILE_TYPE_LABEL[it.file_type] || it.file_type}</span></div>
                                        <div class="text-xs text-muted mt-1">${formatDate(it.created_at)}</div>
                                    </div>
                                    ${it.storage_path ? `<button type="button" class="btn btn--sm btn--secondary dv-download-item" data-storage-path="${it.storage_path}">تنزيل</button>` : `<button type="button" class="btn btn--sm btn--secondary dv-regenerate-export">إعادة التصدير</button>`}
                                </div>
                            `).join('')}
                        </div>
                    `}

                    <h3 class="text-base font-bold mb-2">السجل المحلي</h3>
                    ${localItems.length === 0 ? `
                        <p class="text-muted">لم يتم تسجيل تنزيلات محلية بعد.</p>
                    ` : `
                        <div class="space-y-3">
                            ${localItems.map((it) => `
                                <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                                    <div>
                                        <div class="font-bold">${escapeHtml(it.filename || 'ملف')} <span class="badge badge--neutral">${FILE_TYPE_LABEL[it.fileType] || escapeHtml(it.fileType || 'ملف')}</span></div>
                                        <div class="text-xs text-muted mt-1">${escapeHtml(it.studyName || 'دراسة')} · ${formatDate(it.createdAt)} · ${formatSize(it.size)} · ${qaBadge(it.qa)}</div>
                                    </div>
                                    <button type="button" class="btn btn--sm btn--secondary dv-regenerate-export">إعادة توليد</button>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;

        this.container.querySelector('#btnDownloadsBack')?.addEventListener('click', () => this.onBack());
        this.container.querySelectorAll('.dv-download-item').forEach(btn => {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.textContent = 'جاري التحضير...';
                const { supabase: sb, ok: sbOk } = await getSupabaseClient();
                if (sbOk && sb) {
                    const { data, error } = await sb.storage.from('exports').createSignedUrl(btn.dataset.storagePath, 60);
                    if (!error && data?.signedUrl) {
                        window.open(data.signedUrl, '_blank', 'noopener');
                    } else {
                        toast.error(DOWNLOAD_FAILURE_MESSAGE);
                    }
                } else {
                    toast.error(DOWNLOAD_FAILURE_MESSAGE);
                }
                btn.disabled = false;
                btn.textContent = 'تنزيل';
            });
        });
        this.container.querySelectorAll('.dv-regenerate-export').forEach(btn => {
            btn.addEventListener('click', () => this.onRegenerate());
        });
    }
}

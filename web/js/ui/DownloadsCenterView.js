/**
 * DownloadsCenterView — مركز التنزيلات (export_history + Supabase Storage
 * 'exports'، انظر migration 20260716000002_dashboard_experience.sql). محمية
 * بالدخول (نفس أسلوب BillingHistoryView.js). تصدير PDF غير مُغطّى هنا —
 * قيد معماري موثَّق في web/export/exportTracking.js (لا Blob يُنتَج إطلاقاً).
 */
import { getAuthUser, getSupabaseClient } from '../../supabaseClient.js';
import { AuthGuard } from '../middleware/AuthGuard.js';
import { escapeHtml } from '../utils/escape.js';

const FILE_TYPE_LABEL = { word: 'Word', excel: 'Excel', pptx: 'PowerPoint' };

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', numberingSystem: 'latn' });
}

export class DownloadsCenterView {
    /**
     * @param {HTMLElement} container
     * @param {object} options - { onBack: () => void }
     */
    constructor(container, options = {}) {
        this.container = container;
        this.onBack = options.onBack || (() => {});
    }

    async render() {
        if (!this.container) return;

        const { user } = await getAuthUser();
        if (!user) {
            this.container.innerHTML = `
                <div class="downloads-center-view" style="max-width:560px;margin:60px auto;text-align:center;padding:24px;">
                    <p class="text-muted mb-4">يجب تسجيل الدخول لعرض مركز التنزيلات.</p>
                    <button type="button" id="btnDownloadsLogin" class="btn btn--primary">تسجيل الدخول</button>
                </div>
            `;
            this.container.querySelector('#btnDownloadsLogin')?.addEventListener('click', () => {
                AuthGuard.showAuthPrompt(({ isAuthenticated }) => { if (isAuthenticated) this.render(); });
            });
            return;
        }

        const { supabase, ok } = await getSupabaseClient();
        const items = (ok && supabase)
            ? (await supabase.from('export_history').select('id, study_name, file_type, storage_path, created_at').order('created_at', { ascending: false })).data || []
            : [];

        this.container.innerHTML = `
            <div class="downloads-center-page" style="max-width: 720px; margin: 0 auto; padding: var(--s-4) 0;">
                <button type="button" id="btnDownloadsBack" class="btn btn--ghost mb-4" style="display: inline-flex; align-items: center; gap: 8px;">
                    ← العودة للدراسة
                </button>

                <div class="card p-6">
                    <h2 class="text-xl font-bold mb-4" style="border-bottom: 1px solid var(--c-border); padding-bottom: var(--s-2);">مركز التنزيلات</h2>
                    <p class="text-xs text-muted mb-4">نسخ Word/Excel/PowerPoint من تصديراتك السابقة. تصدير PDF لا يُحفَظ هنا (يعتمد على نافذة الطباعة مباشرة).</p>

                    ${items.length === 0 ? `
                        <p class="text-muted">لا توجد تصديرات محفوظة حتى الآن.</p>
                    ` : `
                        <div class="space-y-3">
                            ${items.map((it) => `
                                <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                                    <div>
                                        <div class="font-bold">${escapeHtml(it.study_name || 'دراسة')} <span class="badge badge--neutral">${FILE_TYPE_LABEL[it.file_type] || it.file_type}</span></div>
                                        <div class="text-xs text-muted mt-1">${formatDate(it.created_at)}</div>
                                    </div>
                                    <button type="button" class="btn btn--sm btn--secondary dv-download-item" data-storage-path="${it.storage_path}">تنزيل</button>
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
                    if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
                }
                btn.disabled = false;
                btn.textContent = 'تنزيل';
            });
        });
    }
}

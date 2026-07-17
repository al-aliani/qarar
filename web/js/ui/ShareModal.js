/**
 * ShareModal — إدارة روابط مشاركة فعلية بصلاحيات (2026-07-14). يُفتح من
 * ExportMenu.js (بطاقة "مشاركة الدراسة"). يعرض الروابط النشطة الحالية مع
 * خيار إلغاء، وزر لإنشاء رابط جديد (صلاحية 'view' فقط هذه الجولة).
 */
import { createShareLink, listShares, revokeShare } from '../services/ShareService.js';
import { toast } from '../utils/toast.js';

function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildShareUrl(token) {
    return `${window.location.origin}${window.location.pathname}#/share/${token}`;
}

export class ShareModal {
    constructor(overlayId, store) {
        this.overlay = document.getElementById(overlayId);
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = overlayId || 'shareModalOverlay';
            this.overlay.className = 'modal-overlay';
            document.body.appendChild(this.overlay);
        }
        this.store = store;
    }

    async open() {
        const state = this.store?.getState?.() || {};
        this.studyId = state.projectInfo?.id || state.id || null;
        this.overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        this._onEscape = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._onEscape);
        await this.render();
    }

    close() {
        this.overlay.classList.remove('is-open');
        document.body.style.overflow = '';
        if (this._onEscape) {
            document.removeEventListener('keydown', this._onEscape);
            this._onEscape = null;
        }
    }

    async render() {
        if (!this.studyId) {
            this.overlay.innerHTML = this._wrap('<p class="text-sm text-muted">احفظ الدراسة أولاً قبل إنشاء رابط مشاركة.</p>');
            this._bindClose();
            return;
        }

        this.overlay.innerHTML = this._wrap('<p class="text-sm text-muted">جارٍ تحميل روابط المشاركة…</p>');
        this._bindClose();

        const shares = await listShares(this.studyId);
        const activeShares = shares.filter((s) => !s.revoked);

        const rows = activeShares.length
            ? activeShares.map((s) => `
                <div class="share-link-row" data-share-id="${escapeHtml(s.id)}" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--c-border,#2a2a2a);">
                    <input type="text" readonly value="${escapeHtml(buildShareUrl(s.shareToken))}" class="input input--sm" style="flex:1;font-size:0.8rem;" />
                    <button type="button" class="btn btn--sm btn--ghost btn-copy-share" data-url="${escapeHtml(buildShareUrl(s.shareToken))}">نسخ</button>
                    <button type="button" class="btn btn--sm btn--ghost btn-revoke-share" style="color:#c53030;">إلغاء</button>
                </div>
            `).join('')
            : '<p class="text-sm text-muted">لا توجد روابط مشاركة نشطة بعد.</p>';

        this.overlay.innerHTML = this._wrap(`
            <div id="shareLinksList">${rows}</div>
            <button type="button" id="btnCreateShareLink" class="btn btn--primary btn-block mt-3">+ إنشاء رابط مشاركة جديد</button>
            <p class="text-xs text-muted mt-2">أي شخص يملك الرابط يستطيع عرض الدراسة (قراءة فقط) بلا حاجة حساب.</p>
        `);
        this._bindClose();
        this._bindActions();
    }

    _wrap(bodyHtml) {
        return `
            <div class="modal-card share-modal animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
                <div class="modal-header">
                    <h3 id="share-modal-title">مشاركة الدراسة</h3>
                    <button type="button" class="btn-close" aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body">${bodyHtml}</div>
            </div>
        `;
    }

    _bindClose() {
        this.overlay.querySelector('.btn-close')?.addEventListener('click', () => this.close());
    }

    _bindActions() {
        this.overlay.querySelector('#btnCreateShareLink')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            const result = await createShareLink(this.studyId);
            if (!result.ok) {
                toast.error(result.error || 'فشل إنشاء رابط المشاركة');
                btn.disabled = false;
                return;
            }
            const url = buildShareUrl(result.shareToken);
            try {
                await navigator.clipboard.writeText(url);
                toast.success('تم إنشاء الرابط ونسخه للحافظة');
            } catch (_) {
                toast.success('تم إنشاء الرابط: ' + url);
            }
            await this.render();
        });

        this.overlay.querySelectorAll('.btn-copy-share').forEach((btn) => {
            btn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(btn.dataset.url);
                    toast.success('تم نسخ الرابط');
                } catch (_) {
                    toast.info(btn.dataset.url);
                }
            });
        });

        this.overlay.querySelectorAll('.btn-revoke-share').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const row = btn.closest('.share-link-row');
                const shareId = row?.dataset.shareId;
                if (!shareId) return;
                btn.disabled = true;
                const result = await revokeShare(shareId);
                if (!result.ok) {
                    toast.error(result.error || 'فشل إلغاء الرابط');
                    btn.disabled = false;
                    return;
                }
                toast.success('تم إلغاء الرابط');
                await this.render();
            });
        });
    }
}

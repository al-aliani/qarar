/**
 * ReviewerDashboardView — بوابة مراجعي الخبراء (2026-07-13).
 * صفحة مغمورة بلا شريط جانبي (نفس نمط ShareView.js)، مقصورة على مستخدمين
 * أعضاء فعلياً في جدول reviewers (AuthGuard.isReviewer) — أي مستخدم آخر يصل
 * لهذا المسار يُعاد توجيهه فوراً بلا أي محاولة عرض بيانات.
 *
 * فتح دراسة "قيد المراجعة عندي" لا يبني عارضاً موازياً: يقرأ studies.data
 * (مسموح الآن عبر سياسة studies_select_reviewer) ويمرّره لمولّد التقرير
 * البنكي الموجود أصلاً (BankReportGenerator) داخل نافذة جديدة — نفس التقرير
 * الذي يراه العميل، فالمراجع يحكم على نفس المستند لا نسخة مختلفة عنه.
 */
import { AuthGuard } from '../middleware/AuthGuard.js';
import { getSupabaseClient } from '../../supabaseClient.js';
import { fetchQueue, claimOrder, submitReview } from '../services/ReviewerService.js';
import { toast } from '../utils/toast.js';
import { escapeHtml } from '../utils/escape.js';

export class ReviewerDashboardView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.queue = [];
        this.myClaims = [];
    }

    async render() {
        const isReviewer = await AuthGuard.isReviewer();
        if (!isReviewer) {
            toast.error('هذه الصفحة مخصّصة لمراجعين معتمدين فقط');
            window.location.hash = '';
            return;
        }

        this.container.innerHTML = `<div class="reviewer-dashboard p-6 max-w-5xl mx-auto"><p class="text-muted">جارٍ تحميل الطابور…</p></div>`;

        const result = await fetchQueue();
        if (!result.ok) {
            this.container.innerHTML = `<div class="reviewer-dashboard p-6 max-w-5xl mx-auto"><p class="text-danger">تعذّر تحميل الطابور: ${this._esc(result.error)}</p></div>`;
            return;
        }

        this.queue = result.queue;
        this.myClaims = result.myClaims;
        this._renderList();
        this.bindEvents();
    }

    _esc(value) {
        return escapeHtml(value);
    }

    _renderQueueItem(item) {
        return `<div class="reviewer-card card flex items-center justify-between gap-4" data-order-id="${this._esc(item.orderId)}">
            <div>
                <div class="font-bold">${this._esc(item.studyTitle || 'دراسة بلا عنوان')}</div>
                <div class="text-xs text-muted">${this._esc(item.sector || '—')} · دُفعت ${item.paidAt ? new Date(item.paidAt).toLocaleDateString('ar-SA') : '—'}</div>
            </div>
            <button class="btn btn--sm btn--primary btn-claim" data-order-id="${this._esc(item.orderId)}">ادّعاء المراجعة</button>
        </div>`;
    }

    _renderClaimItem(item) {
        return `<div class="reviewer-card card" data-order-id="${this._esc(item.orderId)}" data-study-id="${this._esc(item.studyId || '')}">
            <div class="flex items-center justify-between gap-4 mb-3">
                <div>
                    <div class="font-bold">${this._esc(item.studyTitle || 'دراسة بلا عنوان')}</div>
                    <div class="text-xs text-muted">${this._esc(item.sector || '—')}</div>
                </div>
                <button class="btn btn--sm btn--ghost btn-open">فتح للمراجعة ↗</button>
            </div>
            <textarea class="review-notes w-full rounded-lg text-sm" rows="2" placeholder="ملاحظات المراجعة (اختياري)"></textarea>
            <div class="flex gap-2 mt-2">
                <button class="btn btn--sm btn--primary btn-certify">اعتماد ✓</button>
                <button class="btn btn--sm btn--ghost btn-reject" style="color:#c53030;">رفض</button>
            </div>
        </div>`;
    }

    _renderList() {
        this.container.innerHTML = `
            <div class="reviewer-dashboard p-6 max-w-5xl mx-auto">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-2xl font-bold">بوابة المراجعين</h1>
                    <button id="btnExitReviewer" class="btn btn--sm btn--ghost">خروج</button>
                </div>

                <section class="mb-8">
                    <h2 class="text-lg font-bold mb-3">الطابور (${this.queue.length})</h2>
                    ${this.queue.length ? this.queue.map((i) => this._renderQueueItem(i)).join('') : '<p class="text-muted text-sm">لا توجد طلبات بانتظار مراجع حالياً.</p>'}
                </section>

                <section>
                    <h2 class="text-lg font-bold mb-3">قيد المراجعة عندي (${this.myClaims.length})</h2>
                    ${this.myClaims.length ? this.myClaims.map((i) => this._renderClaimItem(i)).join('') : '<p class="text-muted text-sm">لم تدّعِ أي طلب بعد.</p>'}
                </section>
            </div>
        `;
    }

    bindEvents() {
        this.container.querySelector('#btnExitReviewer')?.addEventListener('click', () => {
            window.location.hash = '';
        });

        this.container.querySelectorAll('.btn-claim').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const orderId = btn.dataset.orderId;
                btn.disabled = true;
                const result = await claimOrder(orderId);
                if (!result.ok) {
                    toast.error(result.error || 'فشل الادّعاء');
                    btn.disabled = false;
                    if (result.alreadyClaimed) await this.render(); // أعد التحميل لإزالة الطلب من الطابور
                    return;
                }
                toast.success('تم ادّعاء الطلب — انتقل إلى «قيد المراجعة عندي»');
                await this.render();
            });
        });

        this.container.querySelectorAll('.reviewer-card[data-study-id]').forEach((card) => {
            const studyId = card.dataset.studyId;
            const orderId = card.dataset.orderId;

            card.querySelector('.btn-open')?.addEventListener('click', () => this._openStudyPreview(studyId));

            card.querySelector('.btn-certify')?.addEventListener('click', () => {
                const notes = card.querySelector('.review-notes')?.value || '';
                this._submit(orderId, 'certified', notes);
            });
            card.querySelector('.btn-reject')?.addEventListener('click', () => {
                const notes = card.querySelector('.review-notes')?.value || '';
                if (!notes.trim()) {
                    toast.warning('الرجاء إضافة ملاحظة توضّح سبب الرفض قبل الإرسال');
                    return;
                }
                this._submit(orderId, 'rejected', notes);
            });
        });
    }

    async _submit(orderId, decision, notes) {
        const result = await submitReview(orderId, decision, notes);
        if (!result.ok) {
            toast.error(result.error || 'فشل إرسال المراجعة');
            return;
        }
        toast.success(decision === 'certified' ? `تم الاعتماد — رقم الشهادة: ${result.certificateId}` : 'تم تسجيل الرفض');
        await this.render();
    }

    async _openStudyPreview(studyId) {
        if (!studyId) {
            toast.error('لا يوجد معرّف دراسة مرتبط بهذا الطلب');
            return;
        }
        const { supabase, ok } = await getSupabaseClient();
        if (!ok || !supabase) {
            toast.error('تعذّر الاتصال بقاعدة البيانات');
            return;
        }

        const { data, error } = await supabase.from('studies').select('data').eq('id', studyId).maybeSingle();
        if (error || !data) {
            toast.error('تعذّر جلب بيانات الدراسة — تأكد أنك ادّعيت الطلب المرتبط بها');
            return;
        }

        try {
            const { BankReportGenerator } = await import('../../export/BankReportGenerator.js');
            const fakeStore = { getState: () => data.data };
            const html = BankReportGenerator.generateHTML(fakeStore);
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(html);
                win.document.close();
            } else {
                toast.warning('يرجى السماح بالنوافذ المنبثقة لعرض التقرير');
            }
        } catch (e) {
            console.error('[ReviewerDashboardView] preview generation failed:', e);
            toast.error('تعذّر إنشاء معاينة التقرير');
        }
    }
}

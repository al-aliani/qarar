/**
 * Share Study Modal (Runway-style: تعاون + صلاحيات محرر/مشاهد)
 * عند تفعيل السحابة: مشاركة دراسة مع بريد آخر؛ صلاحيات "محرر" و"مشاهد".
 * + رابط مشاركة للقراءة فقط (Section 36–43) + إرسال بالبريد (mailto + اقتراح مرفق PDF).
 */

import { toast } from '../utils/toast.js';
import { getAuthUser } from '../../supabaseClient.js';
import { createShareLink, listShares, revokeShare } from '../services/ShareService.js';
import { buildShareUrl } from './ShareModal.js';
import { generateQRDataURL, downloadQRAsPNG } from '../utils/qrGenerator.js';
import { calculateStudy as runFullModel } from '../core/engine.js';
import { calculateProjectScore } from '../core/scoring.js';
import { analyzePartnerNeeds } from '../core/partnerNeeds.js';
import { hasActivePayment } from '../services/PaymentService.js';
import { PaywallModal } from './PaywallModal.js';
import { PREMIUM_EXPORT_TYPES } from './ExportMenu.js';
import { BankReportGenerator } from '../../export/BankReportGenerator.js';
import { getCertificationForStudy } from '../services/ReviewerService.js';
import { downloadBlob } from '../../export/utils.js';
import { submitTicket } from '../services/TicketService.js';

const ROLES = [
    { value: 'editor', label: 'محرر', desc: 'يمكن التعديل والحفظ' },
    { value: 'viewer', label: 'مشاهد', desc: 'عرض فقط بدون تعديل' }
];

function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** نمط DocSend: "فُتح X مرة، آخرها كذا" — سلاح تفاوضي فعلي (رقم مشاهدات حقيقي لا افتراض). */
function formatShareViewStat(share) {
    const count = share.viewCount || 0;
    if (!count) return 'لم يُفتح بعد';
    const lastDate = share.lastViewedAt
        ? new Date(share.lastViewedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', numberingSystem: 'latn' })
        : null;
    const times = count === 1 ? 'مرة واحدة' : `${count.toLocaleString('ar-SA', { numberingSystem: 'latn' })} مرة`;
    return lastDate ? `فُتح ${times}، آخرها ${lastDate}` : `فُتح ${times}`;
}

export class ShareStudyView {
    /**
     * @param {string} overlayId - ID of overlay container
     * @param {object} store - app store (for study id/name)
     * @param {object} options - { onClose, onInvite }
     */
    constructor(overlayId, store, options = {}) {
        this.overlay = document.getElementById(overlayId);
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = overlayId || 'shareStudyOverlay';
            document.body.appendChild(this.overlay);
        }
        // index.html يُعرِّف مسبقاً هذا العنصر فارغاً بلا كلاس (خارج app-shell) — الفرع أعلاه لا
        // يُنفَّذ فعلياً، فتبقى النافذة بلا class="modal-overlay" ولا تستجيب لـ.is-open (انظر
        // نفس الإصلاح في ExportMenu.js).
        this.overlay.classList.add('modal-overlay');
        this.store = store;
        this.onClose = options.onClose || (() => { });
        this.onInvite = options.onInvite || null;
        // Try to load members from store if not provided
        const stateMembers = store?.getState?.()?.projectInfo?.members || [];
        this._members = options.initialMembers || stateMembers;
        this._onEscape = null;
    }

    open() {
        this.render();
        this.overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        this._onEscape = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._onEscape);
    }

    close() {
        this.overlay.classList.remove('is-open');
        document.body.style.overflow = '';
        if (this._onEscape) {
            document.removeEventListener('keydown', this._onEscape);
            this._onEscape = null;
        }
        this.onClose();
    }

    async render() {
        const state = this.store?.getState?.() ?? this.store?.get?.() ?? {};
        const studyName = state.projectInfo?.name || 'الدراسة';
        const studyId = state.projectInfo?.id || state.id;

        let user = null;
        try {
            const { user: u } = await getAuthUser();
            user = u;
        } catch (_) { }

        // تدقيق 2026-07-18 — قسم "لمن ترسل؟": نفس نمط ExportMenu.js/DecisionDashboard.js
        // (تشغيل المحرك مرة واحدة، تُستهلَك في بوابة الجودة وتحليل احتياج الشريك معاً).
        let results = null;
        try { results = runFullModel(state); } catch (_) { }
        const recommendation = calculateProjectScore(state, results)?.recommendation; // 'go'|'revise'|'nogo'
        const partnerNeeds = analyzePartnerNeeds(state, results) || [];

        // تدقيق 2026-07-18: كان هذا القسم يستخدم generateInvestorLink (shareUtils.js) —
        // يحفظ الحمولة في localStorage على جهاز المُرسِل فقط، لا يفتح لدى المستلم إطلاقاً
        // (الزر كان معطَّلاً بنص اعتذار صريح لهذا السبب بالضبط). ShareService.js يبني نظام
        // مشاركة حقيقياً بخادم فعلي (RPC get_study_by_share_token) كان يعمل أصلاً منذ
        // 2026-07-14 لكن مدفوناً كخيار داخل قائمة التصدير (ShareModal.js) — نفس النظام
        // يُستخدَم هنا الآن مباشرة، لا بناء جديد.
        const existingShares = studyId ? (await listShares(studyId)).filter((s) => !s.revoked) : [];
        const shareRowsHtml = existingShares.length
            ? existingShares.map((s) => `
                <div class="share-link-row" data-share-id="${escapeHtml(s.id)}" style="padding:6px 0;border-bottom:1px solid var(--c-border, rgba(255,255,255,.08));">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <input type="text" readonly value="${escapeHtml(buildShareUrl(s.shareToken))}" class="input text-xs flex-1" dir="ltr" />
                        <button type="button" class="btn btn--sm btn--ghost btn-copy-existing-share" data-url="${escapeHtml(buildShareUrl(s.shareToken))}">نسخ</button>
                        <button type="button" class="btn btn--sm btn--ghost btn-revoke-share" style="color:#c53030;">إلغاء</button>
                    </div>
                    <p class="text-xs text-muted mt-1" style="margin:2px 0 0;">${formatShareViewStat(s)}</p>
                </div>
            `).join('')
            : '<p class="text-xs text-muted">لا توجد روابط مشاركة نشطة بعد.</p>';

        const membersListHtml = this._members.length === 0
            ? `
                <div class="text-sm text-muted p-4 rounded-lg bg-white/5 border border-white/10 text-center">
                    لا يوجد أعضاء مدعوون بعد.<br>
                    <span class="text-xs">عند تفعيل السحابة وإرسال الدعوات ستظهر القائمة هنا.</span>
                </div>
            `
            : `
                <ul class="space-y-2">
                    ${this._members.map(m => `
                        <li class="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                            <div>
                                <span class="font-medium">${m.email}</span>
                                <span class="text-xs text-muted mr-2">${m.role === 'editor' ? 'محرر' : 'مشاهد'}</span>
                            </div>
                            <button type="button" class="btn btn--sm btn--ghost text-danger btn-revoke" data-email="${m.email}" title="إلغاء الدعوة">إلغاء الدعوة</button>
                        </li>
                    `).join('')}
                </ul>
            `;

        this.overlay.innerHTML = `
            <div class="modal-card export-modal animate-scale-in max-w-md" role="dialog" aria-modal="true" aria-labelledby="share-study-title">
                <div class="modal-header">
                    <h3 id="share-study-title">🔗 مشاركة هذه الدراسة</h3>
                    <button type="button" class="btn-close" aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body">
                    <p class="text-sm text-muted mb-3">${studyName}</p>
                    ${!user
                ? `<p class="text-sm text-warning mb-4">سجّل الدخول لمشاركة الدراسة مع آخرين (محرر أو مشاهد).</p>`
                : `
                        <div class="mb-4">
                            <div class="alert alert--info mb-3" style="font-size: 0.8rem;">
                                <strong>ملاحظة صريحة:</strong> الدعوات البريدية والتحرير المشترك غير مفعّلين بعد.
                                القائمة أدناه <strong>مذكّرة شخصية</strong> بمن تريد مشاركتهم — المشاركة الفعلية تتم
                                بإرسال ملف PDF/Excel من قائمة التصدير أو عبر واتساب.
                            </div>
                            <label class="block text-xs text-muted mb-1">البريد الإلكتروني</label>
                            <input type="email" id="shareEmail" class="input w-full mb-2" placeholder="email@example.com" dir="ltr" />
                            <label class="block text-xs text-muted mb-1">الصلاحية (عند تفعيل التعاون لاحقاً)</label>
                            <select id="shareRole" class="input w-full mb-3">
                                ${ROLES.map(r => `<option value="${r.value}">${r.label} — ${r.desc}</option>`).join('')}
                            </select>
                            <button type="button" id="btnShareInvite" class="btn btn--primary w-full">أضِف إلى قائمة المشاركة</button>
                        </div>
                        `
            }
                    <h4 class="text-sm font-bold mb-2">قائمة المشاركة (مذكّرة)</h4>
                    ${membersListHtml}

                    <hr class="my-4 border-white/10" />
                    <h4 class="text-sm font-bold mb-2">رابط مشاركة للقراءة فقط</h4>
                    <p class="text-xs text-muted mb-2">أي شخص يملك الرابط يفتح لوحة عرض حقيقية للدراسة (قراءة فقط) من أي جهاز، بلا حاجة حساب.</p>
                    <div id="shareLinksExistingList" class="mb-2">${shareRowsHtml}</div>
                    <div class="flex gap-2 mb-2">
                        <button type="button" id="btnGenerateReadOnlyLink" class="btn btn--primary btn--sm" ${studyId ? '' : 'disabled title="احفظ الدراسة أولاً لإنشاء رابط مشاركة"'}>+ إنشاء رابط جديد</button>
                        <span id="readOnlyLinkStatus" class="text-xs text-muted self-center"></span>
                    </div>
                    <div id="readOnlyLinkBox" class="hidden mb-2 p-2 rounded bg-white/5 border border-white/10">
                        <input type="text" id="readOnlyLinkInput" class="input text-xs w-full mb-1" readonly dir="ltr" />
                        <div class="flex gap-2 flex-wrap">
                            <button type="button" id="btnCopyReadOnlyLink" class="btn btn--sm btn--primary">نسخ الرابط</button>
                            <button type="button" id="btnShowQRCode" class="btn btn--sm btn--ghost">📱 عرض رمز QR</button>
                        </div>
                        <div id="qrCodeBox" class="hidden mt-3 p-3 rounded bg-white/5 border border-white/10 text-center">
                            <p class="text-xs text-muted mb-2">امسح الرمز بماسح QR لفتح لوحة المستثمر</p>
                            <img id="qrCodeImage" alt="رمز QR للمشاركة" class="mx-auto rounded" style="max-width: 200px; height: auto;" />
                            <button type="button" id="btnDownloadQR" class="btn btn--sm btn--ghost mt-2">تحميل QR كصورة PNG</button>
                        </div>
                    </div>

                    <hr class="my-4 border-white/10" />
                    <h4 class="text-sm font-bold mb-2">لمن ترسل هذه الدراسة؟</h4>
                    <div class="flex gap-2 mb-2 flex-wrap">
                        <button type="button" id="btnRecipientBank" class="btn btn--secondary btn--sm"><svg class="ic" aria-hidden="true"><use href="#i-bank"/></svg> بنك / جهة تمويل</button>
                        <button type="button" id="btnRecipientInvestor" class="btn btn--secondary btn--sm"><svg class="ic" aria-hidden="true"><use href="#i-trophy"/></svg> مستثمر</button>
                        ${partnerNeeds.length ? `<button type="button" id="btnRecipientPartner" class="btn btn--secondary btn--sm"><svg class="ic" aria-hidden="true"><use href="#i-users"/></svg> شريك</button>` : ''}
                    </div>
                    <div id="recipientActionArea"></div>

                    <h4 class="text-sm font-bold mb-2 mt-3">تصدير مباشر</h4>
                    <p class="text-xs text-muted mb-2">صيغ Word/Excel/PowerPoint تتطلب باقة مدفوعة — نفس بوابة الدفع المستخدمة في قائمة التصدير.</p>
                    <div class="flex gap-2 flex-wrap">
                        <button type="button" class="btn btn--ghost btn--sm btn-direct-export" data-format="word">Word</button>
                        <button type="button" class="btn btn--ghost btn--sm btn-direct-export" data-format="excel">Excel</button>
                        <button type="button" class="btn btn--ghost btn--sm btn-direct-export" data-format="pptx">PowerPoint</button>
                        <button type="button" class="btn btn--ghost btn--sm btn-direct-export" data-format="json">JSON</button>
                    </div>

                    <h4 class="text-sm font-bold mb-2 mt-3">إرسال بالبريد</h4>
                    <p class="text-xs text-muted mb-2">فتح بريدك مع موضوع وجسم جاهزين — يُنصح بإرفاق PDF الدراسة من قائمة التصدير.</p>
                    <button type="button" id="btnShareByEmail" class="btn btn--ghost btn--sm">إرسال بالبريد (mailto)</button>
                </div>
            </div>
        `;

        this.overlay.querySelector('.btn-close')?.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

        const btnInvite = this.overlay.querySelector('#btnShareInvite');
        if (btnInvite) {
            btnInvite.addEventListener('click', () => {
                const emailEl = this.overlay.querySelector('#shareEmail');
                const roleEl = this.overlay.querySelector('#shareRole');
                const email = (emailEl?.value || '').trim();
                if (!email) {
                    toast.warning('أدخل البريد الإلكتروني');
                    return;
                }
                const role = roleEl?.value || 'viewer';
                if (this.onInvite) this.onInvite({ email, role, studyId });
                else {
                    // Local Persistence for "Excellence" demo
                    const state = this.store.getState();
                    const info = state.projectInfo || {};
                    const currentMembers = info.members || [];
                    const newMembers = [...currentMembers, { email, role, invitedAt: new Date().toISOString() }];
                    this.store.update('projectInfo', { ...info, members: newMembers });

                    this._members = newMembers;
                    // صياغة صادقة: لا يُرسَل أي بريد — هذه قائمة تذكير محلية فقط
                    toast.info(`أُضيف ${email} إلى قائمة المشاركة (تذكير محلي — لم يُرسَل بريد). شارك الدراسة بملف PDF من قائمة التصدير.`);
                    this.render();
                }
                if (emailEl) emailEl.value = '';
            });
        }

        this.overlay.querySelectorAll('.btn-revoke').forEach(btn => {
            btn.addEventListener('click', () => {
                const email = btn.dataset.email;
                // Local Persistence Remove
                const state = this.store.getState();
                const info = state.projectInfo || {};
                const currentMembers = info.members || [];
                const newMembers = currentMembers.filter(m => m.email !== email);
                this.store.update('projectInfo', { ...info, members: newMembers });

                this._members = newMembers;
                toast.info('تم إلغاء الدعوة.');
                this.render();
            });
        });

        // رابط مشاركة للقراءة فقط (Section 36–43)
        const btnGenLink = this.overlay.querySelector('#btnGenerateReadOnlyLink');
        const linkStatus = this.overlay.querySelector('#readOnlyLinkStatus');
        const linkBox = this.overlay.querySelector('#readOnlyLinkBox');
        const linkInput = this.overlay.querySelector('#readOnlyLinkInput');
        const btnCopyLink = this.overlay.querySelector('#btnCopyReadOnlyLink');
        if (btnGenLink) {
            btnGenLink.addEventListener('click', async () => {
                if (!studyId) { toast.warning('احفظ الدراسة أولاً لإنشاء رابط مشاركة'); return; }
                btnGenLink.disabled = true;
                if (linkStatus) linkStatus.textContent = 'جاري إنشاء الرابط...';
                const result = await createShareLink(studyId);
                btnGenLink.disabled = false;
                if (result.ok) {
                    // عمداً بلا this.render() هنا — يُفرِغ ذلك readOnlyLinkBox (يبدأ كل رسم
                    // جديد بـclass="hidden") فيفقد المستخدم زرَّي النسخ/QR للرابط للتوّ.
                    // الرابط الجديد يظهر في shareLinksExistingList عند فتح النافذة لاحقاً.
                    const url = buildShareUrl(result.shareToken);
                    if (linkInput) linkInput.value = url;
                    if (linkBox) linkBox.classList.remove('hidden');
                    if (linkStatus) linkStatus.textContent = '';
                    toast.success('تم إنشاء رابط القراءة فقط — انسخه وشاركه');
                } else {
                    if (linkStatus) linkStatus.textContent = 'تعذر إنشاء الرابط';
                    toast.error(result.error || 'تعذر إنشاء الرابط');
                }
            });
        }
        if (btnCopyLink && linkInput) {
            btnCopyLink.addEventListener('click', () => {
                linkInput.select();
                document.execCommand('copy');
                toast.success('تم نسخ الرابط');
            });
        }
        this.overlay.querySelectorAll('.btn-copy-existing-share').forEach((btn) => {
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

        // رمز QR للمشاركة (خطة التطوير — QR Code)
        const btnShowQR = this.overlay.querySelector('#btnShowQRCode');
        const qrCodeBox = this.overlay.querySelector('#qrCodeBox');
        const qrCodeImage = this.overlay.querySelector('#qrCodeImage');
        const btnDownloadQR = this.overlay.querySelector('#btnDownloadQR');
        if (btnShowQR && qrCodeBox && qrCodeImage && linkInput) {
            btnShowQR.addEventListener('click', async () => {
                const url = linkInput.value?.trim();
                if (!url) {
                    toast.warning('أنشئ الرابط أولاً بالضغط على «إنشاء رابط»');
                    return;
                }
                try {
                    btnShowQR.disabled = true;
                    btnShowQR.textContent = 'جاري التوليد...';
                    const dataUrl = await generateQRDataURL(url);
                    qrCodeImage.src = dataUrl;
                    qrCodeBox.classList.remove('hidden');
                    btnShowQR.textContent = '📱 عرض رمز QR';
                    toast.success('تم توليد رمز QR');
                } catch (e) {
                    console.error('QR generation failed:', e);
                    toast.error('فشل توليد رمز QR');
                    btnShowQR.textContent = '📱 عرض رمز QR';
                } finally {
                    btnShowQR.disabled = false;
                }
            });
        }
        if (btnDownloadQR && linkInput) {
            btnDownloadQR.addEventListener('click', async () => {
                const url = linkInput.value?.trim();
                if (!url) {
                    toast.warning('أنشئ الرابط أولاً');
                    return;
                }
                try {
                    const studyName = (state?.projectInfo?.name || 'دراسة').replace(/[/\\*?:[\]<>|]/g, '_');
                    await downloadQRAsPNG(url, `${studyName}_QR.png`);
                    toast.success('تم تحميل رمز QR');
                } catch (e) {
                    console.error('QR download failed:', e);
                    toast.error('فشل تحميل رمز QR');
                }
            });
        }

        // إرسال بالبريد (mailto + اقتراح إرفاق PDF)
        const btnEmail = this.overlay.querySelector('#btnShareByEmail');
        if (btnEmail) {
            btnEmail.addEventListener('click', () => {
                const studyName = (state.projectInfo?.name || 'الدراسة').trim();
                const subject = encodeURIComponent(`دراسة جدوى: ${studyName}`);
                const body = encodeURIComponent(
                    `مرحباً،\n\nأرفق لكم ملخص دراسة الجدوى للمشروع: ${studyName}.\n\nيرجى إرفاق ملف PDF من قائمة «تصدير» في المنصة (تقرير PDF أو نسخة للممول) للاطلاع على التفاصيل.\n\nمع خالص التقدير`
                );
                window.location.href = `mailto:?subject=${subject}&body=${body}`;
                toast.info('تم فتح بريدك — أرفق PDF من قائمة التصدير');
            });
        }

        // ═══ قسم "لمن ترسل؟" — توجيه حسب المتلقي + بوابة جودة (تدقيق 2026-07-18) ═══
        const recipientArea = this.overlay.querySelector('#recipientActionArea');
        const qualityWarningHtml = (recommendation && recommendation !== 'go')
            ? `<div class="alert alert--warning mb-2" style="font-size:0.8rem;">
                    ${recommendation === 'nogo'
                        ? 'توصية دراستك الحالية: <strong>عدم المضي (NO-GO)</strong> — يمكنك المتابعة، لكن راجع التوصية أولاً في لوحة القرار.'
                        : 'دراستك تحتاج <strong>مراجعة (REVISE)</strong> حالياً — يُفضَّل استكمالها قبل إرسالها لجهة تمويل أو مستثمر.'}
               </div>`
            : '';

        this.overlay.querySelector('#btnRecipientBank')?.addEventListener('click', () => {
            if (!recipientArea) return;
            recipientArea.innerHTML = `
                ${qualityWarningHtml}
                <div class="p-2 rounded bg-white/5 border border-white/10 mb-2">
                    <button type="button" id="btnExportBankDirect" class="btn btn--sm btn--primary w-full mb-2">تصدير تقرير البنك</button>
                    <button type="button" id="btnRequestFundingIntro" class="btn btn--sm btn--secondary w-full">اطلب تعريفاً بجهة تمويل حقيقية</button>
                </div>
            `;
            this.overlay.querySelector('#btnExportBankDirect')?.addEventListener('click', () => this._runDirectExport('bank'));
            this.overlay.querySelector('#btnRequestFundingIntro')?.addEventListener('click', () => this._requestFundingIntroduction(studyName));
        });

        this.overlay.querySelector('#btnRecipientInvestor')?.addEventListener('click', () => {
            if (!recipientArea) return;
            recipientArea.innerHTML = `
                ${qualityWarningHtml}
                <p class="text-xs text-muted mb-2">استخدم رابط المشاركة أعلاه («رابط مشاركة للقراءة فقط») — يفتح لوحة استثمارية حقيقية بمؤشرات NPV/IRR، بلا حاجة حساب من المستثمر.</p>
            `;
        });

        this.overlay.querySelector('#btnRecipientPartner')?.addEventListener('click', () => {
            if (!recipientArea) return;
            const summary = partnerNeeds.map((n) => `• ${n.reason}`).join('\n');
            recipientArea.innerHTML = `
                <div class="p-2 rounded bg-white/5 border border-white/10 mb-2">
                    <p class="text-xs text-muted mb-2">حسب بيانات دراستك الفعلية:</p>
                    <ul class="text-xs mb-2" style="padding-inline-start:16px;">
                        ${partnerNeeds.map((n) => `<li>${escapeHtml(n.reason)}</li>`).join('')}
                    </ul>
                    <button type="button" id="btnCopyPartnerSummary" class="btn btn--sm btn--ghost w-full">نسخ الملخص</button>
                </div>
            `;
            this.overlay.querySelector('#btnCopyPartnerSummary')?.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(summary);
                    toast.success('تم نسخ ملخص احتياج الشريك');
                } catch (_) {
                    toast.info(summary);
                }
            });
        });

        // تصدير مباشر — Word/Excel/PowerPoint محمية بنفس بوابة الدفع المستخدمة في
        // ExportMenu.js (hasActivePayment + PaywallModal)؛ JSON مجاني بلا بوابة.
        this.overlay.querySelectorAll('.btn-direct-export').forEach((btn) => {
            btn.addEventListener('click', () => this._runDirectExport(btn.dataset.format));
        });
    }

    /**
     * تصدير مباشر لصيغة من داخل نافذة المشاركة — بلا المرور عبر ExportMenu (غير قابلة
     * لإعادة استخدام نظيفة، مقترنة بشدة بـDOM الخاص بها). ⚠️ الصيغ المدفوعة تمر إلزامياً
     * بنفس بوابة hasActivePayment/PaywallModal المستخدمة في ExportMenu.js:500-510 —
     * تجاوزها هنا كان سيلتف على بوابة الدفع فعلياً.
     */
    async _runDirectExport(format) {
        const state = this.store?.getState?.() ?? this.store?.get?.() ?? {};
        const studyId = state.projectInfo?.id || state.id || null;

        if (PREMIUM_EXPORT_TYPES.has(format)) {
            const alreadyPaid = await hasActivePayment(studyId);
            if (!alreadyPaid) {
                const modal = new PaywallModal('paywallModalOverlay', this.store);
                modal.open(PREMIUM_EXPORT_TYPES.get(format));
                return;
            }
        }

        try {
            if (format === 'bank') {
                const certification = await getCertificationForStudy(studyId);
                const html = BankReportGenerator.generateHTML(this.store, { certification });
                const win = window.open('', '_blank');
                if (win) { win.document.write(html); win.document.close(); }
                toast.success('تم فتح تقرير البنك');
            } else if (format === 'word') {
                const { WordExporter } = await import('../../export/wordExporter.js');
                const result = await new WordExporter(this.store).export();
                if (result.success) { downloadBlob(result.blob, result.fileName); toast.success(`تم تصدير Word: ${result.fileName}`); }
                else toast.error('فشل تصدير Word: ' + (result.error || 'خطأ غير معروف'));
            } else if (format === 'excel') {
                let results = null;
                try { results = runFullModel(state); } catch (_) { }
                const { exportToExcel } = await import('../../export/excelExporter.js');
                const fn = state.projectInfo?.name || 'feasibility_study';
                const excelName = await exportToExcel(state, results, fn);
                toast.success(excelName ? `تم تصدير Excel: ${excelName}` : 'تم تصدير Excel بنجاح');
            } else if (format === 'pptx') {
                const { PPTXExporter } = await import('../../export/pptxExporter.js');
                const result = await new PPTXExporter(this.store).export();
                if (result.success) toast.success(`تم تصدير PowerPoint: ${result.fileName}`);
                else toast.error('فشل تصدير PowerPoint: ' + (result.error || 'خطأ غير معروف'));
            } else if (format === 'json') {
                const json = JSON.stringify(state, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const fileName = `${(state.projectInfo?.name || 'دراسة').replace(/[/\\*?:[\]<>|]/g, '_')}.json`;
                downloadBlob(blob, fileName);
                toast.success('تم تصدير JSON');
            }
        } catch (e) {
            console.error('_runDirectExport', format, e);
            toast.error('تعذّر التصدير');
        }
    }

    /** طلب تعريف بجهة تمويل حقيقية — عبر نظام التذاكر الداخلي (TicketService.js)،
     * يراجعه المالك شخصياً ويُحيله يدوياً؛ لا وسيط آلي. */
    async _requestFundingIntroduction(studyName) {
        const result = await submitTicket({
            subject: `طلب تعريف بجهة تمويل — ${studyName}`,
            body: `أرغب بتعريف من فريق قرار بجهة تمويل حقيقية مناسبة لدراستي: ${studyName}.`,
            category: 'funding_introduction',
        });
        if (result.ok) toast.success('تم إرسال طلبك — سيراجعه فريقنا ويتواصل معك قريباً');
        else toast.error(result.error || 'فشل إرسال الطلب');
    }
}

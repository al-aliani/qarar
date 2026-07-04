/**
 * Share Study Modal (Runway-style: تعاون + صلاحيات محرر/مشاهد)
 * عند تفعيل السحابة: مشاركة دراسة مع بريد آخر؛ صلاحيات "محرر" و"مشاهد".
 * + رابط مشاركة للقراءة فقط (Section 36–43) + إرسال بالبريد (mailto + اقتراح مرفق PDF).
 */

import { toast } from '../utils/toast.js';
import { getAuthUser } from '../../supabaseClient.js';
import { generateInvestorLink } from '../utils/shareUtils.js';
import { generateQRDataURL, downloadQRAsPNG } from '../utils/qrGenerator.js';
import { calculateStudy as runFullModel } from '../core/engine.js';

const ROLES = [
    { value: 'editor', label: 'محرر', desc: 'يمكن التعديل والحفظ' },
    { value: 'viewer', label: 'مشاهد', desc: 'عرض فقط بدون تعديل' }
];

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
            this.overlay.className = 'modal-overlay';
            document.body.appendChild(this.overlay);
        }
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
                            <label class="block text-xs text-muted mb-1">البريد الإلكتروني</label>
                            <input type="email" id="shareEmail" class="input w-full mb-2" placeholder="email@example.com" dir="ltr" />
                            <label class="block text-xs text-muted mb-1">الصلاحية</label>
                            <select id="shareRole" class="input w-full mb-3">
                                ${ROLES.map(r => `<option value="${r.value}">${r.label} — ${r.desc}</option>`).join('')}
                            </select>
                            <button type="button" id="btnShareInvite" class="btn btn--primary w-full">دعوة عضو</button>
                        </div>
                        <div class="mb-2 text-xs text-muted">التحديثات تظهر للمشاركين تلقائياً (حفظ تلقائي). عند التحرير المشترك قد يظهر مؤشر «شخص آخر يعدّل».</div>
                        <div id="collabWhoEditingPlaceholder" class="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 text-center text-xs text-muted" aria-live="polite">
                            عند تفعيل السحابة سيظهر هنا: <strong>من يعدّل الدراسة الآن</strong> (تعاون في الوقت الفعلي).
                        </div>
                        `
            }
                    <h4 class="text-sm font-bold mb-2">الأعضاء المدعوون</h4>
                    ${membersListHtml}

                    <hr class="my-4 border-white/10" />
                    <h4 class="text-sm font-bold mb-2">رابط مشاركة للقراءة فقط</h4>
                    <p class="text-xs text-muted mb-2">رابط يعرض ملخص الدراسة (لوحة المستثمر) دون إمكانية التعديل — مناسب لمستثمر أو بنك.</p>
                    <div class="flex gap-2 mb-2">
                        <button type="button" id="btnGenerateReadOnlyLink" class="btn btn--ghost btn--sm">إنشاء رابط</button>
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
                    toast.success(`تمت دعوة ${email} بنجاح (تم الحفظ).`);
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
                const state = this.store?.getState?.() ?? this.store?.get?.() ?? {};
                if (linkStatus) linkStatus.textContent = 'جاري إنشاء الرابط...';
                try {
                    const results = runFullModel(state);
                    const out = await generateInvestorLink(state, results);
                    if (out?.url) {
                        if (linkInput) linkInput.value = out.url;
                        if (linkBox) linkBox.classList.remove('hidden');
                        if (linkStatus) linkStatus.textContent = 'تم إنشاء الرابط';
                        toast.success('تم إنشاء رابط القراءة فقط — انسخه وشاركه');
                    } else {
                        if (linkStatus) linkStatus.textContent = 'تعذر إنشاء الرابط';
                        toast.warning('تعذر إنشاء الرابط. تأكد من اكتمال بيانات الدراسة.');
                    }
                } catch (e) {
                    console.error('generateInvestorLink', e);
                    if (linkStatus) linkStatus.textContent = 'خطأ';
                    toast.error('تعذر إنشاء الرابط');
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
    }
}

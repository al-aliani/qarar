/**
 * 2FA Modal - إعداد المصادقة الثنائية (TOTP)
 * تفعيل، تحقق، إلغاء — Supabase MFA
 */
import Swal from 'sweetalert2';
import { mfaEnrollTOTP, mfaChallengeAndVerify, mfaListFactors, mfaUnenroll } from '../../supabaseClient.js';
import { generateMfaRecoveryCodes } from '../services/MfaRecoveryService.js';
import { toast } from '../utils/toast.js';
import { attachModalA11y } from '../utils/modalA11y.js';

export class TwoFactorModal {
    constructor() {
        this.isOpen = false;
        this._a11y = null;
    }

    /**
     * الإغلاق الوحيد للنافذة. كان الحذف مكرَّراً في 5 مواضع، فكان أي منها يترك
     * مستمعات الوصول والتركيز معلَّقة. لا يغيّر ما تفعله الأزرار — فقط يوحّد الحذف.
     *
     * ملاحظة SweetAlert: نوافذ Swal.fire داخل هذا الملف (إلغاء 2FA / إعادة توليد
     * الرموز) تدير تركيزها و Escape بنفسها، ومساعد الوصول هنا يتنحّى ما دامت مفتوحة.
     */
    _close(overlay) {
        if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
        this.isOpen = false;
        this._a11y?.release();
        this._a11y = null;
    }

    async show() {
        this.isOpen = true;
        const result = await mfaListFactors();
        const factorsList = result.ok && result.data ? (result.data.totp || result.data.factors || []) : [];
        const hasMFA = factorsList.length > 0;

        const overlay = document.createElement('div');
        overlay.id = '2fa-modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
        
        overlay.innerHTML = `
            <div style="background:var(--c-bg-card);border-radius:12px;padding:24px;max-width:500px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h3 id="twoFactorModalTitle" style="margin:0;font-size:18px;color:var(--c-text-main);"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg> المصادقة الثنائية</h3>
                    <button id="btn2FAClose" aria-label="إغلاق" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--c-text-muted);">×</button>
                </div>
                <div id="2fa-content">
                    ${hasMFA ? this.renderManageMode(factorsList) : this.renderEnrollMode()}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.bindEvents(overlay, hasMFA);
        this._a11y = attachModalA11y({
            container: overlay,
            dialog: overlay.firstElementChild,
            labelledBy: 'twoFactorModalTitle',
            initialFocus: '#btn2FAClose',
            onEscape: () => this._close(overlay)
        });
    }

    renderEnrollMode() {
        return `
            <p style="color:var(--c-text-muted);margin-bottom:16px;">حمّاية حسابك بطبقة أمان إضافية باستخدام تطبيق مصادقة (Google Authenticator، Authy، إلخ).</p>
            <div id="2fa-qr-container" style="display:none;text-align:center;">
                <div style="margin-bottom:12px;padding:16px;background:var(--c-bg-app);border:1px solid var(--c-border);border-radius:8px;">
                    <div id="2fa-qr-svg" style="margin:0 auto 12px;min-height:180px;"></div>
                    <p style="margin-top:8px;font-size:12px;color:var(--c-text-muted);word-break:break-all;" id="2fa-secret-text"></p>
                    <p style="margin-top:12px;font-size:12px;color:var(--c-text-muted);">امسح الكود أو أدخل المفتاح في تطبيق المصادقة</p>
                </div>
                <input type="text" id="inp2FACode" placeholder="رمز التحقق (6 أرقام)" style="width:100%;padding:12px;border:1px solid var(--c-border);border-radius:8px;text-align:center;font-size:18px;letter-spacing:4px;margin-bottom:12px;">
                <button id="btnVerify2FA" class="btn btn--primary" style="width:100%;">تأكيد وتفعيل</button>
            </div>
            <button id="btnStart2FA" class="btn btn--primary" style="width:100%;">بدء التفعيل</button>
        `;
    }

    renderManageMode(factors) {
        return `
            <div style="padding:16px;background:#10b98114;border:1px solid #10b981;border-radius:8px;margin-bottom:16px;">
                <p style="color:#065f46;font-weight:600;">✓ المصادقة الثنائية مفعّلة</p>
                <p style="font-size:12px;color:#047857;margin-top:4px;">حسابك محمي بطبقة أمان إضافية</p>
            </div>
            ${factors.map(f => `
                <div style="padding:12px;background:var(--c-bg-app);border:1px solid var(--c-border);border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-weight:500;">${f.friendly_name || 'تطبيق المصادقة'}</div>
                        <div style="font-size:12px;color:var(--c-text-muted);">نشط منذ ${new Date(f.created_at).toLocaleDateString('ar-SA-u-nu-latn')}</div>
                    </div>
                    <button class="btn btn--ghost btn-sm text-danger" data-factor-id="${f.id}">إلغاء</button>
                </div>
            `).join('')}
            <button id="btnRegenerateRecoveryCodes" class="btn btn--ghost" style="width:100%;margin-top:8px;">إعادة توليد رموز الاسترداد</button>
        `;
    }

    /**
     * شاشة كشف-لمرة-واحدة لرموز الاسترداد — تُعرَض فور أول تفعيل TOTP ناجح
     * (لا عند كل دخول لاحق)، وأيضاً بعد "إعادة توليد الرموز" من وضع الإدارة.
     * نفس أسلوب renderEnrollMode: لا تُخزَّن الرموز في أي مكان آخر غير جسم
     * استجابة mfa-recovery-generate هذه اللحظة تحديداً.
     */
    renderRecoveryCodesScreen(codes) {
        return `
            <p style="color:var(--c-text-muted);margin-bottom:12px;">احفظ رموز الاسترداد العشرة التالية في مكان آمن — تُستخدَم بدل تطبيق المصادقة إن فقدته. لن تظهر هذه الرموز مرة أخرى.</p>
            <div id="2fa-recovery-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:16px;background:var(--c-bg-app);border:1px solid var(--c-border);border-radius:8px;margin-bottom:12px;font-family:monospace;font-size:14px;text-align:center;direction:ltr;">
                ${codes.map((c) => `<div>${c}</div>`).join('')}
            </div>
            <button id="btnCopyRecoveryCodes" class="btn btn--ghost" style="width:100%;margin-bottom:12px;">نسخ الرموز</button>
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:14px;color:var(--c-text-main);cursor:pointer;">
                <input type="checkbox" id="chkRecoverySaved">
                لقد حفظت هذه الرموز في مكان آمن
            </label>
            <button id="btnDoneRecoveryCodes" class="btn btn--primary" style="width:100%;" disabled>تم</button>
        `;
    }

    bindRecoveryCodesEvents(overlay, codes) {
        const chk = overlay.querySelector('#chkRecoverySaved');
        const doneBtn = overlay.querySelector('#btnDoneRecoveryCodes');
        chk?.addEventListener('change', () => { doneBtn.disabled = !chk.checked; });
        overlay.querySelector('#btnCopyRecoveryCodes')?.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(codes.join('\n'));
                toast.success('تم نسخ الرموز');
            } catch (_) {
                toast.error('تعذّر النسخ — انسخها يدوياً');
            }
        });
        doneBtn?.addEventListener('click', () => {
            this._close(overlay);
        });
    }

    bindEvents(overlay, hasMFA) {
        overlay.querySelector('#btn2FAClose')?.addEventListener('click', () => {
            this._close(overlay);
        });

        if (hasMFA) {
            overlay.querySelectorAll('.text-danger').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const factorId = btn.dataset.factorId;
                    const confirmResult = await Swal.fire({
                        title: 'هل أنت متأكد؟',
                        text: 'هل تريد إلغاء المصادقة الثنائية؟',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'نعم، ألغِ',
                        cancelButtonText: 'إلغاء',
                        customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
                        buttonsStyling: false
                    });
                    if (!confirmResult.isConfirmed) return;
                    const result = await mfaUnenroll(factorId);
                    if (result.ok) {
                        toast.success('تم إلغاء المصادقة الثنائية');
                        this._close(overlay);
                    } else {
                        toast.error('فشل الإلغاء: ' + result.error);
                    }
                });
            });

            overlay.querySelector('#btnRegenerateRecoveryCodes')?.addEventListener('click', async (e) => {
                const confirmResult = await Swal.fire({
                    title: 'إعادة توليد رموز الاسترداد؟',
                    text: 'ستُبطَل كل رموز الاسترداد القديمة فوراً ولن تعود صالحة.',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، أعد التوليد',
                    cancelButtonText: 'إلغاء',
                    customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
                    buttonsStyling: false
                });
                if (!confirmResult.isConfirmed) return;
                e.target.disabled = true;
                e.target.textContent = 'جاري التوليد...';
                const result = await generateMfaRecoveryCodes();
                if (result.ok && result.codes) {
                    const content = overlay.querySelector('#2fa-content');
                    content.innerHTML = this.renderRecoveryCodesScreen(result.codes);
                    this.bindRecoveryCodesEvents(overlay, result.codes);
                } else {
                    toast.error('فشل إعادة التوليد: ' + (result.error || ''));
                    e.target.disabled = false;
                    e.target.textContent = 'إعادة توليد رموز الاسترداد';
                }
            });
        } else {
            let enrollData = null;
            overlay.querySelector('#btnStart2FA')?.addEventListener('click', async (e) => {
                e.target.disabled = true;
                e.target.textContent = 'جاري...';
                const result = await mfaEnrollTOTP('تطبيق المصادقة');
                if (result.ok && result.data) {
                    enrollData = result.data;
                    const totp = result.data.totp || {};
                    const qrCode = totp.qr_code;
                    const secret = totp.secret || '';
                    const qrContainer = overlay.querySelector('#2fa-qr-svg');
                    const secretEl = overlay.querySelector('#2fa-secret-text');
                    if (qrCode && qrContainer) {
                        if (typeof qrCode === 'string' && qrCode.startsWith('<svg')) {
                            qrContainer.innerHTML = qrCode;
                        } else {
                            const img = document.createElement('img');
                            img.src = qrCode;
                            img.alt = 'QR';
                            img.style.maxWidth = '200px';
                            qrContainer.innerHTML = '';
                            qrContainer.appendChild(img);
                        }
                    }
                    if (secretEl) secretEl.textContent = secret ? 'المفتاح: ' + secret : '';
                    overlay.querySelector('#2fa-qr-container').style.display = 'block';
                    e.target.style.display = 'none';
                } else {
                    toast.error('فشل التفعيل: ' + (result.error || ''));
                    e.target.disabled = false;
                    e.target.textContent = 'بدء التفعيل';
                }
            });

            overlay.querySelector('#btnVerify2FA')?.addEventListener('click', async (e) => {
                const code = overlay.querySelector('#inp2FACode').value.trim();
                if (!code || code.length < 6) {
                    toast.error('الرجاء إدخال رمز 6 أرقام');
                    return;
                }
                e.target.disabled = true;
                e.target.textContent = 'جاري التحقق...';
                if (!enrollData?.id) {
                    toast.error('خطأ: بيانات التفعيل مفقودة');
                    e.target.disabled = false;
                    e.target.textContent = 'تأكيد وتفعيل';
                    return;
                }
                const result = await mfaChallengeAndVerify(enrollData.id, code);
                if (result.ok) {
                    toast.success('تم تفعيل المصادقة الثنائية بنجاح');
                    // فور أول تفعيل ناجح فقط (لا عند كل دخول لاحق) — الجلسة عند هذه اللحظة
                    // aal2 فعلاً (mfa.challengeAndVerify نجح للتو)، فتجتاز فحص AAL2 في
                    // mfa-recovery-generate. فشل التوليد هنا لا يجوز أن يُسقط نجاح تفعيل
                    // 2FA نفسه — يُغلَق عادياً، ويقدر المستخدم توليدها لاحقاً من وضع الإدارة.
                    const recoveryResult = await generateMfaRecoveryCodes();
                    if (recoveryResult.ok && recoveryResult.codes) {
                        const content = overlay.querySelector('#2fa-content');
                        content.innerHTML = this.renderRecoveryCodesScreen(recoveryResult.codes);
                        this.bindRecoveryCodesEvents(overlay, recoveryResult.codes);
                    } else {
                        toast.error('تم التفعيل، لكن تعذّر توليد رموز الاسترداد. أعد المحاولة لاحقاً من إعدادات الحساب.');
                        this._close(overlay);
                    }
                } else {
                    toast.error(result.error || 'رمز غير صحيح');
                    e.target.disabled = false;
                    e.target.textContent = 'تأكيد وتفعيل';
                }
            });
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this._close(overlay);
            }
        });
    }
}

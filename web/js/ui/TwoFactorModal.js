/**
 * 2FA Modal - إعداد المصادقة الثنائية (TOTP)
 * تفعيل، تحقق، إلغاء — Supabase MFA
 */
import { mfaEnrollTOTP, mfaChallengeAndVerify, mfaListFactors, mfaUnenroll } from '../../supabaseClient.js';
import { toast } from '../utils/toast.js';

export class TwoFactorModal {
    constructor() {
        this.isOpen = false;
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
                    <h3 style="margin:0;font-size:18px;color:var(--c-text-main);">🔐 المصادقة الثنائية</h3>
                    <button id="btn2FAClose" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--c-text-muted);">×</button>
                </div>
                <div id="2fa-content">
                    ${hasMFA ? this.renderManageMode(factorsList) : this.renderEnrollMode()}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.bindEvents(overlay, hasMFA);
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
        `;
    }

    bindEvents(overlay, hasMFA) {
        overlay.querySelector('#btn2FAClose')?.addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.isOpen = false;
        });

        if (hasMFA) {
            overlay.querySelectorAll('.text-danger').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const factorId = btn.dataset.factorId;
                    if (!confirm('هل تريد إلغاء المصادقة الثنائية؟')) return;
                    const result = await mfaUnenroll(factorId);
                    if (result.ok) {
                        toast.success('تم إلغاء المصادقة الثنائية');
                        document.body.removeChild(overlay);
                        this.isOpen = false;
                    } else {
                        toast.error('فشل الإلغاء: ' + result.error);
                    }
                });
            });
        } else {
            let enrollData = null;
            overlay.querySelector('#btnStart2FA')?.addEventListener('click', async (e) => {
                e.target.disabled = true;
                e.target.textContent = '⏳ جاري...';
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
                e.target.textContent = '⏳ جاري التحقق...';
                if (!enrollData?.id) {
                    toast.error('خطأ: بيانات التفعيل مفقودة');
                    e.target.disabled = false;
                    e.target.textContent = 'تأكيد وتفعيل';
                    return;
                }
                const result = await mfaChallengeAndVerify(enrollData.id, code);
                if (result.ok) {
                    toast.success('تم تفعيل المصادقة الثنائية بنجاح');
                    document.body.removeChild(overlay);
                    this.isOpen = false;
                } else {
                    toast.error(result.error || 'رمز غير صحيح');
                    e.target.disabled = false;
                    e.target.textContent = 'تأكيد وتفعيل';
                }
            });
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                this.isOpen = false;
            }
        });
    }
}

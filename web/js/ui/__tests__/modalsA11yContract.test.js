/**
 * @vitest-environment jsdom
 *
 * عقد الوصول لكل النوافذ المنبثقة، مُطبَّقاً على المكوّنات الحقيقية لا على المساعد
 * وحده. القياس قبل الإصلاح: 8 من 14 نافذة لا تُعيد التركيز للزر الفاتح عند
 * الإغلاق، و6 بلا حبس تركيز، و2 (AIChatModal / TwoFactorModal) بلا role="dialog".
 *
 * كل حالة هنا تُشغّل الرحلة كاملة: زر حقيقي يفتح النافذة ⟸ التركيز ينتقل بداخلها
 * ⟸ Tab لا يخرج منها ⟸ الإغلاق يُعيد التركيز للزر نفسه.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const updateUserProfileMock = vi.fn(async () => ({ ok: true, profile: {} }));
vi.mock('../../../supabaseClient.js', () => ({
    updateUserProfile: (...a) => updateUserProfileMock(...a),
    signInWithOtpPhone: vi.fn(async () => ({ ok: true })),
    verifyOtpPhone: vi.fn(async () => ({ ok: true, data: {} })),
    signInWithOAuth: vi.fn(async () => ({ ok: true })),
    mfaListFactors: vi.fn(async () => ({ ok: true, data: { totp: [] } })),
    mfaEnrollTOTP: vi.fn(async () => ({ ok: true })),
    mfaChallengeAndVerify: vi.fn(async () => ({ ok: true })),
    mfaUnenroll: vi.fn(async () => ({ ok: true })),
    signOut: vi.fn(async () => ({ ok: true })),
    getSupabaseClient: vi.fn(async () => ({ ok: true }))
}));

vi.mock('../../services/WhatsAppOtpService.js', () => ({
    sendWhatsAppOtp: vi.fn(async () => ({ ok: true, cooldownSeconds: 0 })),
    verifyWhatsAppOtp: vi.fn(async () => ({ ok: true }))
}));

vi.mock('../../services/PaymentService.js', () => ({
    startCheckout: vi.fn(async () => ({ ok: true }))
}));

const fakeStore = () => ({
    getState: () => ({ projectInfo: { name: 'مشروع اختبار', id: 'p1' }, results: {}, assumptions: {} }),
    get: () => ({}),
    save: vi.fn(),
    notify: vi.fn(),
    state: {}
});

/** يبني صفحة فيها منطقة محتوى وزر يفتح النافذة — كما يحدث فعلياً في التطبيق. */
function pageWithOpener() {
    document.body.innerHTML = '<main id="appMain"><button id="opener">افتح النافذة</button></main>';
    const opener = document.getElementById('opener');
    opener.focus();
    return opener;
}

function pressKey(key, { shift = false } = {}) {
    const event = new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true });
    (document.activeElement || document.body).dispatchEvent(event);
    return event;
}

/**
 * العناصر القابلة للتركيز *والمرئية*. لا تخطٍّ للفلترة: AuthModalStub وPhoneAuthModal
 * يُخفيان لوحات كاملة بـstyle="display:none" (تحدي 2FA، نموذج الرمز) — عدّها ضمن
 * الدورة يجعل «آخر عنصر» عنصراً مخفياً فيفشل الاختبار على سلوك صحيح.
 */
function focusablesIn(root) {
    const all = Array.from(root.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    return all.filter((el) => {
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
            if (n.hidden || n.style?.display === 'none' || n.style?.visibility === 'hidden') return false;
        }
        return true;
    });
}

/**
 * كل نافذة تصف نفسها: كيف تُبنى، كيف تُفتح، كيف تُغلق، وهل Escape يُغلقها.
 * escapeCloses:false = نافذة إلزامية عمداً (رقم الجوال / تحقق واتساب / تفضيل الباقة
 * / بوابة الدخول) — نتحقق حينها أن Escape لا يُغلقها، لا أن يُغلقها.
 */
const MODALS = [
    {
        name: 'RefundPolicyModal',
        escapeCloses: true,
        async build() {
            const { RefundPolicyModal } = await import('../RefundPolicyModal.js');
            const modal = new RefundPolicyModal();
            return { modal, open: () => modal.open(), close: () => modal.close(), root: () => modal.overlay };
        }
    },
    {
        name: 'ConsultationModal',
        escapeCloses: true,
        async build() {
            document.body.insertAdjacentHTML('beforeend', '<div id="consultationModalOverlay"></div>');
            const { ConsultationModal } = await import('../ConsultationModal.js');
            const modal = new ConsultationModal('consultationModalOverlay', fakeStore());
            return { modal, open: () => modal.open(), close: () => modal.close(), root: () => modal.overlay };
        }
    },
    {
        name: 'ReportPreviewModal',
        escapeCloses: true,
        async build() {
            const { ReportPreviewModal } = await import('../ReportPreviewModal.js');
            const modal = new ReportPreviewModal(fakeStore());
            return { modal, open: () => modal.open('تقرير'), close: () => modal.close(), root: () => modal.overlay };
        }
    },
    {
        name: 'PaywallModal',
        escapeCloses: true,
        async build() {
            const { PaywallModal } = await import('../PaywallModal.js');
            const modal = new PaywallModal('paywallOverlay', fakeStore());
            return { modal, open: () => modal.open('تقرير PDF'), close: () => modal.close(), root: () => modal.overlay };
        }
    },
    {
        name: 'NewPasswordModal',
        escapeCloses: true,
        async build() {
            const { NewPasswordModal } = await import('../NewPasswordModal.js');
            const modal = new NewPasswordModal();
            return { modal, open: () => modal.open(), close: () => modal.close(), root: () => modal.overlay };
        }
    },
    {
        name: 'WhatsAppContactModal',
        escapeCloses: true,
        async build() {
            const { WhatsAppContactModal } = await import('../WhatsAppContactModal.js');
            const modal = new WhatsAppContactModal();
            return { modal, open: () => modal.open(), close: () => modal.close(), root: () => modal.overlay };
        }
    },
    {
        name: 'TwoFactorModal',
        escapeCloses: true,
        async build() {
            const { TwoFactorModal } = await import('../TwoFactorModal.js');
            const modal = new TwoFactorModal();
            let overlay = null;
            return {
                modal,
                open: async () => { await modal.show(); overlay = document.getElementById('2fa-modal-overlay'); },
                close: () => modal._close(overlay),
                root: () => overlay
            };
        }
    },
    {
        name: 'CompletePhoneModal',
        escapeCloses: false,
        async build() {
            const { CompletePhoneModal } = await import('../CompletePhoneModal.js');
            const modal = new CompletePhoneModal();
            return { modal, open: () => modal.open(), close: () => modal.close(), root: () => modal.overlay };
        }
    },
    {
        name: 'PackagePreferenceModal',
        escapeCloses: false,
        async build() {
            const { PackagePreferenceModal } = await import('../PackagePreferenceModal.js');
            const modal = new PackagePreferenceModal();
            return { modal, open: () => modal.open(), close: () => modal.close(), root: () => modal.overlay };
        }
    },
    {
        name: 'WhatsAppVerifyModal',
        escapeCloses: false,
        async build() {
            const { WhatsAppVerifyModal } = await import('../WhatsAppVerifyModal.js');
            const modal = new WhatsAppVerifyModal();
            return { modal, open: () => modal.open(), close: () => modal.close(), root: () => modal.overlay };
        }
    },
    {
        name: 'PhoneAuthModal',
        escapeCloses: false,
        async build() {
            const { PhoneAuthModal } = await import('../PhoneAuthModal.js');
            const modal = new PhoneAuthModal('phoneAuth', {});
            return { modal, open: () => modal.open(), close: () => modal.skip(), root: () => modal.overlay };
        }
    },
    {
        name: 'AuthModalStub',
        escapeCloses: true,
        async build() {
            const { AuthModal } = await import('../AuthModalStub.js');
            const modal = new AuthModal('auth', {});
            return { modal, open: () => modal.open(), close: () => modal.close(), root: () => modal.overlay };
        }
    }
];

describe('عقد الوصول للنوافذ المنبثقة', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        document.body.innerHTML = '';
        updateUserProfileMock.mockClear();
    });
    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    for (const spec of MODALS) {
        describe(spec.name, () => {
            it('يحمل role="dialog" و aria-modal="true"', async () => {
                pageWithOpener();
                const h = await spec.build();
                await h.open();
                await vi.advanceTimersByTimeAsync(60);

                const dialog = h.root().querySelector('[role="dialog"]') || h.root();
                expect(dialog.getAttribute('role')).toBe('dialog');
                expect(dialog.getAttribute('aria-modal')).toBe('true');
                h.close();
            });

            it('عند الفتح ينتقل التركيز إلى داخل النافذة', async () => {
                const opener = pageWithOpener();
                const h = await spec.build();
                await h.open();
                await vi.advanceTimersByTimeAsync(60);

                expect(document.activeElement).not.toBe(opener);
                expect(document.activeElement).not.toBe(document.body);
                expect(h.root().contains(document.activeElement)).toBe(true);
                h.close();
            });

            it('Tab لا يخرج التركيز من النافذة', async () => {
                pageWithOpener();
                const h = await spec.build();
                await h.open();
                await vi.advanceTimersByTimeAsync(60);

                const root = h.root();
                const dialog = root.querySelector('[role="dialog"]') || root;
                const items = focusablesIn(dialog);
                expect(items.length).toBeGreaterThan(0);

                // من آخر عنصر: Tab يجب أن يُمنع ويلتف للأول، لا أن يسرّب التركيز للصفحة.
                items[items.length - 1].focus();
                const forward = pressKey('Tab');
                expect(forward.defaultPrevented).toBe(true);
                expect(dialog.contains(document.activeElement)).toBe(true);

                // ومن أول عنصر بالعكس.
                items[0].focus();
                const backward = pressKey('Tab', { shift: true });
                expect(backward.defaultPrevented).toBe(true);
                expect(dialog.contains(document.activeElement)).toBe(true);

                h.close();
            });

            it('الإغلاق يُعيد التركيز إلى الزر الذي فتح النافذة', async () => {
                const opener = pageWithOpener();
                const h = await spec.build();
                await h.open();
                await vi.advanceTimersByTimeAsync(60);
                expect(document.activeElement).not.toBe(opener);

                await h.close();
                await vi.advanceTimersByTimeAsync(60);

                expect(document.activeElement).toBe(opener);
            });

            it('الإغلاق لا يُضيّع التركيز إن أُزيل الزر الفاتح من DOM أثناء الفتح', async () => {
                const opener = pageWithOpener();
                const h = await spec.build();
                await h.open();
                await vi.advanceTimersByTimeAsync(60);

                opener.remove();                 // إعادة رسم الصفحة خلف النافذة
                await h.close();
                await vi.advanceTimersByTimeAsync(60);

                expect(document.activeElement).toBe(document.getElementById('appMain'));
            });

            if (spec.escapeCloses) {
                it('Escape يُغلق النافذة', async () => {
                    const opener = pageWithOpener();
                    const h = await spec.build();
                    await h.open();
                    await vi.advanceTimersByTimeAsync(60);

                    pressKey('Escape');
                    await vi.advanceTimersByTimeAsync(60);

                    const root = h.root();
                    const stillOpen = !!root && root.isConnected && root.classList.contains('is-open');
                    expect(stillOpen).toBe(false);
                    expect(document.activeElement).toBe(opener);
                });
            } else {
                it('Escape لا يُغلقها — خطوة إلزامية عمداً', async () => {
                    pageWithOpener();
                    const h = await spec.build();
                    await h.open();
                    await vi.advanceTimersByTimeAsync(60);

                    pressKey('Escape');
                    await vi.advanceTimersByTimeAsync(60);

                    expect(h.root()).not.toBeNull();
                    expect(h.root().isConnected).toBe(true);
                    h.close();
                });
            }
        });
    }
});

describe('AIChatModal — لوحة غير حاجبة', () => {
    beforeEach(() => { document.body.innerHTML = '<main id="appMain"></main>'; });
    afterEach(() => { document.body.innerHTML = ''; });

    async function mountChat() {
        const { AIChatModal } = await import('../AIChatModal.js');
        const chat = new AIChatModal(fakeStore());
        chat.mount();
        return chat;
    }

    it('تحمل role="dialog" لكن بلا aria-modal — الصفحة خلفها تبقى مستخدَمة', async () => {
        const chat = await mountChat();
        chat.toggle();

        expect(chat.container.getAttribute('role')).toBe('dialog');
        expect(chat.container.hasAttribute('aria-modal')).toBe(false);
        expect(chat.container.getAttribute('aria-label')).toBe('المستشار الذكي');
    });

    it('الفتح ينقل التركيز لحقل الكتابة، ولا يحبس Tab (لوحة لا تحجب شيئاً)', async () => {
        const chat = await mountChat();
        chat.toggle();

        expect(document.activeElement).toBe(chat.container.querySelector('.ai-chat-input'));
        const event = pressKey('Tab');
        expect(event.defaultPrevented).toBe(false);
    });

    it('Escape يُغلقها ويُعيد التركيز للزر العائم', async () => {
        const chat = await mountChat();
        chat.fab.focus();
        chat.toggle();
        expect(chat.isOpen).toBe(true);

        pressKey('Escape');

        expect(chat.isOpen).toBe(false);
        expect(chat.container.style.display).toBe('none');
        expect(document.activeElement).toBe(chat.fab);
    });
});

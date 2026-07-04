/**
 * Shell controller: sidebar toggle, live panel toggle, refund policy link.
 * Extracted from app.js to reduce size and separate concerns (production-readiness).
 */

export function initShellController(options) {
  const {
    sidebarDom,
    sidebarOverlay,
    btnToggleSidebar,
    livePanelEl,
    livePanelOverlay,
    btnToggleLivePanel,
    btnToggleLivePanelFab,
    btnCloseLivePanel
  } = options;

  let lastLivePanelOpener = null;
  let lastSidebarOpener = null;

  const setLivePanelOpen = (open, { opener = null } = {}) => {
    if (!livePanelEl || !livePanelOverlay) return;
    const willOpen = !!open;
    if (willOpen && opener) lastLivePanelOpener = opener;
    livePanelEl.classList.toggle('is-open', willOpen);
    livePanelOverlay.classList.toggle('is-open', willOpen);
    btnToggleLivePanel?.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    btnToggleLivePanelFab?.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if (willOpen) {
      const focusTarget = document.getElementById('btnCloseLivePanel') || livePanelEl.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusTarget) setTimeout(() => focusTarget.focus(), 0);
    } else {
      if (lastLivePanelOpener && typeof lastLivePanelOpener.focus === 'function') {
        setTimeout(() => lastLivePanelOpener.focus(), 0);
      }
    }
  };

  if (livePanelEl && livePanelOverlay) {
    const toggleLivePanel = (e) => {
      e?.preventDefault();
      const isOpen = livePanelEl.classList.contains('is-open');
      if (!isOpen) {
        sidebarDom?.classList.remove('is-open');
        sidebarOverlay?.classList.remove('is-open');
        btnToggleSidebar?.setAttribute('aria-expanded', 'false');
      }
      setLivePanelOpen(!isOpen, { opener: e?.currentTarget || null });
    };
    btnToggleLivePanel?.addEventListener('click', toggleLivePanel);
    btnToggleLivePanelFab?.addEventListener('click', toggleLivePanel);
    btnCloseLivePanel?.addEventListener('click', () => setLivePanelOpen(false));
    livePanelOverlay.addEventListener('click', () => setLivePanelOpen(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setLivePanelOpen(false);
    });
    setLivePanelOpen(false);
  }

  if (btnToggleSidebar && sidebarDom) {
    const toggleSidebar = (e) => {
      e?.preventDefault();
      if (!sidebarDom) return;
      const willOpen = !sidebarDom.classList.contains('is-open');
      if (willOpen) {
        if (e?.currentTarget) lastSidebarOpener = e.currentTarget;
        setLivePanelOpen(false);
      }
      sidebarDom.classList.toggle('is-open', willOpen);
      if (sidebarOverlay) sidebarOverlay.classList.toggle('is-open', willOpen);
      btnToggleSidebar.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      if (willOpen) {
        const focusTarget = sidebarDom.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusTarget) setTimeout(() => focusTarget.focus(), 0);
      } else {
        if (lastSidebarOpener && typeof lastSidebarOpener.focus === 'function') {
          setTimeout(() => lastSidebarOpener.focus(), 0);
        }
      }
    };
    btnToggleSidebar.addEventListener('click', toggleSidebar);
    btnToggleSidebar.addEventListener('touchstart', () => {}, { passive: true });
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => {
        sidebarDom.classList.remove('is-open');
        sidebarOverlay.classList.remove('is-open');
        btnToggleSidebar?.setAttribute('aria-expanded', 'false');
        if (lastSidebarOpener && typeof lastSidebarOpener.focus === 'function') {
          setTimeout(() => lastSidebarOpener.focus(), 0);
        }
      });
    }
    if (sidebarDom) {
      sidebarDom.addEventListener('click', (e) => {
        if (e.target.closest('.nav-btn') || e.target.closest('button') || e.target.closest('.step-item')) {
          if (window.innerWidth <= 768) {
            sidebarDom.classList.remove('is-open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('is-open');
            btnToggleSidebar?.setAttribute('aria-expanded', 'false');
            if (lastSidebarOpener && typeof lastSidebarOpener.focus === 'function') {
              setTimeout(() => lastSidebarOpener.focus(), 0);
            }
          }
        }
      });
    }
  }

  const linkRefund = document.getElementById('linkRefundPolicy');
  if (linkRefund) {
    linkRefund.addEventListener('click', (e) => {
      e.preventDefault();
      import('./ui/RefundPolicyModal.js').then(({ RefundPolicyModal }) => {
        new RefundPolicyModal().open();
      });
    });
  }

  return { setLivePanelOpen };
}

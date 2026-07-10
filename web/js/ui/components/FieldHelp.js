/**
 * أيقونة مساعدة (؟) موحدة بجانب أي سؤال/حقل — للمبتدئ الذي لا يفهم السؤال.
 * الاستخدام: html`<label>السؤال ${fieldHelp('شرح بسيط', 'مثال: ...')}</label>`
 * تعمل باللمس والفأرة ولوحة المفاتيح (زر حقيقي + aria)، RTL، وتحقن CSS مرة واحدة.
 */

let stylesInjected = false;
let helpSequence = 0;

function injectStyles() {
    if (stylesInjected || document.getElementById('field-help-styles')) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.id = 'field-help-styles';
    style.textContent = `
        .field-help { position: relative; display: inline-flex; vertical-align: middle; margin-inline-start: 6px; }
        .field-help-btn {
            width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--border-color, #cbd5e1);
            background: var(--bg-secondary, #f1f5f9); color: var(--text-secondary, #64748b);
            font-size: 13px; font-weight: 700; line-height: 1; cursor: help; padding: 0;
            display: inline-flex; align-items: center; justify-content: center;
        }
        .field-help-btn:hover, .field-help-btn:focus-visible { background: var(--primary-color, #2563eb); color: #fff; border-color: transparent; }
        .field-help-pop {
            position: absolute; z-index: 1000; top: calc(100% + 6px); inset-inline-start: 0; inset-inline-end: auto;
            width: 280px; max-width: min(280px, calc(100vw - 32px));
            background: var(--bg-primary, #fff); color: var(--text-primary, #1e293b);
            border: 1px solid var(--border-color, #cbd5e1); border-radius: 8px;
            box-shadow: 0 6px 20px rgba(0,0,0,.12); padding: 10px 12px;
            font-size: 12.5px; font-weight: 400; line-height: 1.7; text-align: right; white-space: normal;
            display: none; transform: translateX(var(--field-help-shift, 0px));
        }
        [dir="ltr"] .field-help-pop { text-align: left; }
        .field-help.open .field-help-pop,
        .field-help:hover .field-help-pop,
        .field-help:focus-within .field-help-pop { display: block; }
        .field-help-pop .fh-example { display: block; margin-top: 6px; color: var(--text-secondary, #64748b); }
        .field-help-pop .fh-example::before { content: '💡 '; }
        .field-help--standalone { margin-block: 0 4px; }
        th .field-help { margin-inline-start: 4px; }
    `;
    document.head.appendChild(style);
}

let delegated = false;

function keepPopupInsideViewport(wrapper) {
    const pop = wrapper?.querySelector('.field-help-pop');
    if (!pop || typeof window === 'undefined') return;
    pop.style.setProperty('--field-help-shift', '0px');
    const rect = pop.getBoundingClientRect();
    const margin = 12;
    let shift = 0;
    if (rect.left < margin) shift = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) shift = (window.innerWidth - margin) - rect.right;
    pop.style.setProperty('--field-help-shift', `${Math.round(shift)}px`);
}

function delegateEvents() {
    if (delegated) return;
    delegated = true;
    // تفويض واحد على المستند: يعمل مع أي محتوى يُعاد رسمه (innerHTML) دون إعادة ربط
    document.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('.field-help-btn');
        document.querySelectorAll('.field-help.open').forEach(w => {
            if (!btn || w !== btn.parentElement) {
                w.classList.remove('open');
                w.querySelector('.field-help-btn')?.setAttribute('aria-expanded', 'false');
            }
        });
        if (btn) {
            e.preventDefault();
            const isOpen = btn.parentElement.classList.toggle('open');
            btn.setAttribute('aria-expanded', String(isOpen));
            if (isOpen) keepPopupInsideViewport(btn.parentElement);
        }
    });
    document.addEventListener('pointerover', (e) => {
        const wrapper = e.target.closest && e.target.closest('.field-help');
        if (wrapper) requestAnimationFrame(() => keepPopupInsideViewport(wrapper));
    });
    document.addEventListener('focusin', (e) => {
        const wrapper = e.target.closest && e.target.closest('.field-help');
        if (wrapper) requestAnimationFrame(() => keepPopupInsideViewport(wrapper));
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.querySelectorAll('.field-help.open').forEach(w => {
            w.classList.remove('open');
            w.querySelector('.field-help-btn')?.setAttribute('aria-expanded', 'false');
        });
    });
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * يُرجع HTML لأيقونة (؟) مع شرح ومثال اختياري.
 * @param {string} explanation - شرح السؤال بلغة بسيطة
 * @param {string} [example] - مثال عملي يظهر بسطر منفصل
 * @returns {string} HTML string
 */
export function fieldHelp(explanation, example = '') {
    if (!explanation) return '';
    injectStyles();
    delegateEvents();
    const tooltipId = `field-help-${++helpSequence}`;
    const ex = example ? `<span class="fh-example">${escapeHtml(example)}</span>` : '';
    return `<span class="field-help"><button type="button" class="field-help-btn" aria-label="شرح هذه الخانة" aria-expanded="false" aria-controls="${tooltipId}">؟</button><span class="field-help-pop" id="${tooltipId}" role="tooltip">${escapeHtml(explanation)}${ex}</span></span>`;
}

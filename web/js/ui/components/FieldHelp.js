/**
 * أيقونة مساعدة (؟) موحدة بجانب أي سؤال/حقل — للمبتدئ الذي لا يفهم السؤال.
 * الاستخدام: html`<label>السؤال ${fieldHelp('شرح بسيط', 'مثال: ...')}</label>`
 * تعمل باللمس والفأرة ولوحة المفاتيح (زر حقيقي + aria)، RTL، وتحقن CSS مرة واحدة.
 */

let stylesInjected = false;

function injectStyles() {
    if (stylesInjected || document.getElementById('field-help-styles')) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.id = 'field-help-styles';
    style.textContent = `
        .field-help { position: relative; display: inline-flex; vertical-align: middle; margin-inline-start: 6px; }
        .field-help-btn {
            width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--border-color, #cbd5e1);
            background: var(--bg-secondary, #f1f5f9); color: var(--text-secondary, #64748b);
            font-size: 12px; line-height: 1; cursor: help; padding: 0;
            display: inline-flex; align-items: center; justify-content: center;
        }
        .field-help-btn:hover, .field-help-btn:focus-visible { background: var(--primary-color, #2563eb); color: #fff; border-color: transparent; }
        .field-help-pop {
            position: absolute; z-index: 60; top: calc(100% + 6px); inset-inline-start: 50%;
            transform: translateX(50%); width: max-content; max-width: 280px;
            background: var(--bg-primary, #fff); color: var(--text-primary, #1e293b);
            border: 1px solid var(--border-color, #cbd5e1); border-radius: 8px;
            box-shadow: 0 6px 20px rgba(0,0,0,.12); padding: 10px 12px;
            font-size: 12.5px; font-weight: 400; line-height: 1.7; text-align: right; white-space: normal;
            display: none;
        }
        [dir="ltr"] .field-help-pop { transform: translateX(-50%); text-align: left; }
        .field-help.open .field-help-pop { display: block; }
        .field-help-pop .fh-example { display: block; margin-top: 6px; color: var(--text-secondary, #64748b); }
        .field-help-pop .fh-example::before { content: '💡 '; }
    `;
    document.head.appendChild(style);
}

let delegated = false;

function delegateEvents() {
    if (delegated) return;
    delegated = true;
    // تفويض واحد على المستند: يعمل مع أي محتوى يُعاد رسمه (innerHTML) دون إعادة ربط
    document.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('.field-help-btn');
        document.querySelectorAll('.field-help.open').forEach(w => {
            if (!btn || w !== btn.parentElement) w.classList.remove('open');
        });
        if (btn) {
            e.preventDefault();
            btn.parentElement.classList.toggle('open');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.querySelectorAll('.field-help.open').forEach(w => w.classList.remove('open'));
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
    const ex = example ? `<span class="fh-example">${escapeHtml(example)}</span>` : '';
    return `<span class="field-help"><button type="button" class="field-help-btn" aria-label="ما معنى هذا السؤال؟" aria-expanded="false">؟</button><span class="field-help-pop" role="tooltip">${escapeHtml(explanation)}${ex}</span></span>`;
}

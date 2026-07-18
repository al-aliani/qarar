const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

export class ModeSelector {
    constructor(onSelect) {
        this.onSelect = onSelect;
        this.overlay = null;
    }

    render() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'mode-selector-overlay';
        Object.assign(this.overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: '9999',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.3s ease-out'
        });

        // Create container
        const container = document.createElement('div');
        container.className = 'mode-selector-container';
        Object.assign(container.style, {
            maxWidth: '900px',
            width: '90%',
            backgroundColor: 'var(--c-bg-panel)',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-lg)',
            padding: 'var(--s-4)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            textAlign: 'center'
        });

        container.innerHTML = `
            <h1 style="font-size: 2rem; color: var(--c-p-500); margin-bottom: 0.5rem;">${icon('i-star')} مرحباً بك في دراسة الجدوى الذكية</h1>
            <p style="color: var(--c-text-muted); margin-bottom: 2.5rem; font-size: 1.1rem;">اختر الطريقة التي تناسبك للبدء في مشروعك</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                <!-- Quick Mode Card -->
                <button class="mode-card" data-mode="quick" style="
                    background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%);
                    border: 1px solid var(--c-border);
                    border-radius: var(--r-md);
                    padding: 2rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: right;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    group
                ">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">${icon('i-rocket')}</div>
                    <h3 style="color: var(--c-text-main); font-size: 1.4rem; margin: 0;">الدراسة السريعة</h3>
                    <p style="color: var(--c-text-muted); font-size: 0.95rem; line-height: 1.6;">
                        مثالية للأفكار الجديدة. سنطلب منك <strong>5 معلومات فقط</strong>، وسيقوم الذكاء الاصطناعي بتقدير الباقي بناءً على السوق السعودي.
                    </p>
                    <div style="margin-top: auto; padding-top: 1rem;">
                        <span style="color: var(--c-p-500); font-weight: bold; font-size: 0.9rem;">ابدأ في 5 دقائق &larr;</span>
                    </div>
                </button>

                <!-- Detailed Mode Card -->
                <button class="mode-card" data-mode="detailed" style="
                    background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%);
                    border: 1px solid var(--c-border);
                    border-radius: var(--r-md);
                    padding: 2rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: right;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                ">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">${icon('i-folder')}</div>
                    <h3 style="color: var(--c-text-main); font-size: 1.4rem; margin: 0;">الدراسة التفصيلية</h3>
                    <p style="color: var(--c-text-muted); font-size: 0.95rem; line-height: 1.6;">
                        للمحترفين والجهات التمويلية. تحكم كامل في كل رقم وتفصيل في الدراسة الفنية، المالية، والتسويقية.
                    </p>
                    <div style="margin-top: auto; padding-top: 1rem;">
                        <span style="color: var(--c-text-muted); font-size: 0.9rem;">المسار الكامل &larr;</span>
                    </div>
                </button>
            </div>
            
            <p style="margin-top: 2rem; font-size: 0.85rem; color: var(--c-text-muted); opacity: 0.7;">
                يمكنك دائماً التبديل بين الوضعين لاحقاً من الإعدادات.
            </p>
        `;

        // Add hover effects via JS since inline styles are tricky for hover
        const cards = container.querySelectorAll('.mode-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-5px)';
                card.style.borderColor = 'var(--c-p-500)';
                card.style.background = 'rgba(212, 175, 55, 0.05)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.style.borderColor = 'var(--c-border)';
                card.style.background = 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)';
            });
            card.addEventListener('click', () => {
                this.close();
                if (this.onSelect) this.onSelect(card.dataset.mode);
            });
        });

        this.overlay.appendChild(container);
        document.body.appendChild(this.overlay);
    }

    close() {
        if (this.overlay) {
            this.overlay.style.opacity = '0';
            setTimeout(() => {
                if (this.overlay && this.overlay.parentNode) {
                    this.overlay.parentNode.removeChild(this.overlay);
                }
                this.overlay = null;
            }, 300);
        }
    }
}

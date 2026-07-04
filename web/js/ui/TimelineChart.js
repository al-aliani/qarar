/**
 * TimelineChart.js — خارطة الطريق المرئية (Visual Roadmap)
 * خط زمني أفقي أنيق: مراحل كدوائر متصلة بخط، مع سحب وإفلات لتعديل التواريخ.
 */

const MONTHS = 12;
const CATEGORY_LABELS = {
    legal: 'قانوني',
    technical: 'فني',
    hr: 'موارد بشرية',
    marketing: 'تسويق',
    launch: 'افتتاح'
};

/**
 * تحويل شهر (1-12) إلى نسبة موضع أفقي 0-100 (مع هامش)
 */
function monthToPercent(month) {
    const m = Math.max(1, Math.min(MONTHS, Number(month) || 1));
    return ((m - 0.5) / MONTHS) * 100;
}

/**
 * تحويل موقع أفقي (نسبة 0-100 أو بكسل) إلى شهر 1-12
 */
function positionToMonth(percent, trackRect) {
    if (trackRect && typeof percent === 'number' && percent >= 0 && percent <= 1) {
        const pct = percent * 100;
        const month = (pct / 100) * MONTHS + 0.5;
        return Math.max(1, Math.min(MONTHS, Math.round(month)));
    }
    const pct = typeof percent === 'number' ? Math.max(0, Math.min(100, percent)) : 0;
    const month = (pct / 100) * MONTHS + 0.5;
    return Math.max(1, Math.min(MONTHS, Math.round(month)));
}

export class TimelineChart {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            onActivityMove: options.onActivityMove || (() => {}),
            onActivityClick: options.onActivityClick || (() => {}),
            ...options
        };
        this._trackRect = null;
        this._dragging = null;
    }

    /**
     * @param {Array<{ id: number|string, name: string, startMonth: number, duration?: number, category?: string }>} activities
     */
    render(activities = []) {
        if (!this.container) return;

        const sorted = [...activities].sort((a, b) => (a.startMonth || 1) - (b.startMonth || 1));

        this.container.innerHTML = `
            <div class="timeline-chart">
                <div class="timeline-chart__axis">
                    ${Array.from({ length: MONTHS }, (_, i) => i + 1).map(m =>
                        `<span class="timeline-chart__month" data-month="${m}">م${m}</span>`
                    ).join('')}
                </div>
                <div class="timeline-chart__track" data-track>
                    <div class="timeline-chart__line" aria-hidden="true"></div>
                    ${sorted.map(act => this._renderNode(act)).join('')}
                </div>
            </div>
        `;

        this._trackRect = null;
        this._bindDragDrop();
    }

    _renderNode(act) {
        const month = Math.max(1, Math.min(MONTHS, Number(act.startMonth) || 1));
        const pct = monthToPercent(month);
        const cat = (act.category || 'technical');
        const label = (act.name || '').trim() || 'نشاط';
        const duration = act.duration ? ` (${act.duration} شهر)` : '';

        return `
            <div class="timeline-chart__node timeline-chart__node--${cat}"
                 data-id="${act.id}" 
                 data-month="${month}"
                 style="left: ${pct}%;"
                 role="button"
                 tabindex="0"
                 title="${escapeAttr(label)}${duration}"
                 aria-label="${escapeAttr(label)}، شهر ${month}">
                <span class="timeline-chart__dot"></span>
                <span class="timeline-chart__label">${escapeHtml(label)}</span>
            </div>
        `;
    }

    _bindDragDrop() {
        const track = this.container.querySelector('[data-track]');
        if (!track) return;

        const updateRect = () => {
            this._trackRect = track.getBoundingClientRect();
        };

        const onPointerMove = (e) => {
            if (!this._dragging) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            updateRect();
            const x = clientX - this._trackRect.left;
            const percent = (x / this._trackRect.width) * 100;
            const month = positionToMonth(percent, null);
            this._dragging.node.dataset.month = month;
            this._dragging.node.style.left = monthToPercent(month) + '%';
        };

        const onPointerUp = () => {
            if (!this._dragging) return;
            const month = parseInt(this._dragging.node.dataset.month, 10);
            this.options.onActivityMove(this._dragging.id, month);
            this._dragging.node.classList.remove('is-dragging');
            document.removeEventListener('mousemove', onPointerMove);
            document.removeEventListener('mouseup', onPointerUp);
            document.removeEventListener('touchmove', onTouchMove, { passive: false });
            document.removeEventListener('touchend', onPointerUp);
            this._dragging = null;
        };

        const onTouchMove = (e) => {
            e.preventDefault();
            onPointerMove({ clientX: e.touches[0].clientX });
        };

        track.querySelectorAll('.timeline-chart__node').forEach(node => {
            const id = node.dataset.id;
            if (!id) return;

            const onPointerDown = (e) => {
                if (e.button !== 0 && e.type === 'mousedown') return;
                e.preventDefault();
                updateRect();
                this._dragging = { id, node };
                node.classList.add('is-dragging');
                document.addEventListener('mousemove', onPointerMove);
                document.addEventListener('mouseup', onPointerUp);
                document.addEventListener('touchmove', onTouchMove, { passive: false });
                document.addEventListener('touchend', onPointerUp);
            };

            node.addEventListener('mousedown', onPointerDown);
            node.addEventListener('touchstart', (e) => {
                e.preventDefault();
                onPointerDown({ clientX: e.touches[0].clientX, button: 0, preventDefault: () => {} });
            }, { passive: false });
        });
    }

    cleanup() {
        this._dragging = null;
    }
}

function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function escapeAttr(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

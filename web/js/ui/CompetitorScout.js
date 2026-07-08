/**
 * CompetitorScout — رادار المنافسين (بيانات حقيقية فقط، بلا خريطة).
 *
 * النسخة القديمة كانت مسرحاً خالصاً: تخترع 3-5 منافسين بـ Math.random() من قائمة
 * أسماء ثابتة، وتحمّل Leaflet من unpkg.com (يخالف CSP). أُزيل كل ذلك.
 *
 * هذه النسخة مدفوعة بالموصّل الحيّ الحقيقي (OpenStreetMap Overpass) عبر
 * suggest('market.competitors', ...): تعرض العدد الحقيقي وعيّنة الأسماء الفعلية
 * مع إسناد «© OpenStreetMap contributors» وملاحظة المصدر. وعند تعذّر الجلب تُصرّح
 * بذلك بأمانة وتطلب الإدخال اليدوي — لا تختلق أي رقم.
 *
 * الواجهة العامة محفوظة: constructor(store, onCompetitorsFound) و async open().
 */

import { suggest, isUsable } from '../services/connectors/index.js';

export class CompetitorScout {
    constructor(store, onCompetitorsFound) {
        this.store = store;
        this.onCompetitorsFound = onCompetitorsFound;
        this.overlay = null;
        // آخر عيّنة منافسين حقيقية جُلبت (للاستيراد). لا تُملأ إلا من مصدر موثّق.
        this.foundCompetitors = [];
        this._onEscape = null;
    }

    async open() {
        this.renderModal();
        // بحث تلقائي بمدينة الدراسة إن توفّرت — من الحالة، لا من العدم.
        const city = this._studyCity();
        const input = this.overlay.querySelector('#scoutCityInput');
        if (input && city) input.value = city;
        if (city) await this.search();
    }

    /** مدينة الدراسة من الحالة (لا اختلاق). */
    _studyCity() {
        const pi = this.store?.getState?.()?.projectInfo || {};
        return typeof pi.city === 'string' ? pi.city.trim() : '';
    }

    /** إحداثيات الموقع من الحالة إن وُجدت (تحليل الموقع) — تُفضَّل على المدينة. */
    _studyCoords() {
        const pi = this.store?.getState?.()?.projectInfo || {};
        const c = pi?.locationAnalysis?.coordinates;
        if (c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))) {
            return { lat: Number(c.lat), lng: Number(c.lng) };
        }
        return null;
    }

    renderModal() {
        let overlay = document.getElementById('scout-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'scout-overlay';
            overlay.innerHTML = `
                <div class="scout-modal" role="dialog" aria-modal="true" aria-labelledby="scoutTitle">
                    <div class="scout-header">
                        <h3 id="scoutTitle">رادار المنافسين — بيانات حيّة</h3>
                        <button type="button" id="btnCloseScout" aria-label="إغلاق">✕</button>
                    </div>
                    <div class="scout-body">
                        <div class="scout-search-row">
                            <input type="text" id="scoutCityInput" class="scout-input"
                                   placeholder="اكتب المدينة (مثل: الرياض، جدة، الدمام)"
                                   aria-label="المدينة" />
                            <button type="button" class="btn btn--primary" id="btnScoutSearch">ابحث في مدينتي</button>
                        </div>
                        <p class="scout-hint">
                            نعدّ المطاعم والوجبات السريعة والمقاهي القريبة فعلياً من
                            OpenStreetMap — عدّ حيّ وقت الدراسة، لا أرقام مختلقة.
                        </p>
                        <div id="scoutStatus" class="scout-status" role="status" aria-live="polite"></div>
                        <div id="scoutResults" class="scout-results"></div>
                    </div>
                    <div class="scout-footer">
                        <p id="scoutAttribution" class="scout-attribution"></p>
                        <button type="button" class="btn btn--primary" id="btnImportScout" disabled>استيراد المنافسين</button>
                    </div>
                </div>
                <style>
                    #scout-overlay {
                        position: fixed; inset: 0; width: 100%; height: 100%;
                        background: rgba(0,0,0,0.5); z-index: 10000;
                        display: flex; align-items: center; justify-content: center;
                    }
                    .scout-modal {
                        width: 640px; max-width: 95%; max-height: 90vh; background: #fff;
                        border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;
                    }
                    .scout-header {
                        padding: 15px 20px; border-bottom: 1px solid #eee;
                        display: flex; justify-content: space-between; align-items: center;
                        background: #f8f9fa; font-weight: bold;
                    }
                    .scout-header h3 { margin: 0; font-size: 1.05rem; }
                    #btnCloseScout { border: none; background: none; cursor: pointer; font-size: 1.2rem; line-height: 1; }
                    .scout-body { padding: 18px 20px; overflow-y: auto; }
                    .scout-search-row { display: flex; gap: 8px; margin-bottom: 10px; }
                    .scout-input {
                        flex: 1; padding: 10px 12px; border: 1px solid #ccc; border-radius: 8px;
                        font: inherit; min-width: 0;
                    }
                    .scout-hint { margin: 0 0 12px; color: #666; font-size: 0.85rem; line-height: 1.5; }
                    .scout-status { margin: 6px 0; font-size: 0.9rem; color: #444; min-height: 1.2em; }
                    .scout-count {
                        font-size: 1.05rem; font-weight: bold; color: #0a5; margin: 8px 0;
                    }
                    .scout-list { list-style: none; margin: 6px 0 0; padding: 0; }
                    .scout-list li {
                        padding: 8px 10px; border: 1px solid #eee; border-radius: 8px;
                        margin-bottom: 6px; background: #fafafa; font-size: 0.9rem;
                    }
                    .scout-note { margin: 10px 0 0; color: #777; font-size: 0.8rem; line-height: 1.5; }
                    .scout-error { color: #b00; font-size: 0.92rem; line-height: 1.6; }
                    .scout-footer {
                        padding: 15px 20px; border-top: 1px solid #eee;
                        display: flex; justify-content: space-between; align-items: center; gap: 10px;
                    }
                    .scout-attribution { margin: 0; color: #888; font-size: 0.75rem; flex: 1; }
                </style>
            `;
            document.body.appendChild(overlay);

            overlay.querySelector('#btnCloseScout').addEventListener('click', () => this.close());
            overlay.querySelector('#btnScoutSearch').addEventListener('click', () => this.search());
            overlay.querySelector('#scoutCityInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); this.search(); }
            });
            overlay.querySelector('#btnImportScout').addEventListener('click', () => this.importData());

            this._onEscape = (e) => { if (e.key === 'Escape') this.close(); };
            document.addEventListener('keydown', this._onEscape);
        }
        overlay.style.display = 'flex';
        this.overlay = overlay;
    }

    close() {
        if (this.overlay) this.overlay.style.display = 'none';
        if (this._onEscape) {
            document.removeEventListener('keydown', this._onEscape);
            this._onEscape = null;
        }
    }

    /** يبني سياق الاستعلام: الإحداثيات إن وُجدت، وإلا اسم المدينة من الحقل/الحالة. */
    _searchContext() {
        const coords = this._studyCoords();
        if (coords) return { coords };
        const input = this.overlay?.querySelector('#scoutCityInput');
        const city = (input?.value || this._studyCity() || '').trim();
        return city ? { city } : {};
    }

    async search() {
        if (!this.overlay) return;
        const statusEl = this.overlay.querySelector('#scoutStatus');
        const resultsEl = this.overlay.querySelector('#scoutResults');
        const attribEl = this.overlay.querySelector('#scoutAttribution');
        const importBtn = this.overlay.querySelector('#btnImportScout');

        // إعادة ضبط الحالة قبل كل بحث.
        this.foundCompetitors = [];
        importBtn.disabled = true;
        importBtn.textContent = 'استيراد المنافسين';
        resultsEl.textContent = '';
        attribEl.textContent = '';

        const ctx = this._searchContext();
        if (!ctx.coords && !ctx.city) {
            statusEl.textContent = '';
            this._renderError(resultsEl, 'أدخل اسم المدينة أولاً.');
            return;
        }

        statusEl.textContent = 'جاري جلب البيانات الحيّة من OpenStreetMap…';

        let d;
        try {
            d = await suggest('market.competitors', ctx);
        } catch (e) {
            d = null;
        }

        statusEl.textContent = '';

        // تعذّر الجلب أو لا قيمة → تصريح أمين، بلا اختلاق.
        if (!isUsable(d)) {
            const reason = d?.note ? String(d.note) : 'تعذّر الاتصال بمصدر البيانات.';
            this._renderError(resultsEl, `تعذّر جلب البيانات — أدخل يدوياً.\n${reason}`);
            return;
        }

        const value = d.value || {};
        const count = Number(value.count) || 0;
        const sample = Array.isArray(value.sample) ? value.sample : [];

        // إسناد المصدر (إلزامي بترخيص ODbL).
        attribEl.textContent = '© OpenStreetMap contributors';

        this._renderResults(resultsEl, { count, sample, note: d.note });

        // خزّن العيّنة الحقيقية للاستيراد (أسماء فقط — لا حصص/نقاط قوة مختلقة).
        this.foundCompetitors = sample
            .map((s) => (s && typeof s.name === 'string' ? s.name.trim() : ''))
            .filter(Boolean)
            .map((name) => ({
                name,
                // تُترك فارغة عمداً: لا نخترع حصة سوق أو نقاط قوة/ضعف.
                marketShare: '',      // تقديري — يُدخله المستخدم يدوياً
                strengths: '',
                weaknesses: '',
                estimatedDailyCustomers: '',
                estimatedAvgTicket: ''
            }));

        if (this.foundCompetitors.length > 0) {
            importBtn.disabled = false;
            importBtn.textContent = `استيراد ${this.foundCompetitors.length} منافساً`;
        }
    }

    /** يعرض النتائج الحقيقية عبر DOM آمن (textContent) — لا innerHTML لأسماء خارجية. */
    _renderResults(container, { count, sample, note }) {
        container.textContent = '';

        const countEl = document.createElement('div');
        countEl.className = 'scout-count';
        countEl.textContent = `عدد المنشآت المرصودة فعلياً: ${count}`;
        container.appendChild(countEl);

        const named = (Array.isArray(sample) ? sample : [])
            .map((s) => (s && typeof s.name === 'string' ? s.name.trim() : ''))
            .filter(Boolean);

        if (named.length > 0) {
            const heading = document.createElement('div');
            heading.style.fontSize = '0.85rem';
            heading.style.color = '#555';
            heading.style.margin = '6px 0 2px';
            heading.textContent = `عيّنة من الأسماء (${named.length}):`;
            container.appendChild(heading);

            const ul = document.createElement('ul');
            ul.className = 'scout-list';
            for (const name of named) {
                const li = document.createElement('li');
                li.textContent = name; // آمن: نص خام، لا HTML
                ul.appendChild(li);
            }
            container.appendChild(ul);
        } else if (count > 0) {
            const p = document.createElement('p');
            p.className = 'scout-note';
            p.textContent = 'رُصدت منشآت لكن بلا أسماء موسومة في OpenStreetMap.';
            container.appendChild(p);
        }

        if (note) {
            const noteEl = document.createElement('p');
            noteEl.className = 'scout-note';
            noteEl.textContent = String(note);
            container.appendChild(noteEl);
        }
    }

    /** رسالة تعذّر أمينة — تدعو للإدخال اليدوي بلا اختلاق. */
    _renderError(container, message) {
        container.textContent = '';
        const p = document.createElement('p');
        p.className = 'scout-error';
        p.textContent = String(message);
        container.appendChild(p);
    }

    importData() {
        if (this.foundCompetitors.length > 0 && typeof this.onCompetitorsFound === 'function') {
            // نمرّر نسخاً حتى لا يشارك المستهلك المرجع الداخلي.
            this.onCompetitorsFound(this.foundCompetitors.map((c) => ({ ...c })));
        }
        this.close();
    }
}

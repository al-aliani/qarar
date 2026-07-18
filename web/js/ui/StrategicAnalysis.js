/**
 * Strategic Analysis Component
 * Displays PESTEL, SWOT, and Porter's Five Forces analysis
 */

import { AIWriter } from '../services/AIWriter.js';
import { InternalAIGenerator } from '../services/InternalAIGenerator.js';
import { toast } from '../utils/toast.js';
import { escapeHtml } from '../utils/escape.js';
import { calculateStudy } from '../core/engine.js';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#${id}"/></svg>`;

export class StrategicAnalysis {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.isGenerating = false;
        this.stepIndex = 0;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        const strategic = state.strategic || {};

        let partnerNeeds = [];
        try {
            partnerNeeds = calculateStudy(state)?.partnerNeeds || [];
        } catch (e) {
            console.error('[StrategicAnalysis] تعذّر حساب احتياجات الشريك الاستراتيجي:', e);
        }

        this.container.innerHTML = `
            <div class="strategic-analysis">
                <h2 class="section-title">التحليل الاستراتيجي</h2>
                
                <!-- PESTEL Analysis -->
                <div class="card analysis-card">
                    <div class="flex-between">
                        <div>
                            <h3 class="card-title">تحليل بيستل (PESTEL)</h3>
                            <p class="text-muted text-sm mb-3">تحليل البيئة الخارجية للمشروع</p>
                        </div>
                        <button type="button" class="btn-xs btn-magic btn-generate-pestel" title="توليد PESTEL من بيانات المشروع (بدون اتصال خارجي)">${icon('i-sparkle')} توليد تلقائي من البيانات</button>
                    </div>
                    ${this.renderPESTEL(strategic.pestel || [])}
                </div>

                <!-- SWOT Analysis -->
                <div class="card analysis-card">
                    <div class="flex-between">
                        <div>
                            <h3 class="card-title">التحليل الرباعي (SWOT)</h3>
                            <p class="text-muted text-sm mb-3">نقاط القوة والضعف والفرص والتهديدات</p>
                        </div>
                        <div class="flex gap-2 flex-wrap">
                            <button type="button" class="btn-xs btn-magic btn-generate-swot" title="توليد SWOT من بيانات المشروع (بدون اتصال خارجي)">${icon('i-sparkle')} توليد تلقائي من البيانات</button>
                            <button class="btn-xs btn-magic ai-swot-btn">${icon('i-sparkle')} اقتراح تلقائي (AI)</button>
                        </div>
                    </div>
                    ${this.renderSWOT(strategic.swot || {})}
                </div>

                <!-- TOWS Matrix (مبنية على SWOT) -->
                <div class="card analysis-card">
                    <div class="flex-between">
                        <div>
                            <h3 class="card-title">مصفوفة الاستراتيجيات (TOWS)</h3>
                            <p class="text-muted text-sm mb-3">حوِّل SWOT إلى استراتيجيات عملية: كل ربع يربط بين محورين. اكتب بنداً إجرائياً واحداً على الأقل في كل مربع.</p>
                        </div>
                        <button type="button" class="btn-xs btn-magic btn-generate-tows" title="تعبئة الأرباع الفارغة من بنود SWOT الفعلية (بدون اتصال خارجي، لا يستبدل ما كتبته)">${icon('i-sparkle')} توليد من SWOT</button>
                    </div>
                    ${this.renderTOWS((state.marketing && state.marketing.towsMatrix) || {})}
                </div>

                <!-- Porter's Five Forces -->
                <div class="card analysis-card">
                    <div class="flex-between">
                        <div>
                            <h3 class="card-title">القوى الخمس لبورتر</h3>
                            <p class="text-muted text-sm mb-3">تحليل القوى التنافسية في الصناعة</p>
                        </div>
                        <button type="button" class="btn-xs btn-magic btn-generate-porter" title="توليد تحليل بورتر من بيانات المشروع (بدون اتصال خارجي)">${icon('i-sparkle')} توليد تلقائي من البيانات</button>
                    </div>
                    ${this.renderPorter(strategic.porter || {})}
                </div>

                <!-- Partner Needs (نوع الشريك الاستراتيجي المطلوب) — قيمة محسوبة حياً، بلا زر توليد -->
                <div class="card analysis-card">
                    <div class="flex-between">
                        <div>
                            <h3 class="card-title">نوع الشريك الاستراتيجي المطلوب</h3>
                            <p class="text-muted text-sm mb-3">مُشتق تلقائياً من بيانات الدراسة الفعلية — يتحدّث تلقائياً، لا يحتاج توليداً يدوياً</p>
                        </div>
                    </div>
                    ${this.renderPartnerNeeds(partnerNeeds)}
                </div>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    renderPESTEL(pestel) {
        const factors = pestel.length > 0 ? pestel : [
            { factor: 'political', label: 'سياسي', description: '', impact: 'neutral', notes: '' },
            { factor: 'economic', label: 'اقتصادي', description: '', impact: 'neutral', notes: '' },
            { factor: 'social', label: 'اجتماعي', description: '', impact: 'neutral', notes: '' },
            { factor: 'technological', label: 'تقني', description: '', impact: 'neutral', notes: '' },
            { factor: 'environmental', label: 'بيئي', description: '', impact: 'neutral', notes: '' },
            { factor: 'legal', label: 'قانوني', description: '', impact: 'neutral', notes: '' }
        ];

        const icons = {
            political: icon('i-bank'),
            economic: icon('i-chart'),
            social: icon('i-users'),
            technological: icon('i-code'),
            environmental: icon('i-pin'),
            legal: icon('i-scale')
        };

        const impactLabels = {
            positive: { label: 'إيجابي', class: 'badge--success' },
            negative: { label: 'سلبي', class: 'badge--danger' },
            neutral: { label: 'محايد', class: 'badge--neutral' }
        };

        return `
            <div class="pestel-grid">
                ${factors.map((f, idx) => `
                    <div class="pestel-item" data-factor="${f.factor}">
                        <div class="pestel-header">
                            <span class="pestel-icon">${icons[f.factor] || icon('i-info')}</span>
                            <span class="pestel-label">${f.label}</span>
                        </div>
                        <textarea 
                            class="input pestel-desc" 
                            data-idx="${idx}" 
                            data-field="description"
                            placeholder="وصف التأثير..."
                            rows="2"
                        >${escapeHtml(f.description)}</textarea>
                        <div class="pestel-impact">
                            <label class="text-sm text-muted" for="pestel-impact-${idx}">التأثير:</label>
                            <select id="pestel-impact-${idx}" class="input input--sm pestel-impact-select" data-idx="${idx}" data-field="impact">
                                <option value="positive" ${f.impact === 'positive' ? 'selected' : ''}>إيجابي</option>
                                <option value="negative" ${f.impact === 'negative' ? 'selected' : ''}>سلبي</option>
                                <option value="neutral" ${f.impact === 'neutral' ? 'selected' : ''}>محايد</option>
                            </select>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderSWOT(swot) {
        const categories = [
            { key: 'strengths', label: 'نقاط القوة', icon: icon('i-shield'), class: 'swot-strengths' },
            { key: 'weaknesses', label: 'نقاط الضعف', icon: icon('i-warning'), class: 'swot-weaknesses' },
            { key: 'opportunities', label: 'الفرص', icon: icon('i-target'), class: 'swot-opportunities' },
            { key: 'threats', label: 'التهديدات', icon: icon('i-hand-stop'), class: 'swot-threats' }
        ];

        return `
            <div class="swot-grid">
                ${categories.map(cat => `
                    <div class="swot-quadrant ${cat.class}">
                        <div class="swot-quadrant-header">
                            <span>${cat.icon}</span>
                            <span>${cat.label}</span>
                        </div>
                        <div class="swot-items" data-category="${cat.key}">
                            ${(swot[cat.key] || []).map((item, idx) => `
                                <div class="swot-item">
                                    <span class="swot-item-text">${escapeHtml(item)}</span>
                                    <button class="btn-icon btn-remove-swot" data-category="${cat.key}" data-idx="${idx}" aria-label="حذف بند التحليل الرباعي">×</button>
                                </div>
                            `).join('')}
                        </div>
                        <div class="swot-add">
                            <input type="text" class="input input--sm swot-input" data-category="${cat.key}" placeholder="إضافة بند جديد...">
                            <button class="btn btn--sm btn--ghost btn-add-swot" data-category="${cat.key}">+</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderTOWS(tows) {
        const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const quadrants = [
            { key: 'so', title: 'هجومية (SO)', hint: 'قوة + فرص: استغل نقاط قوتك لاقتناص الفرص. مثال: أطلق منتجاً مميزاً في الحي عالي الطلب.', cls: 'swot-strengths' },
            { key: 'wo', title: 'تطويرية (WO)', hint: 'ضعف + فرص: عالج ضعفك لتلتقط الفرصة. مثال: وظّف خبير تسويق لاستثمار نمو الطلب.', cls: 'swot-opportunities' },
            { key: 'st', title: 'دفاعية (ST)', hint: 'قوة + تهديدات: استخدم قوتك لصدّ التهديد. مثال: برنامج ولاء لمواجهة دخول منافس.', cls: 'swot-threats' },
            { key: 'wt', title: 'انكماشية (WT)', hint: 'ضعف + تهديدات: قلّل المخاطر وتجنّب الخسارة. مثال: خفّض الالتزامات الثابتة عند ضعف السيولة.', cls: 'swot-weaknesses' }
        ];
        return `
            <div class="tows-grid swot-grid">
                ${quadrants.map(q => `
                    <div class="tows-quadrant swot-quadrant ${q.cls}">
                        <div class="swot-quadrant-header">
                            <span>${q.title}</span>
                        </div>
                        <textarea class="input tows-input" data-tows="${q.key}" rows="4" placeholder="${q.hint}">${esc(tows[q.key])}</textarea>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderPorter(porter) {
        const forces = [
            { key: 'newEntrants', label: 'تهديد الداخلين الجدد', icon: icon('i-user'), position: 'top' },
            { key: 'supplierPower', label: 'قوة الموردين', icon: icon('i-box'), position: 'left' },
            { key: 'rivalry', label: 'التنافس في الصناعة', icon: icon('i-trophy'), position: 'center' },
            { key: 'buyerPower', label: 'قوة المشترين', icon: icon('i-users'), position: 'right' },
            { key: 'substitutes', label: 'تهديد البدائل', icon: icon('i-reset'), position: 'bottom' }
        ];

        const levelLabels = { low: 'منخفض', medium: 'متوسط', high: 'عالي' };
        const levelColors = { low: 'success', medium: 'warning', high: 'danger' };

        return `
            <div class="porter-diagram">
                ${forces.map(f => {
            const data = porter[f.key] || { level: 'medium', description: '' };
            return `
                        <div class="porter-force porter-${f.position}" data-force="${f.key}">
                            <div class="porter-force-icon">${f.icon}</div>
                            <div class="porter-force-label">${f.label}</div>
                            <select class="input input--sm porter-level" data-force="${f.key}">
                                <option value="low" ${data.level === 'low' ? 'selected' : ''}>منخفض</option>
                                <option value="medium" ${data.level === 'medium' ? 'selected' : ''}>متوسط</option>
                                <option value="high" ${data.level === 'high' ? 'selected' : ''}>عالي</option>
                            </select>
                            <textarea class="input porter-desc" data-force="${f.key}" rows="3"
                                   placeholder="وصف...">${escapeHtml(data.description)}</textarea>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    renderPartnerNeeds(partnerNeeds) {
        if (!partnerNeeds || partnerNeeds.length === 0) {
            return `<p class="text-muted text-sm" style="font-style: italic;">لا توجد إشارات كافية حالياً لتحديد نوع شريك استراتيجي مطلوب — عبّئ الملكية الأجنبية، نموذج العمل، مستوى التقنية، وجدول الموردين في الخطوات السابقة لرصدها هنا.</p>`;
        }
        return `
            <div class="flex flex-col gap-2">
                ${partnerNeeds.map(n => `
                    <div class="partner-need-item">
                        <div class="flex-between mb-2">
                            <strong>${escapeHtml(n.label)}</strong>
                            <span class="badge badge--${n.priority === 'high' ? 'warning' : 'neutral'}">${n.priority === 'high' ? 'أولوية عالية' : 'أولوية متوسطة'}</span>
                        </div>
                        <p class="text-sm text-muted">${escapeHtml(n.reason)}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    bindEvents() {
        // Navigation
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });
        // PESTEL events
        this.container.querySelectorAll('.pestel-desc, .pestel-impact-select').forEach(el => {
            el.addEventListener('change', (e) => this.updatePESTEL(e));
        });

        // توليد تلقائي لـ PESTEL (داخلي، بدون API)
        this.container.querySelector('.btn-generate-pestel')?.addEventListener('click', () => {
            try {
                const state = this.store.getState();
                const pestel = InternalAIGenerator.generatePESTEL(state);
                this.store.update('strategic', { ...state.strategic, pestel });
                this.render();
                toast.success('تم توليد تحليل بيستل (PESTEL) من بيانات المشروع.');
            } catch (e) {
                console.error('generatePESTEL error:', e);
                toast.error('فشل التوليد: ' + (e?.message || 'خطأ'));
            }
        });

        // SWOT events
        this.container.querySelectorAll('.btn-add-swot').forEach(btn => {
            btn.addEventListener('click', (e) => this.addSWOTItem(e));
        });
        this.container.querySelectorAll('.swot-input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addSWOTItem(e);
            });
        });
        this.container.querySelectorAll('.btn-remove-swot').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeSWOTItem(e));
        });

        // TOWS events — تُكتب في قسم marketing (وليس strategic)
        this.container.querySelectorAll('.tows-input').forEach(el => {
            el.addEventListener('change', (e) => this.updateTOWS(e));
        });

        // Porter events
        this.container.querySelectorAll('.porter-level, .porter-desc').forEach(el => {
            el.addEventListener('change', (e) => this.updatePorter(e));
        });

        // توليد تلقائي لـ بورتر (داخلي، بدون API)
        this.container.querySelector('.btn-generate-porter')?.addEventListener('click', () => {
            try {
                const state = this.store.getState();
                const porter = InternalAIGenerator.generatePorter(state);
                this.store.update('strategic', { ...state.strategic, porter });
                this.render();
                toast.success('تم توليد القوى الخمس لبورتر من بيانات المشروع.');
            } catch (e) {
                console.error('generatePorter error:', e);
                toast.error('فشل التوليد: ' + (e?.message || 'خطأ'));
            }
        });

        // توليد تلقائي للـ SWOT (داخلي، بدون API)
        this.container.querySelector('.btn-generate-swot')?.addEventListener('click', () => {
            try {
                const state = this.store.getState();
                const swot = InternalAIGenerator.generateSWOT(state);
                this.store.update('strategic', { ...state.strategic, swot });
                this.render();
                toast.success('تم توليد التحليل الرباعي (SWOT) من بيانات المشروع.');
            } catch (e) {
                console.error('generateSWOT error:', e);
                toast.error('فشل التوليد: ' + (e?.message || 'خطأ'));
            }
        });

        // توليد تلقائي لمصفوفة TOWS من بنود SWOT الفعلية (داخلي، بدون API) — بند 2.4.
        // تحذيرا الخطة: القراءة من strategic.swot (المصدر الغني)، والكتابة النهائية في
        // marketing.towsMatrix (قسم مختلف عمداً)؛ وتُعبَّأ الأرباع الفارغة فقط — لا يُستبدل
        // أي نص كتبه المستخدم يدوياً، وبلا window.confirm (لا يحمي نص المستخدم أصلاً).
        this.container.querySelector('.btn-generate-tows')?.addEventListener('click', () => {
            try {
                const state = this.store.getState();
                const swot = state.strategic?.swot || {};
                if (!(swot.strengths?.length || swot.weaknesses?.length || swot.opportunities?.length || swot.threats?.length)) {
                    toast.error('أنشئ التحليل الرباعي (SWOT) أولاً — لا توجد بنود لتحويلها إلى استراتيجيات.');
                    return;
                }
                const generated = InternalAIGenerator.generateTOWS(state);
                const existing = state.marketing?.towsMatrix || {};
                const isBlank = (v) => !v || !String(v).trim();
                const merged = { ...existing };
                let filledCount = 0;
                ['so', 'wo', 'st', 'wt'].forEach(key => {
                    if (isBlank(existing[key]) && generated[key]) {
                        merged[key] = generated[key];
                        filledCount++;
                    }
                });
                if (filledCount === 0) {
                    toast.error('كل أرباع TOWS مكتوبة مسبقاً — لا شيء لتعبئته دون استبدال ما كتبته.');
                    return;
                }
                this.store.update('marketing', { ...(state.marketing || {}), towsMatrix: merged });
                this.render();
                toast.success(`تم تعبئة ${filledCount} من أرباع TOWS من بنود SWOT (الأرباع المكتوبة سابقاً لم تُمس).`);
            } catch (e) {
                console.error('generateTOWS error:', e);
                toast.error('فشل التوليد: ' + (e?.message || 'خطأ'));
            }
        });

        // AI SWOT Handler (خارجي)
        this.container.querySelectorAll('.ai-swot-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (this.isGenerating) return;

                e.target.disabled = true;
                e.target.textContent = 'جاري التحليل...';
                this.isGenerating = true;

                const state = this.store.getState();
                const projectInfo = state.projectInfo || {};

                try {
                    // Call AI
                    const rawResult = await AIWriter.generate('swot', projectInfo);

                    // Parse result (AI Server currently sends JSON string)
                    let swotData;
                    try {
                        swotData = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
                    } catch (parseErr) {
                        console.error('SWOT Parse Error', parseErr);
                        swotData = {};
                    }

                    // Update Store
                    if (swotData.strengths) {
                        this.store.update('strategic', {
                            ...state.strategic,
                            swot: swotData
                        });
                        this.render(); // Re-render to show new items
                    }
                } catch (err) {
                    console.error(err);
                }

                e.target.disabled = false;
                e.target.innerHTML = `${icon('i-sparkle')} اقتراح تلقائي`;
                this.isGenerating = false;
            });
        });
    }

    updatePESTEL(e) {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        const value = e.target.value;

        const state = this.store.getState();
        const pestel = [...(state.strategic?.pestel || [])];

        if (pestel[idx]) {
            pestel[idx] = { ...pestel[idx], [field]: value };
            this.store.update('strategic', { ...state.strategic, pestel });
        }
    }

    addSWOTItem(e) {
        const category = e.target.dataset.category;
        const input = this.container.querySelector(`.swot-input[data-category="${category}"]`);
        const value = input.value.trim();

        if (!value) return;

        const state = this.store.getState();
        const swot = { ...state.strategic?.swot } || {};
        swot[category] = [...(swot[category] || []), value];

        this.store.update('strategic', { ...state.strategic, swot });
        input.value = '';
        this.render();
    }

    removeSWOTItem(e) {
        const category = e.target.dataset.category;
        const idx = parseInt(e.target.dataset.idx);

        const state = this.store.getState();
        const swot = { ...state.strategic?.swot } || {};
        swot[category] = swot[category].filter((_, i) => i !== idx);

        this.store.update('strategic', { ...state.strategic, swot });
        this.render();
    }

    updateTOWS(e) {
        const key = e.target.dataset.tows; // so | wo | st | wt
        if (!key) return;
        const value = e.target.value;
        const state = this.store.getState();
        const marketing = { ...(state.marketing || {}) };
        const towsMatrix = { ...(marketing.towsMatrix || {}), [key]: value };
        this.store.update('marketing', { ...marketing, towsMatrix });
    }

    updatePorter(e) {
        const force = e.target.dataset.force;
        const field = e.target.classList.contains('porter-level') ? 'level' : 'description';
        const value = e.target.value;

        const state = this.store.getState();
        const porter = { ...state.strategic?.porter } || {};
        porter[force] = { ...porter[force], [field]: value };

        this.store.update('strategic', { ...state.strategic, porter });
    }
}

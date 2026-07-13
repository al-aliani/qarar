/**
 * Market Analysis Component
 * Displays TAM-SAM-SOM, Customer Segments, and enhanced Competitor Analysis
 */

import { AIWriter } from '../services/AIWriter.js';
import { generateTableSuggestions } from '../services/AIConnector.js';
import { InternalAIGenerator } from '../services/InternalAIGenerator.js';
import { getTAMSuggestion } from '../services/SaudiDemographicsService.js';
import { suggest, isUsable } from '../services/DataConnectors.js';
import '../services/connectors/OverpassConnector.js'; // يسجّل 'market.competitors' ذاتياً عند التحميل
import { CITY_CENTROIDS } from '../services/connectors/OverpassConnector.js';
import { toast } from '../utils/toast.js';
import { SAUDI_REGIONS } from '../data/SaudiCityStats.js';
import { fieldHelp } from './components/FieldHelp.js';
import { deriveRevenueFromStreams } from '../core/engine.js';

// أيقونات من الـsprite الموحّد (index.html) بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#${id}"/></svg>`;

// أحياء شائعة لأبرز المدن — datalist يسمح بالكتابة الحرة
const COMMON_NEIGHBORHOODS = [
    'العليا', 'النرجس', 'الملقا', 'الياسمين', 'حطين', 'القيروان',
    'الروضة', 'الشاطئ', 'السلامة', 'الحمراء',
    'العقربية', 'الراكة', 'العزيزية', 'الششة', 'قباء', 'العوالي'
];

function escapeHtml(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

export class MarketAnalysis {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
        this.isGenerating = false;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        const marketSizing = state.marketSizing || {};
        const marketing = state.marketing || {};
        // بند 1.2 (خطة 2026-07-12): مشتق خفيف من جدول الإيرادات (نفس صيغة عمود year1 حرفياً)
        // لعرضه بجوار حقل SOM فوراً — بلا تشغيل المحرك الكامل على كل كتابة.
        this._derivedRevenue = deriveRevenueFromStreams(state.revenue?.streams);

        this.container.innerHTML = `
            <div class="market-analysis">
                <h2 class="section-title">تحجيم السوق</h2>

                <!-- TAM-SAM-SOM: جوهر الخطوة — أولاً، لا مدفوناً تحت أقسام توثيقية -->
                <div class="card analysis-card">
                    <div class="flex-between mb-3">
                        <div>
                            <h3 class="card-title">حجم السوق</h3>
                            <p class="text-muted text-sm">إجمالي حجم السوق | السوق المتاح | حصتنا المستهدفة
                                ${fieldHelp('إجمالي حجم السوق (TAM): كل الطلب المحتمل. السوق المتاح (SAM): الجزء الذي يمكنك خدمته. حصتنا المستهدفة (SOM): ما تتوقعه خلال الفترة.')}
                            </p>
                        </div>
                        <button type="button" class="btn-xs btn-magic btn-generate-market" title="توليد أوصاف حجم السوق من بيانات المشروع (بدون اتصال خارجي)">${icon('i-sparkle')} توليد تلقائي من البيانات</button>
                    </div>
                    <div id="tam-suggestion-box" class="tam-suggestion-box mb-3" aria-live="polite"></div>
                    ${this.renderTAMSAMSOM(marketSizing)}
                </div>

                <div class="card analysis-card">
                    <h3 class="card-title">${icon('i-pin')} التقسيم الجغرافي للسوق</h3>
                    <p class="text-muted text-sm mb-3">حدّد المنطقة والحي بدقة — منافسو شرق الرياض لا يهمّون مشروعاً في غربها.</p>
                    <div class="form-row form-row--2">
                        <div class="form-group">
                            <label for="target-district">المنطقة/القطاع المستهدف</label>
                            <select id="target-district" class="input">
                                <option value="" ${!marketSizing.targetDistrict ? 'selected' : ''} disabled>اختر المنطقة…</option>
                                ${SAUDI_REGIONS.map(r => `<option value="${escapeHtml(r.name)}" ${marketSizing.targetDistrict === r.name ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="target-neighborhood">الحي/الموقع المحدد</label>
                            <input type="text" id="target-neighborhood" class="input" list="dl-target-neighborhood" autocomplete="off" placeholder="مثال: حي النخيل، العليا" value="${(marketSizing.targetNeighborhood || '').replace(/</g, '&lt;')}">
                            <datalist id="dl-target-neighborhood">${COMMON_NEIGHBORHOODS.map(n => `<option value="${escapeHtml(n)}"></option>`).join('')}</datalist>
                        </div>
                    </div>
                </div>

                <!-- دراسة إحصائية للسكان (الفجوة المعيارية) -->
                <div class="card analysis-card">
                    <h3 class="card-title">${icon('i-chart')} دراسة إحصائية للسكان</h3>
                    <p class="text-muted text-sm mb-3">تعداد سكان، ديموغرافيا، توزيع عمري وفق هيئة الإحصاء</p>
                    <div class="form-row form-row--2">
                        <div class="form-group">
                            <label for="pop-total">إجمالي السكان (نسمة)</label>
                            <input type="number" id="pop-total" class="input" placeholder="مثال: 1500000" value="${marketSizing.populationDemographics?.totalPopulation || ''}">
                        </div>
                        <div class="form-group">
                            <label for="pop-year">سنة التعداد</label>
                            <input type="text" id="pop-year" class="input" placeholder="مثال: 2022" value="${(marketSizing.populationDemographics?.year || '').replace(/</g, '&lt;')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="pop-source">المصدر (هيئة الإحصاء، إلخ)</label>
                        <input type="text" id="pop-source" class="input" placeholder="الهيئة العامة للإحصاء" value="${(marketSizing.populationDemographics?.source || '').replace(/</g, '&lt;')}">
                        <small class="text-muted">مصادر مقترحة: <a href="https://www.stats.gov.sa" target="_blank" rel="noopener">الهيئة العامة للإحصاء</a>، الغرفة التجارية، الغرفة الصناعية، معهد الإدارة العامة</small>
                    </div>
                    <div class="form-row form-row--2">
                        <div class="form-group">
                            <label for="pop-youth">نسبة الشباب (%)</label>
                            <input type="text" id="pop-youth" class="input" placeholder="الفئة المستهدفة" value="${(marketSizing.populationDemographics?.youthPercentage || '').replace(/</g, '&lt;')}">
                        </div>
                        <div class="form-group">
                            <label for="pop-target">حجم الشريحة المستهدفة</label>
                            <input type="text" id="pop-target" class="input" placeholder="عدد أو نسبة" value="${(marketSizing.populationDemographics?.targetSegmentSize || '').replace(/</g, '&lt;')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="pop-notes">ملاحظات</label>
                        <textarea id="pop-notes" class="input" rows="2" placeholder="تفاصيل ديموغرافية إضافية">${(marketSizing.populationDemographics?.notes || '').replace(/</g, '&lt;')}</textarea>
                    </div>
                </div>

                <!-- تحليل القطاع والصناعة -->
                <div class="card analysis-card">
                    <div class="flex-between mb-3">
                        <h3 class="card-title mb-0">${icon('i-factory')} تحليل القطاع والصناعة</h3>
                        <button type="button" class="btn-xs btn-magic btn-generate-sector" title="توليد مقترح">${icon('i-sparkle')} توليد تلقائي</button>
                    </div>
                    <small class="text-muted d-block mb-2">المصدر المقترح: الغرفة التجارية، الغرفة الصناعية، معهد الإدارة العامة</small>
                    <div class="form-group">
                        <label for="sector-analysis">تحليل القطاع</label>
                        <textarea id="sector-analysis" class="input" rows="2" placeholder="خصائص القطاع المستهدف، الحجم، النمو...">${(marketSizing.sectorAnalysis || '').replace(/</g, '&lt;')}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="industry-analysis">تحليل الصناعة</label>
                        <textarea id="industry-analysis" class="input" rows="2" placeholder="هيكل الصناعة، اللاعبون الرئيسيون، الاتجاهات...">${(marketSizing.industryAnalysis || '').replace(/</g, '&lt;')}</textarea>
                    </div>
                </div>

                <!-- المزيج التسويقي (4P) -->
                <div class="card analysis-card">
                    <div class="flex-between mb-3">
                        <div>
                            <h3 class="card-title">${icon('i-box')} المزيج التسويقي (4P)</h3>
                            <p class="text-muted text-sm mb-0">منتج، سعر، مكان، ترويج</p>
                        </div>
                        <button type="button" class="btn-xs btn-magic btn-generate-4p" title="توليد مقترح للمزيج التسويقي">${icon('i-sparkle')} توليد تلقائي</button>
                    </div>
                    <div class="form-group">
                        <label for="mix-product">المنتج (Product)</label>
                        <textarea id="mix-product" class="input" rows="2" placeholder="المواصفات، الجودة، العلامة التجارية...">${(marketing.marketingMix?.product || '').replace(/</g, '&lt;')}</textarea>
                        <small class="text-muted" style="display:block; margin-top:4px;">ركّز على القيمة كما يدركها العميل، لا المواصفات الفنية وحدها.</small>
                    </div>
                    <div class="form-group">
                        <label for="mix-price">السعر (Price)</label>
                        <input type="text" id="mix-price" class="input" placeholder="استراتيجية التسعير، الخصومات، الدفع..." value="${(marketing.marketingMix?.price || '').replace(/</g, '&lt;')}">
                        <small class="text-muted" style="display:block; margin-top:4px;">قارن بالتكلفة وأسعار المنافسين وقدرة عملائك — وتجنّب حرب الأسعار.</small>
                    </div>
                    <div class="form-group">
                        <label for="mix-place">المكان (Place)</label>
                        <input type="text" id="mix-place" class="input" placeholder="قنوات التوزيع، المواقع، المنافذ..." value="${(marketing.marketingMix?.place || '').replace(/</g, '&lt;')}">
                    </div>
                    <div class="form-group">
                        <label for="mix-promotion">الترويج (Promotion)</label>
                        <textarea id="mix-promotion" class="input" rows="2" placeholder="الإعلان، العلاقات العامة، الحملات...">${(marketing.marketingMix?.promotion || '').replace(/</g, '&lt;')}</textarea>
                        <small class="text-muted" style="display:block; margin-top:4px;">وجّه الحملة للشريحة المستهدفة، لا للجميع.</small>
                    </div>
                </div>
                
                <div class="form-group mb-3">
                    <label for="demand-elasticity">مرونة الطلب السعرية</label>
                    <select id="demand-elasticity" class="input">
                        <option value="">-- اختياري --</option>
                        <option value="inelastic" ${((marketing.marketAnalysis || {}).demandElasticity || '') === 'inelastic' ? 'selected' : ''}>غير مرنة (سلعة ضرورية) — تقليل الاستهلاك قليل رغم ارتفاع السعر</option>
                        <option value="elastic" ${((marketing.marketAnalysis || {}).demandElasticity || '') === 'elastic' ? 'selected' : ''}>مرنة (سلعة كمالية) — الاستهلاك ينخفض كثيراً مع ارتفاع السعر</option>
                        <option value="unitary" ${((marketing.marketAnalysis || {}).demandElasticity || '') === 'unitary' ? 'selected' : ''}>وحدة مرونة — نسبة تغير الكمية = نسبة تغير السعر</option>
                    </select>
                    <small class="text-muted">مرونة الطلب تؤثر على استراتيجية التسعير</small>
                </div>

                <!-- Customer Segments -->
                <div class="card analysis-card">
                    <div class="flex-between">
                         <div>
                            <h3 class="card-title">شرائح العملاء</h3>
                            <p class="text-muted text-sm mb-3">تحليل وتصنيف العملاء المستهدفين. حدّد شريحة واضحة — تجنّب عبارة "جميع فئات المجتمع".</p>
                         </div>
                         <div class="flex gap-2 flex-wrap">
                            <button type="button" class="btn-xs btn-magic btn-generate-segments" title="توليد شرائح من بيانات المشروع (بدون اتصال خارجي)">${icon('i-sparkle')} توليد تلقائي من البيانات</button>
                            <button class="btn-xs btn-magic ai-segments-btn">${icon('i-sparkle')} اكتشف (AI)</button>
                         </div>
                    </div>
                    ${this.renderSegments(marketSizing.segments || [])}
                </div>

                <!-- Competitor Matrix -->
                <div class="card analysis-card">
                    <div class="flex-between">
                        <div>
                            <h3 class="card-title">مصفوفة المنافسين</h3>
                            <p class="text-muted text-sm mb-3">مقارنة تفصيلية مع المنافسين. <strong>المصدر المقترح:</strong> زيارة ميدانية، استبيان، مراقبة مباشرة</p>
                        </div>
                        <div class="flex gap-2 flex-wrap">
                            <button type="button" class="btn-xs btn-magic btn-generate-competitors" title="توليد منافسين من بيانات المشروع (بدون اتصال خارجي)">${icon('i-sparkle')} توليد تلقائي من البيانات</button>
                            <button class="btn-xs btn-magic ai-competitors-btn">${icon('i-sparkle')} اكتشف (AI)</button>
                        </div>
                    </div>
                    ${this.renderCompetitorMatrix(marketing.competitors || [])}
                    <div class="competitor-map-wrap mt-3">
                        <h4 class="card-title text-sm mb-2">${icon('i-pin')} خريطة المنافسين</h4>
                        <div id="competitorMap" class="competitor-map"></div>
                    </div>
                </div>

                <!-- مواءمة رؤية 2030 واقتصاد الدولة: توثيق اختياري يظهر في التقرير — مطوي كي لا يزاحم جوهر الخطوة -->
                <details class="card advanced-fields">
                    <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">${icon('i-flag-sa')} مواءمة رؤية 2030 ودراسة اقتصاد الدولة (اختياري — يظهر في التقرير)</summary>
                    <div class="mt-3">
                        <div class="flex-between mb-3">
                            <h3 class="card-title mb-0">مواءمة رؤية 2030</h3>
                            <button type="button" class="btn-xs btn-magic btn-generate-vision" title="توليد مواءمة 2030 واقتصاد الدولة">${icon('i-sparkle')} توليد تلقائي</button>
                        </div>
                        <div class="form-group">
                            <div class="flex-between mb-1">
                                <label for="vision2030-alignment">ربط المشروع برؤية 2030</label>
                                <button type="button" class="btn-xs btn-magic btn-ai-field" data-target="vision2030-alignment">${icon('i-sparkle')} ولّد</button>
                            </div>
                            <textarea id="vision2030-alignment" class="input" rows="2" placeholder="وصف ارتباط المشروع بالرؤية (مثال: دعم قطاع الترفيه، توطين الصناعة...)">${(marketSizing.vision2030?.alignment || '').replace(/</g, '&lt;')}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="vision2030-programs">البرامج ذات الصلة</label>
                            <input type="text" id="vision2030-programs" class="input" placeholder="برامج رفع المحتوى المحلي، منشآت، كفالة..." value="${(marketSizing.vision2030?.relevantPrograms || '').replace(/</g, '&lt;')}">
                        </div>
                        <div class="form-group">
                            <div class="flex-between mb-1">
                                <label for="vision2030-impact">الأثر المتوقع على أهداف الرؤية</label>
                                <button type="button" class="btn-xs btn-magic btn-ai-field" data-target="vision2030-impact">${icon('i-sparkle')} ولّد</button>
                            </div>
                            <textarea id="vision2030-impact" class="input" rows="2" placeholder="مساهمة في التوظيف، التنويع الاقتصادي...">${(marketSizing.vision2030?.impact || '').replace(/</g, '&lt;')}</textarea>
                        </div>
                        <h3 class="card-title mt-4">دراسة اقتصاد الدولة</h3>
                        <div class="form-group">
                            <label for="economy-gdp">معدل النمو والاتجاه الاقتصادي</label>
                            <input type="text" id="economy-gdp" class="input" placeholder="نمو الناتج المحلي، التضخم، اتجاهات القطاع..." value="${(marketSizing.nationalEconomy?.gdpGrowth || '').replace(/</g, '&lt;')}">
                        </div>
                        <div class="form-group">
                            <label for="economy-sector">نمو القطاع المستهدف</label>
                            <input type="text" id="economy-sector" class="input" placeholder="اتجاهات نمو القطاع..." value="${(marketSizing.nationalEconomy?.sectorGrowth || '').replace(/</g, '&lt;')}">
                        </div>
                        <div class="form-group">
                            <label for="economy-indicators">مؤشرات وطنية ذات صلة</label>
                            <input type="text" id="economy-indicators" class="input" placeholder="مؤشرات الاستثمار، الاستهلاك، السياحة..." value="${(marketSizing.nationalEconomy?.keyIndicators || '').replace(/</g, '&lt;')}">
                        </div>
                        <div class="form-group">
                            <div class="flex-between mb-1">
                                <label for="economy-trends">الاتجاهات الاقتصادية المؤثرة</label>
                                <button type="button" class="btn-xs btn-magic btn-ai-field" data-target="economy-trends">${icon('i-sparkle')} ولّد</button>
                            </div>
                            <textarea id="economy-trends" class="input" rows="2" placeholder="التوجهات التي تؤثر على فرص المشروع...">${(marketSizing.nationalEconomy?.trends || '').replace(/</g, '&lt;')}</textarea>
                        </div>
                    </div>
                </details>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents();
        this.renderCompetitorMap();
    }

    /**
     * خريطة تفاعلية (Leaflet) لموقع المشروع ومنافسيه ذوي الإحداثيات المعروفة (من Overpass).
     * محمّلة عند الطلب (dynamic import) كبقية المكتبات الثقيلة في المشروع — لا تُثقل الحزمة
     * الأساسية. تُتخطّى بصمت (رسالة نصية بدل خطأ) حين لا تتوفر إحداثيات كافية للرسم.
     */
    async renderCompetitorMap() {
        const mapEl = this.container?.querySelector('#competitorMap');
        if (!mapEl) return;

        const state = this.store.getState();
        const projectInfo = state.projectInfo || {};
        const competitors = state.marketing?.competitors || [];

        const explicitCoords = projectInfo.locationAnalysis?.coordinates;
        const hasExplicit = explicitCoords
            && Number.isFinite(Number(explicitCoords.lat))
            && Number.isFinite(Number(explicitCoords.lng));
        const cityCentroid = !hasExplicit && projectInfo.city
            ? CITY_CENTROIDS[projectInfo.city.trim()]
            : null;
        const center = hasExplicit
            ? { lat: Number(explicitCoords.lat), lng: Number(explicitCoords.lng) }
            : (cityCentroid || null);

        const points = competitors.filter(c =>
            Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))
        );

        if (!center && points.length === 0) {
            mapEl.innerHTML = `<p class="text-muted text-sm">لا تتوفر إحداثيات كافية لعرض الخريطة بعد — أدخل موقع المشروع، أو اضغط «اكتشف (AI)» أعلاه لجلب منافسين حقيقيين من OpenStreetMap.</p>`;
            return;
        }

        try {
            const [{ default: L }] = await Promise.all([
                import('leaflet'),
                import('leaflet/dist/leaflet.css')
            ]);

            // قد يتبدّل المحتوى (render لاحق) قبل اكتمال الاستيراد الديناميكي — نتحقق أن
            // الحاوية ما زالت في DOM الحالي قبل الرسم عليها.
            if (!this.container?.contains(mapEl)) return;

            mapEl.innerHTML = '';
            const focus = center || { lat: Number(points[0].lat), lng: Number(points[0].lng) };
            const map = L.map(mapEl).setView([focus.lat, focus.lng], center ? 14 : 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            if (center) {
                L.marker([center.lat, center.lng]).addTo(map).bindPopup('موقع المشروع');
            }
            points.forEach(p => {
                L.marker([Number(p.lat), Number(p.lng)]).addTo(map).bindPopup(escapeHtml(p.name || 'منافس'));
            });

            const boundsPoints = [
                ...(center ? [[center.lat, center.lng]] : []),
                ...points.map(p => [Number(p.lat), Number(p.lng)])
            ];
            if (boundsPoints.length > 1) {
                map.fitBounds(L.latLngBounds(boundsPoints), { padding: [24, 24] });
            }
        } catch (e) {
            console.error('renderCompetitorMap error:', e);
            mapEl.innerHTML = `<p class="text-muted text-sm">تعذّر تحميل الخريطة.</p>`;
        }
    }

    renderTAMSAMSOM(data) {
        const tam = data.tam || { value: 0, description: '' };
        const sam = data.sam || { value: 0, description: '' };
        const som = data.som || { value: 0, description: '' };

        const maxValue = Math.max(tam.value || 1, 1);
        const tamPercent = 100;
        const samPercent = ((sam.value || 0) / maxValue) * 100;
        const somPercent = ((som.value || 0) / maxValue) * 100;

        return `
                    <div class="tam-sam-som-container">
                <div class="tam-sam-som-visual">
                    <div class="tam-circle" style="--size: ${tamPercent}%">
                        <span class="circle-label" title="إجمالي حجم السوق">إجمالي السوق</span>
                        <div class="sam-circle" style="--size: ${Math.min(samPercent, 80)}%">
                            <span class="circle-label" title="السوق المتاح">السوق المتاح</span>
                            <div class="som-circle" style="--size: ${Math.min(somPercent, 60)}%">
                                <span class="circle-label" title="حصتنا المستهدفة">حصتنا</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="tam-sam-som-inputs">
                    <div class="market-input-group">
                        <label class="input-label" for="market-tam">
                            <span class="badge badge--tam">إجمالي حجم السوق</span>
                            <span title="كل الطلب المحتمل للمنتج في المنطقة الجغرافية المستهدفة. مثال: إجمالي مبيعات المطاعم في المملكة">(TAM)</span>
                            ${fieldHelp('إجمالي السوق المتاح: كل الطلب المحتمل للمنتج في المنطقة الجغرافية المستهدفة.', 'مثال: إجمالي مبيعات المطاعم في المملكة')}
                        </label>
                        <input type="number" id="market-tam" class="input tam-value" data-field="tam" 
                               value="${tam.value || 0}" placeholder="بالريال">
                        <input type="text" class="input input--sm" data-field="tam" data-subfield="description" aria-label="وصف السوق الكلي"
                               value="${tam.description || ''}" placeholder="وصف السوق الكلي...">
                    </div>
                    <div class="market-input-group">
                        <label class="input-label" for="market-sam">
                            <span class="badge badge--sam">السوق المتاح</span>
                            <span title="الجزء من إجمالي السوق الذي يمكنك الوصول إليه فعلياً بناءً على قدراتك الجغرافية والتشغيلية">(SAM)</span>
                            ${fieldHelp('السوق المتاح: الجزء من TAM الذي يمكنك الوصول إليه فعلياً بناءً على قدراتك الجغرافية والتشغيلية.', 'مثال: مبيعات المطاعم في المدينة المستهدفة')}
                        </label>
                        <input type="number" id="market-sam" class="input sam-value" data-field="sam" 
                               value="${sam.value || 0}" placeholder="بالريال">
                        <input type="text" class="input input--sm" data-field="sam" data-subfield="description" aria-label="وصف السوق المتاح"
                               value="${sam.description || ''}" placeholder="وصف السوق المتاح...">
                    </div>
                    <div class="market-input-group">
                        <label class="input-label" for="market-som">
                            <span class="badge badge--som">حصتنا المستهدفة</span>
                            <span title="النسبة من السوق المتاح التي تتوقع الاستحواذ عليها خلال 3-5 سنوات">(SOM)</span>
                            ${fieldHelp('حصة السوق المستهدفة: النسبة من SAM التي تستطيع الاستحواذ عليها فعلياً خلال 3-5 سنوات.', 'مثال: 2% من سوق المطاعم في المدينة')}
                        </label>
                        <input type="number" id="market-som" class="input som-value" data-field="som"
                               value="${som.value || 0}" placeholder="بالريال">
                        <input type="text" class="input input--sm" data-field="som" data-subfield="description" aria-label="وصف الحصة المستهدفة"
                               value="${som.description || ''}" placeholder="وصف الحصة المستهدفة...">
                        <p class="text-xs som-revenue-hint mt-1" id="som-revenue-hint" data-year1-revenue="${Math.round(this._derivedRevenue?.year1Revenue || 0)}">
                            ${this._renderSomRevenueHintText(som.value)}
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * نص تلميح فوري ملوّن بجوار حقل SOM: الإيراد المخطَّط لسنة كاملة من جدول الإيرادات
     * (نفس رقم عمود year1) مقارَناً بحصة السوق المستهدفة (SOM، بالريال). أخضر ضمن SOM
     * بأمان، أصفر قريب من الحد، أحمر يتجاوزه — يطابق سماحية 120% في REVENUE_EXCEEDS_SOM
     * (SaudiMarketEngine.js) دون تكرار فحص كامل هنا (بند 1.2، خطة 2026-07-12).
     */
    _renderSomRevenueHintText(somValue) {
        const year1Revenue = this._derivedRevenue?.year1Revenue || 0;
        if (!year1Revenue) return '';
        const fmt = (n) => Math.round(n).toLocaleString('ar-SA');
        const som = Number(somValue) || 0;
        let colorClass = 'text-muted';
        let tail = '';
        if (som > 0) {
            const ratio = year1Revenue / som;
            if (ratio > 1.2) {
                colorClass = 'text-danger';
                tail = ` — يتجاوز حصتك المستهدفة (SOM) بنحو ${Math.round((ratio - 1) * 100)}%؛ راجع توقع العملاء/السعر أو ارفع SOM.`;
            } else if (ratio > 0.9) {
                colorClass = 'text-warning';
                tail = ' — قريب جداً من حصتك المستهدفة (SOM)، بلا هامش يُذكر للنمو.';
            } else {
                colorClass = 'text-success';
                tail = ' — ضمن حصتك المستهدفة (SOM) بأمان.';
            }
        }
        return `<span class="${colorClass}">الإيراد المخطَّط لسنة كاملة من جدول الإيرادات: ${fmt(year1Revenue)} ريال${tail}</span>`;
    }

    renderSegments(segments) {
        const freqOpts = [
            { v: '', l: '—' },
            { v: 'daily', l: 'يومي' },
            { v: 'weekly', l: 'أسبوعي' },
            { v: 'monthly', l: 'شهري' },
            { v: 'rarely', l: 'نادراً' }
        ];
        const methodOpts = [
            { v: '', l: '—' },
            { v: 'cash', l: 'نقدي' },
            { v: 'online', l: 'إلكتروني' },
            { v: 'delivery', l: 'توصيل' },
            { v: 'app', l: 'تطبيق' }
        ];
        return `
            <div class="segments-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الشريحة</th>
                            <th>الديموغرافيا</th>
                            <th>الاحتياجات</th>
                            <th>تردد الشراء</th>
                            <th>طريقة الشراء</th>
                            <th>الحجم (ريال)</th>
                            <th>الأولوية</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="segmentsBody">
                        ${segments.map((seg, idx) => `
                            <tr data-idx="${idx}">
                                <td><input type="text" class="input input--sm segment-field" data-field="name" value="${(seg.name || '').toString().replace(/"/g, '&quot;')}"></td>
                                <td><input type="text" class="input input--sm segment-field" data-field="demographics" value="${(seg.demographics || '').toString().replace(/"/g, '&quot;')}"></td>
                                <td><input type="text" class="input input--sm segment-field" data-field="needs" value="${(seg.needs || '').toString().replace(/"/g, '&quot;')}"></td>
                                <td>
                                    <select class="input input--sm segment-field" data-field="purchaseFrequency">
                                        ${freqOpts.map(o => `<option value="${o.v}" ${seg.purchaseFrequency === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
                                    </select>
                                </td>
                                <td>
                                    <select class="input input--sm segment-field" data-field="purchaseMethod">
                                        ${methodOpts.map(o => `<option value="${o.v}" ${seg.purchaseMethod === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
                                    </select>
                                </td>
                                <td><input type="number" class="input input--sm segment-field" data-field="size" value="${seg.size || 0}"></td>
                                <td>
                                    <select class="input input--sm segment-field" data-field="priority">
                                        <option value="primary" ${seg.priority === 'primary' ? 'selected' : ''}>أساسي</option>
                                        <option value="secondary" ${seg.priority === 'secondary' ? 'selected' : ''}>ثانوي</option>
                                        <option value="tertiary" ${seg.priority === 'tertiary' ? 'selected' : ''}>ثالثي</option>
                                    </select>
                                </td>
                                <td><button class="btn-icon btn-remove-segment" data-idx="${idx}" aria-label="حذف الشريحة السوقية">${icon('i-trash')}</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="flex gap-2 mt-3">
                    <button class="btn btn--sm btn--secondary btn-suggest-segments">${icon('i-sparkle')} اقتراح بنود</button>
                    <button class="btn btn--sm btn--ghost btn-add-segment">+ إضافة شريحة</button>
                </div>
            </div>
        `;
    }

    renderCompetitorMatrix(competitors) {
        const criteria = ['السعر', 'الجودة', 'الموقع', 'التسويق', 'خدمة العملاء'];

        return `
            <div class="competitor-matrix">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>المنافس</th>
                            <th>الحصة السوقية</th>
                            <th>نقاط القوة</th>
                            <th>نقاط الضعف</th>
                            <th>الميزة التنافسية</th>
                            <th>عملاء/يوم (تقديري)</th>
                            <th>متوسط فاتورة (ريال)</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="competitorsBody">
                        ${competitors.map((comp, idx) => `
                            <tr data-idx="${idx}">
                                <td><input type="text" class="input input--sm competitor-field" data-field="name" value="${comp.name || ''}"></td>
                                <td><input type="number" class="input input--sm competitor-field" data-field="marketShare" value="${comp.marketShare || 0}" min="0" max="100">%</td>
                                <td><input type="text" class="input input--sm competitor-field" data-field="strengths" value="${comp.strengths || ''}"></td>
                                <td><input type="text" class="input input--sm competitor-field" data-field="weaknesses" value="${comp.weaknesses || ''}"></td>
                                <td><input type="text" class="input input--sm competitor-field" data-field="advantage" value="${comp.advantage || ''}"></td>
                                <td><input type="number" class="input input--sm competitor-field" data-field="estimatedDailyCustomers" value="${comp.estimatedDailyCustomers || 0}" placeholder="للمقارنة"></td>
                                <td><input type="number" class="input input--sm competitor-field" data-field="estimatedAvgTicket" value="${comp.estimatedAvgTicket || 0}" placeholder="عدد × متوسط = مبيعات يومية"></td>
                                <td><button class="btn-icon btn-remove-competitor" data-idx="${idx}" aria-label="حذف المنافس">${icon('i-trash')}</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="flex gap-2 mt-3">
                    <button class="btn btn--sm btn--secondary btn-suggest-competitors">${icon('i-sparkle')} اقتراح بنود</button>
                    <button class="btn btn--sm btn--ghost btn-add-competitor">+ إضافة منافس</button>
                </div>
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

        // مواءمة رؤية 2030 ودراسة اقتصاد الدولة والتقسيم الجغرافي
        this.container.querySelectorAll('#vision2030-alignment, #vision2030-programs, #vision2030-impact, #economy-gdp, #economy-sector, #economy-indicators, #economy-trends, #pop-total, #pop-year, #pop-source, #pop-youth, #pop-target, #pop-notes, #target-district, #target-neighborhood').forEach(el => {
            el?.addEventListener('change', () => this.saveVisionAndEconomy());
            el?.addEventListener('blur', () => this.saveVisionAndEconomy());
        });

        // توليد تحليل القطاع والصناعة
        this.container.querySelector('.btn-generate-sector')?.addEventListener('click', () => {
            try {
                const state = this.store.getState();
                const out = InternalAIGenerator.generateSectorIndustry(state);
                this.store.update('marketSizing', { ...state.marketSizing, ...out });
                toast.success('تم توليد مقترح تحليل القطاع والصناعة.');
                this.render(this.stepIndex);
            } catch (e) {
                console.error('generateSectorIndustry error:', e);
                toast.error('فشل التوليد: ' + (e?.message || 'خطأ'));
            }
        });

        // AI Field Buttons — ولّد (المهمة 3: AI Writer في المعالج)
        this.container.querySelectorAll('.btn-ai-field').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.dataset.target;
                const inputEl = this.container.querySelector(`#${targetId}`);
                if (!inputEl || this.isGenerating) return;

                btn.disabled = true;
                const origText = btn.textContent;
                btn.textContent = 'جاري...';
                this.isGenerating = true;
                const originalVal = inputEl.value;

                setTimeout(() => {
                    try {
                        const state = this.store.getState();
                        const suggestion = InternalAIGenerator.generateFieldSuggestion(targetId, originalVal, state);
                        inputEl.value = suggestion;
                        inputEl.dispatchEvent(new Event('change'));
                        this.saveVisionAndEconomy();
                        toast.success('تم اقتراح النص بنجاح');
                    } catch (err) {
                        console.error(err);
                        toast.error('حدث خطأ أثناء التوليد');
                    } finally {
                        btn.disabled = false;
                        btn.textContent = origText;
                        this.isGenerating = false;
                    }
                }, 400);
            });
        });

        // توليد مواءمة 2030 واقتصاد الدولة
        this.container.querySelector('.btn-generate-vision')?.addEventListener('click', () => {
            try {
                const state = this.store.getState();
                const out = InternalAIGenerator.generateVision2030Economy(state);
                this.store.update('marketSizing', {
                    ...state.marketSizing,
                    vision2030: out.vision2030,
                    nationalEconomy: out.nationalEconomy
                });
                toast.success('تم توليد مواءمة رؤية 2030 ودراسة اقتصاد الدولة.');
                this.render(this.stepIndex);
            } catch (e) {
                console.error('generateVision2030Economy error:', e);
                toast.error('فشل التوليد: ' + (e?.message || 'خطأ'));
            }
        });

        // تحليل القطاع والصناعة
        this.container.querySelectorAll('#sector-analysis, #industry-analysis').forEach(el => {
            el?.addEventListener('change', () => this.saveSectorIndustry());
            el?.addEventListener('blur', () => this.saveSectorIndustry());
        });

        // توليد المزيج التسويقي تلقائياً
        this.container.querySelector('.btn-generate-4p')?.addEventListener('click', () => {
            try {
                const state = this.store.getState();
                const mix = InternalAIGenerator.generateMarketingMix(state);
                this.store.update('marketing', { ...state.marketing, marketingMix: mix });
                toast.success('تم توليد مقترح المزيج التسويقي (4P).');
                this.render(this.stepIndex);
            } catch (e) {
                console.error('generateMarketingMix error:', e);
                toast.error('فشل التوليد: ' + (e?.message || 'خطأ'));
            }
        });

        // المزيج التسويقي 4P
        this.container.querySelectorAll('#mix-product, #mix-price, #mix-place, #mix-promotion').forEach(el => {
            el?.addEventListener('change', () => this.saveMarketingMix());
            el?.addEventListener('blur', () => this.saveMarketingMix());
        });
        this.container.querySelector('#demand-elasticity')?.addEventListener('change', () => this.saveDemandElasticity());

        // TAM-SAM-SOM inputs (قيم وأوصاف)
        this.container.querySelectorAll('.tam-value, .sam-value, .som-value').forEach(input => {
            input.addEventListener('change', (e) => this.updateMarketSize(e));
        });
        // تلميح فوري (بند 1.2، خطة 2026-07-12): تحديث موضعي لنص المقارنة أثناء الكتابة في
        // SOM بلا render() كامل ولا كتابة للمخزن على كل ضغطة (يمنع سقوط التركيز — نفس فخ
        // الجداول الديناميكية المُصلح في الدفعة 0؛ الحفظ الفعلي يبقى على change/blur أعلاه).
        this.container.querySelector('#market-som')?.addEventListener('input', (e) => {
            const hintEl = this.container.querySelector('#som-revenue-hint');
            if (hintEl) hintEl.innerHTML = this._renderSomRevenueHintText(e.target.value);
        });
        this.container.querySelectorAll('input[data-subfield="description"]').forEach(input => {
            input.addEventListener('change', (e) => this.updateMarketSizeDesc(e));
        });

        // توليد تلقائي لأوصاف TAM-SAM-SOM (داخلي)
        this.container.querySelector('.btn-generate-market')?.addEventListener('click', () => {
            try {
                const state = this.store.getState();
                const out = InternalAIGenerator.generateMarketDescriptions(state);
                const ms = state.marketSizing || {};
                this.store.update('marketSizing', {
                    ...ms,
                    tam: { ...(ms.tam || {}), description: out.tam.description },
                    sam: { ...(ms.sam || {}), description: out.sam.description },
                    som: { ...(ms.som || {}), description: out.som.description }
                });
                this.render();
                toast.success('تم توليد أوصاف حجم السوق من بيانات المشروع.');
            } catch (e) {
                console.error('generateMarketDescriptions error:', e);
                toast.error('فشل التوليد: ' + (e?.message || 'خطأ'));
            }
        });

        // اقتراح TAM من بيانات هيئة الإحصاء (عند اختيار المدينة)
        this.loadAndShowTAMSuggestion();

        this.container.addEventListener('click', (e) => {
            if (e.target.closest?.('.btn-apply-tam-suggestion')) {
                e.preventDefault();
                this.applyTAMSuggestion();
            }
        });

        // توليد تلقائي لشرائح العملاء (داخلي)
        this.container.querySelector('.btn-generate-segments')?.addEventListener('click', () => {
            try {
                const state = this.store.getState();
                const out = InternalAIGenerator.generateSegments(state);
                const current = state.marketSizing?.segments || [];
                this.store.update('marketSizing', { ...state.marketSizing, segments: [...current, ...out] });
                this.render();
                toast.success('تم توليد شرائح العملاء من بيانات المشروع.');
            } catch (e) {
                console.error('generateSegments error:', e);
                toast.error('فشل التوليد: ' + (e?.message || 'خطأ'));
            }
        });

        // توليد تلقائي لمصفوفة المنافسين (داخلي)
        this.container.querySelector('.btn-generate-competitors')?.addEventListener('click', () => {
            try {
                const state = this.store.getState();
                const out = InternalAIGenerator.generateCompetitors(state);
                const current = state.marketing?.competitors || [];
                this.store.update('marketing', { ...state.marketing, competitors: [...current, ...out] });
                this.render();
                toast.success('تم توليد مصفوفة المنافسين من بيانات المشروع.');
            } catch (e) {
                console.error('generateCompetitors error:', e);
                toast.error('فشل التوليد: ' + (e?.message || 'خطأ'));
            }
        });

        // Segment events
        this.container.querySelectorAll('.segment-field').forEach(input => {
            input.addEventListener('change', (e) => this.updateSegment(e));
        });
        this.container.querySelector('.btn-add-segment')?.addEventListener('click', () => this.addSegment());
        this.container.querySelectorAll('.btn-remove-segment').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeSegment(e));
        });
        
        // Suggest segments button
        this.container.querySelector('.btn-suggest-segments')?.addEventListener('click', async () => {
            if (this.isGenerating) return;
            const btn = this.container.querySelector('.btn-suggest-segments');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'جاري التوليد...';
            this.isGenerating = true;

            try {
                const state = this.store.getState();
                const projectInfo = state.projectInfo || {};

                // Use unified AI service
                const suggestions = await generateTableSuggestions('suggest_segments', projectInfo);

                if (Array.isArray(suggestions) && suggestions.length > 0) {
                    // Merge with existing segments
                    const currentSegments = state.marketSizing?.segments || [];
                    const mergedSegments = [...currentSegments, ...suggestions];
                    
                    this.store.update('marketSizing', { 
                        ...state.marketSizing, 
                        segments: mergedSegments 
                    });
                    this.render();
                }
            } catch (err) {
                console.error('AI Segments Error', err);
                toast.error('حدث خطأ أثناء الاتصال بالذكاء الاصطناعي');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
                this.isGenerating = false;
            }
        });

        // Competitor events
        this.container.querySelectorAll('.competitor-field').forEach(input => {
            input.addEventListener('change', (e) => this.updateCompetitor(e));
        });
        this.container.querySelector('.btn-add-competitor')?.addEventListener('click', () => this.addCompetitor());
        this.container.querySelectorAll('.btn-remove-competitor').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeCompetitor(e));
        });
        
        // Suggest competitors button
        this.container.querySelector('.btn-suggest-competitors')?.addEventListener('click', async () => {
            if (this.isGenerating) return;
            const btn = this.container.querySelector('.btn-suggest-competitors');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'جاري التوليد...';
            this.isGenerating = true;

            try {
                const state = this.store.getState();
                const projectInfo = state.projectInfo || {};

                // Use unified AI service
                const suggestions = await generateTableSuggestions('competitors', projectInfo);

                if (Array.isArray(suggestions) && suggestions.length > 0) {
                    // Map suggestions to match the competitor matrix structure
                    const mappedSuggestions = suggestions.map(item => ({
                        name: item.name || '',
                        marketShare: item.marketShare || 0,
                        strengths: item.strengths || '',
                        weaknesses: item.weaknesses || '',
                        advantage: '' // Will be filled by user
                    }));
                    
                    // Merge with existing competitors
                    const currentCompetitors = state.marketing?.competitors || [];
                    const mergedCompetitors = [...currentCompetitors, ...mappedSuggestions];
                    
                    this.store.update('marketing', { 
                        ...state.marketing, 
                        competitors: mergedCompetitors 
                    });
                    this.render();
                }
            } catch (err) {
                console.error('AI Competitors Error', err);
                toast.error('حدث خطأ أثناء الاتصال بالذكاء الاصطناعي');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
                this.isGenerating = false;
            }
        });

        // AI Competitors Handler — تدقيق 2026-07-08: كانت طبقة DataConnectors/OverpassConnector
        // (بيانات حية فعلية من OpenStreetMap) مبنية ومختبرة لكن غير مستدعاة إطلاقاً؛ الزر
        // كان يوهم المستخدم بـ"اكتشاف" بينما المصدر نص AI مولَّد بالكامل بلا صلة بموقع حقيقي.
        // الآن: نحاول أولاً منافسين حقيقيين من Overpass حول مدينة/إحداثيات المشروع، ونسقط
        // فقط عند تعذّر ذلك (لا تغطية OSM/لا إحداثيات) إلى توليد AI النصي كما كان.
        this.container.querySelectorAll('.ai-competitors-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (this.isGenerating) return;

                e.target.disabled = true;
                e.target.textContent = 'جاري البحث...';
                this.isGenerating = true;

                const state = this.store.getState();
                const projectInfo = state.projectInfo || {};

                try {
                    // تدقيق 2026-07-08 (تحقق عدائي): projectInfo.coords غير موجود في المخطط
                    // إطلاقاً — الإحداثيات الفعلية إن أُدخلت هي locationAnalysis.coordinates.
                    const coords = projectInfo.locationAnalysis?.coordinates;
                    const hasRealCoords = coords && Number.isFinite(Number(coords.lat)) && Number.isFinite(Number(coords.lng));
                    const live = await suggest('market.competitors', {
                        city: projectInfo.city,
                        coords: hasRealCoords ? coords : undefined
                    });

                    if (isUsable(live) && Array.isArray(live.value?.sample) && live.value.sample.length > 0) {
                        const current = state.marketing?.competitors || [];
                        const fromOsm = live.value.sample.map(s => ({
                            name: s.name, marketShare: 0, strengths: '', weaknesses: '', advantage: '',
                            ...(Number.isFinite(s.lat) && Number.isFinite(s.lng) ? { lat: s.lat, lng: s.lng } : {})
                        }));
                        this.store.update('marketing', {
                            ...state.marketing,
                            competitors: [...current, ...fromOsm]
                        });
                        toast.success(`عُثر على ${live.value.count} منشأة قريبة فعلياً (OpenStreetMap) — أضف حصة السوق ونقاط القوة/الضعف يدوياً.`);
                        this.render();
                    } else {
                        // لا تغطية OSM لهذا الموقع أو لا إحداثيات/مدينة معروفة — احتياط AI نصي كما كان،
                        // مع إفصاح صريح أن هذه أسماء مولَّدة لا بيانات حية (لا إيهام).
                        const rawResult = await AIWriter.generate('competitors', projectInfo);
                        const compsData = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
                        if (Array.isArray(compsData)) {
                            this.store.update('marketing', {
                                ...state.marketing,
                                competitors: compsData
                            });
                            toast.warning('تعذّر العثور على بيانات منافسين حية لموقعك — تم توليد أمثلة نصية بالذكاء الاصطناعي، راجعها وعدّلها.');
                            this.render();
                        }
                    }
                } catch (err) {
                    console.error("AI Comp Error", err);
                }

                e.target.disabled = false;
                e.target.innerHTML = `${icon('i-sparkle')} اكتشف المنافسين`;
                this.isGenerating = false;
            });
        });

        // AI Segments Handler
        this.container.querySelectorAll('.ai-segments-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (this.isGenerating) return;
                e.target.disabled = true;
                e.target.textContent = 'جاري البحث...';
                this.isGenerating = true;

                const state = this.store.getState();
                const projectInfo = state.projectInfo || {};

                try {
                    const rawResult = await AIWriter.generate('suggest_segments', projectInfo);
                    const data = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;

                    if (Array.isArray(data)) {
                        const marketSizing = { ...state.marketSizing, segments: data };
                        this.store.update('marketSizing', marketSizing);
                        this.render();
                    }
                } catch (err) {
                    console.error("AI Segments Error", err);
                }

                e.target.disabled = false;
                e.target.innerHTML = `${icon('i-sparkle')} اكتشف (AI)`;
                this.isGenerating = false;
            });
        });
    }

    saveSectorIndustry() {
        const sector = this.container.querySelector('#sector-analysis')?.value || '';
        const industry = this.container.querySelector('#industry-analysis')?.value || '';
        const state = this.store.getState();
        this.store.update('marketSizing', { ...state.marketSizing, sectorAnalysis: sector, industryAnalysis: industry });
    }

    saveMarketingMix() {
        const product = this.container.querySelector('#mix-product')?.value || '';
        const price = this.container.querySelector('#mix-price')?.value || '';
        const place = this.container.querySelector('#mix-place')?.value || '';
        const promotion = this.container.querySelector('#mix-promotion')?.value || '';
        const state = this.store.getState();
        this.store.update('marketing', {
            ...state.marketing,
            marketingMix: { product, price, place, promotion }
        });
    }

    saveDemandElasticity() {
        const val = this.container.querySelector('#demand-elasticity')?.value || '';
        const state = this.store.getState();
        const ma = state.marketing?.marketAnalysis || {};
        this.store.update('marketing', {
            ...state.marketing,
            marketAnalysis: { ...ma, demandElasticity: val || undefined }
        });
    }

    saveVisionAndEconomy() {
        const alignment = this.container.querySelector('#vision2030-alignment')?.value || '';
        const programs = this.container.querySelector('#vision2030-programs')?.value || '';
        const impact = this.container.querySelector('#vision2030-impact')?.value || '';
        const gdp = this.container.querySelector('#economy-gdp')?.value || '';
        const sector = this.container.querySelector('#economy-sector')?.value || '';
        const indicators = this.container.querySelector('#economy-indicators')?.value || '';
        const trends = this.container.querySelector('#economy-trends')?.value || '';
        const popTotal = parseFloat(this.container.querySelector('#pop-total')?.value) || 0;
        const popYear = this.container.querySelector('#pop-year')?.value || '';
        const popSource = this.container.querySelector('#pop-source')?.value || '';
        const popYouth = this.container.querySelector('#pop-youth')?.value || '';
        const popTarget = this.container.querySelector('#pop-target')?.value || '';
        const popNotes = this.container.querySelector('#pop-notes')?.value || '';
        const targetDistrict = this.container.querySelector('#target-district')?.value || '';
        const targetNeighborhood = this.container.querySelector('#target-neighborhood')?.value || '';

        const state = this.store.getState();
        this.store.update('marketSizing', {
            ...state.marketSizing,
            vision2030: { alignment, relevantPrograms: programs, impact },
            nationalEconomy: { gdpGrowth: gdp, sectorGrowth: sector, keyIndicators: indicators, trends },
            populationDemographics: { totalPopulation: popTotal, year: popYear, source: popSource, youthPercentage: popYouth, targetSegmentSize: popTarget, notes: popNotes },
            targetDistrict,
            targetNeighborhood
        });
    }

    async loadAndShowTAMSuggestion() {
        const box = this.container.querySelector('#tam-suggestion-box');
        if (!box) return;
        const state = this.store.getState();
        const city = state.projectInfo?.city || state.projectInfo?.location || '';
        const sector = state.projectInfo?.concept || state.projectInfo?.activity || state.marketSizing?.sectorAnalysis || '';

        if (!city || city === 'أخرى') {
            box.innerHTML = '<p class="text-muted text-sm">اختر مدينة في <strong>بيانات المشروع</strong> لرؤية اقتراح TAM من بيانات هيئة الإحصاء.</p>';
            return;
        }

        box.innerHTML = '<p class="text-muted text-sm">جاري تحميل الاقتراح من بيانات الإحصاء...</p>';
        try {
            const suggestion = await getTAMSuggestion(city, sector);
            this._lastTAMSuggestion = suggestion;
            const popStr = suggestion.population > 0 ? suggestion.population.toLocaleString('ar-SA') : '—';
            box.innerHTML = `
                <div class="tam-suggestion-card p-3 rounded-lg border border-border" style="background: var(--c-bg-app);">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-sm font-medium">${icon('i-chart')} اقتراح من بيانات هيئة الإحصاء</span>
                    </div>
                    <p class="text-sm text-muted mb-2">بناءً على مدينة <strong>${escapeHtml(city)}</strong>: عدد السكان <strong>${popStr}</strong> نسمة، ونسبة استهلاك القطاع. TAM المقترح: <strong>${(suggestion.tam || 0).toLocaleString('ar-SA')}</strong> ريال سنوياً.</p>
                    <p class="text-xs text-muted mb-2">المصدر: ${escapeHtml(suggestion.sourceLabel)} — <a href="https://www.stats.gov.sa" target="_blank" rel="noopener">هيئة الإحصاء</a></p>
                    <button type="button" class="btn btn--secondary btn-sm btn-apply-tam-suggestion">تطبيق الاقتراح</button>
                </div>
            `;
        } catch (e) {
            console.warn('TAM suggestion load failed:', e);
            box.innerHTML = '<p class="text-muted text-sm">تعذّر تحميل اقتراح TAM من بيانات الإحصاء. يمكنك إدخال القيم يدوياً.</p>';
        }
    }

    applyTAMSuggestion() {
        const suggestion = this._lastTAMSuggestion;
        if (!suggestion) return;
        const state = this.store.getState();
        const ms = { ...state.marketSizing };
        ms.tam = { ...(ms.tam || {}), value: suggestion.tam, description: suggestion.description };
        ms.sam = { ...(ms.sam || {}), value: suggestion.sam, description: `السوق المتاح في المنطقة المستهدفة — تقدير بناءً على ${suggestion.source}` };
        ms.som = { ...(ms.som || {}), value: suggestion.som, description: `الحصة المستهدفة خلال 3–5 سنوات — تقدير أولي` };
        ms.populationDemographics = {
            ...(ms.populationDemographics || {}),
            totalPopulation: suggestion.population,
            source: suggestion.source,
            year: suggestion.year
        };
        this.store.update('marketSizing', ms);
        toast.success('تم تطبيق اقتراح TAM من بيانات هيئة الإحصاء.');
        this.render(this.stepIndex);
    }

    updateMarketSize(e) {
        const field = e.target.dataset.field;
        const value = parseFloat(e.target.value) || 0;

        const state = this.store.getState();
        const marketSizing = { ...state.marketSizing };
        marketSizing[field] = { ...marketSizing[field], value };

        this.store.update('marketSizing', marketSizing);
        this.render();
    }

    updateMarketSizeDesc(e) {
        const field = e.target.dataset.field;
        const sub = e.target.dataset.subfield;
        const value = e.target.value || '';

        const state = this.store.getState();
        const marketSizing = { ...state.marketSizing };
        marketSizing[field] = { ...marketSizing[field], [sub]: value };

        this.store.update('marketSizing', marketSizing);
    }

    updateSegment(e) {
        const row = e.target.closest('tr');
        const idx = parseInt(row.dataset.idx);
        const field = e.target.dataset.field;
        const value = field === 'size' ? parseFloat(e.target.value) || 0 : e.target.value;

        const state = this.store.getState();
        const segments = [...(state.marketSizing?.segments || [])];

        if (segments[idx]) {
            segments[idx] = { ...segments[idx], [field]: value };
            this.store.update('marketSizing', { ...state.marketSizing, segments });
        }
    }

    addSegment() {
        const state = this.store.getState();
        const segments = [...(state.marketSizing?.segments || [])];
        segments.push({ name: '', demographics: '', needs: '', size: 0, priority: 'primary', purchaseFrequency: '', purchaseMethod: '' });
        this.store.update('marketSizing', { ...state.marketSizing, segments });
        this.render();
    }

    removeSegment(e) {
        const idx = parseInt(e.target.dataset.idx);
        const state = this.store.getState();
        const segments = (state.marketSizing?.segments || []).filter((_, i) => i !== idx);
        this.store.update('marketSizing', { ...state.marketSizing, segments });
        this.render();
    }

    updateCompetitor(e) {
        const row = e.target.closest('tr');
        const idx = parseInt(row.dataset.idx);
        const field = e.target.dataset.field;
        const numericFields = ['marketShare', 'estimatedDailyCustomers', 'estimatedAvgTicket'];
        const value = numericFields.includes(field) ? parseFloat(e.target.value) || 0 : e.target.value;

        const state = this.store.getState();
        const marketing = { ...state.marketing };
        const competitors = [...(marketing.competitors || [])];

        if (competitors[idx]) {
            competitors[idx] = { ...competitors[idx], [field]: value };
            marketing.competitors = competitors;
            this.store.update('marketing', marketing);
        }
    }

    addCompetitor() {
        const state = this.store.getState();
        const marketing = { ...state.marketing };
        const competitors = [...(marketing.competitors || [])];
        competitors.push({ name: '', marketShare: 0, strengths: '', weaknesses: '', advantage: '', estimatedDailyCustomers: 0, estimatedAvgTicket: 0 });
        marketing.competitors = competitors;
        this.store.update('marketing', marketing);
        this.render();
    }

    removeCompetitor(e) {
        const idx = parseInt(e.target.dataset.idx);
        const state = this.store.getState();
        const marketing = { ...state.marketing };
        marketing.competitors = (marketing.competitors || []).filter((_, i) => i !== idx);
        this.store.update('marketing', marketing);
        this.render();
    }
}

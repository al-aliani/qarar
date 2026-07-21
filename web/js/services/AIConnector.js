/**
 * AI API Connector
 * Connects to AI services for intelligent recommendations
 */

import { InternalAIGenerator } from './InternalAIGenerator.js';
import { SmartAdvisor } from './SmartAdvisor.js';
import { trackEvent } from '../utils/analytics.js';

// توليد محلي فقط: لا يوجد اتصال بأي مزوّد LLM خارجي. النقاط الخارجية (OpenAI/Anthropic/…)
// غير مفعّلة ومحذوفة عمداً كي لا يوحي الكود بذكاء خارجي غير موجود. المصدر الوحيد للمحتوى
// هو المولّد الداخلي (InternalAIGenerator) أو خادم محلي اختياري على /api/generate.
const AI_ENDPOINTS = {
    local: '/api/generate'
};

const STORAGE_KEY_INTERNAL_ONLY = 'feasibility_ai_internal_only';

export class AIConnector {
    constructor(config = {}) {
        // FORCE LOCAL INTERNAL BRAIN
        this.provider = 'local';
        this.apiKey = null; // No keys needed
        this.model = 'internal-logic';
        this.endpoint = AI_ENDPOINTS.local;

        // وضع «داخلي فقط»: لا fetch؛ التوجيه مباشرة لـ InternalAIGenerator عند الأنواع المعروفة
        this.useInternalOnly = config.useInternalOnly ?? (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_INTERNAL_ONLY) === '1');

        // Cache settings
        this._cache = new Map();
        this._cacheMax = 50;
        this._cacheTTL = 5 * 60 * 1000;
    }

    _normalizeApiUrl(path) {
        if (!path) return '/api';
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        if (path.startsWith('/')) return path;
        return `/${path}`;
    }

    // ملاحظة: أُزيل مسار OpenAI العميلي بالكامل (كان يناقض إعلان «داخلي فقط» أعلاه، ويفشل
    // بصمت في الإنتاج لأن CSP لا يسمح بـ api.openai.com، ويسرّب المفتاح من المتصفح، وبرومبت
    // حجم السوق كان يطلب اختلاق أرقام). المصدر الوحيد الآن: المولّد الداخلي / الخادم المحلي.

    async _postJson(path, body, { timeoutMs = 20000 } = {}) {
        const url = this._normalizeApiUrl(path);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body ?? {}),
                signal: controller.signal
            });

            if (!response.ok) {
                let details = '';
                try {
                    const t = await response.text();
                    details = t ? ` (${t.slice(0, 200)})` : '';
                } catch (_) {
                    // ignore
                }
                throw new Error(`HTTP ${response.status}${details}`);
            }

            return await response.json();
        } catch (e) {
            if (e?.name === 'AbortError') throw new Error('انتهت مهلة الاتصال بالخادم');
            throw e;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /** تفعيل/تعطيل الوضع الداخلي فقط وحفظه في localStorage */
    setUseInternalOnly(on) {
        this.useInternalOnly = !!on;
        try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY_INTERNAL_ONLY, on ? '1' : '0'); } catch (_) {}
    }

    _getFromCache(key) {
        const e = this._cache.get(key);
        if (!e) return undefined;
        if (Date.now() > e.expiresAt) {
            this._cache.delete(key);
            return undefined;
        }
        return e.value;
    }

    _setCache(key, value) {
        for (const [k, v] of this._cache) {
            if (Date.now() > v.expiresAt) this._cache.delete(k);
        }
        while (this._cache.size >= this._cacheMax) {
            const first = this._cache.keys().next().value;
            if (first != null) this._cache.delete(first);
        }
        this._cache.set(key, { value, expiresAt: Date.now() + this._cacheTTL });
    }

    /**
     * تشغيل المولّد الداخلي للأنواع المعروفة — يُستخدم عند useInternalOnly أو عند فشل الخادم
     * @param {string} type
     * @param {object} data - { projectInfo, context, risks, timeline, insights }
     * @returns {*} الناتج أو undefined إن لم يُدعم النوع
     */
    _runInternalFallback(type, data) {
        const proj = data?.projectInfo ?? data ?? {};
        const state = { projectInfo: proj };
        if (type === 'executive_summary' || type === 'summary') {
            try {
                const ctx = data?.context || {};
                const results = { ...ctx.financials, indicators: ctx.kpis || ctx.financials, decision: ctx.decision, decisionReasons: ctx.decisionReasons };
                return InternalAIGenerator.generateExecutiveSummary(state, results);
            } catch (e) { console.warn('Internal fallback executive summary failed', e); return undefined; }
        }
        if (type === 'business_model') { try { return InternalAIGenerator.generateBusinessModel(state); } catch (e) { console.warn('Internal fallback business_model failed', e); return undefined; } }
        if (type === 'analysis' || type === 'swot') { try { return InternalAIGenerator.generateSWOT(state); } catch (e) { console.warn('Internal fallback SWOT failed', e); return undefined; } }
        if (type === 'market_analysis' || type === 'market_analysis_text') { try { return InternalAIGenerator.generateMarketAnalysisSummary(state); } catch (e) { console.warn('Internal fallback market_analysis failed', e); return undefined; } }
        if (type === 'pestel') { try { return InternalAIGenerator.generatePESTEL(state); } catch (e) { console.warn('Internal fallback PESTEL failed', e); return undefined; } }
        if (type === 'mitigation') { try { return InternalAIGenerator.generateMitigationSuggestions(data?.risks || []); } catch (e) { console.warn('Internal fallback mitigation failed', e); return undefined; } }
        if (type === 'timeline') { try { return InternalAIGenerator.generateTimeline({ ...state, timeline: data?.timeline }); } catch (e) { console.warn('Internal fallback timeline failed', e); return undefined; } }
        if (type === 'suggest_risks') {
            try {
                const arr = InternalAIGenerator.generateRisks(state);
                return arr.map(r => ({ name: r.name, description: r.description || '', probability: r.impact === 'high' ? 'high' : 'medium', impact: r.impact || 'medium', type: r.type || 'operational', mitigation: '', owner: '' }));
            } catch (e) { console.warn('Internal fallback suggest_risks failed', e); return undefined; }
        }
        if (type === 'competitors') { try { return InternalAIGenerator.generateCompetitors(state); } catch (e) { console.warn('Internal fallback competitors failed', e); return undefined; } }
        if (type === 'suggest_segments' || type === 'segments') { try { return InternalAIGenerator.generateSegments(state); } catch (e) { console.warn('Internal fallback segments failed', e); return undefined; } }
        if (type === 'advisor') {
            try {
                // data.results = الكائن المالي الحقيقي (incomeStatement/opex/indicators/...) —
                // مصدره الآن FinancialDashboard.js صراحة. data.context قد يكون نفس الكائن
                // (getBusinessAdvice القديمة تمرره هكذا) أو غلاف ملخّص {question, kpis, insights}
                // (askHandler الجديدة) لا يصلح كمدخل لـ SmartAdvisor.analyze — لذا الأولوية لـ
                // data.results، والرجوع لـ data.context فقط للتوافق مع المستدعين القدامى.
                const results = data?.results || data?.context || {};
                const out = SmartAdvisor.analyze(results, state);
                if (out?.insights?.length > 0) return 'تحليل المستشار:\n\n' + out.insights.map(i => `• ${i.message}\n  الإجراء: ${i.action || '—'}`).join('\n\n');
                return InternalAIGenerator.generateAdvisorFallback(state);
            } catch (e) { console.warn('Internal fallback advisor failed', e); return InternalAIGenerator.generateAdvisorFallback(state); }
        }
        if (type === 'consultant_review') {
            try {
                const insights = data?.insights || [];
                if (Array.isArray(insights) && insights.length > 0) return 'رأي المستشار (من التحليل الداخلي):\n\n' + insights.map(i => `• [${i.category || '—'}] ${i.message || ''}\n  الإجراء: ${i.action || '—'}`).join('\n\n');
                return InternalAIGenerator.generateAdvisorFallback({ projectInfo: data?.projectInfo || {} });
            } catch (e) { console.warn('Internal fallback consultant_review failed', e); return InternalAIGenerator.generateAdvisorFallback({ projectInfo: {} }); }
        }
        if (type === 'suggest_licenses') { try { return InternalAIGenerator.generateLicenses(state); } catch (e) { console.warn('Internal fallback suggest_licenses failed', e); return undefined; } }
        if (type === 'suggest_logistics') { try { return InternalAIGenerator.generateLogistics(state); } catch (e) { console.warn('Internal fallback suggest_logistics failed', e); return undefined; } }
        if (type === 'suggest_administrative') { try { return InternalAIGenerator.generateAdministrative(state); } catch (e) { console.warn('Internal fallback suggest_administrative failed', e); return undefined; } }
        if (type === 'suggest_campaigns') { try { return InternalAIGenerator.generateCampaigns(state); } catch (e) { console.warn('Internal fallback suggest_campaigns failed', e); return undefined; } }
        if (type === 'suggest_revenue') { try { return InternalAIGenerator.generateRevenueStreams(state); } catch (e) { console.warn('Internal fallback suggest_revenue failed', e); return undefined; } }
        if (type === 'suggest_staff') { try { return InternalAIGenerator.generatePositions(state); } catch (e) { console.warn('Internal fallback suggest_staff failed', e); return undefined; } }
        if (type === 'suggest_key_people') { try { return InternalAIGenerator.generateKeyPeople(state); } catch (e) { console.warn('Internal fallback suggest_key_people failed', e); return undefined; } }
        if (type === 'suggest_products') { try { return InternalAIGenerator.generateProducts(state); } catch (e) { console.warn('Internal fallback suggest_products failed', e); return undefined; } }
        if (type === 'suggest_intro_services') { try { return InternalAIGenerator.generateIntroServices(state); } catch (e) { console.warn('Internal fallback suggest_intro_services failed', e); return undefined; } }
        if (type === 'suggest_customer_values') { try { return InternalAIGenerator.generateCustomerValues(state); } catch (e) { console.warn('Internal fallback suggest_customer_values failed', e); return undefined; } }
        if (type === 'suggest_buildings') { try { return InternalAIGenerator.generateBuildings(state); } catch (e) { console.warn('Internal fallback suggest_buildings failed', e); return undefined; } }
        if (type === 'suggest_equipment') { try { return InternalAIGenerator.generateEquipment(state); } catch (e) { console.warn('Internal fallback suggest_equipment failed', e); return undefined; } }
        if (type === 'suggest_furniture') { try { return InternalAIGenerator.generateFurniture(state); } catch (e) { console.warn('Internal fallback suggest_furniture failed', e); return undefined; } }
        if (type === 'suggest_tech') { try { return InternalAIGenerator.generateTechResources(state); } catch (e) { console.warn('Internal fallback suggest_tech failed', e); return undefined; } }
        if (type === 'suggest_location_factors') { try { return InternalAIGenerator.generateLocationFactors(state); } catch (e) { console.warn('Internal fallback suggest_location_factors failed', e); return undefined; } }
        if (type === 'suggest_suppliers') { try { return InternalAIGenerator.generateSuppliers(state); } catch (e) { console.warn('Internal fallback suggest_suppliers failed', e); return undefined; } }
        if (type === 'suggest_competitor_benchmark') { try { return InternalAIGenerator.generateCompetitorBenchmark(state); } catch (e) { console.warn('Internal fallback suggest_competitor_benchmark failed', e); return undefined; } }
        if (type === 'suggest_establishment_costs') { try { return InternalAIGenerator.generateEstablishmentCosts(state); } catch (e) { console.warn('Internal fallback suggest_establishment_costs failed', e); return undefined; } }
        if (type === 'suggest_operational_kpis') { try { return InternalAIGenerator.generateOperationalKpis(state); } catch (e) { console.warn('Internal fallback suggest_operational_kpis failed', e); return undefined; } }
        if (type === 'field_suggestion') {
            try {
                const ctx = data?.context || {};
                const state = { projectInfo: data.projectInfo || {} };
                return InternalAIGenerator.generateFieldSuggestion(ctx.fieldName, ctx.currentValue, state);
            } catch (e) { console.warn('Internal fallback field_suggestion failed', e); return undefined; }
        }
        if (type === 'pitch_script') {
            try {
                const ind = data?.context?.indicators || data?.projectInfo?.indicators || {};
                const name = (proj.name || 'المشروع');
                const city = (proj.city || 'المدينة');
                const desc = proj.description || 'خدمات متميزة';
                const concept = proj.concept || desc;
                const sector = proj.sector || 'القطاع';
                const npv = ind.npv ?? 0, irr = ind.irr ?? 0, payback = ind.paybackPeriod ?? ind.payback ?? null, roi = ind.roi ?? 0;
                const paybackNum = Number(payback);
                const paybackText = Number.isFinite(paybackNum) && paybackNum > 0 ? `${paybackNum.toFixed(1)} سنوات` : 'غير محققة ضمن فترة الدراسة';
                return `سكربت العرض التقديمي (Pitch) — ${name}\nمدة مقترحة: 1–2 دقيقة\n\n[الافتتاحية — 15 ثانية]\nمرحباً، أنا هنا لأقدم لكم فرصة استثمارية واضحة: مشروع «${name}» في ${city}. نحن نقدم ${desc}، ونستهدف فجوة حقيقية في السوق.\n\n[المشكلة والحل — 25 ثانية]\nالمشكلة التي نعالجها: عدم وجود عرض يوفّر ${concept} بجودة عالية وسعر مناسب في نطاقنا. حلنا يقوم على ${concept} مع فريق محترف وموقع استراتيجي في ${city}.\n\n[السوق والفرصة — 20 ثانية]\n• السوق المستهدف: ${city} والمناطق المحيطة.\n• القطاع: ${sector}.\n\n[الأرقام الرئيسية — 25 ثانية]\n• صافي القيمة الحالية (NPV): ${Number(npv).toLocaleString('ar-SA')} ريال.\n• معدل العائد الداخلي (IRR): ${(Number(irr) * 100).toFixed(1)}%.\n• فترة الاسترداد: ${paybackText}.\n• العائد على الاستثمار (ROI): ${(Number(roi) * 100).toFixed(0)}%.\n\n[الإغلاق — 15 ثانية]\nنطلب منكم الشراكة معنا لتحقيق هذه الرؤية. شكراً لكم، وأنا جاهز لأسئلتكم.`;
            } catch (e) { console.warn('Internal fallback pitch_script failed', e); return undefined; }
        }
        return undefined;
    }

    /**
     * Build cache key from type + canonical payload (projectInfo + context slice) to avoid stale results.
     * @param {string} type
     * @param {object} data
     * @returns {string}
     */
    _buildCacheKey(type, data) {
        const proj = data?.projectInfo ?? {};
        const ctx = data?.context ?? {};
        const canonical = {
            type,
            name: proj.name,
            city: proj.city,
            sector: proj.sector,
            concept: proj.concept,
            npv: ctx?.financials?.npv ?? ctx?.indicators?.npv,
            irr: ctx?.financials?.irr ?? ctx?.indicators?.irr,
        };
        let str = JSON.stringify(canonical);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + c;
            hash = hash & hash;
        }
        return type + '::' + hash;
    }

    /**
     * Generate AI-powered business advice (Via Internal Logic)
     */
    async getBusinessAdvice(studyData, financialResults) {
        const prompt = 'advisor'; // The backend knows what to do
        return this.query(prompt, 'advisor', { projectInfo: studyData.projectInfo, context: financialResults });
    }

    /**
     * Generate risk mitigation suggestions
     */
    async getRiskMitigation(risks) {
        // Internal Brain doesn't need complex prompting, just the type
        return this.query('mitigate', 'mitigation', { risks });
    }

    /**
     * Generate executive summary
     */
    async generateExecutiveSummary(studyData, financialResults) {
        // We pass the data, the backend constructs the text procedurally
        return this.query('summary', 'executive_summary', {
            projectInfo: studyData.projectInfo,
            context: {
                financials: financialResults,
                kpis: financialResults?.indicators
            }
        });
    }

    /**
     * توليد نص تحليل السوق (فقرة واحدة) — للاستخدام في "ولّد تحليل السوق"
     */
    async generateMarketAnalysisText(studyData) {
        const state = { projectInfo: studyData?.projectInfo ?? studyData ?? {} };
        return this.query('market_analysis_text', 'market_analysis_text', state);
    }

    /**
     * توليد تحليل SWOT — يُرجع كائن { strengths, weaknesses, opportunities, threats }
     */
    async generateSWOT(studyData) {
        const state = { projectInfo: studyData?.projectInfo ?? studyData ?? {} };
        return this.query('analysis', 'swot', state);
    }

    /**
     * توليد قائمة المنافسين — يُرجع مصفوفة
     */
    async generateCompetitors(studyData) {
        const state = { projectInfo: studyData?.projectInfo ?? studyData ?? {} };
        return this.query('competitors', 'competitors', state);
    }

    /**
     * توليد اقتراحات مخاطر (قسم المخاطر) — للاستخدام في "اكتب لي هذا القسم" / LivePlan
     */
    async generateRisksForReport(studyData) {
        const state = studyData?.projectInfo ? studyData : { projectInfo: studyData?.projectInfo ?? {} };
        return this.query('suggest_risks', 'suggest_risks', state);
    }

    /**
     * توليد Pitch Script بالـ AI (نص عرض تقديمي 1–2 دقيقة للمستثمرين)
     */
    async generatePitchScript(studyData, financialResults) {
        const projectInfo = { ...(studyData?.projectInfo || {}), indicators: financialResults?.indicators };
        const payload = { projectInfo, context: { indicators: financialResults?.indicators } };
        const result = await this.query('pitch_script', 'pitch_script', payload);
        const text = typeof result === 'string' ? result : (typeof result?.content === 'string' ? result.content : '');
        if (text.trim()) return text;

        const fallback = this._runInternalFallback('pitch_script', payload);
        return typeof fallback === 'string' ? fallback : '';
    }

    // ملاحظة: أُزيلت خمس دوال ميتة (optimizeProject/getFinancialAudit/optimizeStaffing/
    // runSimulation/analyzeSensitivity) كانت تستدعي /api/optimize و/api/audit و/api/simulate —
    // مسارات لا يخدمها ai_server.py (يخدم /api/generate و/market/defaults و/experience/suggest
    // فقط) ولا أي واجهة تستدعيها، فتفشل 404 دائماً وتوحي بقدرات «Deep Core» غير موجودة.

    /**
     * Get Market Analysis (TAM/SAM/SOM)
     * عند useInternalOnly أو فشل الخادم: استخدام InternalAIGenerator
     */
    async getMarketAnalysis(city, sector) {
        // أرقام السوق تُشتق من المولّد الداخلي الموسوم (لا من نموذج خارجي يختلق أرقاماً بلا مصدر)
        const runInternal = () => {
            try {
                const state = { projectInfo: { city: city || 'المنطقة', concept: sector || 'النشاط' } };
                const desc = InternalAIGenerator.generateMarketDescriptions(state);
                const est = InternalAIGenerator.generateMarketEstimates(city, sector);
                return { tam: { ...desc.tam, value: est.tam }, sam: { ...desc.sam, value: est.sam }, som: { ...desc.som, value: est.som } };
            } catch (e) { console.warn('Internal market failed', e); return null; }
        };
        if (this.useInternalOnly) return runInternal();

        try {
            return await this._postJson('/api/market_analysis', { city: city || '', sector: sector || '' }, { timeoutMs: 20000 });
        } catch (e) {
            console.warn('getMarketAnalysis fallback to internal', e);
            return runInternal();
        }
    }

    /**
     * Ask Internal Brain to Reverse Engineer pricing
     */
    async reverseEngineerPrice(inputs, targetMargin = 0.20) {
        try {
            return await this._postJson('/api/optimize', {
                mode: 'reverse',
                inputs: inputs,
                target_margin: targetMargin
            }, { timeoutMs: 20000 });
        } catch (e) {
            return null;
        }
    }

    /**
     * Query Internal Brain
     * عند useInternalOnly أو فشل الخادم: استخدام _runInternalFallback للأنواع المعروفة
     */
    async query(prompt, type = 'general', data = {}) {
        const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const eventBase = { type, provider: this.provider, model: this.model };
        const trackCompletion = (source, outcome) => {
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            trackEvent('ai_request_completed', {
                ...eventBase,
                source,
                outcome,
                duration_ms: Math.max(0, Math.round(now - startedAt)),
            });
        };
        const cacheKey = this._buildCacheKey(type, data);
        const cached = this._getFromCache(cacheKey);
        if (cached !== undefined) {
            trackEvent('ai_cache_hit', eventBase);
            trackCompletion('cache', 'success');
            return cached;
        }

        const runInternal = () => this._runInternalFallback(type, data);

        if (this.useInternalOnly) {
            const r = runInternal();
            if (r !== undefined) {
                this._setCache(cacheKey, r);
                trackCompletion('internal', 'success');
                return r;
            }
            // null = «لا ناتج» — لا نعيد نص خطأ قد يحفظه المستدعي كمحتوى قسم في التقرير
            console.warn(`AIConnector: لا يتوفر مولّد داخلي للنوع "${type}"`);
            trackCompletion('internal', 'empty');
            return null;
        }

        try {
            const result = await this._postJson(this.endpoint, {
                type,
                projectInfo: data.projectInfo || {},
                context: data.context || {}
            }, { timeoutMs: 20000 });
            const content = result.content || result;

            // ‏{"content": []} من خادم بلا مفتاح API كان يمرّ كنجاح: المصفوفة الفارغة truthy،
            // فتُعاد وتُخزَّن في الكاش، والمولّد الداخلي لا يعمل لأن لا استثناء — فتبدو كل
            // أزرار ✨ «ميتة» بصمت تام (تدقيق ٢٠٢٦-٠٧-٠٦). الفارغ ليس ناتجاً.
            const isEmpty =
                content == null ||
                (Array.isArray(content) && content.length === 0) ||
                (typeof content === 'string' && content.trim() === '') ||
                (typeof content === 'object' && !Array.isArray(content) && Object.keys(content).length === 0);
            if (isEmpty) {
                this._notifyLocalFallback();
                const r = runInternal();
                if (r !== undefined) {
                    this._setCache(cacheKey, r);
                    trackCompletion('fallback', 'success');
                    return r;
                }
                trackCompletion('server', 'empty');
                return null;
            }

            this._setCache(cacheKey, content);
            trackCompletion('server', 'success');
            return content;
        } catch (error) {
            console.error('Internal Brain query error:', error);
            this._notifyLocalFallback();
            const r = runInternal();
            if (r !== undefined) {
                trackCompletion('fallback', 'success');
                return r;
            }
            // null = «لا ناتج» — كانت رسالة الخطأ هنا تجتاز فحص typeof string لدى المستدعين
            // وتُحفظ كنص قسم «دراسة السوق» ثم تُطبع حرفياً في تقرير منشآت
            trackCompletion('server', 'error');
            return null;
        }
    }

    /**
     * إفصاح لمرة واحدة في الجلسة: خادم الذكاء لم يُنتج محتوى والنصوص مولّدة محلياً من
     * قوالب المنصة — كي لا يظن العميل أن ما يقرؤه ذكاء اصطناعي خادمي وهو قالب داخلي.
     */
    _notifyLocalFallback() {
        if (this._localFallbackNotified) return;
        this._localFallbackNotified = true;
        console.warn('AIConnector: خادم الذكاء غير متاح/أعاد محتوى فارغاً — التوليد يتم محلياً من قوالب المنصة.');
        import('../utils/toast.js')
            .then(({ toast }) => toast?.info?.('خدمة الذكاء غير متاحة حالياً — النصوص تُولَّد محلياً من قوالب المنصة. راجعها وعدّلها قبل الاعتماد عليها.', 7000))
            .catch(() => {});
    }

    // Keep table generation for compatibility, but mapped to internal logic
    async generateTableSuggestions(type, projectInfo = {}) {
        const result = await this.query('', type, { projectInfo });
        if (Array.isArray(result) && result.length > 0) return result;
        // الخادم قد يردّ 200 بمحتوى غير مصفوفة لأنواع لا يدعمها (suggest_risks مثلاً) فلا يُطلق catch
        // فيبقى الزر «ميتاً». نرجع للمولّد الداخلي الذي يدعم هذه الأنواع — مطابقةً لسلوك التراخيص.
        try {
            const internal = this._runInternalFallback(type, { projectInfo });
            return Array.isArray(internal) ? internal : [];
        } catch (e) {
            console.warn('generateTableSuggestions internal fallback failed', e);
            return [];
        }
    }
}

// Singleton instance
export const aiConnector = new AIConnector();

// Quick access functions
export async function getAIAdvice(studyData, financialResults) {
    return aiConnector.getBusinessAdvice(studyData, financialResults);
}

export async function getAIMitigation(risks) {
    return aiConnector.getRiskMitigation(risks);
}

export async function getAISummary(studyData, financialResults) {
    return aiConnector.generateExecutiveSummary(studyData, financialResults);
}

export async function generateTableSuggestions(type, projectInfo) {
    return aiConnector.generateTableSuggestions(type, projectInfo);
}

export async function generatePitchScript(studyData, financialResults) {
    return aiConnector.generatePitchScript(studyData, financialResults);
}

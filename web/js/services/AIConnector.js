/**
 * AI API Connector
 * Connects to AI services for intelligent recommendations
 */

import { InternalAIGenerator } from './InternalAIGenerator.js';
import { SmartAdvisor } from './SmartAdvisor.js';

const AI_ENDPOINTS = {
    local: '/api/generate',
    openai: 'https://api.openai.com/v1/chat/completions',
    anthropic: 'https://api.anthropic.com/v1/messages',
    perplexity: 'https://api.perplexity.ai/chat/completions'
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
                const ctx = data?.context || {};
                const out = SmartAdvisor.analyze(ctx, state);
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
                const npv = ind.npv ?? 0, irr = ind.irr ?? 0, payback = ind.paybackPeriod ?? ind.payback ?? 0, roi = ind.roi ?? 0;
                return `سكربت العرض التقديمي (Pitch) — ${name}\nمدة مقترحة: 1–2 دقيقة\n\n[الافتتاحية — 15 ثانية]\nمرحباً، أنا هنا لأقدم لكم فرصة استثمارية واضحة: مشروع «${name}» في ${city}. نحن نقدم ${desc}، ونستهدف فجوة حقيقية في السوق.\n\n[المشكلة والحل — 25 ثانية]\nالمشكلة التي نعالجها: عدم وجود عرض يوفّر ${concept} بجودة عالية وسعر مناسب في نطاقنا. حلنا يقوم على ${concept} مع فريق محترف وموقع استراتيجي في ${city}.\n\n[السوق والفرصة — 20 ثانية]\n• السوق المستهدف: ${city} والمناطق المحيطة.\n• القطاع: ${sector}.\n\n[الأرقام الرئيسية — 25 ثانية]\n• صافي القيمة الحالية (NPV): ${Number(npv).toLocaleString('ar-SA')} ريال.\n• معدل العائد الداخلي (IRR): ${(Number(irr) * 100).toFixed(1)}%.\n• فترة الاسترداد: ${Number(payback).toFixed(1)} سنوات.\n• العائد على الاستثمار (ROI): ${(Number(roi) * 100).toFixed(0)}%.\n\n[الإغلاق — 15 ثانية]\nنطلب منكم الشراكة معنا لتحقيق هذه الرؤية. شكراً لكم، وأنا جاهز لأسئلتكم.`;
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
        return this.query('pitch_script', 'pitch_script', { projectInfo, context: { indicators: financialResults?.indicators } });
    }

    /**
     * Get mathematical optimization suggestions
     */
    async optimizeProject(projectData) {
        try {
            return await this._postJson('/api/optimize', projectData, { timeoutMs: 20000 });
        } catch (e) {
            console.error('Optimization error:', e);
            return [];
        }
    }

    /**
     * Virtual CFO: Deep Audit
     */
    async getFinancialAudit(projectData) {
        try {
            return await this._postJson('/api/audit', projectData, { timeoutMs: 20000 });
        } catch (e) {
            console.error('Audit error:', e);
            return { flags: [] };
        }
    }

    /**
     * Ask Internal Brain: "Can I hire more?"
     */
    async optimizeStaffing(inputs, financials) {
        try {
            return await this._postJson('/api/optimize', {
                mode: 'staffing',
                inputs: inputs,
                financials: financials
            }, { timeoutMs: 20000 });
        } catch (e) {
            return null;
        }
    }

    /**
     * Run Monte Carlo Simulation (Deep Core)
     */
    async runSimulation(inputs, financials) {
        try {
            return await this._postJson('/api/simulate', {
                mode: 'monte_carlo',
                inputs: inputs,
                financials: financials
            }, { timeoutMs: 25000 });
        } catch (e) {
            return null;
        }
    }

    /**
     * Run Sensitivity Analysis (Deep Core)
     */
    async analyzeSensitivity(inputs, financials) {
        try {
            return await this._postJson('/api/simulate', {
                mode: 'sensitivity',
                inputs: inputs,
                financials: financials
            }, { timeoutMs: 25000 });
        } catch (e) {
            return null;
        }
    }

    /**
     * Get Market Analysis (TAM/SAM/SOM)
     * عند useInternalOnly أو فشل الخادم: استخدام InternalAIGenerator
     */
    async getMarketAnalysis(city, sector) {
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
        const cacheKey = this._buildCacheKey(type, data);
        const cached = this._getFromCache(cacheKey);
        if (cached !== undefined) return cached;

        const runInternal = () => this._runInternalFallback(type, data);

        if (this.useInternalOnly) {
            const r = runInternal();
            if (r !== undefined) { this._setCache(cacheKey, r); return r; }
            // null = «لا ناتج» — لا نعيد نص خطأ قد يحفظه المستدعي كمحتوى قسم في التقرير
            console.warn(`AIConnector: لا يتوفر مولّد داخلي للنوع "${type}"`);
            return null;
        }

        try {
            const result = await this._postJson(this.endpoint, {
                type,
                projectInfo: data.projectInfo || {},
                context: data.context || {}
            }, { timeoutMs: 20000 });
            const content = result.content || result;

            this._setCache(cacheKey, content);
            return content;
        } catch (error) {
            console.error('Internal Brain query error:', error);
            const r = runInternal();
            if (r !== undefined) return r;
            // null = «لا ناتج» — كانت رسالة الخطأ هنا تجتاز فحص typeof string لدى المستدعين
            // وتُحفظ كنص قسم «دراسة السوق» ثم تُطبع حرفياً في تقرير منشآت
            return null;
        }
    }

    // Keep table generation for compatibility, but mapped to internal logic
    async generateTableSuggestions(type, projectInfo = {}) {
        // The backend `_build_table_data` handles this now
        const result = await this.query('', type, { projectInfo });
        return Array.isArray(result) ? result : [];
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

export async function optimizeProject(projectData) {
    return aiConnector.optimizeProject(projectData);
}

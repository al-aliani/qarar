/**
 * مولّد نصوص داخلي (ذكاء صناعي داخلي)
 * ينتج نصوص نموذج العمل وغيره من بيانات الدراسة باستخدام قواعد ونماذج محلية.
 * لا يتطلب اتصالاً خارجياً أو مفاتيح API.
 */

const BLOCK_KEYS = [
    'valueProposition', 'customerSegments', 'channels', 'customerRelationships',
    'revenueStreams', 'keyResources', 'keyActivities', 'keyPartners', 'costStructure'
];

import { getCityStats, getSuggestion } from '../data/SaudiCityStats.js';
import { getCostRatios } from '../core/costRatios.js';
import { resolveSectorBenchmark } from '../core/sectorBenchmarks.js';

function or(v, d) { return (v != null && String(v).trim() !== '') ? String(v).trim() : d; }

/**
 * اسم نشاط قصير صالح للحشر داخل جملة. نص «نوع النشاط» الوصفي الطويل (من قوالب قديمة
 * أو إدخال حر) كان يُقحم كاملاً في الجمل فيكسر تركيبها: «تقديم متجر عطور نسائية ورجالية
 * وتجزئة ماركات محلية وعالمية الأساسي» (تدقيق ٢٠٢٦-٠٧-٠٦). نفضّل القيمة القصيرة،
 * ثم القطاع، ثم نقتطع حتى أول فاصل طبيعي.
 */
function shortActivity(p, fallback) {
    const c = (p?.concept || '').toString().trim();
    const s = (p?.sector || '').toString().trim();
    if (c && c.length <= 30) return c;
    if (s && s.length <= 30) return s;
    if (c) {
        const cut = c.split(/[،,ـ—]|\sو/)[0].trim();
        if (cut.length >= 4) return cut;
        return c.slice(0, 30);
    }
    return fallback;
}

/**
 * توليد نموذج العمل (Business Model Canvas) من بيانات الدراسة
 * @param {object} state - حالة الدراسة من الـ store
 * @returns {object} كائن بالحقول التسعة، كل قيمة string
 */
export function generateBusinessModel(state) {
    const p = state?.projectInfo || {};
    const name = or(p.name, 'المشروع');
    const concept = shortActivity(p, 'النشاط المقترح');
    const desc = or(p.description, 'تقديم قيمة للعميل');
    const city = or(p.city, 'الموقع المستهدف');
    const district = or(p.district, '');
    const districtStr = district ? ` حي ${district}` : '';

    // مصادر الإيرادات (يدعم revenue.streams و revenue.revenueStreams؛ يدعم service، name، title)
    const streams = state?.revenue?.revenueStreams || state?.revenue?.streams || [];
    const revenueSummary = streams.length
        ? streams.map(s => `${or(s.name, or(s.title, or(s.service, 'مصدر')))} (${or(s.type, 'بيع')})`).join('، ')
        : 'مبيعات المنتجات والخدمات';

    // المنافسون
    const comps = state?.marketing?.competitors || [];
    const compsStr = comps.length ? comps.map(c => or(c.name, 'منافس')).join('، ') : '';

    // الموارد البشرية
    const positions = state?.hr?.positions || [];
    const positionsSummary = positions.length
        ? positions.map(x => `${or(x.position, or(x.title, 'وظيفة'))} (${x.count || 1})`).join('، ')
        : 'كادر تشغيلي وإداري';

    // الأصول: مباني، معدات، أثاث
    const tech = state?.technical || {};
    const assets = [
        ...(tech.buildings || []),
        ...(tech.equipment || []),
        ...(tech.furniture || [])
    ];
    const assetsSummary = assets.length
        ? assets.slice(0, 6).map(a => or(a.name, 'بند')).join('، ')
        : 'الموقع، المعدات، والأثاث';

    // الحملات التسويقية
    const camps = state?.marketing?.campaigns || [];
    const hasDigital = camps.some(c => /إلكترون|انستقرام|تيك|سناب|فيسبوك|ديجيتال|رقم/i.test(or(c.name, or(c.channel, ''))));

    // المخاطر
    const risk = state?.riskAnalysis || {};
    const riskList = risk.risks || risk.matrix || (Array.isArray(risk) ? risk : []);
    const risksList = riskList.slice(0, 4).map(r => (typeof r === 'string' ? r : (r?.name || r?.risk || r?.description || ''))).filter(Boolean);
    const risksSummary = risksList.length ? risksList.join('، ') : 'مخاطر السوق والتشغيل العامة';

    // قنوات الوصول
    let channelsText = 'قنوات الوصول: الموقع الفعلي أو الفرع، التفاعل المباشر مع العميل.';
    if (hasDigital || camps.length > 0) {
        channelsText += ' الاعتماد على المنصات الإلكترونية والحملات الرقمية.';
    }
    if (compsStr) {
        channelsText += ` التنافس مع ${compsStr} يتطلب تميزاً في القنوات وطرق الوصول.`;
    }

    // تحليل المقارنة المعيارية للمنافسين (الميزة التنافسية)
    const benchmarking = state?.marketing?.competitorBenchmarking || [];
    let competitiveAdvantage = '';
    if (benchmarking.length > 0) {
        const myRankOne = benchmarking.filter(b => Number(b.myRank) === 1).map(b => b.criterion);
        if (myRankOne.length > 0) {
            competitiveAdvantage = ` ويتميز المشروع تنافسياً عن غيره في: ${myRankOne.join(' و')}.`;
        }
    }

    // حجم السوق
    const som = state?.marketSizing?.som?.value ?? state?.marketSizing?.som ?? 0;
    const tam = state?.marketSizing?.tam?.value ?? state?.marketSizing?.tam ?? 0;
    let marketInfo = '';
    if (Number(som) > 0 && Number(tam) > 0) {
        marketInfo = ` باستهداف حصة سوقية مخدومة (SOM) تقدر بـ ${Number(som).toLocaleString('ar-SA')} من إجمالي السوق المتاح.`;
    }

    return {
        valueProposition: `يمثل مشروع «${name}» حلاً يركز على ${concept}. ${desc}. يهدف المشروع إلى تقديم قيمة متميزة للعملاء في ${city}${districtStr}.${competitiveAdvantage}`,
        customerSegments: `شرائح العملاء المستهدفة: العملاء في منطقة ${city}${districtStr} والمهتمين بـ ${concept}.${marketInfo}`,
        channels: channelsText,
        customerRelationships: `علاقة مباشرة مع العميل عبر جودة الخدمة والمنتج. الاهتمام بالولاء والتكرار عبر تجربة إيجابية وخدمة ما بعد البيع.`,
        revenueStreams: `مصادر الإيرادات: ${revenueSummary}.`,
        keyResources: `الموارد الأساسية: ${assetsSummary}. الفريق البشري: ${positionsSummary}.`,
        keyActivities: `الأنشطة الرئيسية: التشغيل اليومي، الإنتاج أو تقديم الخدمة، التسويق وخدمة العملاء، والمتابعة الإدارية.`,
        keyPartners: `الشراكات: الموردون، مزودو التقنية والخدمات، وإمكانية التحالفات التسويقية أو التوزيع لتعزيز الوصول.`,
        costStructure: `هيكل التكاليف: تكاليف ثابتة (إيجار، رواتب، إهلاك) وتكاليف متغيرة مرتبطة بالإنتاج والمبيعات. مراعاة: ${risksSummary}.`
    };
}

/**
 * توليد مقترح تحليل القطاع والصناعة
 * @param {object} state
 * @returns {{ sectorAnalysis: string, industryAnalysis: string }}
 */
export function generateSectorIndustry(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'النشاط');
    const city = or(p.city, 'المنطقة');
    const som = state?.marketSizing?.som?.value ?? state?.marketSizing?.som ?? 0;
    const tam = state?.marketSizing?.tam?.value ?? state?.marketSizing?.tam ?? 0;

    // لا ادعاءات منهجية بجهات رسمية ولا إحصاءات مُختلَقة — نص استرشادي مبني على مدخلات المستخدم فقط
    const somPart = Number(som) > 0 && Number(tam) > 0
        ? ` الحصة المستهدفة المُدخلة (${Number(som).toLocaleString('ar-SA')}) تعادل ${((Number(som) / Number(tam)) * 100).toFixed(1)}% من السوق الكلي المُقدّر.`
        : '';
    const sectorAnalysis = `قطاع ${concept} في ${city} من القطاعات المرتبطة بالإنفاق الاستهلاكي المحلي، ويستفيد من برامج دعم المنشآت الصغيرة والمتوسطة ضمن رؤية 2030.${somPart} (نص استرشادي مولَّد من مدخلات دراستك — راجعه وأسنده بأرقام سوق فعلية قبل التقديم لممول.)`;

    const industryAnalysis = `المنافسة في نشاط ${concept} تتراوح عادة بين متوسطة وعالية، بين لاعبين راسخين ومشاريع صغيرة ومتوسطة. عوامل التنافس الرئيسية: الجودة، السعر، الموقع، وتجربة العميل. التوجهات العامة: الرقمنة، التوصيل، والتخصيص حسب احتياجات الشريحة.`;

    return { sectorAnalysis, industryAnalysis };
}

/**
 * توليد مقترح مواءمة رؤية 2030 ودراسة اقتصاد الدولة
 * @param {object} state
 * @returns {{ vision2030: object, nationalEconomy: object }}
 */
export function generateVision2030Economy(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'النشاط');
    const city = or(p.city, 'المملكة');

    const vision2030 = {
        alignment: `المشروع يتماشى مع رؤية 2030 من خلال المساهمة في تنويع الاقتصاد، وخلق فرص عمل، وتعزيز المحتوى المحلي في قطاع ${concept}.`,
        relevantPrograms: 'برامج منشآت، كفالة، رفع المحتوى المحلي، وتمويل المشاريع الصغيرة والمتوسطة.',
        impact: 'زيادة التشغيل، تنشيط القطاع المحلي، ودعم أهداف الرؤية في القطاع الخاص.'
    };

    const nationalEconomy = {
        gdpGrowth: 'النمو الاقتصادي السعودي إيجابي، مع توجه قوي نحو الاستثمار والتنويع. القطاع الخاص في نمو مستمر.',
        sectorGrowth: `قطاع ${concept} يستفيد من النمو السكاني والتحسن في القوة الشرائية واتجاهات الاستهلاك.`,
        keyIndicators: 'مؤشرات الاستثمار، مبيعات التجزئة، وسوق العمل إيجابية. السياسات الحكومية تدعم ريادة الأعمال.',
        trends: 'التحول الرقمي، ارتفاع توقعات الجودة، والتركيز على تجربة العميل.'
    };

    return { vision2030, nationalEconomy };
}

/**
 * توليد نص تحليل السوق (فقرة واحدة) من بيانات الدراسة — للاستخدام في "ولّد تحليل السوق"
 * @param {object} state
 * @returns {string}
 */
export function generateMarketAnalysisSummary(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'المنتج أو الخدمة');
    const city = or(p.city, 'المنطقة');
    const sector = generateSectorIndustry(state);
    const desc = generateMarketDescriptions(state);
    const parts = [
        sector.sectorAnalysis,
        sector.industryAnalysis,
        `السوق المتاح: ${desc.tam?.description || ''}. السوق المستهدف: ${desc.sam?.description || ''}. الحصة المستهدفة: ${desc.som?.description || ''}.`
    ].filter(Boolean);
    return parts.join(' ');
}

/**
 * توليد أوصاف TAM-SAM-SOM (حجم السوق) من بيانات الدراسة
 * @param {object} state
 * @returns {{ tam: {description}, sam: {description}, som: {description} }}
 */
export function generateMarketDescriptions(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'المنتج أو الخدمة');
    const city = or(p.city, 'المنطقة المستهدفة');
    const name = or(p.name, 'المشروع');

    return {
        tam: {
            description: `إجمالي السوق المتاح لـ ${concept} على المستوى الوطني أو الإقليمي. يشمل كل الطلب المحتمل على المنتجات أو الخدمات المشابهة في النطاق الجغرافي الواسع.`
        },
        sam: {
            description: `جزء من السوق الكلي الذي يمكن الوصول إليه من ${city} وتقديم الخدمة فيه. يشمل الطلب على ${concept} في النطاق الجغرافي والتشغيلي الذي يستهدفه مشروع «${name}».`
        },
        som: {
            description: `الحصة التي يسعى مشروع «${name}» للوصول إليها خلال السنوات الأولى (3–5). تعتمد على القدرة التشغيلية، التميز التنافسي، وخطة التسويق في ${city}.`
        }
    };
}

/**
 * توليد تحليل SWOT من بيانات الدراسة (داخلي، بدون API)
 * @param {object} state
 * @returns {{ strengths: string[], weaknesses: string[], opportunities: string[], threats: string[] }}
 */
export function generateSWOT(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'النشاط');
    const city = or(p.city, 'المنطقة');
    const tech = state?.technical || {};
    const hr = state?.hr || {};
    const rev = state?.revenue || {};
    const risk = state?.riskAnalysis || {};

    const assets = [...(tech.buildings || []), ...(tech.equipment || []), ...(tech.furniture || [])];
    const pos = hr?.positions || [];
    const streams = rev?.revenueStreams || rev?.streams || [];
    const riskList = risk?.risks || risk?.matrix || (Array.isArray(risk) ? risk : []);

    const strengths = [
        `تركيز على ${concept} في موقع استراتيجي (${city})`,
        `وجود خطة وموارد مبدئية محددة في دراسة الجدوى`
    ];
    if (assets.length > 0) strengths.push(`أصول وتجهيزات: ${assets.slice(0, 2).map(a => a?.name).filter(Boolean).join('، ') || 'معدات ومباني'}`);
    if (pos.length > 0) strengths.push(`هيكل فريق واضح: ${pos.slice(0, 2).map(x => x?.position || x?.title).filter(Boolean).join('، ') || 'كادر تشغيلي'}`);
    if (streams.length > 1) strengths.push('تنوع في مصادر الإيرادات المتوقعة');

    // نقاط ضعف مبنية على مدخلات الدراسة الفعلية قدر الإمكان (كانت 3 نقاط متطابقة لكل مشروع)
    const weaknesses = ['علامة تجارية جديدة تحتاج بناء وعي في السوق'];
    const financing = state?.financing?.sources || {};
    const equityAmt = Number(financing.equity?.amount || 0);
    const loanAmt = Number(financing.bankLoan?.amount || 0);
    if (loanAmt > 0 && loanAmt >= equityAmt) weaknesses.push('اعتماد ملموس على التمويل بالدين (أقساط تضغط على التدفق النقدي)');
    if (pos.length <= 2) weaknesses.push('فريق عمل محدود العدد في مرحلة الانطلاق');
    if (streams.length <= 1) weaknesses.push('الاعتماد على مصدر إيراد واحد يزيد حساسية المشروع لتقلب الطلب');
    if (weaknesses.length < 3) weaknesses.push('محدودية الموارد المالية والتشغيلية في البداية مقارنة بالمنافسين الراسخين');

    // فرص مبنية على مدخلات الدراسة الفعلية قدر الإمكان (كانت 4 عبارات شبه ثابتة —
    // فقط الأولى تُقحم فيها concept/city — على عكس weaknesses/threats المبنيتين ديناميكياً).
    const opportunities = [
        `نمو الطلب المحلي على ${concept} في ${city}`,
        'دعم برامج رؤية 2030 للمشاريع الصغيرة والمتوسطة'
    ];
    const ms = state?.marketSizing || {};
    const tamVal = Number(ms?.tam?.value || 0);
    const somVal = Number(ms?.som?.value || 0);
    if (tamVal > 0 && (somVal <= 0 || tamVal >= somVal * 5)) {
        opportunities.push(`حجم السوق الكلي (TAM) يقدَّر بنحو ${tamVal.toLocaleString('ar-SA')} ريال، وهو كبير مقارنة بالحصة المستهدفة، ما يفتح مجالاً واسعاً للنمو والتوسع`);
    } else {
        opportunities.push('فرص التوسع الرقمي والتوصيل');
    }
    const marketingComps = state?.marketing?.competitors || [];
    if (marketingComps.length > 0 && marketingComps.length <= 2) {
        opportunities.push(`سوق محدود التشبع بالمنافسين حالياً (${marketingComps.length} منافس مرصود فقط)، ما يتيح فرصة اكتساب حصة سوقية أسرع`);
    } else {
        opportunities.push('إمكانية الشراكات مع جهات مكملة');
    }

    // تهديدات مبنية على مدخلات الدراسة الفعلية قدر الإمكان (كانت 3 نصوص ثابتة حرفياً لكل مشروع)
    const sector = or(p.sector, concept);
    const isFandB = /مطعم|كافي|كافتيريا|قهوة|بن|وجبات|مأكولات|مشروبات|فود|طعام|حلويات|مخبوزات/i.test(sector);
    const threats = [
        marketingComps.length >= 3
            ? `منافسة مباشرة من ${marketingComps.length} منافسين مرصودين في السوق المحلي`
            : 'احتمالية دخول منافسين محليين ودوليين جدد إلى السوق مستقبلاً',
        isFandB
            ? 'تقلب أسعار المواد الغذائية الخام والمدخلات'
            : 'تقلب أسعار المدخلات وتكاليف التشغيل الأساسية',
        streams.length <= 1
            ? 'تغير أذواق واحتياجات العملاء يمثل خطراً أكبر مع الاعتماد على مصدر إيراد واحد'
            : 'تغير تدريجي في أذواق واحتياجات العملاء مع الوقت'
    ];
    riskList.slice(0, 2).forEach(r => {
        const t = typeof r === 'string' ? r : (r?.name || r?.risk || r?.description);
        if (t) threats.push(t);
    });

    return {
        strengths: strengths.slice(0, 4),
        weaknesses: weaknesses.slice(0, 4),
        opportunities: opportunities.slice(0, 4),
        threats: threats.slice(0, 4)
    };
}

/**
 * توليد مصفوفة TOWS (استراتيجيات SO/WO/ST/WT) من بنود SWOT الفعلية — لا تُنشئ SWOT
 * جديداً، فقط تُزاوج بنوده الحقيقية المخزَّنة في state.strategic.swot (المصدر الغني).
 * تحذير تصميمي (خطة الدفعة 2، بند 2.4): القراءة من strategic.swot، لكن التخزين
 * النهائي في المستدعي (StrategicAnalysis.js) يذهب إلى marketing.towsMatrix — قسمان
 * مختلفان عمداً في المخطط، لا تُوحَّد الكتابة بينهما.
 * النص الناتج مبني بالكامل من بنود SWOT الحقيقية لهذا المشروع (لا قوالب ثابتة متطابقة
 * بين المشاريع) — إن كان محور ما فارغاً في SWOT يبقى ربع TOWS المقابل فارغاً بدل نص وهمي.
 * @param {object} state
 * @returns {{ so: string, wo: string, st: string, wt: string }}
 */
export function generateTOWS(state) {
    const swot = state?.strategic?.swot || {};
    const strengths = (swot.strengths || []).filter(Boolean);
    const weaknesses = (swot.weaknesses || []).filter(Boolean);
    const opportunities = (swot.opportunities || []).filter(Boolean);
    const threats = (swot.threats || []).filter(Boolean);

    // يُزاوج حتى بندين من كل محور (إن وُجدا) بدل بند واحد فقط — النص بالكامل من بنود
    // SWOT الحقيقية لهذا المشروع تحديداً، فيختلف تلقائياً بين مشروعين مختلفين.
    const join = (items) => items.slice(0, 2).join('، و');

    return {
        so: (strengths.length && opportunities.length)
            ? `استغلال ${join(strengths)} لاقتناص ${join(opportunities)}.`
            : '',
        wo: (weaknesses.length && opportunities.length)
            ? `معالجة ${join(weaknesses)} أولاً حتى يمكن الاستفادة من ${join(opportunities)}.`
            : '',
        st: (strengths.length && threats.length)
            ? `استخدام ${join(strengths)} لمواجهة ${join(threats)}.`
            : '',
        wt: (weaknesses.length && threats.length)
            ? `تقليل الأثر بمعالجة ${join(weaknesses)} قبل أن يتفاقم أثر ${join(threats)}.`
            : ''
    };
}

/**
 * توليد شرائح عملاء مقترحة من بيانات الدراسة (داخلي، بدون API)
 * @param {object} state
 * @returns {Array<{ name, demographics, needs, size, priority }>}
 */
export function generateSegments(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'المنتج أو الخدمة');
    const city = or(p.city, 'المنطقة');
    const som = state?.marketSizing?.som?.value ?? state?.marketSizing?.som ?? 0;
    const num = Number(som) || 0;
    const third = num > 0 ? Math.round(num / 3) : 0;
    const isB2B = / b2b|شركات|مؤسسات|حكومي|تعاقد/i.test(concept);

    const isHealth = /صحي|عيادة|مستشفى|طب|مختبر/i.test(concept);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم|دورات/i.test(concept);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع/i.test(concept);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(concept);

    const base = [
        { name: 'العائلات', demographics: `عائلات في ${city}`, needs: `جودة وخدمة مناسبة لـ ${concept}`, size: third || 0, priority: 'primary' },
        { name: 'الشباب', demographics: 'شريحة عمرية 18–35', needs: 'أسعار منافسة ومرونة وتجربة', size: third || 0, priority: 'primary' },
        { name: 'رجال الأعمال والموظفون', demographics: 'مهنون وموظفون', needs: 'سرعة وراحة وموثوقية', size: third || 0, priority: 'secondary' }
    ];
    if (isHealth) base.push({ name: 'مرضى مزمنون وأسر', demographics: 'رعاية صحية متكررة', needs: 'مواعيد مرنة وجودة ورعاية متابعة', size: third || 0, priority: 'primary' });
    if (isEducation) base.push({ name: 'طلاب ومهنيون', demographics: 'تطوير مهارات وشهادات', needs: 'برامج مرنة ومعتمدة وبيئة مناسبة', size: third || 0, priority: 'primary' });
    if (isLogistics) base.push({ name: 'شركات تجارة ومصانع', demographics: 'B2B توريد وتوزيع', needs: 'موثوقية وتسعير وتتبع', size: third || 0, priority: 'primary' });
    if (isIndustrial) base.push({ name: 'مصانع ووكلاء وتجار جملة', demographics: 'B2B شراء منتج', needs: 'جودة ثابتة وتوريد منتظم وسعر تنافسي', size: third || 0, priority: 'primary' });
    if (isB2B && !isLogistics && !isIndustrial) base.push({ name: 'الشركات والمؤسسات', demographics: 'قطاع خاص وعام', needs: 'عروض جماعية، فواتير، التزام بالجودة', size: third || 0, priority: 'primary' });
    return base;
}

/**
 * توليد منافسين مقترحين من بيانات الدراسة (داخلي، بدون API)
 * @param {object} state
 * @returns {Array<{ name, strengths, weaknesses, marketShare, advantage }>}
 */
export function generateCompetitors(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'النشاط');
    const city = or(p.city, 'المنطقة');
    const sector = or(p.sector, concept);

    const isFandB = /مطعم|كافي|كافتيريا|قهوة|وجبات|مأكولات|مشروبات|فود|طعام/i.test(sector);
    const isRetail = /بقالة|تجزئة|متجر|بيع/i.test(sector);
    const isService = /خدمي|استشار|تعليم|تدريب|صحي|عيادة|صالة|رياض/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع|استيراد|تصدير/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);

    if (isFandB) {
        return [
            { name: `سلسلة أو فرع راسخ في ${city}`, strengths: 'علامة معروفة، ولاء عملاء', weaknesses: 'أسعار أعلى، بطء في التحديث', marketShare: null, advantage: 'الانتشار' },
            { name: 'منافس وافد (فرانشايز)', strengths: 'دعم مركزي، تسويق قوي', weaknesses: 'تكيف محدود مع الأذواق المحلية', marketShare: null, advantage: 'العلامة' },
            { name: 'مشاريع محلية صغيرة', strengths: 'مرونة، أسعار منافسة، طابع محلي', weaknesses: 'محدودية التمويل والتوسع', marketShare: null, advantage: 'السعر والمرونة' }
        ];
    }
    if (isRetail) {
        return [
            { name: 'مولات وسلاسل كبرى', strengths: 'تنوع ومساحة، عروض', weaknesses: 'إيجارات عالية، منافسة داخل المول', marketShare: null, advantage: 'الموقع والتنوع' },
            { name: 'متاجر أحياء', strengths: 'قرب من العملاء، ولاء محلي', weaknesses: 'مساحة وتشكيلة محدودتان', marketShare: null, advantage: 'القرب' },
            { name: 'منصات إلكترونية وتوصيل', strengths: 'وصول واسع، عدم حاجة لموقع', weaknesses: 'عمولات وتكاليف توصيل', marketShare: null, advantage: 'الرقمنة' }
        ];
    }
    if (isService) {
        return [
            { name: `مقدم خدمة راسخ في ${city}`, strengths: 'سمعة، شبكة علاقات', weaknesses: 'أسعار أعلى، تركيز على شرائح معينة', marketShare: null, advantage: 'السمعة' },
            { name: 'مشاريع وافدة أو فرانشايز', strengths: 'معايير، دعم فني', weaknesses: 'تكاليف تشغيل ورسوم', marketShare: null, advantage: 'المعايير' },
            { name: 'ممارسون أفراد أو ورش صغيرة', strengths: 'مرونة، تكلفة منخفضة', weaknesses: 'قدرة استيعاب محدودة', marketShare: null, advantage: 'المرونة' }
        ];
    }
    if (isLogistics) {
        return [
            { name: 'شركات شحن كبرى وطنية', strengths: 'شبكة تغطية، أسطول', weaknesses: 'أسعار أعلى للكميات الصغيرة', marketShare: null, advantage: 'الحجم' },
            { name: 'وكلاء ومستودعات محلية', strengths: 'قرب من السوق، مرونة', weaknesses: 'قدرة تخزين ونقل محدودة', marketShare: null, advantage: 'القرب' },
            { name: 'منصات رقمية وخدمات آخر ميل', strengths: 'تتبع، تكامل تقني', weaknesses: 'عمولات وتقلب الطلب', marketShare: null, advantage: 'الرقمنة' }
        ];
    }
    if (isIndustrial) {
        return [
            { name: 'مصانع راسخة بالقطاع', strengths: 'حجم إنتاج، علاقات توريد', weaknesses: 'بطء في التكيف مع منتجات جديدة', marketShare: null, advantage: 'الإنتاجية' },
            { name: 'وحدات إنتاج وافدة أو مشتركة', strengths: 'تقنية، معايير جودة', weaknesses: 'تكاليف وتوطين', marketShare: null, advantage: 'الجودة' },
            { name: 'ورش ومنشآت صغيرة', strengths: 'مرونة، تخصيص', weaknesses: 'محدودية الطاقة والتمويل', marketShare: null, advantage: 'المرونة' }
        ];
    }

    return [
        { name: `منافس محلي راسخ في ${city}`, strengths: 'اسم معروف، قاعدة عملاء', weaknesses: 'بطء في التطوير', marketShare: null, advantage: 'الحصة السوقية' },
        { name: 'منافس وافد حديثاً', strengths: 'علامة كبيرة، استثمار', weaknesses: 'تكيف محدود مع السوق المحلي', marketShare: null, advantage: 'التمويل' },
        { name: 'مشاريع صغيرة ومتوسطة', strengths: 'مرونة، أسعار', weaknesses: 'محدودية الموارد والوصول', marketShare: null, advantage: 'المرونة' }
    ];
}

/**
 * اقتراح نصي لحقل معيّن (للمساعد «عصا سحرية») — يعمل بدون API
 * @param {string} fieldName - مفتاح الحقل (مثل projectInfo.description أو marketing.marketAnalysis.trends)
 * @param {string} currentValue - القيمة الحالية
 * @param {object} state - حالة الدراسة
 * @returns {string}
 */
export function generateFieldSuggestion(fieldName, currentValue, state) {
    const p = state?.projectInfo || {};
    const name = or(p.name, 'المشروع');
    const concept = shortActivity(p, 'النشاط');
    const city = or(p.city, 'المنطقة');
    const key = (fieldName || '').split('.').pop() || fieldName;

    const templates = {
        description: `مشروع «${name}» يقدم ${concept} في ${city}. يهدف إلى تلبية احتياجات السوق المحلي بجودة عالية وخدمة متميزة، مع التركيز على تجربة العميل والقيمة المضافة.`,
        notes: `ملاحظات إضافية ذات صلة بسياق المشروع والافتراضات المعتمدة في الدراسة.`,
        trends: `اتجاهات السوق تشير إلى نمو الطلب على ${concept} في ${city}، مع تفضيل متزايد للجودة والخدمة والرقمنة.`,
        strengths: `نقاط القوة (عدّلها حسب واقع مشروعك): [صف ميزة موقعك]، [صف خبرة فريقك الفعلية في ${concept}]، [ما الذي يميّز خدمتك تحديداً؟].`,
        weaknesses: `نقاط الضعف المحتملة: الحاجة لرأس مال تشغيلي، الاعتماد على موردين، ومنافسة محلية.`,
        opportunities: `الفرص: توسع السوق، برامج دعم حكومية، واتجاه الاستهلاك الإيجابي نحو ${concept}.`,
        threats: `التهديدات: تغير الأسعار، منافسة جديدة، وتقلبات الطلب.`,
        // New Hooks
        'hypothesis-problem': `نقص في خيارات ${concept} ذات الجودة العالية في ${city}، مع عدم وجود تجربة عميل مرضية في السوق الحالي.`,
        'hypothesis-solution': `توفير ${concept} بمعايير احترافية وأسعار تنافسية، مع التركيز على الخدمة الشخصية وسرعة التوصيل.`,
        'hypothesis-insight': `[اذكر ميزتك الحقيقية غير القابلة للنسخ: خبرة فريق فعلية في ${concept}، اتفاق حصري مع مورد، موقع، تقنية…] — استبدل هذا النص بما تملكه بالفعل ويصعب على المنافس تكراره.`,
        'identity': `«${name}» هي الوجهة الأولى لـ ${concept} في ${city}، نجمع بين الأصالة والحداثة لتقديم تجربة لا تُنسى.`,
        // المهمة 3 — AI Writer في المعالج
        'ua-insight-text': `[صف ميزتك التنافسية الفعلية في ${concept} بسوق ${city}: ما الذي تملكه ويصعب على منافس جديد محاكاته؟] — استبدل النص بواقع مشروعك.`,
        'national-importance': `المشروع يساهم في التنويع الاقتصادي وتوطين صناعة ${concept} في ${city}، مع إمكانية خلق فرص عمل محلية.`,
        'selectionFactors': `الكثافة السكانية وقرب العملاء المستهدفين، توفر مواقف السيارات والبنية التحتية، تكلفة الإيجار المناسبة، واجهة الشارع والظهور التجاري، واشتراطات البلدية وتصنيف استخدام الموقع في المنطقة.`,
        'la-factors': `الكثافة السكانية وقرب العملاء المستهدفين، توفر مواقف السيارات والبنية التحتية، تكلفة الإيجار المناسبة، واجهة الشارع والظهور التجاري، واشتراطات البلدية وتصنيف استخدام الموقع في المنطقة.`,
        'problemStatement': `نقص في خيارات ${concept} الجيدة في ${city}، مع حاجة السوق لتجربة عميل متميزة وأسعار معقولة.`,
        'exec-problemStatement': `نقص في خيارات ${concept} الجيدة في ${city}، مع حاجة السوق لتجربة عميل متميزة وأسعار معقولة.`,
        'uniqueValueProposition': `نقدم ${concept} بجودة عالية وخدمة متميزة، مع التركيز على تجربة العميل والأسعار التنافسية في ${city}.`,
        'exec-uniqueValue': `نقدم ${concept} بجودة عالية وخدمة متميزة، مع التركيز على تجربة العميل والأسعار التنافسية في ${city}.`,
        'vision2030-alignment': `المشروع يدعم أهداف رؤية المملكة 2030 عبر المساهمة في تنمية قطاع ${concept}، وتعزيز التنويع الاقتصادي، وتوطين الخدمات في ${city}.`,
        'vision2030-impact': `المتوقع أن يساهم المشروع في خلق فرص عمل محلية، ورفع جودة الخدمة في القطاع، ودعم تنافسية السوق المحلي.`,
        'economy-trends': `الاتجاهات تشير إلى نمو الطلب على ${concept} في المملكة، مع دعم برامج الرؤية للقطاع الخاص والاستثمار المحلي.`
    };

    if (!Object.prototype.hasOwnProperty.call(templates, key)) {
        // تدقيق أمني/جودة (دفعة 6): كان يسقط صامتاً لقالب الوصف العام لأي مفتاح غير
        // مطابق — يمر ذلك دون أن يلاحظه مطوّر يضيف حقلاً جديداً، فيظهر نص تعبئة عام
        // في الإنتاج بدل نص مخصص فعلي للحقل.
        console.warn(`[InternalAIGenerator] generateFieldSuggestion: لا يوجد قالب مطابق للحقل "${key}" — يُستخدم القالب العام الافتراضي (description). أضف قالباً مخصصاً لهذا الحقل.`);
    }
    return templates[key] || templates.description;
}

/**
 * توليد مقترحات مقدمة الجدوى (معايير الفكرة، الهوية، القيمة، تحليل الموقع)
 * @param {object} state
 * @returns {{ ideaCriteria, identityStatement, valueProposition, locationAnalysis }}
 */
export function generateIntroSuggestions(state) {
    const p = state?.projectInfo || {};
    const concept = (p.concept || 'النشاط').toString().trim();
    const city = (p.city || 'المنطقة').toString().trim();
    const name = (p.name || 'المشروع').toString().trim();
    const desc = (p.description || '').toString().trim();

    const ideaCriteria = {
        feasibility: `الفكرة قابلة للتنفيذ من الناحية التشغيلية والتقنية، مع توفر الموارد الأساسية لبدء مشروع ${concept} في ${city}.`,
        uniqueness: `تميّز بتقديم قيمة مضافة أو تجربة مختلفة في قطاع ${concept}، مع التركيز على جودة الخدمة والعميل.`,
        marketFit: `يلبي الطلب المتزايد على ${concept} في ${city}، ويستهدف شريحة عملاء محددة لها احتياجات واضحة.`,
        resourceAvailability: `توفر رأس المال الأولي، وإمكانية استقطاب كوادر مناسبة، وموقع أو وسائل تشغيل متاحة.`
    };

    const identityStatement = name && concept
        ? `«${name}» مشروع يهدف إلى تقديم ${concept} بجودة عالية وخدمة متميزة في ${city}.`
        : `مشروع متخصص في تقديم ${concept} يستهدف السوق المحلي بمنهجية واضحة.`;

    const valueProposition = concept
        ? `تقديم ${concept} بأفضل قيمة مقابل السعر، مع تجربة عميل مميزة وضمان الجودة والالتزام بالمواعيد.`
        : 'تقديم قيمة متميزة للعميل من خلال الجودة والخدمة والثقة.';

    const cityCoords = { الرياض: [24.7136, 46.6753], جدة: [21.5433, 39.1728], مكة: [21.4225, 39.8262], 'مكة المكرمة': [21.4225, 39.8262], المدينة: [24.5247, 39.5692], الدمام: [26.4207, 50.0888], الخبر: [26.2172, 50.1971], الطائف: [21.2703, 40.4158], تبوك: [28.3838, 36.5550], بريدة: [26.3260, 43.9750] };
    const coords = cityCoords[city?.trim()] || cityCoords['الرياض'];
    const locationAnalysis = {
        selectionFactors: `الكثافة السكانية، قرب العملاء المستهدفين، تكلفة الإيجار، البنية التحتية والمواقف، واجهة الشارع والظهور، اشتراطات البلدية وتصنيف استخدام الموقع.`,
        alternativesComparison: `تم تقييم عدة مواقع في ${city} ومقارنة التكلفة والوصولية والمنافسة المحلية.`,
        chosenReason: `الموقع المختار يوازن بين التكلفة والوصولية وملاءمته للشريحة المستهدفة.`,
        coordinates: { lat: coords[0], lng: coords[1] },
        address: ''
    };

    let products = [];
    let introServices = [];
    let customerValues = [];

    if (/قهوة|بن|مشروبات|كافي/i.test(concept)) {
        products = [{
            type: 'final',
            name: 'القهوة السعودية',
            description: 'منتج يُستخرج من شجرة البن على شكل حبيبات تتدرج ألوانها من الأخضر إلى الأصفر إلى البني الفاتح أو الغامق. يُحمّص حسب المعيار حتى يكون جاهزاً للاستخدام.',
            // دُمج مع valueAdded السابق (دفعة 3، 2026-07-12) — كانا يكرران نفس الفكرة (المذاق/التحميص/المرارة).
            uniqueFeatures: 'مذاق مميز يعتمد على نوع البن وطريقة التحميص ودرجة المرارة المطلوبة — يمنح الطعم المر المميز للقهوة العربية الأصيلة الذي يبحث عنه العميل.',
            customerBenefit: 'جودة عالية وبسعر مناسب.'
        }];
        introServices = [
            { name: 'التوزيع', type: 'supportive', description: 'عملية تهدف إلى تسليم ونقل منتجات البن من الموقع الإنتاجي أو المستودع للعميل باستخدام وسائل مباشرة أو غير مباشرة من خلال الوسطاء.' }
        ];
        customerValues = [
            { customerType: 'صاحب المقهى (عميل B2B)', customerNeed: 'قهوة مختلفة عن السوق لتقديمها لعملائه', valueWeProvide: 'مذاق مميز وجودة ثابتة تلبي توقعات عملائه' },
            { customerType: 'المستهلك المباشر', customerNeed: 'قهوة للاستهلاك الشخصي', valueWeProvide: 'جودة عالية وبسعر مناسب' },
            { customerType: 'الأسر المنتجة (مستهلك غير مباشر)', customerNeed: 'شراء قهوة لتحويلها لمنتج نهائي', valueWeProvide: 'مواد أولية بجودة تسمح بإنتاج قيمة مضافة' }
        ];
    } else {
        products = [{ type: 'final', name: concept, description: `منتج أو خدمة ${concept} بمواصفات تلبي احتياجات السوق المستهدف.`, uniqueFeatures: '', customerBenefit: '' }];
        introServices = [{ name: 'التوزيع أو التوصيل', type: 'supportive', description: `خدمة وصول ${concept} للعميل.` }];
        customerValues = [
            { customerType: 'العميل المستهدف', customerNeed: 'تلبية احتياج محدد', valueWeProvide: `قيمة متميزة في ${concept}` }
        ];
    }

    return { ideaCriteria, identityStatement, valueProposition, locationAnalysis, products, introServices, customerValues };
}

/**
 * توليد المزيج التسويقي (4P) من بيانات الدراسة
 * @param {object} state
 * @returns {{ product, price, place, promotion }}
 */
export function generateMarketingMix(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'المنتج/الخدمة');
    const city = or(p.city, 'المنطقة');
    const name = or(p.name, 'المشروع');
    const isFandB = /مطعم|كافي|قهوة|فود|طعام|مشروبات/i.test(concept);
    const isRetail = /بقالة|تجزئة|متجر|بيع/i.test(concept);
    const isService = /خدمي|استشار|تعليم|تدريب|صحي|رياض/i.test(concept);

    let product = `تقديم ${concept} بجودة عالية ومواصفات تلبي احتياجات الشريحة المستهدفة.`;
    let price = 'تسعير تنافسي يراعي تكلفة الإنتاج والهوامش والسوق المحلي. مراجعة دورية للعروض والخصومات.';
    let place = `الوصول للعميل عبر الموقع في ${city}، وتوزيع منافذ أو توصيل حسب نوع النشاط.`;
    let promotion = 'حملات إعلانية عبر وسائل التواصل، علاقات عامة، وعروض الإطلاق.';

    if (isFandB) {
        product = `وجبات ومشروبات متنوعة، تجربة طعام مريحة، وجودة مكونات.`;
        price = 'أسعار متوسطة تنافسية، عروض الوجبات، وبرنامج ولاء للعملاء الدائمين.';
        place = `المقر الرئيسي في ${city}، إمكانية التوصيل والتقاضي حسب القدرة.`;
        promotion = 'إعلانات إنستغرام وسناب، تعاون مع مؤثرين محليين، عروض الافتتاح.';
    } else if (isRetail) {
        product = `مجموعة منتجات متنوعة، علامة مميزة، وجودة ثابتة.`;
        price = 'أسعار تنافسية مع هامش ربح، عروض موسمية، وتمييز الأسعار حسب الشرائح.';
        place = `متجر في موقع استراتيجي ب${city}، أو منصة إلكترونية للتوصيل.`;
        promotion = 'إعلانات محلية، عروض البيع، وبرامج الكوبونات.';
    } else if (isService) {
        product = `خدمات ${concept} بمعايير احترافية، مع تقديم قيمة مضافة.`;
        price = 'أسعار تتناسب مع الجودة والمنافسة، باقات واشتراكات.';
        place = `مقر في ${city} أو تقديم الخدمة عن بُعد حسب طبيعة النشاط.`;
        promotion = 'التسويق عبر المحتوى، الشراكات، والإحالات.';
    }

    return { product, price, place, promotion };
}

/**
 * توليد مقترح الطاقة الإنتاجية
 * @param {object} state
 * @returns {{ annualCapacity: number, unitOrMeasure: string, marketShareLink: string }}
 */
export function generateProductionCapacity(state) {
    const services = state?.services?.items || [];
    const streams = state?.revenue?.streams || state?.revenue?.revenueStreams || [];
    const som = state?.marketSizing?.som?.value ?? 0;

    let annualCapacity = 0;
    let unitOrMeasure = 'وحدة/سنة';

    if (services.length > 0) {
        annualCapacity = services.reduce((s, svc) => {
            const c = (svc.customersPerMonth || 0) * 12 * (1 + (svc.growthRate || 0));
            return s + c;
        }, 0);
        unitOrMeasure = 'عميل/سنة';
    } else if (streams.length > 0) {
        annualCapacity = streams.reduce((s, r) => {
            const c = (r.customersPerMonth || r.customersPerYear || 0) * (r.customersPerYear ? 1 : 12);
            return s + c;
        }, 0);
        unitOrMeasure = 'عميل/سنة';
    }

    const marketShareLink = som > 0
        ? `الحصة المستهدفة ${som} من السوق تمثل جزءاً من الطاقة الإنتاجية المخططة.`
        : 'ربط الطاقة بالسوق المستهدف (SOM) عند إكمال تحليل السوق.';

    return {
        annualCapacity: Math.round(annualCapacity),
        unitOrMeasure,
        marketShareLink
    };
}

/**
 * توليد تحليل PESTEL من بيانات الدراسة (داخلي، بدون API)
 * @param {object} state
 * @returns {Array<{ factor, label, description, impact, notes }>}
 */
export function generatePESTEL(state) {
    const p = state?.projectInfo || {};
    const name = or(p.name, 'المشروع');
    const concept = shortActivity(p, 'النشاط');
    const city = or(p.city, 'المملكة');
    const sector = or(p.sector, concept);
    const isHealth = /صحي|عيادة|مستشفى|طب|مختبر/i.test(sector);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);

    let envDesc = `اشتراطات البيئة والاستدامة المؤثرة على تشغيل مشروع «${name}». توجه الأنظمة نحو المشاريع الخضراء والكفاءة في الاستخدام.`;
    if (isIndustrial) envDesc += ' في القطاع الصناعي: الانبعاثات، النفايات، والموافقة البيئية حاسمة.';
    else if (isHealth) envDesc += ' في المنشآت الصحية: التخلص من النفايات الطبية وفق اللوائح.';

    let legalDesc = `اللوائح والتراخيص المنظمة لقطاع ${concept} في ${city}. ضرورة الالتزام بنظام العمل والضريبة والشركات.`;
    if (isHealth) legalDesc += ' إضافة: هيئة التخصصات الصحية والغذاء والدواء للمنشآت والمختبرات.';
    else if (isEducation) legalDesc += ' إضافة: تراخيص التعليم والاعتماد والمناهج.';
    else if (isLogistics) legalDesc += ' إضافة: رخص النقل واشتراطات السلامة.';

    return [
        { factor: 'political', label: 'سياسي', description: `استقرار السياسات الحكومية ودعم رؤية 2030 للمشاريع الصغيرة والمتوسطة في قطاع ${concept}. تحفيز الاستثمار المحلي في ${city}.`, impact: 'positive', notes: '' },
        { factor: 'economic', label: 'اقتصادي', description: `النمو الاقتصادي ومؤشرات القوة الشرائية في ${city}. تأثر الطلب على ${concept} بأسعار المدخلات وأسعار الفائدة.`, impact: 'neutral', notes: '' },
        { factor: 'social', label: 'اجتماعي', description: `تغير العادات الاستهلاكية واتجاه المجتمع نحو ${concept}. ديموغرافيا ${city} وتوزيع الشرائح العمرية والاجتماعية.`, impact: 'positive', notes: '' },
        { factor: 'technological', label: 'تقني', description: `توفر التقنيات والتطبيقات الرقمية لتعزيز تقديم ${concept}. إمكانية التحول الرقمي والوصول للعملاء عبر منصات إلكترونية.`, impact: 'positive', notes: '' },
        { factor: 'environmental', label: 'بيئي', description: envDesc, impact: 'neutral', notes: '' },
        { factor: 'legal', label: 'قانوني', description: legalDesc, impact: 'neutral', notes: '' }
    ];
}

/**
 * توليد تحليل القوى الخمس لبورتر من بيانات الدراسة (داخلي، بدون API)
 * @param {object} state
 * @returns {{ newEntrants, supplierPower, rivalry, buyerPower, substitutes }}
 *   كل عنصر: { level: 'low'|'medium'|'high', description: string }
 */
export function generatePorter(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'النشاط');
    const city = or(p.city, 'المنطقة');
    const comps = state?.marketing?.competitors || [];
    const compCount = comps.length;

    return {
        newEntrants: {
            level: compCount > 3 ? 'high' : 'medium',
            description: `ظهور منافسين جدد محتمل في قطاع ${concept} ب${city}. متطلبات رأس المال والتراخيص تشكل حاجزاً جزئياً. العلامات الوافدة تزيد من حدة التهديد.`
        },
        supplierPower: {
            level: 'medium',
            description: `اعتماد المشروع على موردين للمدخلات والخدمات. تعدد الموردين يخفف القوة التفاوضية. مراعاة عقود التوريد والضمانات.`
        },
        rivalry: {
            level: compCount >= 2 ? 'high' : 'medium',
            description: `منافسة محلية في سوق ${concept} ب${city}. التميز بالجودة والموقع والخدمة يحدد الحصة. نمو السوق يقلل حدة التنافس.`
        },
        buyerPower: {
            level: 'medium',
            description: `قدرة العملاء على المقارنة والانتقال بين العروض. الولاء يبنى عبر الجودة والسعر وتجربة الخدمة. الشفافية في التسعير تزيد من حساسية المشتري.`
        },
        substitutes: {
            level: 'medium',
            description: `وجود بدائل أو حلول بديلة لـ ${concept}. التميز والتركيز على قيمة مضافة يقلل تأثير البدائل. التطور التقني قد يطلق بدائل جديدة.`
        }
    };
}

/**
 * توليد ملخص تنفيذي من مؤشرات وقرار الدراسة (داخلي، بدون API)
 * @param {object} state - حالة الدراسة (projectInfo)
 * @param {object} results - نتائج المحرك: indicators, decision, decisionReasons
 * @returns {string} نص الملخص التنفيذي بالعربية
 */
export function generateExecutiveSummary(state, results) {
    const p = state?.projectInfo || state || {};
    const name = or(p.name, 'المشروع');
    const concept = shortActivity(p, 'النشاط');
    const city = or(p.city, 'المنطقة');

    const ind = results?.indicators || results?.context?.kpis || results?.context?.financials || {};
    const npv = ind.npv ?? results?.npv ?? 0;
    const irr = ind.irr ?? results?.irr ?? 0;
    const payback = ind.paybackPeriod ?? results?.paybackPeriod ?? ind.payback ?? null;
    const roi = ind.roi ?? results?.roi ?? 0;
    const breakEven = ind.breakEvenPointValue ?? results?.breakEvenPointValue ?? 0;
    const margin = ind.profitMargin ?? results?.profitMargin ?? 0;

    const decision = results?.decision ?? results?.context?.decision ?? null; // لا نفترض GO على بيانات ناقصة — يمنع توصية «امضِ قدماً» زائفة
    const reasons = results?.decisionReasons ?? results?.context?.decisionReasons ?? [];

    let overview = `تهدف دراسة الجدوى إلى تقييم جدوى مشروع «${name}» في ${city}، وهو مشروع يركز على ${concept}.`;
    let indText = [];
    // نعرض المؤشر فقط إذا كان له قيمة فعلية (غير صفرية) — يمنع طباعة «٠ ريال · ٠٪» على بيانات ناقصة
    // المحرك يخزّن IRR/ROI/الهامش كسوراً عشرية (−0.127 = −12.7%) — الضرب في 100 إلزامي
    // قبل الطباعة، وإلا خرج «معدل العائد الداخلي: −0.1%» في ملخص يُقدَّم لممول (تدقيق ٢٠٢٦-٠٧-٠٦).
    if (Number(npv)) indText.push(`صافي القيمة الحالية: ${Math.round(Number(npv)).toLocaleString('ar-SA')} ريال`);
    if (Number(irr)) indText.push(`معدل العائد الداخلي: ${(Number(irr) * 100).toFixed(1)}%`);
    if (Number(payback) > 0) indText.push(`فترة الاسترداد: ${Number(payback).toFixed(1)} سنة`);
    if (Number(roi)) indText.push(`العائد على الاستثمار: ${(Number(roi) * 100).toFixed(1)}% (تراكمي لسنوات الدراسة)`);
    if (Number(breakEven)) indText.push(`نقطة التعادل: ${Math.round(Number(breakEven)).toLocaleString('ar-SA')} ريال سنوياً`);
    if (Number(margin)) indText.push(`هامش الربح الصافي (سنة أولى): ${(Number(margin) * 100).toFixed(1)}%`);
    const indicatorsBlock = indText.length ? `أهم المؤشرات: ${indText.join('؛ ')}.` : 'تم حساب المؤشرات المالية في نموذج التدفقات.';

    let feasibility = 'الجدوى المالية تُحدد وفق المؤشرات أعلاه ومقارنتها بمعايير القطاع.';
    if (decision === 'GO') feasibility = 'المؤشرات والقرار يدلان على جدوى المشروع وفق الافتراضات المدخلة.';
    else if (decision === 'NO-GO') feasibility = 'القرار يشير إلى عدم الجدوى في ظل الافتراضات الحالية.';
    else if (decision === 'REVISE') feasibility = 'القرار يوصي بمراجعة الافتراضات أو الهيكلة قبل المضي قدماً.';

    let rec = decision === 'GO' ? 'التوصية: المضي قدماً مع مراقبة التنفيذ والمخاطر.' : 'التوصية: مراجعة بنود الدراسة وإعادة الحساب قبل اتخاذ القرار النهائي.';
    if (Array.isArray(reasons) && reasons.length) {
        rec += ' أبرز أسباب القرار: ' + reasons.slice(0, 3).map(r => typeof r === 'string' ? r : (r?.text || r?.reason || '')).filter(Boolean).join('؛ ');
    }

    // إفصاح صادق بدل ادعاء اعتماد مختلق: لا توجد «معايير معتمدة» من رؤية 2030/منشآت/بنك التنمية
    // اعتمدها المنتج — النص مولَّد آلياً من مدخلات المستخدم ومؤشرات النموذج، ويجب مراجعته قبل التقديم.
    const disclosureNote = ' (نص مولَّد آلياً من مدخلات دراستك ومؤشرات النموذج المالي — راجعه وأسنده بمصادرك قبل التقديم لممول.)';
    return `${overview}\n\n${indicatorsBlock}\n\n${feasibility}\n\n${rec}${disclosureNote}`;
}

/**
 * توليد قائمة مخاطر مقترحة من بيانات الدراسة (داخلي، بدون API)
 * @param {object} state - حالة الدراسة
 * @returns {Array<{ name, type, impact, description }>}
 */
export function generateRisks(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'النشاط');
    const city = or(p.city, 'المنطقة');
    const sector = or(p.sector, concept);

    const isFandB = /مطعم|كافي|قهوة|وجبات|مأكولات|مشروبات|فود|طعام/i.test(sector);
    const isRetail = /بقالة|تجزئة|متجر|بيع/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع|استيراد|تصدير/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);

    const base = [
        { name: 'تراجع الطلب أو تباطؤ السوق', type: 'سوقي', impact: 'high', description: `انكماش الطلب على ${concept} في ${city} يقلل الإيرادات.` },
        { name: 'ارتفاع تكاليف التشغيل والمدخلات', type: 'مالي', impact: 'high', description: 'تقلب أسعار المواد والطاقة والإيجار يؤثر على الهوامش.' },
        { name: 'منافسة شديدة أو دخول منافس قوي', type: 'سوقي', impact: 'medium', description: `زيادة حدة المنافسة في قطاع ${concept}.` },
        { name: 'تأخر التراخيص أو التعقيدات الإجرائية', type: 'تنظيمي', impact: 'medium', description: 'تأخر الحصول على التراخيص يؤخر الافتتاح ويزيد التكاليف.' },
        { name: 'نقص أو انقطاع الكوادر المؤهلة', type: 'تشغيلي', impact: 'medium', description: 'صعوبة توظيف أو الاحتفاظ بالموظفين المناسبين.' }
    ];

    if (isFandB) {
        base.push({ name: 'مخاطر سلامة الغذاء والسمعة', type: 'تشغيلي', impact: 'high', description: 'حوادث تسمم أو شكاوى تلحق ضرراً بالسمعة والامتثال.' });
    }
    if (isRetail) {
        base.push({ name: 'سرقة أو هدر مخزون', type: 'تشغيلي', impact: 'medium', description: 'مخاطر مخزون ونقص في الرقابة الداخلية.' });
    }
    if (isLogistics) {
        base.push({ name: 'تعطل أو تأخر الشحن والتوريد', type: 'تشغيلي', impact: 'high', description: 'تأثير على الالتزام بالعملاء وتكاليف إضافية.' });
        base.push({ name: 'تقلب أسعار النقل والوقود', type: 'مالي', impact: 'medium', description: 'ارتفاع تكاليف التشغيل وتقلب الهوامش.' });
    }
    if (isIndustrial) {
        base.push({ name: 'انقطاع أو نقص مدخلات الإنتاج', type: 'تشغيلي', impact: 'high', description: 'تأثير على الجدولة والالتزام بالتوريد.' });
        base.push({ name: 'مخاطر بيئية وصحية (صحة مهنية، انبعاثات)', type: 'تنظيمي', impact: 'medium', description: 'اشتراطات وغرامات وسمعة.' });
    }

    return base.slice(0, 8);
}

/**
 * توليد منتجات مقترحة للجدول (داخلي، بدون API)
 * الأعمدة مطابقة لـ TABLE_SCHEMAS.products: type, name, description, uniqueFeatures, customerBenefit
 * (uniqueFeatures يدمج «الميزة الفريدة» و«القيمة المضافة» في نص واحد — دفعة 3، 2026-07-12)
 * type: select من primary | semi | final
 */
export function generateProducts(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'النشاط');
    const sector = or(p.sector, concept);
    // تدقيق 2026-07-09: مقهى مختص كان يُصنَّف ضمن "isFandB" العام فيقترح "الأطباق
    // الرئيسية" كمنتج أول — يناقض عدم وجود شيف/مطبخ في generatePositions لنفس
    // النشاط (isCafe هناك). isCafe هنا يجب أن يُختبر قبل isFandB لنفس السبب.
    const isCafe = /مقهى|كافيه|قهوة|بن|مختصة|cafe|coffee/i.test(sector);
    const isFandB = /مطعم|كافي|كافتيريا|قهوة|بن|وجبات|مأكولات|مشروبات|فود|طعام|حلويات|مخبوزات/i.test(sector);

    if (isCafe) {
        return [
            { type: 'final', name: 'المشروبات المختصة (ساخنة وباردة)', description: 'قهوة مختصة ومشروبات ساخنة وباردة (اسبريسو، فلتر، مشروبات موسمية) تُحضّر بمعايير احترافية.', uniqueFeatures: 'حبوب بن منتقاة وطرق تحضير متخصصة تمنح مذاقاً مختلفاً عن المقاهي التقليدية، وتبرر متوسط فاتورة أعلى من الكافيهات العادية.', customerBenefit: 'مشروب عالي الجودة بخبرة تحضير احترافية وثبات في الطعم.' },
            { type: 'semi', name: 'المخبوزات والحلويات الخفيفة', description: 'كرواسان وكيك وحلويات خفيفة تُورَّد جاهزة أو شبه جاهزة وتُقدَّم طازجة دون الحاجة لمطبخ كامل.', uniqueFeatures: 'تشكيلة تدور دورياً وتقديم بصري جذاب — يرفع متوسط قيمة الفاتورة بهامش مرتفع دون استثمار في مطبخ طهي كامل.', customerBenefit: 'خيار تحلية طازج يرافق المشروب.' },
            { type: 'final', name: 'حبوب بن للبيع (Retail)', description: 'أكياس حبوب بن محمصة تُباع للاستهلاك المنزلي بعلامة المقهى.', uniqueFeatures: 'تحميص مميز أو منتقى من محمصة موثوقة يصعب إيجاده في السوبرماركت — مصدر إيراد إضافي بهامش مرتفع يعزز ولاء العميل للعلامة.', customerBenefit: 'إعادة تجربة المقهى في المنزل.' }
        ];
    }

    if (isFandB) {
        return [
            { type: 'final', name: 'الأطباق الرئيسية', description: 'قائمة أطباق رئيسية متنوعة تُحضّر طازجة حسب الطلب بمعايير جودة ثابتة.', uniqueFeatures: 'وصفات مميزة ومكونات منتقاة تمنح نكهة مختلفة عن السوق ضمن تجربة طعام متكاملة تجمع الجودة والسرعة والتقديم المميز.', customerBenefit: 'وجبة عالية الجودة بسعر مناسب وخدمة سريعة.' },
            { type: 'final', name: 'المشروبات الساخنة والباردة', description: 'قهوة ومشروبات متنوعة تُحضّر باحترافية لمرافقة الوجبات أو الاستهلاك المستقل.', uniqueFeatures: 'مذاق مميز وثبات في الجودة عبر معايير تحضير موحّدة — ينوّع مصادر الإيراد ويرفع متوسط قيمة الفاتورة.', customerBenefit: 'خيارات مشروبات تناسب مختلف الأذواق والأوقات.' },
            { type: 'semi', name: 'الحلويات والمخبوزات', description: 'أصناف حلويات ومخبوزات تُعدّ داخلياً أو تُجهّز جزئياً وتُكمَّل عند الطلب.', uniqueFeatures: 'تنوّع موسمي وتقديم بصري جذّاب — منتج إضافي مرتفع الهامش يعزّز الربحية.', customerBenefit: 'خيارات تحلية طازجة تكمّل التجربة.' }
        ];
    }

    return [
        { type: 'final', name: `المنتج/الخدمة الأساسية (${concept})`, description: `المنتج أو الخدمة الرئيسية في نشاط ${concept} بمواصفات تلبي احتياجات الشريحة المستهدفة.`, uniqueFeatures: 'ميزة تنافسية في الجودة أو التجربة تميّزه عن المنافسين، بقيمة مضافة واضحة للعميل تبرّر السعر وتبني الولاء.', customerBenefit: 'تلبية احتياج فعلي بجودة عالية وسعر مناسب.' },
        { type: 'final', name: 'منتج/خدمة مكمّلة', description: `عرض مكمّل يرفع متوسط قيمة الطلب في نشاط ${concept}.`, uniqueFeatures: 'يكمّل العرض الأساسي ويزيد فرص البيع المتقاطع، وينوّع مصادر الإيراد ويقلّل الاعتماد على منتج واحد.', customerBenefit: 'حلّ أشمل من مصدر واحد موثوق.' }
    ];
}

/**
 * توليد خدمات مقدَّمة مقترحة للجدول (داخلي، بدون API)
 * الأعمدة مطابقة لـ TABLE_SCHEMAS.introServices: type, name, description
 * type: select من essential | supporting | secondary
 */
export function generateIntroServices(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'النشاط');
    const sector = or(p.sector, concept);
    const isCafe = /مقهى|كافيه|قهوة|بن|مختصة|cafe|coffee/i.test(sector);
    const isFandB = /مطعم|كافي|كافتيريا|قهوة|بن|وجبات|مأكولات|مشروبات|فود|طعام|حلويات|مخبوزات/i.test(sector);

    if (isCafe) {
        return [
            { type: 'essential', name: 'الخدمة داخل المقهى (الجلسة)', description: 'استقبال العملاء وتقديم المشروبات داخل صالة المقهى ببيئة مناسبة للجلوس والعمل.' },
            { type: 'supporting', name: 'الطلب السفري والتوصيل', description: 'طلبات السفري (Takeaway) والتوصيل عبر التطبيقات لتوسيع نطاق الوصول.' },
            { type: 'secondary', name: 'بيع حبوب البن وأدوات التحضير', description: 'بيع حبوب البن المحمّصة وأدوات التحضير المنزلي كمصدر إيراد مكمّل.' }
        ];
    }

    if (isFandB) {
        return [
            { type: 'essential', name: 'الخدمة داخل الصالة', description: 'استقبال العملاء وتقديم الطلبات داخل المطعم بمعايير ضيافة وجودة خدمة عالية.' },
            { type: 'supporting', name: 'التوصيل والطلب الخارجي', description: 'توصيل الطلبات للعملاء مباشرة أو عبر منصات التوصيل لتوسيع نطاق الوصول.' },
            { type: 'secondary', name: 'خدمة المناسبات والطلبات الكبيرة (كيترنق)', description: 'تجهيز طلبات المناسبات والولائم كمصدر إيراد إضافي في أوقات الذروة.' }
        ];
    }

    return [
        { type: 'essential', name: `تقديم ${concept} الأساسي`, description: `الخدمة الجوهرية التي يقوم عليها نشاط ${concept} وتلبّي الاحتياج الرئيسي للعميل.` },
        { type: 'supporting', name: 'التوصيل أو خدمة ما بعد البيع', description: `خدمة داعمة تسهّل وصول ${concept} للعميل وترفع رضاه وولاءه.` },
        { type: 'secondary', name: 'الاستشارة أو الدعم', description: 'خدمة ثانوية تعزّز تجربة العميل وتميّز العرض عن المنافسين.' }
    ];
}

/**
 * توليد جدول القيمة للعميل (Value Proposition) مقترح (داخلي، بدون API)
 * الأعمدة مطابقة لـ TABLE_SCHEMAS.customerValues: customerType, customerNeed, valueWeProvide
 */
export function generateCustomerValues(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'النشاط');
    const sector = or(p.sector, concept);
    const isCafe = /مقهى|كافيه|قهوة|بن|مختصة|cafe|coffee/i.test(sector);
    const isFandB = /مطعم|كافي|كافتيريا|قهوة|بن|وجبات|مأكولات|مشروبات|فود|طعام|حلويات|مخبوزات/i.test(sector);

    if (isCafe) {
        return [
            { customerType: 'الموظفون ورجال الأعمال', customerNeed: 'مشروب قهوة عالي الجودة وسريع خلال ساعات العمل', valueWeProvide: 'قهوة مختصة وخدمة سريعة وطلب سفري يعتمد عليه يومياً' },
            { customerType: 'الباحثون عن مكان للعمل أو الدراسة', customerNeed: 'أجواء هادئة مناسبة للجلوس لفترة طويلة', valueWeProvide: 'بيئة مريحة وإنترنت وجلسات تناسب العمل والدراسة' },
            { customerType: 'عشّاق القهوة المختصة', customerNeed: 'تجربة قهوة مختلفة عن السلاسل التجارية', valueWeProvide: 'حبوب منتقاة وطرق تحضير احترافية وتشكيلة متجددة' }
        ];
    }

    if (isFandB) {
        return [
            { customerType: 'العائلات', customerNeed: 'مكان مناسب لوجبة عائلية بجودة وسعر معقول', valueWeProvide: 'أجواء عائلية مريحة وقائمة متنوعة بجودة ثابتة وأسعار مناسبة' },
            { customerType: 'الموظفون ورجال الأعمال', customerNeed: 'وجبة سريعة وموثوقة خلال ساعات العمل', valueWeProvide: 'خدمة سريعة وطلب خارجي وجودة تُعتمد عليها يومياً' },
            { customerType: 'الشباب ومحبّو التجارب', customerNeed: 'تجربة طعام مميزة تستحق المشاركة', valueWeProvide: 'أصناف مميزة وتقديم جذّاب وأجواء تناسب اللقاءات' }
        ];
    }

    return [
        { customerType: 'العميل المستهدف الأساسي', customerNeed: `احتياج واضح لـ ${concept} بجودة موثوقة`, valueWeProvide: `${concept} بجودة عالية وسعر تنافسي وخدمة متميزة` },
        { customerType: 'العميل الباحث عن السعر', customerNeed: 'حلّ مناسب بأقل تكلفة ممكنة', valueWeProvide: 'قيمة عالية مقابل السعر مع الحفاظ على مستوى الجودة' },
        { customerType: 'العميل الباحث عن التميّز', customerNeed: 'تجربة أو جودة أعلى من المتوسط', valueWeProvide: 'تميّز في الجودة والخدمة يصعب على المنافسين الجدد تقليده' }
    ];
}

/**
 * توليد جدول زمني مقترح (داخلي، بدون API)
 * صيغة الخرج متوافقة مع واجهة الجدول الزمني: name, duration (أشهر), startMonth, category
 * @param {object} state - حالة الدراسة
 * @returns {Array<{ name, duration, startMonth, category }>}
 */
export function generateTimeline(state) {
    const existing = state?.timeline?.activities;
    if (Array.isArray(existing) && existing.length > 0) {
        return existing.map(a => ({
            name: a.name ?? a.activity ?? a.title ?? '',
            duration: a.duration ?? 1,
            startMonth: a.startMonth ?? 1,
            category: a.category ?? 'technical'
        })).filter(a => a.name);
    }

    const p = state?.projectInfo || {};
    const sector = or(p.sector, p.concept, 'النشاط');
    const isFandB = /مطعم|كافي|قهوة|وجبات|فود|طعام/i.test(sector);
    const isHealth = /صحي|عيادة|مستشفى|طب|مختبر/i.test(sector);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);

    const steps = [
        { name: 'استكمال التراخيص والموافقات', duration: 2, startMonth: 1, category: 'legal' },
        { name: 'اختيار الموقع والتوقيع على العقد', duration: 1, startMonth: 3, category: 'legal' },
        { name: 'التصاميم والاعتماد (ديكور، كهرباء، صرف)', duration: 1, startMonth: 4, category: 'technical' },
        { name: 'التنفيذ والديكور', duration: 3, startMonth: 5, category: 'technical' },
        { name: 'شراء المعدات والتجهيزات وتركيبها', duration: 2, startMonth: 8, category: 'technical' },
        { name: 'التوظيف والتدريب', duration: 1, startMonth: 10, category: 'hr' },
        { name: 'الحملة التسويقية والافتتاح الناعم', duration: 1, startMonth: 11, category: 'marketing' },
        { name: 'الافتتاح الرسمي', duration: 1, startMonth: 12, category: 'launch' }
    ];
    if (isFandB) {
        const idx = steps.findIndex(s => /معدات|تجهيزات/.test(s.name));
        if (idx >= 0) steps.splice(idx + 1, 0, { name: 'استلام شهادات السلامة والصحة (بلدية، دفاع مدني)', duration: 1, startMonth: 9, category: 'legal' });
    }
    if (isHealth) {
        steps.push({ name: 'اعتماد ترخيص هيئة التخصصات وتجهيز العيادة', duration: 2, startMonth: 4, category: 'legal' });
        const i = steps.findIndex(s => /معدات|تجهيزات/.test(s.name));
        if (i >= 0) steps.splice(i + 1, 0, { name: 'تركيب أجهزة طبية وتعقيم', duration: 1, startMonth: 9, category: 'technical' });
    }
    if (isEducation) {
        steps.push({ name: 'اعتماد منهج وترخيص التعليم', duration: 2, startMonth: 2, category: 'legal' });
    }
    if (isLogistics) {
        steps.push({ name: 'رخصة نقل وتجهيز مستودع', duration: 1, startMonth: 4, category: 'legal' });
    }
    if (isIndustrial) {
        steps.push({ name: 'موافقة بيئية وتركيب خط إنتاج', duration: 2, startMonth: 7, category: 'technical' });
    }
    return steps.sort((a, b) => (a.startMonth || 1) - (b.startMonth || 1));
}

/**
 * توليد عوامل تقييم الموقع (التحليل الجغرافي المكاني)
 * @param {object} state
 * @returns {Array<{ factor: string, rating: number, weight: number, notes: string }>}
 */
export function generateLocationFactors(state) {
    const city = or(state?.projectInfo?.city, 'المنطقة');
    const concept = or(state?.projectInfo?.concept, 'المشروع');
    return [
        { factor: 'الكثافة السكانية', rating: 4, weight: 25, notes: `كثافة سكانية في ${city} تدعم الطلب` },
        { factor: 'قرب المواصلات والطرق', rating: 4, weight: 15, notes: 'سهولة الوصول للعملاء' },
        { factor: 'مواقف السيارات', rating: 3, weight: 15, notes: 'توفر مواقف أو قرب مواقف عامة' },
        { factor: 'تكلفة الإيجار', rating: 3, weight: 20, notes: 'توازن بين التكلفة والموقع' },
        { factor: 'واجهة الشارع والظهور', rating: 4, weight: 15, notes: 'ظهور جيد للعلامة' },
        { factor: 'المنافسة القريبة', rating: 3, weight: 10, notes: `منافسة محلية في قطاع ${concept}` }
    ];
}

/**
 * اقتراح إجراءات تخفيف للمخاطر حسب النوع (داخلي، بدون API)
 * يدعم النوع بالعربية أو الإنجليزية (financial, market, operational, regulatory, legal, technical)
 * @param {Array<{ type?, name?, impact? }>} risks - قائمة المخاطر
 * @returns {Array<{ ...risk, mitigation: string }>}
 */
export function generateMitigationSuggestions(risks) {
    const tpl = {
        مالي: 'تنويع الموردين، عقود أسعار ثابتة جزئياً، احتياطي نقدي، مراجعة الهوامش دورياً.',
        سوقي: 'تنويع الشرائح والقنوات، تعزيز الولاء والتميز، متابعة المنافسة وتعديل العروض.',
        تشغيلي: 'تدريب الكوادر، إجراءات ومعايير واضحة، تأمين وصيانة دورية، خطة بديلة للغياب.',
        تنظيمي: 'المتابعة المبكرة للتراخيص، استشارة قانونية، الالتزام باللوائح وتجديد الموافقات في وقتها.',
        قانوني: 'مراجعة العقود، الالتزام بالضريبة ونظام العمل، استشارة مهنية عند الحاجة.',
        تقني: 'نسخ احتياطي، صيانة دورية، خطة استمرارية التشغيل.',
        سمعة: 'مراقبة التغذية الراجعة، استجابة سريعة للشكاوى، شفافية وتواصل إيجابي مع العملاء.',
        استراتيجي: 'مراجعة خطة العمل دورياً، مرونة في تغيير المسار، تنويع المنتجات أو الشرائح عند الحاجة.'
    };
    const enToAr = { financial: 'مالي', market: 'سوقي', operational: 'تشغيلي', regulatory: 'تنظيمي', legal: 'قانوني', technical: 'تقني', reputation: 'سمعة', strategic: 'استراتيجي' };

    return (Array.isArray(risks) ? risks : []).map(r => {
        let type = (r.type || r.category || '').trim() || 'تشغيلي';
        type = enToAr[String(type).toLowerCase()] || type;
        const key = Object.keys(tpl).find(k => type.includes(k) || type === k) || 'تشغيلي';
        return { ...r, mitigation: r.mitigation || tpl[key] || tpl.تشغيلي };
    });
}

/**
 * تقديرات رقمية تقريبية لـ TAM/SAM/SOM حسب المدينة والقطاع (داخلي، بدون API)
 * @param {string} city - المدينة
 * @param {string} sector - القطاع أو النشاط
 * @returns {{ tam: number, sam: number, som: number }}
 */
export function generateMarketEstimates() {
    // مبدأ «لا محتوى مزيف»: كانت هذه الدالة تختلق أرقام سوق
    // (مليون × عامل مدينة × عامل قطاع) تُقدَّم كتقديرات TAM/SAM/SOM في التقرير.
    // لا نُدرج أرقام سوق غير حقيقية — المستخدم يُدخل تقديراته من مصادر فعلية
    // (الهيئة العامة للإحصاء، تقارير القطاع) والأوصاف النصية تشرح له كيف.
    return { tam: null, sam: null, som: null };
}

/**
 * نصائح عامة للبدء بالمشروع (داخلي، بدون API) — يُستخدم عند تعذّر المستشار عن الخادم
 * @param {object} state - { projectInfo }
 * @returns {string}
 */
export function generateAdvisorFallback(state) {
    const p = state?.projectInfo || {};
    const name = or(p.name, 'المشروع');
    const city = or(p.city, 'المنطقة');
    const sector = or(p.sector, p.concept, '');
    const isHealth = /صحي|عيادة|مستشفى|طب|مختبر/i.test(sector);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);

    const tips = [
        `مراعاة استكمال التراخيص والموافقات قبل البدء (سجل تجاري، رخصة نشاط، بلدية، دفاع مدني حسب النشاط).`,
        `اختيار الموقع بعناية في ${city}؛ الإيجار من أكبر التكاليف الثابتة — تفاوض على فترة سماح أو تخفيض في بداية العقد.`,
        `وضع هيكل واضح للرواتب والمزايا والالتزام بنظام العمل والضريبة.`,
        `التخطيط لميزانية تسويقية واقعية (حوالي 3–6% من المبيعات المتوقعة) وتركيزها على القنوات ذات العائد.`,
        `الاحتفاظ باحتياطي نقدي لـ 3–6 أشهر تشغيل لتغطية التقلبات والتأخير في التحصيل.`
    ];
    if (isHealth) tips.push('في القطاع الصحي: الالتزام ببروتوكولات التعقيم وجودة الخدمة وعلاقات شركات التأمين يزيد من الاستدامة.');
    if (isEducation) tips.push('في قطاع التعليم: اعتماد المنهج والجهة المانحة للشهادات يعزز المصداقية وجذب الطلاب.');
    if (isLogistics) tips.push('في اللوجستيات: استثمار التتبع والالتزام بالمواعيد يبني سمعة مع العملاء ويقلل الخصومات.');
    if (isIndustrial) tips.push('في القطاع الصناعي: الموافقة البيئية وجودة المنتج وعلاقات الموردين أساسية قبل التوسع.');
    return `نصائح أولية لمشروع «${name}» في ${city}:\n\n${tips.map((t, i) => `${i + 1}. ${t}`).join('\n\n')}\n\n— لتوصيات مالية مُفصّلة، شغّل خادم الذكاء (ai_server) أو فعّل «داخلي فقط» وأعد تحميل النتائج.`;
}

/**
 * توصيات تحسين مالية مبنية على بيانات الدراسة الفعلية (داخلي، بدون API) — تُستخدم لسؤال
 * «كيف أحسن النتائج المالية؟» في المستشار الذكي العائم. على نمط generateSWOT: تقرأ نسب
 * التكلفة الحقيقية من getCostRatios (نفس مصدر SmartAdvisor) وتقارنها بمعيار القطاع من
 * sectorBenchmarks.js، وترتّب أكبر الفجوات أثراً مالياً أولاً بدل قائمة مسطّحة غير مرتبة.
 * @param {object} state - حالة الدراسة من الـ store
 * @param {object} results - نتائج المحرك المالي (من engine.js calculateStudy)
 * @returns {string}
 */
export function generateFinancialImprovementAdvice(state, results) {
    const p = state?.projectInfo || {};
    const name = or(p.name, 'المشروع');
    const year1 = results?.incomeStatement?.[0];
    const revenue = Number(year1?.revenue) || 0;

    if (!year1 || revenue <= 0) {
        return `لا تتوفر بيانات مالية كافية لتحليل تحسين النتائج المالية لمشروع «${name}» — أكمل بيانات الإيرادات والتكاليف التشغيلية أولاً ثم أعد المحاولة.`;
    }

    const ratios = getCostRatios(results);
    const bench = resolveSectorBenchmark(state);
    const sectorNote = bench.isGeneric ? '' : ` لقطاع «${bench.label}»`;
    const fmtSar = (n) => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' ريال';
    const pct = (n) => (n * 100).toFixed(1) + '%';

    const items = [];
    const addCostGap = (label, ratioVal, range) => {
        const [, hi] = range;
        if (ratioVal > hi) {
            const gap = ratioVal - hi;
            items.push({ label, ratioVal, hi, gap, sarImpact: gap * revenue, direction: 'high' });
        }
    };
    addCostGap('تكلفة البضاعة/التكلفة المتغيرة', ratios.cogs, bench.variableCostRate);
    addCostGap('الرواتب والأجور', ratios.labor, bench.laborToRevenue);
    addCostGap('الإيجار', ratios.rent, bench.rentToRevenue);
    addCostGap('التسويق', ratios.marketing, bench.marketingToRevenue);

    const [profitLo] = bench.netProfitToRevenue;
    if (ratios.profit < profitLo) {
        const gap = profitLo - ratios.profit;
        items.push({ label: 'هامش الربح الصافي', ratioVal: ratios.profit, lo: profitLo, gap, sarImpact: gap * revenue, direction: 'low' });
    }

    // الأكبر أثراً مالياً (بالريال) أولاً — لا قائمة غير مرتبة
    items.sort((a, b) => b.sarImpact - a.sarImpact);

    if (items.length === 0) {
        return `أداء «${name}» المالي ضمن النطاق الصحي${sectorNote}: تكلفة البضاعة (${pct(ratios.cogs)})، الرواتب (${pct(ratios.labor)})، الإيجار (${pct(ratios.rent)})، والتسويق (${pct(ratios.marketing)}) جميعها ضمن الحدود المتعارف عليها، وهامش الربح الصافي ${pct(ratios.profit)}. لا توجد فجوة كبيرة تستدعي تدخلاً فورياً — استمر بمراقبة الأداء دورياً.`;
    }

    const lines = items.slice(0, 4).map((it, idx) => {
        if (it.direction === 'high') {
            return `${idx + 1}. **${it.label}** تبلغ ${pct(it.ratioVal)} من المبيعات — أعلى من الحد الصحي${sectorNote} (${pct(it.hi)}) بفارق ${pct(it.gap)}. خفضها لحد المعيار يوفّر نحو ${fmtSar(it.sarImpact)} سنوياً.`;
        }
        return `${idx + 1}. **${it.label}** ${pct(it.ratioVal)} أقل من الحد المستهدف${sectorNote} (${pct(it.lo)}) بفارق ${pct(it.gap)} — إغلاق هذه الفجوة يضيف نحو ${fmtSar(it.sarImpact)} سنوياً لصافي الربح.`;
    });

    return `**تحليل تحسين النتائج المالية لمشروع «${name}»**${sectorNote}\n\nأبرز الفجوات مرتبة حسب الأثر المالي التقديري (من الأكبر للأصغر):\n\n${lines.join('\n\n')}\n\nملاحظة: النطاقات القطاعية أعلاه تقديرية (ممارسات محلية متعارف عليها) — راجعها بمصدرك الخاص قبل اتخاذ قرار نهائي.`;
}

/**
 * تراخيص ورسوم قانونية مقترحة حسب النشاط (داخلي، بدون API)
 * @param {object} state - { projectInfo }
 * @returns {Array<{ name, quantity, price, notes }>}
 */
export function generateLicenses(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'النشاط');
    const sector = or(p.sector, concept);
    const isFandB = /مطعم|كافي|قهوة|وجبات|فود|طعام|مأكولات|مشروبات/i.test(sector);
    const isRetail = /بقالة|تجزئة|متجر|بيع/i.test(sector);
    const isHealth = /صحي|عيادة|مستشفى|طب|تمريض|مختبر|صيدل/i.test(sector);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم|دورات/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع|استيراد|تصدير/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);

    // تدقيق 2026-07-08 (ملاحظة متوسطة #39): كانت القائمة الأساسية تقتصر على 4 بنود
    // فقط وتُغفل متطلبات سعودية شائعة لأي نشاط تجاري — أُضيفت 3 بنود عامة (الغرفة
    // التجارية، التسجيل الضريبي/الزكوي ZATCA، رخصة اللافتات) بالإضافة لبند صحي خاص
    // بالمطاعم (لا GOSI — مُمثَّلة فعلياً كنسبة راتب متكررة في قسم الموارد البشرية،
    // لا كرسم ترخيص لمرة واحدة، فإضافتها هنا تُكرِّر تمثيلها).
    const base = [
        { name: 'سجل تجاري', quantity: 1, price: 2000, notes: 'وزارة التجارة' },
        { name: 'انضمام الغرفة التجارية', quantity: 1, price: 800, notes: 'عضوية سنوية' },
        { name: 'تسجيل ضريبي/زكوي (ZATCA)', quantity: 1, price: 0, notes: 'إلزامي، بلا رسوم تسجيل مبدئياً' },
        { name: 'رخصة بلدية', quantity: 1, price: 1500, notes: 'البلدية حسب النشاط' },
        { name: 'رخصة لافتات المحل', quantity: 1, price: 600, notes: 'البلدية' },
        { name: 'شهادة الدفاع المدني', quantity: 1, price: 500, notes: 'متطلبات السلامة' }
    ];
    if (isFandB) {
        base.push({ name: 'رخصة هيئة الغذاء والدواء', quantity: 1, price: 1000, notes: 'للمنشآت الغذائية' });
        base.push({ name: 'شهادة صحية للعاملين', quantity: 1, price: 400, notes: 'لكل عامل بمناولة الطعام — وزارة الصحة' });
        base.push({ name: 'تصريح شفاط المطبخ (التهوية)', quantity: 1, price: 1200, notes: 'اشتراط شبه إلزامي لمطابخ المطاعم — البلدية / الدفاع المدني' });
    }
    if (isRetail) base.push({ name: 'رخصة نشاط تجاري', quantity: 1, price: 2500, notes: 'حسب البند' });
    if (isHealth) {
        base.push({ name: 'ترخيص هيئة التخصصات الصحية', quantity: 1, price: 3000, notes: 'للمنشآت الطبية' });
        base.push({ name: 'رخصة هيئة الغذاء والدواء (مختبر)', quantity: 1, price: 1500, notes: 'للمختبرات إن وُجدت' });
    }
    if (isEducation) base.push({ name: 'ترخيص التعليم / وزارة التعليم', quantity: 1, price: 4000, notes: 'مؤسسة تعليمية أو تدريبية' });
    if (isLogistics) {
        base.push({ name: 'رخصة نقل بضائع', quantity: 1, price: 3500, notes: 'وزارة النقل' });
        base.push({ name: 'سجل وكالة شحن (إن وُجد)', quantity: 1, price: 2000, notes: '' });
    }
    if (isIndustrial) {
        base.push({ name: 'رخصة تشغيل منشأة صناعية', quantity: 1, price: 5000, notes: 'الوزارة المعنية' });
        base.push({ name: 'موافقة بيئية', quantity: 1, price: 2500, notes: 'الرئاسة العامة للبيئة' });
    }
    return base;
}

/**
 * موارد لوجستية (نقل، تخزين، إيجار...) مقترحة (داخلي، بدون API)
 * @param {object} state - { projectInfo }
 * @returns {Array<{ name, monthly, variablePercent, notes }>}
 */
export function generateLogistics(state) {
    const p = state?.projectInfo || {};
    const sector = or(p.sector, p.concept, 'النشاط');
    const isFandB = /مطعم|كافي|فود|طعام/i.test(sector);
    const isRetail = /بقالة|تجزئة|متجر/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);
    const isHealth = /صحي|عيادة|مستشفى|طب|مختبر/i.test(sector);

    // تدقيق 2026-07-08 (ملاحظة عالية #38): variablePercent يُخزَّن ككسر (0–1) مثل
    // variableCostRate تماماً (الآن مسجَّل في DynamicTable.isFractionPercentColumn) —
    // كانت هذه القيم مكتوبة كنسبة مئوية خام (30، 50، 60...) فتُقرأ 3000%/5000% وتُدمّر الدراسة.
    //
    // تدقيق 2026-07-09 (اختبار عميل حي: دراسة مقهى — نتيجة NPV سالبة كاشفة): كان بند
    // "إيجار الموقع" هنا يُزدوَج مع بند "إيجار المحل (الصالة/المطبخ)" الافتراضي في جدول
    // الموارد الإدارية (schema.js، أُضيف في تدقيق سابق لأن إيجار المحل لم يكن له حقل
    // مستقل) — فيُحتسب إيجار واحد فعلياً كبندين منفصلين في التكاليف الثابتة، ما يضخّم
    // المصروفات ويحوّل مشاريع رابحة فعلياً إلى NPV سالب زوراً. الإيجار الآن مصدر واحد
    // (إدارية) فقط؛ حُذف من هنا لكل القطاعات (بما فيها الصحي الذي كان له بند مشابه).
    const base = [
        { name: 'كهرباء ومياه', monthly: 1500, variablePercent: 0.30, notes: '' },
        { name: 'نقل وتوزيع', monthly: 1200, variablePercent: 0.50, notes: isFandB || isRetail ? 'توصيل وتوريد' : '' }
    ];
    if (isRetail) base.push({ name: 'تأمين مخزن', monthly: 300, variablePercent: 0, notes: '' });
    if (isLogistics) {
        base.push({ name: 'إيجار مستودع/منصة', monthly: 12000, variablePercent: 0, notes: '' });
        base.push({ name: 'وقود وصيانة أسطول', monthly: 8000, variablePercent: 0.60, notes: '' });
        base.push({ name: 'تأمين شحن وبضائع', monthly: 1500, variablePercent: 0, notes: '' });
    }
    if (isIndustrial) {
        base.push({ name: 'طاقة (كهرباء صناعية)', monthly: 5000, variablePercent: 0.40, notes: '' });
        base.push({ name: 'تخزين مواد خام', monthly: 2000, variablePercent: 0.30, notes: '' });
    }
    if (isHealth) {
        base.push({ name: 'جمع ونقل نفايات طبية', monthly: 800, variablePercent: 0, notes: 'جهة مرخصة' });
    }
    return base;
}

/**
 * موارد إدارية (أمن، محاسبة، صيانة...) مقترحة (داخلي، بدون API) — حسب القطاع
 * @param {object} state - { projectInfo }
 * @returns {Array<{ name, monthly, notes }>}
 */
export function generateAdministrative(state) {
    const p = state?.projectInfo || {};
    const sector = or(p.sector, p.concept, '');
    const isHealth = /صحي|عيادة|مستشفى|طب|مختبر/i.test(sector);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);
    // تدقيق دفعة 3 (اختبار عميل بقالة 2026-07-12): areaSize كان معرَّفاً في المخطط
    // (projectInfo.areaSize) وغير مقروء في أي مولّد — بند «أمن وحراسة» الثابت (1500
    // ريال/شهر) كان يُقترح لأي نشاط بصرف النظر عن حجمه، رغم أن محلاً صغيراً (<150م²)
    // نادراً ما يستأجر حارساً مستقلاً (يُغطّى عادة بأمن المول/المبنى أو كاميرات فقط).
    const areaSize = Number(p.areaSize) || 0;
    const isSmallPremises = areaSize > 0 && areaSize < 150;

    const base = [
        { name: 'محاسبة ومراجعة', monthly: 800, notes: 'محاسب خارجي أو برامج محاسبة' },
        { name: 'صيانة ودعم فني', monthly: 500, notes: 'أجهزة ونظم' },
        { name: 'اتصالات وإنترنت', monthly: 400, notes: '' },
        // تدقيق دفعة 3: «تأمين تجاري» (حريق/سرقة/مسؤولية عامة عن المنشأة) كان غائباً
        // عن القائمة المقترحة رغم كونه بنداً شبه قياسي لأي منشأة تجارية مؤجَّرة —
        // منفصل عن «تأمين بضائع ومسؤولية» الخاص باللوجستيات أدناه (نطاق أضيق).
        { name: 'تأمين تجاري (حريق وسرقة ومسؤولية عامة)', monthly: 350, notes: 'وثيقة تأمين تجاري أساسية للمنشأة' }
    ];
    if (!isSmallPremises) base.push({ name: 'أمن وحراسة', monthly: 1500, notes: 'حسب الموقع والحاجة' });
    if (isHealth) base.push({ name: 'أرشفة وملفات مرضى (ورقي/إلكتروني)', monthly: 350, notes: 'التزام تنظيمي' });
    if (isEducation) base.push({ name: 'منصات وبرامج إدارية للطلاب', monthly: 600, notes: 'حضور، شهادات' });
    if (isLogistics) base.push({ name: 'تأمين بضائع ومسؤولية', monthly: 1200, notes: '' });
    if (isIndustrial) base.push({ name: 'صحة مهنية وبيئة عمل', monthly: 800, notes: 'كوادر، معدات وقائية' });
    return base;
}

/**
 * حملات تسويقية مقترحة (داخلي، بدون API) — حسب القطاع
 * @param {object} state - { projectInfo }
 * @returns {Array<{ name, type, amount, monthly, notes }>}
 */
export function generateCampaigns(state) {
    const p = state?.projectInfo || {};
    const sector = or(p.sector, p.concept, 'النشاط');
    const isFandB = /مطعم|كافي|فود|طعام/i.test(sector);
    const isRetail = /بقالة|تجزئة|متجر/i.test(sector);
    const isHealth = /صحي|عيادة|مستشفى|طب|مختبر/i.test(sector);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم|دورات/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);

    const base = [
        { name: 'حملة الإطلاق والافتتاح', type: 'capital', amount: 15000, monthly: 0, notes: 'إعلانات، دعوات، ترويج' },
        { name: 'إعلانات شهرية (سوشال ومحركات)', type: 'operating', amount: 0, monthly: 3500, notes: 'انستقرام، سناب، جوجل' },
        { name: 'علاقات عامة وإعلام', type: 'capital', amount: 5000, monthly: 0, notes: 'مرة عند التأسيس' }
    ];
    if (isFandB) base.push({ name: 'عروض افتتاحية وولاء', type: 'operating', amount: 0, monthly: 800, notes: 'كوبونات، خصم، برنامج ولاء' });
    if (isRetail) base.push({ name: 'عروض وعروضات أسبوعية', type: 'operating', amount: 0, monthly: 600, notes: 'منشورات، لافتات' });
    if (isHealth) base.push({ name: 'توعية صحية وعلاقات أطباء/تأمين', type: 'operating', amount: 0, monthly: 2000, notes: 'محاضرات، شراكات تأمين' });
    if (isEducation) base.push({ name: 'محتوى تعليمي وورش ومعارض', type: 'operating', amount: 0, monthly: 1500, notes: 'ويبينار، وسم، مشاركة معاهد' });
    if (isLogistics) base.push({ name: 'تواصل B2B ومنصات وعروض عقود', type: 'operating', amount: 0, monthly: 2500, notes: 'LinkedIn، معارض لوجستيات' });
    if (isIndustrial) base.push({ name: 'معارض صناعية ومبيعات مباشرة', type: 'capital', amount: 12000, monthly: 0, notes: 'معارض، زيارات مصانع' });
    return base;
}

/**
 * مناصب ووظائف مقترحة حسب النشاط (داخلي، بدون API)
 * @param {object} state - { projectInfo }
 * @returns {Array<{ position, nationality, count, salary, months, isVariable }>}
 */
export function generatePositions(state) {
    const p = state?.projectInfo || {};
    const sector = or(p.sector, p.concept, 'النشاط');
    const isCafe = /مقهى|كافيه|قهوة|بن|مختصة|cafe|coffee/i.test(sector);
    const isFandB = /مطعم|كافي|قهوة|فود|طعام|مأكولات|مشروبات/i.test(sector);
    const isRetail = /بقالة|تجزئة|متجر|بيع/i.test(sector);
    const isHealth = /صحي|عيادة|مستشفى|طب|تمريض|مختبر|صيدل/i.test(sector);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم|دورات/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع|استيراد|تصدير/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);
    const isService = /استشار|خدمي|صالة|رياض/i.test(sector);

    let positions = [];

    if (isCafe) {
        positions = [
            { position: 'مدير/مديرة فرع', nationality: 'saudi', count: 1, salary: 7000, months: 12, isVariable: false },
            { position: 'باريستا رئيسي', nationality: 'saudi', count: 1, salary: 5500, months: 12, isVariable: false },
            { position: 'باريستا', nationality: 'saudi', count: 3, salary: 4500, months: 12, isVariable: false },
            { position: 'كاشير وخدمة عملاء', nationality: 'saudi', count: 1, salary: 4200, months: 12, isVariable: false },
            { position: 'عامل خدمة ونظافة', nationality: 'expat', count: 1, salary: 2800, months: 12, isVariable: true }
        ];
    } else if (isFandB) {
        positions = [
            { position: 'مدير/مديرة التشغيل', nationality: 'saudi', count: 1, salary: 7500, months: 12, isVariable: false },
            { position: 'شيف / مشرف مطبخ', nationality: 'expat', count: 1, salary: 5500, months: 12, isVariable: false },
            { position: 'كاشير', nationality: 'expat', count: 2, salary: 3200, months: 12, isVariable: false },
            { position: 'موظف خدمة وعناية بالعملاء', nationality: 'expat', count: 3, salary: 2800, months: 12, isVariable: false }
        ];
    } else if (isRetail) {
        positions = [
            { position: 'مدير الفرع', nationality: 'saudi', count: 1, salary: 7000, months: 12, isVariable: false },
            { position: 'بائع/بائعة', nationality: 'expat', count: 2, salary: 3000, months: 12, isVariable: false },
            { position: 'أمين مخزن', nationality: 'expat', count: 1, salary: 3200, months: 12, isVariable: false }
        ];
    } else if (isHealth) {
        positions = [
            { position: 'مدير/مديرة المنشأة', nationality: 'saudi', count: 1, salary: 12000, months: 12, isVariable: false },
            { position: 'طبيب/استشاري', nationality: 'expat', count: 1, salary: 18000, months: 12, isVariable: false },
            { position: 'تمريض/فني', nationality: 'expat', count: 2, salary: 5500, months: 12, isVariable: false },
            { position: 'موظف استقبال وإداري', nationality: 'expat', count: 1, salary: 4000, months: 12, isVariable: false }
        ];
    } else if (isEducation) {
        positions = [
            { position: 'مدير/مديرة المؤسسة', nationality: 'saudi', count: 1, salary: 10000, months: 12, isVariable: false },
            { position: 'معلم/مدرب', nationality: 'expat', count: 2, salary: 6000, months: 12, isVariable: false },
            { position: 'موظف إداري واستقبال', nationality: 'expat', count: 1, salary: 3800, months: 12, isVariable: false }
        ];
    } else if (isLogistics) {
        positions = [
            { position: 'مدير/مديرة العمليات', nationality: 'saudi', count: 1, salary: 9000, months: 12, isVariable: false },
            { position: 'سائق / منسق نقل', nationality: 'expat', count: 3, salary: 3500, months: 12, isVariable: false },
            { position: 'أمين مستودع ومُدخل بيانات', nationality: 'expat', count: 2, salary: 3200, months: 12, isVariable: false }
        ];
    } else if (isIndustrial) {
        positions = [
            { position: 'مدير/مديرة الإنتاج', nationality: 'saudi', count: 1, salary: 10000, months: 12, isVariable: false },
            { position: 'فني/مشغل خط إنتاج', nationality: 'expat', count: 3, salary: 4000, months: 12, isVariable: false },
            { position: 'مراقب جودة ومخازن', nationality: 'expat', count: 1, salary: 3800, months: 12, isVariable: false }
        ];
    } else if (isService) {
        positions = [
            { position: 'مدير/مديرة', nationality: 'saudi', count: 1, salary: 8000, months: 12, isVariable: false },
            { position: 'منفذ/مقدم الخدمة', nationality: 'expat', count: 2, salary: 4000, months: 12, isVariable: false },
            { position: 'موظف استقبال وإداري', nationality: 'expat', count: 1, salary: 3500, months: 12, isVariable: false }
        ];
    } else {
        positions = [
            { position: 'مدير/مديرة المشروع', nationality: 'saudi', count: 1, salary: 6500, months: 12, isVariable: false },
            { position: 'موظف تنفيذي', nationality: 'expat', count: 2, salary: 3500, months: 12, isVariable: false }
        ];
    }

    // Apply Saudi City Logic
    const city = or(p.city, 'الرياض');
    const stats = getCityStats(city);
    const multiplier = stats.salary_factor || 1;

    return positions.map(pos => {
        let salary = pos.salary * multiplier;
        // Saudi Localization logic (min 4000)
        if (pos.nationality === 'saudi' && salary < 4000) salary = 4000;

        return {
            ...pos,
            salary: Math.round(salary / 50) * 50 // Round to nearest 50
        };
    });
}

/**
 * سقالة الأشخاص الرئيسين (الفريق المؤسس) — schema.js يعلن aiPrompt: 'suggest_key_people' لكن
 * لا يوجد أي معالج له في AIConnector.js فيرجع "اقتراح بنود" بلا أثر بصمت (تدقيق 2026-07-09،
 * اختبار عميل حي: دراسة مقهى). لا يمكن اختلاق اسم أو خبرة شخص حقيقي — الحقل name يبقى فارغاً
 * عمداً ليملأه المستخدم، والحقول الأخرى نص إرشادي بين قوسين يوضّح المطلوب توثيقه فقط.
 * @param {object} state - { projectInfo, hr }
 * @returns {Array<{ name, role, experience, qualifications }>}
 */
export function generateKeyPeople(state) {
    const positions = state?.hr?.positions || [];
    const managerPos = positions.find(x => /مدير|مديرة/i.test(x?.position || ''));
    const role = managerPos ? managerPos.position : 'المؤسس / المدير العام';
    return [
        { name: '', role, experience: '[اذكر سنوات خبرتك الفعلية في هذا النشاط أو نشاط مشابه]', qualifications: '[اذكر مؤهلاتك أو شهاداتك ذات الصلة، إن وُجدت]' }
    ];
}

/**
 * مباني وإنشاءات مقترحة (داخلي، بدون API)
 * @param {object} state - { projectInfo }
 * @returns {Array<{ name, quantity, price, depreciationRate, notes }>}
 */
/**
 * موردون مقترحون (الفجوة المعيارية)
 * @param {object} state - { projectInfo }
 * @returns {Array<{ name, supplyNature, availability, avgDeliveryDays, notes }>}
 */
/**
 * مقارنة تفصيلية مع المنافسين (جدول معايير)
 * @param {object} state - { projectInfo, marketing }
 * @returns {Array}
 */
export function generateCompetitorBenchmark() {
    // هيكل معايير جاهز بلا ترتيبات مُختلَقة — كانت تُعبّأ برُتب وهمية (نحن 1 والمنافس 3…)
    // تصل للتقرير كأنها تقييم فعلي. المستخدم وحده من يعرف منافسيه.
    const NOTE = 'قيّم من 1 (الأفضل) إلى 4 حسب معرفتك الفعلية بالمنافسين';
    return [
        { criterion: 'المنتجات والخدمات', importance: 'high', myRank: null, comp1Rank: null, comp2Rank: null, comp3Rank: null, notes: NOTE },
        { criterion: 'السعر', importance: 'high', myRank: null, comp1Rank: null, comp2Rank: null, comp3Rank: null, notes: NOTE },
        { criterion: 'الجودة', importance: 'high', myRank: null, comp1Rank: null, comp2Rank: null, comp3Rank: null, notes: NOTE },
        { criterion: 'الموقع', importance: 'medium', myRank: null, comp1Rank: null, comp2Rank: null, comp3Rank: null, notes: NOTE },
        { criterion: 'المظهر والتصميم', importance: 'medium', myRank: null, comp1Rank: null, comp2Rank: null, comp3Rank: null, notes: NOTE },
        { criterion: 'مستوى الخدمة', importance: 'high', myRank: null, comp1Rank: null, comp2Rank: null, comp3Rank: null, notes: NOTE }
    ];
}

export function generateSuppliers(state) {
    const p = state?.projectInfo || {};
    const sector = or(p.sector, p.concept, 'النشاط');
    const isFandB = /مطعم|كافي|فود|طعام|قهوة/i.test(sector);
    const isRetail = /بقالة|تجزئة|متجر/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);

    if (isFandB) {
        return [
            { name: 'مورد مواد غذائية (بن، شاي، حليب)', supplyNature: 'مواد خام للمشروبات والأطباق', availability: 'سهل', avgDeliveryDays: 2, notes: '' },
            { name: 'مورد أجهزة ومعدات (قهوة، ثلاجات)', supplyNature: 'معدات وآلات', availability: 'متوسط', avgDeliveryDays: 14, notes: '' },
            { name: 'مورد مستهلكات (أكواب، أطباق)', supplyNature: 'مستهلكات تشغيلية', availability: 'سهل', avgDeliveryDays: 3, notes: '' },
            { name: 'مورد حلويات وجاهز', supplyNature: 'منتجات جاهزة للبيع', availability: 'سهل', avgDeliveryDays: 1, notes: '' }
        ];
    }
    if (isRetail) {
        return [
            { name: 'مورد بضائع رئيسية', supplyNature: 'سلع للتجزئة', availability: 'متوسط', avgDeliveryDays: 7, notes: '' },
            { name: 'مورد تجهيزات عرض', supplyNature: 'رفوف، صناديق', availability: 'سهل', avgDeliveryDays: 10, notes: '' }
        ];
    }
    if (isIndustrial) {
        return [
            { name: 'مورد مواد خام إنتاج', supplyNature: 'مدخلات تصنيع', availability: 'متوسط', avgDeliveryDays: 14, notes: '' },
            { name: 'مورد عبوات وتغليف', supplyNature: 'تغليف وعبوات', availability: 'سهل', avgDeliveryDays: 5, notes: '' }
        ];
    }
    return [
        { name: 'مورد رئيسي للمشروع', supplyNature: 'مدخلات التشغيل', availability: 'متوسط', avgDeliveryDays: 7, notes: '' }
    ];
}

/**
 * مؤشرات قياس أداء تشغيلية مقترحة (الفجوة المعيارية)
 * @param {object} state - { projectInfo }
 * @returns {Array<{ strategicGoal, indicator, calculationMethod, unit, targetValue, notes }>}
 */
export function generateOperationalKpis(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'النشاط');

    return [
        { strategicGoal: 'تحقيق الإيرادات المستهدفة', indicator: 'متوسط عدد الفواتير/يوم', calculationMethod: 'عدد الفواتير ÷ أيام الشهر', unit: 'عدد/يوم', targetValue: '50', notes: '' },
        { strategicGoal: 'تحقيق الإيرادات المستهدفة', indicator: 'متوسط قيمة الفاتورة', calculationMethod: 'إجمالي المبيعات ÷ عدد الفواتير', unit: 'ريال/فاتورة', targetValue: '55', notes: '' },
        { strategicGoal: 'جودة الخدمة', indicator: 'عدد الشكاوى', calculationMethod: 'إجمالي الشكاوى المسجلة', unit: 'عدد/شهر', targetValue: '≤5', notes: '' },
        { strategicGoal: 'الولاء والعودة', indicator: 'معدل الشراء المتكرر', calculationMethod: 'عملاء متكررون ÷ إجمالي العملاء', unit: '%', targetValue: '30%', notes: '' }
    ];
}

/**
 * نفقات التأسيس (دراسات، تراخيص، ديكورات حد أدنى...)
 * @param {object} state - { projectInfo }
 * @returns {Array}
 */
export function generateEstablishmentCosts(state) {
    const p = state?.projectInfo || {};
    const sector = or(p.sector, p.concept, 'النشاط');

    // City logic
    const city = or(p.city, 'الرياض');
    const stats = getCityStats(city);
    const costMultiplier = stats.purchasing_power > 8 ? 1.2 : 1.0; // Higher incidental costs in rich cities

    return [
        { name: 'إعداد دراسة الجدوى', amount: 15000, amortizationRate: 0.20 },
        { name: 'الرسوم الإدارية والتسجيلات', amount: Math.round(5000 * costMultiplier), amortizationRate: 0.20 },
        { name: 'السجل التجاري والتراخيص', amount: Math.round(8000 * costMultiplier), amortizationRate: 0.20 },
        { name: 'أعمال الديكورات الأساسية (حد أدنى للتشغيل)', amount: Math.round(20000 * costMultiplier), amortizationRate: 0.20 },
        { name: 'بريد واصل ولوحة', amount: 2500, amortizationRate: 0.20 }
    ];
}

export function generateBuildings(state) {
    const p = state?.projectInfo || {};
    const sector = or(p.sector, p.concept, 'النشاط');
    // تدقيق 2026-07-09: مقهى مختص لا يملك مطبخاً تجارياً كاملاً (لا شيف في
    // generatePositions لنفس النشاط) — يجب ألا يُحمَّل بند "مطبخ تجاري وتهوية"
    // 120,000 ريال المخصص لمطاعم الطهي الكامل؛ يكفيه بار تحضير مشروبات أخف تكلفة.
    const isCafe = /مقهى|كافيه|قهوة|بن|مختصة|cafe|coffee/i.test(sector);
    const isFandB = /مطعم|كافي|فود|طعام/i.test(sector);
    const isRetail = /بقالة|تجزئة|متجر/i.test(sector);
    const isHealth = /صحي|عيادة|مستشفى|طب|مختبر/i.test(sector);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);

    const base = [
        { name: 'تعديلات وتشطيب الموقع', quantity: 1, price: 80000, depreciationRate: 0.05, notes: 'ديكور، كهرباء، صرف' },
        { name: 'أعمال السباكة والكهرباء', quantity: 1, price: 25000, depreciationRate: 0.05, notes: '' }
    ];
    if (isCafe) base.push({ name: 'بار تحضير المشروبات وتهوية خفيفة', quantity: 1, price: 45000, depreciationRate: 0.05, notes: 'كاونتر، تمديدات صرف ومياه لماكينة القهوة، تهوية بخار خفيفة' });
    else if (isFandB) base.push({ name: 'مطبخ تجاري وتهوية', quantity: 1, price: 120000, depreciationRate: 0.05, notes: 'شفاطات، أوانٍ' });
    if (isRetail) base.push({ name: 'رفوف وعرض بضاعة', quantity: 1, price: 35000, depreciationRate: 0.10, notes: '' });
    if (isHealth) {
        base.push({ name: 'تجهيز عيادة (غرف كشف، انتظار، تعقيم)', quantity: 1, price: 180000, depreciationRate: 0.05, notes: '' });
        base.push({ name: 'تهوية وإضاءة طبية', quantity: 1, price: 35000, depreciationRate: 0.05, notes: '' });
    }
    if (isEducation) {
        base.push({ name: 'قاعات تدريس/تدريب', quantity: 1, price: 90000, depreciationRate: 0.05, notes: '' });
        base.push({ name: 'معامل أو ورش تطبيقية', quantity: 1, price: 60000, depreciationRate: 0.05, notes: 'إن وُجدت' });
    }
    if (isLogistics) {
        base.push({ name: 'مستودع ورفوف تخزين', quantity: 1, price: 100000, depreciationRate: 0.05, notes: '' });
        base.push({ name: 'منصة تحميل/تفريغ', quantity: 1, price: 45000, depreciationRate: 0.05, notes: '' });
    }
    if (isIndustrial) {
        base.push({ name: 'ورشة وخط إنتاج', quantity: 1, price: 200000, depreciationRate: 0.05, notes: '' });
        base.push({ name: 'تخزين وإمداد كهرباء صناعية', quantity: 1, price: 55000, depreciationRate: 0.05, notes: '' });
    }
    return base;
}

/**
 * معدات وأجهزة مقترحة (داخلي، بدون API)
 * @param {object} state - { projectInfo }
 * @returns {Array<{ name, quantity, price, depreciationRate, notes }>}
 */
export function generateEquipment(state) {
    const p = state?.projectInfo || {};
    const sector = or(p.sector, p.concept, 'النشاط');
    const isCafe = /مقهى|كافيه|قهوة|بن|مختصة|cafe|coffee/i.test(sector);
    const isFandB = /مطعم|كافي|فود|طعام/i.test(sector);
    const isRetail = /بقالة|تجزئة|متجر/i.test(sector);
    const isHealth = /صحي|عيادة|مستشفى|طب|مختبر/i.test(sector);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);

    if (isCafe) {
        return [
            { name: 'ماكينة اسبريسو احترافية', quantity: 1, price: 35000, depreciationRate: 0.15, notes: '' },
            { name: 'مطاحن قهوة (اسبريسو وفلتر)', quantity: 2, price: 6000, depreciationRate: 0.15, notes: '' },
            { name: 'ثلاجات وعرض بارد', quantity: 2, price: 16000, depreciationRate: 0.15, notes: '' },
            { name: 'خلاط مشروبات باردة (بلندر)', quantity: 2, price: 3000, depreciationRate: 0.15, notes: '' },
            { name: 'نقاط بيع (POS)', quantity: 2, price: 4000, depreciationRate: 0.20, notes: '' }
        ];
    }
    if (isFandB) {
        return [
            { name: 'فرن ومعدات طهي', quantity: 1, price: 45000, depreciationRate: 0.15, notes: '' },
            { name: 'ثلاجات وعرض بارد', quantity: 2, price: 18000, depreciationRate: 0.15, notes: '' },
            { name: 'ماكينة قهوة وإعداد مشروبات', quantity: 1, price: 22000, depreciationRate: 0.15, notes: '' },
            { name: 'نقاط بيع (POS)', quantity: 2, price: 4000, depreciationRate: 0.20, notes: '' }
        ];
    }
    if (isRetail) {
        return [
            { name: 'أنظمة نقاط بيع وكاشير', quantity: 2, price: 8000, depreciationRate: 0.20, notes: '' },
            { name: 'ميزان وموازين', quantity: 2, price: 2500, depreciationRate: 0.15, notes: '' },
            { name: 'كاميرات مراقبة', quantity: 1, price: 6000, depreciationRate: 0.15, notes: '' }
        ];
    }
    if (isHealth) {
        return [
            { name: 'أجهزة فحص وكشف', quantity: 1, price: 85000, depreciationRate: 0.15, notes: 'حسب التخصص' },
            { name: 'أجهزة تعقيم ومختبر أساسي', quantity: 1, price: 35000, depreciationRate: 0.15, notes: '' },
            { name: 'أجهزة حاسوب ونقاط بيع/مواعيد', quantity: 2, price: 12000, depreciationRate: 0.20, notes: '' }
        ];
    }
    if (isEducation) {
        return [
            { name: 'أجهزة عرض وسبورة ذكية', quantity: 2, price: 25000, depreciationRate: 0.20, notes: '' },
            { name: 'أجهزة حاسوب للتدريب', quantity: 10, price: 35000, depreciationRate: 0.20, notes: '' },
            { name: 'طابعات ومعدات إدارية', quantity: 1, price: 5000, depreciationRate: 0.20, notes: '' }
        ];
    }
    if (isLogistics) {
        return [
            { name: 'رافعات شوكية/عربات يدوية', quantity: 2, price: 45000, depreciationRate: 0.15, notes: '' },
            { name: 'أنظمة تتبع وإدارة مستودعات (WMS)', quantity: 1, price: 28000, depreciationRate: 0.20, notes: '' },
            { name: 'حساسات وماسحات', quantity: 2, price: 8000, depreciationRate: 0.15, notes: '' }
        ];
    }
    if (isIndustrial) {
        return [
            { name: 'آلات وخط إنتاج', quantity: 1, price: 180000, depreciationRate: 0.10, notes: 'حسب المنتج' },
            { name: 'أجهزة تحكم وقياس جودة', quantity: 1, price: 35000, depreciationRate: 0.15, notes: '' },
            { name: 'معدات أمان وصيانة', quantity: 1, price: 15000, depreciationRate: 0.15, notes: '' }
        ];
    }
    return [
        { name: 'أجهزة حاسوب ومعدات مكتب', quantity: 2, price: 12000, depreciationRate: 0.20, notes: '' },
        { name: 'طابعات وأجهزة اتصال', quantity: 1, price: 3000, depreciationRate: 0.20, notes: '' }
    ];
}

/**
 * أثاث وتجهيزات مقترحة (داخلي، بدون API)
 * @param {object} state - { projectInfo }
 * @returns {Array<{ name, quantity, price, depreciationRate }>}
 */
export function generateFurniture(state) {
    const p = state?.projectInfo || {};
    const sector = or(p.sector, p.concept, 'النشاط');
    const isFandB = /مطعم|كافي|فود|طعام/i.test(sector);
    const isRetail = /بقالة|تجزئة|متجر/i.test(sector);
    const isHealth = /صحي|عيادة|مستشفى|طب|مختبر/i.test(sector);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم/i.test(sector);

    if (isFandB) {
        return [
            { name: 'طاولات وكراسي للعملاء', quantity: 1, price: 35000, depreciationRate: 0.20 },
            { name: 'طاولات إعداد وخدمة', quantity: 1, price: 8000, depreciationRate: 0.20 },
            { name: 'أرفف تخزين', quantity: 1, price: 6000, depreciationRate: 0.20 }
        ];
    }
    if (isRetail) {
        return [
            { name: 'مكاتب وكراسي إدارية', quantity: 1, price: 5000, depreciationRate: 0.20 },
            { name: 'أثاث منطقة خدمة العملاء', quantity: 1, price: 4000, depreciationRate: 0.20 }
        ];
    }
    if (isHealth) {
        return [
            { name: 'سرير كشف ووحدة فحص', quantity: 2, price: 22000, depreciationRate: 0.20 },
            { name: 'أثاث انتظار وكراسي', quantity: 1, price: 12000, depreciationRate: 0.20 },
            { name: 'مكاتب إدارية ومستودع أدوية', quantity: 1, price: 8000, depreciationRate: 0.20 }
        ];
    }
    if (isEducation) {
        return [
            { name: 'طاولات وكراسي قاعات', quantity: 1, price: 28000, depreciationRate: 0.20 },
            { name: 'مكاتب إدارية واستقبال', quantity: 1, price: 6000, depreciationRate: 0.20 }
        ];
    }
    return [
        { name: 'مكاتب وكراسي', quantity: 1, price: 15000, depreciationRate: 0.20 },
        { name: 'خزانات وملفات', quantity: 1, price: 4000, depreciationRate: 0.20 }
    ];
}

/**
 * موارد تقنية مقترحة (داخلي، بدون API)
 * @param {object} state - { projectInfo }
 * @returns {Array<{ name, quantity, price, notes }>}
 */
export function generateTechResources(state) {
    const p = state?.projectInfo || {};
    const sector = or(p.sector, p.concept, 'النشاط');
    const isHealth = /صحي|عيادة|مستشفى|طب|مختبر/i.test(sector);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);

    const base = [
        { name: 'برمجيات محاسبة وإدارة', quantity: 1, price: 4000, notes: 'اشتراك سنوي' },
        { name: 'موقع إلكتروني / منصة', quantity: 1, price: 8000, notes: 'تصميم واشتِراك' }
    ];
    if (isHealth) {
        base.push({ name: 'سجل طبي إلكتروني ونظام مواعيد', quantity: 1, price: 12000, notes: 'اشتراك سنوي' });
        base.push({ name: 'أنظمة أرشفة (صورة، تقارير)', quantity: 1, price: 5500, notes: '' });
    } else if (isEducation) {
        base.push({ name: 'منصة تعلم (LMS) وحضور', quantity: 1, price: 9000, notes: 'اشتراك سنوي' });
        base.push({ name: 'أنظمة حجز قاعات ودورات', quantity: 1, price: 4000, notes: '' });
    } else if (isLogistics) {
        base.push({ name: 'نظام إدارة نقل ومستودعات (TMS/WMS)', quantity: 1, price: 18000, notes: 'اشتراك أو ترخيص' });
        base.push({ name: 'تتبع وربط مع عملاء', quantity: 1, price: 6000, notes: '' });
    } else if (isIndustrial) {
        base.push({ name: 'ERP أو إدارة إنتاج ومخزون', quantity: 1, price: 22000, notes: 'ترخيص سنوي' });
        base.push({ name: 'تحكم آلات وجودة', quantity: 1, price: 8000, notes: '' });
    } else {
        base.push({ name: 'أنظمة حجز أو طلبات (إن وُجد)', quantity: 1, price: 3500, notes: '' });
    }
    return base;
}

/**
 * مصادر إيرادات مقترحة (داخلي، بدون API)
 * @param {object} state - { projectInfo }
 * @returns {Array<{ service, customersPerMonth, avgPrice, growthRate }>}
 * ASSUMPTION (تدقيق 2026-07-08، ملاحظة عالية #22): كل قيم growthRate أدناه (6-12%)
 * تقديرات داخلية اجتهادية بحسب القطاع — لا مصدر خارجي منشور لها. هذه اقتراحات
 * أولية قابلة للتعديل الكامل من المستخدم (وليست بيانات نهائية معتمدة للدراسة).
 */
export function generateRevenueStreams(state) {
    const p = state?.projectInfo || {};
    const concept = shortActivity(p, 'الخدمة');
    const sector = or(p.sector, concept);
    // تدقيق 2026-07-09: مقهى مختص كان يُصنَّف ضمن isFandB العام بمتوسط فاتورة
    // مطعم كامل (45 ريال) — يضاعف الإيراد المتوقع تقريباً مقارنة بمتوسط فاتورة
    // مقهى واقعي (مشروب + إضافة خفيفة)، ما يُفسد NPV/IRR مباشرة.
    const isCafe = /مقهى|كافيه|قهوة|بن|مختصة|cafe|coffee/i.test(sector);
    const isFandB = /مطعم|كافي|قهوة|فود|طعام/i.test(sector);
    // تدقيق دفعة 3 (اختبار عميل بقالة 2026-07-12): isGrocery يجب أن يُختبر قبل isRetail
    // (نمط الأخير يطابق «بقالة» أيضاً) — نفس سابقة isCafe قبل isFandB أعلاه — وإلا
    // تُصنَّف بقالة الخضار كتجزئة عامة بصف واحد بلا تفصيل هدر/عمولة توصيل.
    const isGrocery = /خضار|فواكه|بقالة|تموينات/i.test(sector);
    const isRetail = /بقالة|تجزئة|متجر/i.test(sector);
    const isHealth = /صحي|عيادة|مستشفى|طب|مختبر/i.test(sector);
    const isEducation = /تعليم|مدرسة|جامعة|تدريب|أكاديم|دورات/i.test(sector);
    const isLogistics = /لوجستي|شحن|نقل|تخزين|توزيع/i.test(sector);
    const isIndustrial = /صناع|مصنع|إنتاج|تصنيع/i.test(sector);

    if (isCafe) {
        return [
            { service: 'مبيعات المشروبات والمخبوزات (داخل المقهى)', customersPerMonth: 3000, avgPrice: 20, growthRate: 0.08 },
            { service: 'الطلب السفري والتوصيل', customersPerMonth: 400, avgPrice: 28, growthRate: 0.12 }
        ];
    }
    if (isFandB) {
        return [
            { service: 'مبيعات المأكولات والمشروبات', customersPerMonth: 1200, avgPrice: 45, growthRate: 0.07 },
            { service: 'توصيل وطلبات أونلاين', customersPerMonth: 200, avgPrice: 55, growthRate: 0.12 }
        ];
    }
    if (isGrocery) {
        return [
            // wasteRate هنا يمثّل تلف/هدر المنتجات الطازجة الفعلي — مفصول عن variableCostRate
            // (تكلفة البضاعة المباعة نفسها) كي لا يُخلط الاثنان في رقم واحد (أعمدة جديدة، دفعة 3).
            { service: 'خضار وفواكه طازجة', customersPerMonth: 2200, avgPrice: 32, growthRate: 0.05, variableCostRate: 0.62, wasteRate: 0.08 },
            { service: 'مواد غذائية وتموينات جافة', customersPerMonth: 1100, avgPrice: 55, growthRate: 0.04, variableCostRate: 0.68, wasteRate: 0.01 },
            { service: 'طلبات توصيل عبر التطبيقات', customersPerMonth: 200, avgPrice: 60, growthRate: 0.15, variableCostRate: 0.62, wasteRate: 0.04, platformCommissionRate: 0.20 }
        ];
    }
    if (isRetail) return [{ service: 'مبيعات التجزئة', customersPerMonth: 800, avgPrice: 85, growthRate: 0.06 }];
    if (isHealth) {
        return [
            { service: 'استشارات وفحوص', customersPerMonth: 180, avgPrice: 180, growthRate: 0.08 },
            { service: 'إجراءات وعلاجات', customersPerMonth: 60, avgPrice: 450, growthRate: 0.06 },
            { service: 'اشتراكات/باقات', customersPerMonth: 25, avgPrice: 800, growthRate: 0.10 }
        ];
    }
    if (isEducation) {
        return [
            { service: 'رسوم دورات/برامج', customersPerMonth: 80, avgPrice: 1200, growthRate: 0.08 },
            { service: 'اشتراكات سنوية أو شهادات', customersPerMonth: 15, avgPrice: 2500, growthRate: 0.07 }
        ];
    }
    if (isLogistics) {
        return [
            { service: 'شحن وتوزيع', customersPerMonth: 120, avgPrice: 350, growthRate: 0.10 },
            { service: 'تخزين وتموين', customersPerMonth: 25, avgPrice: 2000, growthRate: 0.08 }
        ];
    }
    if (isIndustrial) {
        return [
            { service: 'بيع منتج/إنتاج', customersPerMonth: 40, avgPrice: 8500, growthRate: 0.07 },
            { service: 'تعاقدات OEM/جملة', customersPerMonth: 8, avgPrice: 25000, growthRate: 0.06 }
        ];
    }
    return [{ service: or(concept, 'الخدمة الرئيسية'), customersPerMonth: 150, avgPrice: 200, growthRate: 0.07 }];
}

/**
 * دالة لمحاكاة التدفق (Streaming) لنص معين كـ ReadableStream
 * @param {string} text - النص المراد تدفقه
 * @param {number} delayMs - التأخير بين كل جزء
 * @returns {ReadableStream}
 */
export function simulateStream(text, delayMs = 15) {
    return new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            const words = (text || '').split(' ');
            for (let i = 0; i < words.length; i++) {
                const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
                controller.enqueue(encoder.encode(chunk));
                await new Promise(r => setTimeout(r, delayMs));
            }
            controller.close();
        }
    });
}

// الكائن المجمَّع يجب أن يشمل *كل* الدوال المصدَّرة — كان ناقصاً 7 دوال
// (generateMarketAnalysisSummary وأخواتها) فترمي أزرار التوليد TypeError وقت التشغيل.
export const InternalAIGenerator = {
    simulateStream,
    generateBusinessModel,
    generateMarketDescriptions,
    generateMarketAnalysisSummary,
    generateSWOT,
    generateTOWS,
    generateSegments,
    generateCompetitors,
    generateCompetitorBenchmark,
    generateFieldSuggestion,
    generateSuppliers,
    generateEstablishmentCosts,
    generateOperationalKpis,
    generateProductionCapacity,
    generateMarketingMix,
    generateIntroSuggestions,
    generateSectorIndustry,
    generateVision2030Economy,
    generatePESTEL,
    generatePorter,
    generateExecutiveSummary,
    generateRisks,
    generateProducts,
    generateIntroServices,
    generateCustomerValues,
    generateTimeline,
    generateLocationFactors,
    generateMitigationSuggestions,
    generateMarketEstimates,
    generateAdvisorFallback,
    generateFinancialImprovementAdvice,
    generateLicenses,
    generateLogistics,
    generateAdministrative,
    generateCampaigns,
    generateRevenueStreams,
    generatePositions,
    generateKeyPeople,
    generateBuildings,
    generateEquipment,
    generateFurniture,
    generateTechResources,
    BLOCK_KEYS
};

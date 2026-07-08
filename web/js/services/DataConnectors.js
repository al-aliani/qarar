/**
 * DataConnectors — الطبقة الموحّدة لموصّلات البيانات الخارجية لـ«قرار».
 *
 * مبدأ التصميم (غير قابل للتفاوض):
 *  1) لا مفاتيح API في العميل أبداً — أي مصدر مُفتاح يمرّ عبر proxy خادمي (/api/...).
 *  2) البيانات المفتوحة البطيئة تُشحن كلقطات JSON مُجمّعة (bundled snapshots).
 *  3) كل قيمة تُرجعها الطبقة موسومة بمصدرها (provenance) — لا رقم عارٍ إطلاقاً.
 *
 * الاستهلاك: FieldSuggestionService / SmartAdvisor / MarketAnalysis تنادي suggest(key, ctx)
 * وتحصل دائماً على كائن Datum موحّد، بلا علم هل المصدر محلي (snapshot) أم حيّ (API/proxy).
 */

/** أنواع مصدر القيمة — تُعرض كشارة مرئية بجانب الحقل. */
export const PROVENANCE = Object.freeze({
    SOURCED: 'sourced',        // من مصدر رسمي مُوثّق (GASTAT، World Bank، OSM…)
    DERIVED: 'derived',        // محسوب من مصادر (مثل: سكان × إنفاق للفرد)
    ASSUMPTION: 'assumption',  // افتراض معلن (نطاق ممارسة/معامل) — ليس بياناً
    UNAVAILABLE: 'unavailable' // تعذّر الجلب (شبكة/غياب مصدر) — لا تُخمّن
});

/**
 * كتالوج المصادر الممكن ربطها بأدوات المساندة. هذا ليس موصّلات تنفيذية بعد؛
 * هو سجل اكتشاف موحّد للواجهة ولخطة الربط اللاحقة (API/proxy/Python/ملفات).
 */
export const DATA_SOURCE_CATALOG = Object.freeze([
    {
        id: 'national-data-bank',
        name: 'بنك البيانات الوطني',
        category: 'حكومي',
        desc: 'كتالوج بيانات وواجهات مشاركة حكومية سعودية',
        connection: 'حكومي/API',
        url: 'https://data.gov.sa/',
        icon: 'book',
        useCases: ['مصادر حكومية', 'بيانات قطاعية', 'مراجع التقرير']
    },
    {
        id: 'gastat-open-data',
        name: 'الهيئة العامة للإحصاء',
        category: 'إحصاء',
        desc: 'سكان، اقتصاد، منشآت، أسعار، ومؤشرات قطاعية',
        connection: 'إحصاء/API',
        url: 'https://dp.stats.gov.sa/opendata',
        icon: 'chart',
        useCases: ['حجم السوق', 'السكان', 'الطلب', 'المؤشرات الاقتصادية']
    },
    {
        id: 'data-saudi',
        name: 'DataSaudi',
        category: 'إحصاء',
        desc: 'مستكشف مؤشرات الاقتصاد والقطاعات والمناطق',
        connection: 'بيانات',
        url: 'https://datasaudi.sa/en/data-explorer',
        icon: 'chart',
        useCases: ['اقتصاد كلي', 'مقارنات قطاعية', 'مناطق']
    },
    {
        id: 'world-bank-indicators',
        name: 'World Bank Indicators',
        category: 'دولي',
        desc: 'مؤشرات اقتصادية وتنموية عالمية قابلة للجلب برمجياً',
        connection: 'API مفتوح',
        url: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation',
        icon: 'chart',
        useCases: ['GDP', 'التضخم', 'المقارنات الدولية', 'سلاسل زمنية']
    },
    {
        id: 'imf-data-api',
        name: 'IMF Data API',
        category: 'دولي',
        desc: 'بيانات صندوق النقد عبر SDMX/DataMapper APIs',
        connection: 'API',
        url: 'https://data.imf.org/en/Resource-Pages/IMF-API',
        icon: 'chart',
        useCases: ['اقتصاد كلي', 'توقعات', 'مقارنات دولية']
    },
    {
        id: 'sama-statistics',
        name: 'البنك المركزي السعودي',
        category: 'مالي',
        desc: 'مؤشرات نقدية، أسعار فائدة، تمويل، وتضخم',
        connection: 'رسمي',
        url: 'https://www.sama.gov.sa/en-US/Statistics/pages/summary.aspx',
        icon: 'bank',
        useCases: ['معدل الخصم', 'الفائدة', 'التضخم', 'التمويل']
    },
    {
        id: 'mci-open-data',
        name: 'وزارة التجارة',
        category: 'شركات',
        desc: 'بيانات وسجلات تجارية ومؤشرات قطاع الأعمال',
        connection: 'شركات',
        url: 'https://mc.gov.sa/en/OpenData/Pages/default.aspx',
        icon: 'list',
        useCases: ['السجلات', 'نشاط الشركات', 'التحقق التجاري']
    },
    {
        id: 'wathq-cr-api',
        name: 'واجهة واثق للسجلات',
        category: 'شركات',
        desc: 'استعلام تجاري عبر API عند توفر مفتاح وصلاحية',
        connection: 'API',
        url: 'https://developer.wathq.sa/en/api/32',
        icon: 'shield',
        useCases: ['السجل التجاري', 'التحقق من الموردين', 'بيانات الشركات']
    },
    {
        id: 'saudi-business-center',
        name: 'المركز السعودي للأعمال',
        category: 'تأسيس وتراخيص',
        desc: 'خدمات السجل التجاري وإجراءات بدء النشاط',
        connection: 'رسمي',
        url: 'https://business.sa/en/servicesprocedures/details/3f37df76-a853-4616-ef34-08dced12ee80',
        icon: 'list',
        useCases: ['السجل التجاري', 'متطلبات التأسيس', 'إجراءات النشاط']
    },
    {
        id: 'balady-open-data',
        name: 'بلدي - البيانات المفتوحة',
        category: 'تراخيص ومواقع',
        desc: 'بيانات بلدية وتراخيص وأنشطة مكانية قابلة لإعادة الاستخدام',
        connection: 'حكومي/ملفات',
        url: 'https://balady.gov.sa/en/open-data',
        icon: 'map',
        useCases: ['الرخص البلدية', 'الأنشطة', 'اشتراطات الموقع']
    },
    {
        id: 'zatca-open-data-apis',
        name: 'الزكاة والضريبة والجمارك',
        category: 'ضريبة وزكاة',
        desc: 'بيانات وواجهات مفتوحة للزكاة والضريبة والجمارك',
        connection: 'حكومي/API',
        url: 'https://zatca.gov.sa/en/e-participation/PublicData/Pages/APIs.aspx',
        icon: 'shield',
        useCases: ['VAT', 'الزكاة', 'الجمارك', 'متطلبات الامتثال']
    },
    {
        id: 'hrsd-open-data',
        name: 'الموارد البشرية والتنمية الاجتماعية',
        category: 'عمل وتوظيف',
        desc: 'بيانات سوق العمل، العمالة، والأجور والمؤشرات الاجتماعية',
        connection: 'حكومي/بيانات',
        url: 'https://www.hrsd.gov.sa/en/knowledge-centre/data-and-statistics/open-data',
        icon: 'users',
        useCases: ['التوظيف', 'السعودة', 'الأجور', 'سوق العمل']
    },
    {
        id: 'monshaat-open-data',
        name: 'منشآت',
        category: 'تمويل ومنشآت',
        desc: 'بيانات ومنشورات المنشآت الصغيرة والمتوسطة',
        connection: 'SME',
        url: 'https://www.monshaat.gov.sa/en/node/12825',
        icon: 'bank',
        useCases: ['معايير منشآت', 'SME', 'مراجع التمويل']
    },
    {
        id: 'rega-real-estate-indicators',
        name: 'مؤشرات العقار',
        category: 'إيجارات وموقع',
        desc: 'مؤشرات أسعار وصفقات عقارية حسب المناطق والمدن',
        connection: 'لوحات/بيانات',
        url: 'https://rega.gov.sa/en/rega-services/platforms/real-estate-indicators/',
        icon: 'map',
        useCases: ['الإيجار', 'اختيار الموقع', 'تكلفة العقار']
    },
    {
        id: 'ejar-platform',
        name: 'إيجار',
        category: 'إيجارات',
        desc: 'منصة تنظيم قطاع الإيجار ومؤشراته التعاقدية',
        connection: 'رسمي',
        url: 'https://www.ejar.sa/en',
        icon: 'list',
        useCases: ['عقود الإيجار', 'تحقق الموقع', 'تكلفة الإيجار']
    },
    {
        id: 'electricity-tariffs',
        name: 'تعرفة الكهرباء',
        category: 'تشغيل',
        desc: 'تعرفة الاستهلاك حسب القطاع والشريحة',
        connection: 'رسمي',
        url: 'https://www.sera.gov.sa/en/consumer/electric-tariff/electric-tariff-categories/consumption-tariff',
        icon: 'activity',
        useCases: ['تكلفة الكهرباء', 'المصاريف التشغيلية', 'اختبار الحساسية']
    },
    {
        id: 'water-bill-calculator',
        name: 'حاسبة فاتورة المياه',
        category: 'تشغيل',
        desc: 'تقدير تكلفة المياه والصرف حسب الاستهلاك والفئة',
        connection: 'حاسبة رسمية',
        url: 'https://www.swa.gov.sa/en/services/service-calculator/water-bill-calculator',
        icon: 'activity',
        useCases: ['تكلفة المياه', 'المصاريف التشغيلية', 'المرافق']
    },
    {
        id: 'google-places',
        name: 'Google Places',
        category: 'خرائط',
        desc: 'منافسون، مواقع، تقييمات، وساعات عمل حول موقع المشروع',
        connection: 'خرائط/API',
        url: 'https://developers.google.com/maps/documentation/places/web-service/overview',
        icon: 'map',
        useCases: ['المنافسين', 'تحليل الموقع', 'الكثافة التجارية']
    },
    {
        id: 'osm-overpass',
        name: 'OpenStreetMap Overpass',
        category: 'خرائط',
        desc: 'بديل مفتوح لجمع نقاط الاهتمام والمنافسين مكانياً',
        connection: 'مفتوح/API',
        url: 'https://wiki.openstreetmap.org/wiki/Overpass_API',
        icon: 'map',
        useCases: ['المنافسين', 'نقاط الاهتمام', 'بديل مفتوح']
    },
    {
        id: 'tourism-dashboard',
        name: 'لوحة بيانات السياحة',
        category: 'قطاعي',
        desc: 'مؤشرات سياحية مفيدة للمطاعم والمقاهي والتجزئة',
        connection: 'قطاعي',
        url: 'https://mt.gov.sa/tic/dashboard/domestic-tourism',
        icon: 'trend',
        useCases: ['السياحة', 'الطلب الموسمي', 'المناطق']
    },
    {
        id: 'uploaded-supplier-files',
        name: 'رفع ملفات الموردين والأسعار',
        category: 'ملفات',
        desc: 'Excel/CSV/PDF لعروض أسعار ومرفقات ميدانية',
        connection: 'ملفات',
        actionId: 'linkImportCsvSources',
        icon: 'download',
        useCases: ['عروض أسعار', 'أصول', 'تكاليف تشغيل']
    },
    {
        id: 'custom-python-connector',
        name: 'موصل Python مخصص',
        category: 'مخصص',
        desc: 'قالب لجلب بيانات API أو ملفات دورية وتوثيق المصدر',
        connection: 'Python',
        actionId: 'linkPythonConnectorDocs',
        icon: 'flask',
        useCases: ['API خاص', 'تنزيل ملفات', 'تنظيف بيانات']
    }
]);

/**
 * الشكل الموحّد لأي قيمة تُرجعها الطبقة.
 * @typedef {Object} Datum
 * @property {*} value           القيمة (رقم/نص/كائن) أو null عند التعذّر
 * @property {string} unit       الوحدة (ريال، %، نسمة، عدد…)
 * @property {string} source     اسم المصدر المعروض ("GASTAT — تعداد 2022")
 * @property {string} sourceUrl  رابط المصدر
 * @property {string} year       سنة البيانات
 * @property {string} provenance أحد PROVENANCE
 * @property {string} note       ملاحظة/تفسير (طريقة الاشتقاق، سبب التعذّر…)
 */

/**
 * منشئ Datum موحّد بقيم افتراضية آمنة.
 * @param {*} value
 * @param {Partial<Datum>} [meta]
 * @returns {Datum}
 */
export function datum(value, meta = {}) {
    return {
        value: value ?? null,
        unit: meta.unit || '',
        source: meta.source || '',
        sourceUrl: meta.sourceUrl || '',
        year: meta.year ? String(meta.year) : '',
        provenance: meta.provenance || PROVENANCE.SOURCED,
        note: meta.note || ''
    };
}

/** Datum «غير متاح» — المسار الأمين حين يتعذّر الجلب: لا تُخمّن، أعلن التعذّر. */
export function unavailable(note = '') {
    return datum(null, { provenance: PROVENANCE.UNAVAILABLE, note });
}

/** هل الشارة تمثّل قيمة قابلة للاستخدام (لا null ولا تعذّر). */
export function isUsable(d) {
    return !!d && d.value !== null && d.value !== undefined && d.provenance !== PROVENANCE.UNAVAILABLE;
}

/** نص الشارة المعروضة للمستخدم بجانب الحقل. */
export function provenanceLabel(d) {
    if (!d) return '';
    switch (d.provenance) {
        case PROVENANCE.SOURCED: return `مصدر: ${d.source || 'موثّق'}${d.year ? ' ' + d.year : ''}`;
        case PROVENANCE.DERIVED: return `مُشتقّ${d.note ? ': ' + d.note : ''}`;
        case PROVENANCE.ASSUMPTION: return `افتراض${d.note ? ': ' + d.note : ''}`;
        case PROVENANCE.UNAVAILABLE: return 'غير متاح — أدخل القيمة يدوياً';
        default: return '';
    }
}

// ── سجل الموصّلات ────────────────────────────────────────────────────────────
/** @type {Map<string, (ctx:Object)=>(Datum|Promise<Datum>)>} */
const registry = new Map();

/**
 * تسجيل موصّل لمفتاح حقل. تستدعيه وحدات الموصّلات ذاتياً عند تحميلها.
 * @param {string} key  مفتاح موحّد (مثل 'market.competitors' أو 'macro.inflation')
 * @param {(ctx:Object)=>(Datum|Promise<Datum>)} fn
 */
export function registerConnector(key, fn) {
    if (typeof key === 'string' && typeof fn === 'function') registry.set(key, fn);
}

/** المفاتيح المتاحة حالياً (للاكتشاف/الاختبار). */
export function availableKeys() {
    return [...registry.keys()];
}

/**
 * الاستدعاء الموحّد: يعيد دائماً Datum — لا يرمي أبداً.
 * @param {string} key  مفتاح الحقل
 * @param {Object} [context]  سياق (city, coords, sector, radius…)
 * @returns {Promise<Datum>}
 */
export async function suggest(key, context = {}) {
    const fn = registry.get(key);
    if (!fn) return unavailable(`لا يوجد موصّل للمفتاح: ${key}`);
    try {
        const result = await fn(context);
        return result && typeof result === 'object' && 'provenance' in result
            ? result
            : datum(result); // موصّل أعاد قيمة خام — نغلّفها بشكل موحّد
    } catch (e) {
        return unavailable(e?.message || `فشل الموصّل: ${key}`);
    }
}

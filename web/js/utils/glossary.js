/**
 * Financial Terms Glossary & Tooltip Helper
 * Provides definitions and explanations for financial terms
 */

import { fieldHelp } from '../ui/components/FieldHelp.js';
import { escapeHtml } from './escape.js';

export const FINANCIAL_TERMS = {
    NPV: {
        term: 'صافي القيمة الحالية',
        abbr: 'NPV',
        definition: 'القيمة الحالية لجميع التدفقات النقدية المستقبلية مخصومة بمعدل العائد المطلوب.',
        formula: 'NPV = Σ (التدفق النقدي / (1 + معدل الخصم)^السنة)',
        interpretation: 'إذا كان NPV > 0 فالمشروع مربح، وإذا كان سالباً فهو خاسر.',
        example: 'NPV = 500,000 ريال يعني أن المشروع سيضيف نصف مليون لثروتك'
    },

    IRR: {
        term: 'معدل العائد الداخلي',
        abbr: 'IRR',
        definition: 'معدل الخصم الذي يجعل صافي القيمة الحالية تساوي صفر. يمثل العائد السنوي المتوقع على الاستثمار.',
        formula: 'IRR هو r حيث: NPV = 0',
        interpretation: 'كلما ارتفع IRR كان المشروع أفضل. يجب أن يكون أعلى من تكلفة رأس المال.',
        example: 'IRR = 25% يعني كل ريال تستثمره سيعود عليك بـ 25% سنوياً'
    },

    WACC: {
        term: 'المتوسط المرجح لتكلفة رأس المال',
        abbr: 'WACC',
        definition: 'متوسط تكلفة التمويل من جميع المصادر (أسهم + قروض) مرجحاً بنسبة كل منها.',
        formula: 'WACC = (E/V × Re) + (D/V × Rd × (1-T))',
        interpretation: 'يستخدم كمعدل خصم لتقييم المشروع. أقل WACC = أفضل.',
        example: 'WACC = 10% يعني تكلفة تمويل المشروع 10% سنوياً'
    },

    DSCR: {
        term: 'نسبة تغطية خدمة الدين',
        abbr: 'DSCR',
        definition: 'مقياس قدرة المشروع على تسديد أقساط القرض من التدفقات النقدية التشغيلية.',
        formula: 'DSCR = التدفق النقدي التشغيلي / خدمة الدين (أصل + فائدة)',
        // تدقيق 2026-07-12: كانت 1.2 هنا احتياطية مختلفة عن 1.25 الفعلية المستخدمة في محرك
        // القرار وكل شاشات التمويل (targetDSCR الافتراضي وحدّ البنوك المعتاد) — توحيد الرقم.
        interpretation: 'يجب أن يكون DSCR ≥ 1.25 لضمان القدرة على السداد (الحد الائتماني المعتاد لدى البنوك).',
        example: 'DSCR = 1.5 يعني لديك 50% فائض بعد سداد القرض'
    },

    PAYBACK: {
        term: 'فترة الاسترداد',
        abbr: 'Payback Period',
        definition: 'المدة الزمنية المطلوبة لاسترداد الاستثمار الأولي من التدفقات النقدية.',
        formula: 'عدد السنوات حتى تصبح التدفقات المتراكمة = الاستثمار الأولي',
        interpretation: 'كلما كانت الفترة أقصر كان أفضل. عادة يفضل أقل من 3-5 سنوات.',
        example: 'Payback = 2.3 سنة يعني ستسترد أموالك بعد سنتين وربع'
    },

    BREAKEVEN: {
        term: 'نقطة التعادل',
        abbr: 'Break-even Point',
        definition: 'حجم المبيعات الذي عنده تتساوى الإيرادات مع التكاليف (لا ربح ولا خسارة).',
        formula: 'نقطة التعادل = التكاليف الثابتة / (السعر - التكلفة المتغيرة للوحدة)',
        interpretation: 'أي مبيعات فوق هذه النقطة = ربح، وتحتها = خسارة.',
        example: 'Break-even = 500 طلب/شهر يعني تحتاج 500 طلب لتصل للتعادل'
    },

    CAPEX: {
        term: 'النفقات الرأسمالية',
        abbr: 'CAPEX',
        definition: 'المصروفات على الأصول طويلة الأجل (معدات، مباني، تجهيزات) التي تُستخدم لعدة سنوات.',
        interpretation: 'هذه مصروفات لمرة واحدة عند بداية المشروع، ويتم إهلاكها سنوياً.',
        example: 'CAPEX = 1,000,000 ريال للمعدات والديكور'
    },

    OPEX: {
        term: 'المصروفات التشغيلية',
        abbr: 'OPEX',
        definition: 'المصروفات اليومية/الشهرية لتشغيل المشروع (رواتب، إيجار، كهرباء، مواد).',
        interpretation: 'هذه مصروفات متكررة شهرياً أو سنوياً.',
        example: 'OPEX = 80,000 ريال شهرياً (رواتب + إيجار + تشغيل)'
    },

    COGS: {
        term: 'تكلفة البضاعة المباعة',
        abbr: 'COGS',
        definition: 'التكلفة المباشرة لإنتاج السلع/الخدمات المباعة (مواد خام، تعبئة، عمالة مباشرة).',
        formula: 'COGS% = (تكلفة المنتج / سعر البيع) × 100',
        interpretation: 'للمطاعم: عادة 25-35%. أقل نسبة = هامش ربح أعلى.',
        example: 'وجبة سعرها 40 ريال وتكلفتها 12 ريال → COGS = 30%'
    },

    EBITDA: {
        term: 'الأرباح قبل الفوائد والضرائب والإهلاك والإطفاء',
        abbr: 'EBITDA',
        definition: 'مقياس للربح التشغيلي قبل احتساب تكاليف التمويل والضرائب والإهلاك.',
        formula: 'EBITDA = الإيرادات - المصروفات التشغيلية',
        interpretation: 'يعطي صورة واضحة عن الأداء التشغيلي للمشروع.',
        example: 'EBITDA = 200,000 ريال/سنة = ربح تشغيلي قبل المصروفات المالية'
    },

    TAM: {
        term: 'إجمالي السوق المتاح',
        abbr: 'TAM',
        definition: 'كل من يمكن أن يشتري المنتج/الخدمة في السوق كاملاً، دون أي قيود جغرافية أو تشغيلية.',
        interpretation: 'يعطي الصورة الكبرى لحجم الفرصة، لكنه ليس ما ستحصل عليه فعلياً.',
        example: 'لمقهى في الرياض: TAM = كل مستهلكي القهوة في الرياض'
    },

    SAM: {
        term: 'السوق القابل للخدمة',
        abbr: 'SAM',
        definition: 'الجزء من إجمالي السوق الذي يمكن الوصول إليه جغرافياً/تشغيلياً بإمكانياتك الحالية.',
        interpretation: 'أصغر من TAM — يعكس نطاق تغطيتك الفعلي (الموقع، القدرة، قنوات التوزيع).',
        example: 'لمقهى في الرياض: SAM = مستهلكو القهوة في الحي والأحياء المجاورة'
    },

    SOM: {
        term: 'الحصة السوقية الممكنة',
        abbr: 'SOM',
        definition: 'ما يمكن الفوز به واقعياً من السوق القابل للخدمة في السنوات الأولى، مع وجود المنافسة.',
        interpretation: 'هذا هو الرقم الذي تُبنى عليه توقعات الإيرادات — كن متحفظاً فيه.',
        example: 'لمقهى في الرياض: SOM = 5-10% من سكان الحي يزورونك شهرياً في أول سنتين'
    },

    ROI: {
        term: 'العائد على الاستثمار',
        abbr: 'ROI',
        definition: 'يقيس الأرباح أو العوائد المتحققة نسبةً إلى الاستثمار الإجمالي.',
        formula: 'ROI = (صافي الربح / الاستثمار الإجمالي) × 100',
        interpretation: 'كلما زادت النسبة، كلما كانت كفاءة استثمار الأموال أعلى.',
        example: 'ROI = 20% يعني أن كل 100 ريال مستثمرة تحقق ربحاً قدره 20 ريال.'
    },

    // تدقيق 2026-07-12: كانت مستدعاة من ZakatView عبر createTooltip('ZAKAT_BASE') وغير
    // معرَّفة هنا إطلاقاً، فتظهر أيقونة «؟» فارغة بلا محتوى بجانب صف الوعاء الزكوي.
    ZAKAT_BASE: {
        term: 'الوعاء الزكوي',
        abbr: 'Zakat Base',
        definition: 'الأساس الذي تُحسب عليه الزكاة، وهو الأعلى بين مصادر الأموال (حقوق الملكية والمخصصات طويلة الأجل ناقص الأصول الثابتة وما في حكمها) والربح المعدَّل زكوياً.',
        formula: 'الزكاة المستحقة = الوعاء الزكوي × 2.5% × نسبة الملكية السعودية',
        interpretation: 'يُحسب على الوعاء الزكوي وليس على الربح فقط — لذلك قد تُستحق الزكاة حتى في سنة خسارة إن كان مصدر الأموال موجباً.',
        example: 'وعاء زكوي 800,000 ريال بملكية سعودية 100% → زكاة السنة = 20,000 ريال'
    }
};

/**
 * Create a tooltip HTML element
 */
export function createTooltip(term, variant = 'info') {
    const glossary = FINANCIAL_TERMS[term];

    if (!glossary) {
        console.warn(`Term "${term}" not found in glossary`);
        return `<span class="tooltip-icon">؟</span>`;
    }

    return `
    <span class="tooltip-wrapper ${variant ? `tooltip-${variant}` : ''}">
      <span class="tooltip-icon">؟</span>
      <span class="tooltip-content">
        <strong>${glossary.term} (${glossary.abbr})</strong>
        <br><br>
        ${glossary.definition}
        ${glossary.formula ? `<br><br><span class="formula">${glossary.formula}</span>` : ''}
        ${glossary.interpretation ? `<br><br>💡 ${glossary.interpretation}` : ''}
        ${glossary.example ? `<br><br>📌 <em>${escapeHtml(glossary.example)}</em>` : ''}
      </span>
    </span>
  `;
}

/**
 * Wrap a term with tooltip
 */
export function wrapWithTooltip(text, term, variant = 'info') {
    const glossary = FINANCIAL_TERMS[term];

    if (!glossary) {
        return text;
    }

    return `
    <span class="tooltip-wrapper ${variant ? `tooltip-${variant}` : ''}">
      ${text}
      <span class="tooltip-content">
        <strong>${glossary.term} (${glossary.abbr})</strong>
        <br><br>
        ${glossary.definition}
        ${glossary.formula ? `<br><br><span class="formula">${glossary.formula}</span>` : ''}
        ${glossary.interpretation ? `<br><br>💡 ${glossary.interpretation}` : ''}
        ${glossary.example ? `<br><br>📌 <em>${escapeHtml(glossary.example)}</em>` : ''}
      </span>
    </span>
  `;
}

/**
 * أيقونة شرح مؤشر مالي موحّدة على نمط FieldHelp الوصولي (زر حقيقي + popover، aria،
 * يعمل باللمس والفأرة ولوحة المفاتيح) — بديل createTooltip/wrapWithTooltip القائمين
 * على :hover فقط (span غير قابل للتركيز، لا يعملان بنقرة واحدة على شاشة لمس).
 * تُستخدم في لوحة القرار والملخص التنفيذي واللوحة المالية الحية (تدقيق 2026-07-12).
 */
export function indicatorHelp(term) {
    const glossary = FINANCIAL_TERMS[term];
    if (!glossary) {
        console.warn(`Term "${term}" not found in glossary`);
        return '';
    }
    const parts = [`${glossary.term} (${glossary.abbr})`, glossary.definition];
    if (glossary.formula) parts.push(glossary.formula);
    if (glossary.interpretation) parts.push(glossary.interpretation);
    return fieldHelp(parts.join(' — '), glossary.example || '');
}

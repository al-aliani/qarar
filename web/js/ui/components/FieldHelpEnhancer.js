/**
 * يضمن وجود شرح سياقي بجانب كل خانة داخل خطوات الدراسة، بما فيها الشاشات
 * المتخصصة التي لا تمر عبر Wizard.renderField والجداول التي تتكرر صفوفها.
 * الشرح الخاص من fieldHelpTexts له الأولوية، ثم قواعد سياقية، ثم شرح واضح آمن.
 */

import { getFieldHelp } from '../../core/fieldHelpTexts.js';
import { fieldHelp } from './FieldHelp.js';

const CONTROL_SELECTOR = 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select';
const HELP_MARKER_SELECTOR = '.field-help, .tooltip-icon[title], .tooltip-auditor[title], .tooltip-wrapper';
const CHOICE_WORDS = new Set(['نعم', 'لا', 'غير متأكد']);

const CONTEXT_RULES = [
    {
        match: /اسم المشروع|project.?name|field-name\b/i,
        help: 'اكتب الاسم الذي تريد أن يظهر في الدراسة والتقارير الرسمية.',
        example: 'مثال: مقهى رواق الرياض'
    },
    {
        match: /وصف المشروع|description|نبذة|overview/i,
        help: 'لخّص نشاط المشروع وما يقدمه ولمن، بجملة أو جملتين واضحتين.',
        example: 'مثال: مقهى مختص يخدم موظفي الحي ويقدم طلبات سريعة.'
    },
    {
        match: /مدينة|منطقة|حي|district|city|region|عنوان|address|موقع/i,
        help: 'حدد الموقع المقصود بدقة لأن الإيجار والطلب والرواتب والمنافسة تختلف حسب المنطقة.',
        example: 'مثال: الرياض، حي الياسمين، شارع أنس بن مالك'
    },
    {
        match: /نوع النشاط|concept|نشاط المشروع/i,
        help: 'اختر أو اكتب النشاط الرئيسي الذي سيحقق منه المشروع معظم إيراداته.',
        example: 'مثال: مقهى مختص، متجر إلكتروني، خدمات صيانة'
    },
    {
        match: /تاريخ|شهر البدء|مدة|timeline|start|end|duration/i,
        help: 'أدخل التوقيت الواقعي للتنفيذ؛ سيُستخدم في خطة الإطلاق والتدفقات النقدية.',
        example: 'اترك هامشاً للتراخيص والتجهيز قبل بدء التشغيل.'
    },
    {
        match: /عميل|عملاء|شريحة|customer|segment|سكان|population/i,
        help: 'حدد العميل أو العدد المتوقع بناءً على سوقك الفعلي، لا على أفضل حالة ممكنة.',
        example: 'مثال: 120 عميلاً شهرياً من موظفي المنطقة'
    },
    {
        match: /سوق|طلب|عرض|حصة|market|demand|supply|tam|sam|som/i,
        help: 'أدخل تقديراً موثقاً للسوق أو الطلب، واذكر المصدر في الملاحظات متى أمكن.',
        example: 'استخدم بيانات رسمية أو مقابلات ميدانية أو أرقام منافسين قابلة للتحقق.'
    },
    {
        match: /منافس|competition|competitor|ميزة تنافسية/i,
        help: 'قارن بمنافس حقيقي يخدم العميل نفسه، ودوّن المعلومة التي تستطيع إثباتها.',
        example: 'مثال: السعر، الموقع، الجودة، سرعة الخدمة، الحصة السوقية'
    },
    {
        match: /إيراد|مبيعات|revenue|sales/i,
        help: 'أدخل الإيراد المتوقع أو الفعلي للفترة المحددة، قبل خصم المصروفات.',
        example: 'الإيراد = عدد الوحدات المباعة × سعر الوحدة'
    },
    {
        match: /سعر|price|متوسط فاتورة|ticket/i,
        help: 'أدخل سعر البيع للعميل قبل الخصومات، وبنفس العملة المستخدمة في الدراسة.',
        example: 'مثال: 35 ريالاً للوحدة'
    },
    {
        match: /تكلفة|مصروف|راتب|salary|cost|expense|amount|مبلغ|رسوم|ميزانية/i,
        help: 'أدخل التكلفة الواقعية للفترة الموضحة، وتأكد هل هي شهرية أم سنوية أم مرة واحدة.',
        example: 'اعتمد عرض سعر أو فاتورة حديثة كلما أمكن.'
    },
    {
        match: /كمية|عدد|quantity|count|وحدات|مقاعد|موظفين/i,
        help: 'أدخل العدد الفعلي أو المتوقع لهذا البند فقط، دون جمع بنود مختلفة في خانة واحدة.',
        example: 'مثال: 3 أجهزة أو 5 موظفين'
    },
    {
        match: /نسبة|معدل|%|٪|rate|percent|growth|نمو/i,
        help: 'أدخل النسبة المئوية كما تظهر في الخانة، وتحقق من الفترة التي تقيسها.',
        example: 'مثال: أدخل 10 عندما تكون النسبة 10٪'
    },
    {
        match: /تمويل|قرض|فائدة|سداد|equity|loan|funding|dscr|wacc/i,
        help: 'أدخل شرط التمويل المتفق عليه أو المتوقع بدقة لأنه يؤثر مباشرة في السيولة والجدوى.',
        example: 'راجع عرض البنك أو الممول قبل اعتماد القيمة.'
    },
    {
        match: /ملكية|سعودية|أجنبية|زكاة|ضريبة|tax|ownership|legal.?form|كيان قانوني|نوع المنشأة/i,
        help: 'اختر الوضع النظامي الفعلي للمشروع؛ تُستخدم هذه المعلومة في حساب الزكاة أو الضريبة والمتطلبات القانونية.',
        example: 'إن لم يُحسم الكيان بعد، اختر الأقرب ثم راجعه مع مختص.'
    },
    {
        match: /خطر|احتمال|أثر|impact|risk|mitigation|مواجهة/i,
        help: 'قدّر الخطر بواقعية وحدد أثره وطريقة عملية لتقليله أو التعامل معه.',
        example: 'مثال: تأخر التوريد — أثر عالٍ — مورد بديل بعقد مسبق'
    },
    {
        match: /هدف|مؤشر|قياس|target|indicator|kpi/i,
        help: 'اكتب هدفاً أو مؤشراً يمكن قياسه برقم وفترة زمنية ومسؤول واضح.',
        example: 'مثال: الوصول إلى 100 طلب يومياً خلال 6 أشهر'
    },
    {
        match: /منتج|خدمة|service|product/i,
        help: 'عرّف المنتج أو الخدمة كما يشتريها العميل، وافصل الأنواع المختلفة في صفوف مستقلة.',
        example: 'مثال: اشتراك شهري، وجبة غداء، جلسة استشارة'
    },
    {
        match: /مورد|شريك|supplier|partner/i,
        help: 'اكتب الجهة ودورها وما الذي ستوفره للمشروع، مع بديل عند الإمكان.',
        example: 'مثال: مورد البن الرئيسي — توريد أسبوعي — بديل محلي متاح'
    },
    {
        match: /ملاحظات|notes|سبب|تبرير|شرح|خلاصة/i,
        help: 'دوّن هنا المصدر أو السبب أو أي معلومة تساعد على مراجعة الرقم لاحقاً.',
        example: 'مثال: عرض سعر بتاريخ حديث أو رابط التقرير المستخدم'
    }
];

function cleanText(value) {
    return String(value || '')
        .replace(/\s*[؟?!*]+\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function elementText(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll(`${HELP_MARKER_SELECTOR}, input, textarea, select, button, .field-hint`).forEach(node => node.remove());
    return cleanText(clone.textContent);
}

function explicitLabel(root, control) {
    if (!control.id) return null;
    return [...root.querySelectorAll('label')].find(label => label.htmlFor === control.id) || null;
}

function labelledBy(root, control) {
    const ids = (control.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    for (const id of ids) {
        const element = root.ownerDocument.getElementById(id);
        if (element && root.contains(element)) return element;
    }
    return null;
}

function tableHeader(control) {
    const cell = control.closest('td');
    const table = control.closest('table');
    if (!cell || !table || !cell.parentElement) return null;
    const index = [...cell.parentElement.children].indexOf(cell);
    return index >= 0 ? table.querySelectorAll('thead th')[index] || null : null;
}

function groupQuestion(control) {
    const group = control.closest('.yesno-group, [role="radiogroup"], [role="group"], fieldset');
    if (!group) return null;
    const labelled = group.getAttribute('aria-labelledby');
    if (labelled) return group.ownerDocument.getElementById(labelled);
    const fieldset = group.closest('fieldset');
    if (fieldset) return fieldset.querySelector('legend');
    const parent = group.parentElement;
    return parent ? [...parent.children].find(child => child.tagName === 'LABEL' && !child.contains(control)) || null : null;
}

function resolveTarget(root, control) {
    if (control.matches('input[type="radio"], input[type="checkbox"]')) {
        const question = groupQuestion(control);
        if (question) return question;
    }

    const direct = explicitLabel(root, control) || labelledBy(root, control);
    if (direct && !CHOICE_WORDS.has(elementText(direct))) return direct;

    const header = tableHeader(control);
    if (header) return header;

    const wrapping = control.closest('label');
    if (wrapping && !CHOICE_WORDS.has(elementText(wrapping))) return wrapping;

    const formGroup = control.closest('.form-group, .field-group, .idea-field, .bm-block, .card');
    if (formGroup) {
        const candidate = formGroup.querySelector('label, legend, .bm-label, .form-label, h4');
        if (candidate && !candidate.contains(control)) return candidate;
    }
    return null;
}

function controlKey(control) {
    return cleanText(
        control.dataset.key ||
        control.dataset.field ||
        control.dataset.path ||
        control.name ||
        control.id
    ).replace(/^(field-|inp-?)/i, '');
}

function contextualHelp(control, label) {
    const key = controlKey(control);
    const registered = getFieldHelp(key);
    if (registered) return registered;

    const haystack = `${key} ${label} ${control.placeholder || ''}`;
    const rule = CONTEXT_RULES.find(entry => entry.match.test(haystack));
    if (rule) return { help: rule.help, example: rule.example };

    const subject = label || control.getAttribute('aria-label') || control.placeholder || 'هذه الخانة';
    let verb = 'اكتب';
    if (control.tagName === 'SELECT') verb = 'اختر';
    else if (control.type === 'number' || control.type === 'range') verb = 'أدخل القيمة الرقمية لـ';
    else if (control.type === 'date' || control.type === 'month') verb = 'اختر تاريخ';
    else if (control.type === 'radio' || control.type === 'checkbox') verb = 'حدد ما إذا كان ينطبق';

    const placeholder = cleanText(control.placeholder).replace(/^مثال\s*[:：-]?\s*/i, '');
    return {
        help: `${verb} ${subject} بما يطابق واقع مشروعك. ستظهر المعلومة في التحليل أو التقرير المرتبط بهذه الخطوة.`,
        example: placeholder ? `مثال: ${placeholder}` : 'استخدم معلومة قابلة للتحقق، ويمكنك تعديلها لاحقاً.'
    };
}

function connectDescription(control, helpElement) {
    const tooltip = helpElement?.querySelector('.field-help-pop');
    if (!tooltip?.id) return;
    const current = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!current.includes(tooltip.id)) current.push(tooltip.id);
    control.setAttribute('aria-describedby', current.join(' '));
}

function appendHelp(control, target, entry) {
    const holder = document.createElement('span');
    holder.innerHTML = fieldHelp(entry.help, entry.example);
    const helpElement = holder.firstElementChild;
    if (!helpElement) return null;

    if (target) {
        target.appendChild(helpElement);
    } else {
        helpElement.classList.add('field-help--standalone');
        control.insertAdjacentElement('beforebegin', helpElement);
    }
    connectDescription(control, helpElement);
    return helpElement;
}

/** يضيف المساعدة للخانات الموجودة حالياً، ويُرجع إحصاءً مفيداً للاختبارات. */
export function enhanceFieldHelp(container) {
    if (!container) return { total: 0, covered: 0, added: 0 };
    const controls = [...container.querySelectorAll(CONTROL_SELECTOR)];
    let covered = 0;
    let added = 0;

    for (const control of controls) {
        if (control.dataset.fieldHelpCovered === 'true') {
            covered++;
            continue;
        }

        const target = resolveTarget(container, control);
        const existing = target?.querySelector(HELP_MARKER_SELECTOR);
        if (existing) {
            connectDescription(control, existing.closest('.field-help') || existing);
        } else {
            const label = elementText(target) || cleanText(control.getAttribute('aria-label')) || cleanText(control.placeholder);
            appendHelp(control, target, contextualHelp(control, label));
            added++;
        }
        control.dataset.fieldHelpCovered = 'true';
        covered++;
    }

    return { total: controls.length, covered, added };
}

/** يغطّي الصفوف والخانات التي تضاف لاحقاً داخل الخطوة بدون إعادة ربط يدوي. */
export function observeFieldHelp(container, options = {}) {
    if (!container || typeof MutationObserver === 'undefined') return () => {};
    let scheduled = false;
    const isActive = options.isActive || (() => true);
    const run = () => {
        scheduled = false;
        if (isActive()) enhanceFieldHelp(container);
    };
    const observer = new MutationObserver(() => {
        if (scheduled || !isActive()) return;
        scheduled = true;
        queueMicrotask(run);
    });
    observer.observe(container, { childList: true, subtree: true });
    if (isActive()) enhanceFieldHelp(container);
    return () => observer.disconnect();
}

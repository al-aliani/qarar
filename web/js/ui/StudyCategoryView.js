import { calculateStudy as runFullModel } from '../core/engine.js';
import { STEPS } from '../core/wizardSteps.js';
import { enhanceFieldHelp } from './components/FieldHelpEnhancer.js';
import { Wizard } from './Wizard.js';
import { renderStepComponent } from './stepComponentRegistry.js';
import { trackEvent } from '../utils/analytics.js';
import { captureFocusOwner, restoreFocusAfterRerender } from '../utils/focusRestore.js';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

/**
 * يعرض جميع أقسام التصنيف في صفحة واحدة. تظل معرّفات الأقسام الـ41 وبياناتها
 * كما هي؛ التغيير في طريقة العرض والتنقل فقط.
 */
export class StudyCategoryView {
    constructor(containerId, store, tableSchemas, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.tableSchemas = tableSchemas;
        this.steps = options.steps || STEPS;
        this.categories = options.categories || [];
        this.onNavigateCategory = options.onNavigateCategory || (() => {});
        this.onGoHome = options.onGoHome || (() => {});
        this.progressTracker = options.progressTracker || null;
        this.visibleStepIndexes = null;
        // فهارس التصنيفات غير الفارغة في الوضع الحالي (مصغّر/بسيط) — null = كلها ظاهرة.
        this.visibleCategoryIndexes = null;
        this.instances = [];
        this.currentCategoryIndex = 0;
        this._navPrev = null;
        this._navNext = null;
    }

    setVisibleStepIndexes(indexes) {
        this.visibleStepIndexes = Array.isArray(indexes) ? new Set(indexes) : null;
    }

    setVisibleCategoryIndexes(indexes) {
        this.visibleCategoryIndexes = Array.isArray(indexes) && indexes.length ? indexes.slice() : null;
    }

    /** أقرب تصنيف ظاهر قبل/بعد التصنيف المعطى (أو null إن لا يوجد) — يتخطى الفارغة. */
    _adjacentVisibleCategory(categoryIndex, direction) {
        const vis = this.visibleCategoryIndexes;
        if (!vis) {
            const target = categoryIndex + direction;
            return target >= 0 && target < this.categories.length ? target : null;
        }
        return direction < 0
            ? [...vis].reverse().find(c => c < categoryIndex) ?? null
            : vis.find(c => c > categoryIndex) ?? null;
    }

    categoryStepIndexes(category) {
        const indexes = [];
        for (let index = category.range[0]; index <= category.range[1]; index++) {
            if (!this.visibleStepIndexes || this.visibleStepIndexes.has(index)) indexes.push(index);
        }
        return indexes;
    }

    async render(categoryIndex, options = {}) {
        const category = this.categories[categoryIndex];
        if (!this.container || !category) return false;
        this.currentCategoryIndex = categoryIndex;
        this.instances = [];
        // أهداف «السابق/التالي» = أقرب تصنيف ظاهر (يتخطى الفارغة في مصغّر/بسيط).
        this._navPrev = this._adjacentVisibleCategory(categoryIndex, -1);
        this._navNext = this._adjacentVisibleCategory(categoryIndex, +1);

        const stepIndexes = this.categoryStepIndexes(category);
        // ترقيم «التصنيف X من Y» يعكس تصنيفات الوضع الحالي الظاهرة فعلياً (مصغّر/بسيط
        // تُخفيان تصنيفات فارغة تماماً) بدل الإجمالي المطلق دوماً — نفس visibleCategoryIndexes
        // المستخدم أصلاً لتخطي التصنيفات الفارغة في تنقّل السابق/التالي، فلا ينحرف الرقمان
        // المعروضان (رأس الصفحة هنا وشريط المراحل في الهيدر) عن بعضهما (تحقّق 2026-07-15).
        // بلا visibleCategoryIndexes (لم يُستدعَ setVisibleCategoryIndexes بعد): يبقى السلوك
        // القديم (ترقيم مطلق من كل التصنيفات) كما هو تماماً.
        const visibleCatPosition = this.visibleCategoryIndexes ? this.visibleCategoryIndexes.indexOf(categoryIndex) : -1;
        const categoryNumber = (visibleCatPosition >= 0 ? visibleCatPosition + 1 : categoryIndex + 1).toLocaleString('ar-SA');
        const categoryTotal = (this.visibleCategoryIndexes ? this.visibleCategoryIndexes.length : this.categories.length).toLocaleString('ar-SA');
        // ترقيم «الخطوة X من Y» (رأس كل قسم أدناه + شارة رقمه في فهرس الأقسام أعلى
        // الصفحة) بنفس مبدأ ترقيم «التصنيف X من Y» أعلاه بالضبط: يعكس خطوات الوضع
        // الحالي الظاهرة فعلياً (مصغّر=7، بسيط=23، مفصّل=40 بعد استبعاد الخطوتين
        // المُمتصّتين بصرياً في OperatingCostsView) بدل إجمالي STEPS المطلق (42) دوماً
        // — قرار صاحب المنتج 2026-07-15. visibleStepIndexes نفسه المستخدم أصلاً في
        // categoryStepIndexes() لتصفية الأقسام الظاهرة، فلا مصدر ثانٍ للحقيقة، ولا
        // ينحرف رقم شارة الفهرس عن رقم رأس نفس القسم أدناه. الفهرسة الداخلية
        // (id="category-section-N"/data-step-index) تبقى مطلقة كما هي — التغيير في
        // الرقم المعروض فقط. بلا visibleStepIndexes (لم يُستدعَ setVisibleStepIndexes
        // بعد): يبقى السلوك القديم (ترقيم مطلق من كل الخطوات) كما هو تماماً.
        const visibleStepOrder = this.visibleStepIndexes ? [...this.visibleStepIndexes].sort((a, b) => a - b) : null;
        const stepTotal = (visibleStepOrder ? visibleStepOrder.length : this.steps.length).toLocaleString('ar-SA');
        const stepPosition = (idx) => {
            const pos = visibleStepOrder ? visibleStepOrder.indexOf(idx) : -1;
            return (pos >= 0 ? pos + 1 : idx + 1).toLocaleString('ar-SA');
        };
        // مبدّل نمط العرض (أساسي/متقدم) في رأس الصفحة — الوسيلة الظاهرة الوحيدة لضبط
        // localStorage.study_mode_preference بعد إخفاء الشريط الجانبي (Sidebar.js) نهائياً
        // عبر main.css. نفس المفتاح/القيم المستهلكة فعلاً في DynamicTable.js/Wizard.js.
        const currentMode = (this.store?.getState && this.store.getState()) || (this.store?.get && this.store.get()) || {};
        const activeMode = currentMode.appSettings?.mode || localStorage.getItem('study_mode_preference') || 'advanced';
        const modeToggleHTML = `
            <div class="category-mode-toggle" role="group" aria-label="نمط الدراسة">
                <button type="button" class="category-mode-toggle__btn ${activeMode === 'quick' ? 'is-active' : ''}" data-mode="quick" title="إخفاء التفاصيل المعقدة (للمبتدئين)" aria-pressed="${activeMode === 'quick'}">أساسي</button>
                <button type="button" class="category-mode-toggle__btn ${activeMode === 'advanced' ? 'is-active' : ''}" data-mode="advanced" title="عرض كافة التحليلات (للمستشارين)" aria-pressed="${activeMode === 'advanced'}">متقدم</button>
            </div>`;
        // الانتقال الفعلي الذي يراه المستخدم هو «تصنيف ⟶ تصنيف»: زرّا التصنيف
        // السابق/التالي أدناه داخل this.container، والسطر التالي يستبدله بالكامل —
        // فيُتلف الزرّ المُركَّز عليه ويسقط التركيز إلى <body>. نلتقطه قبل الإتلاف
        // ونعيده إلى عنوان التصنيف الجديد بعده (راجع utils/focusRestore.js).
        const focusOwner = captureFocusOwner(this.container);
        this.container.innerHTML = `
            <div class="category-page" data-category-index="${categoryIndex}">
                <header class="category-page__header">
                    <div>
                        <span class="category-page__eyebrow">التصنيف ${categoryNumber} من ${categoryTotal}</span>
                        <h2 id="categoryPageHeading" tabindex="-1">${category.label}</h2>
                        <p>${this.categoryDescription(category.id)}</p>
                    </div>
                    ${modeToggleHTML}
                </header>

                <div class="category-page__sections${stepIndexes.some(index => this.steps[index].gridSize) ? ' category-page__sections--adaptive' : ''}">
                    ${stepIndexes.length ? stepIndexes.map(index => {
                        const step = this.steps[index];
                        return `
                        <section class="category-step" id="category-section-${index}" data-step-index="${index}"${step.gridSize ? ` data-size="${step.gridSize}"` : ''}>
                            <div class="category-step__meta">
                                ${step.icon ? icon(step.icon) : ''}
                                <div class="category-step__number">الخطوة ${stepPosition(index)} من ${stepTotal}</div>
                                ${step.stepType ? `<span class="category-step__type">${step.stepType}</span>` : ''}
                            </div>
                            <div id="category-step-content-${index}" class="category-step__content" tabindex="-1"></div>
                        </section>
                    `;
                    }).join('') : '<div class="empty-state">لا توجد أقسام ظاهرة في هذا التصنيف ضمن وضع العرض الحالي.</div>'}
                </div>

                <footer class="category-page__nav">
                    <button type="button" class="btn btn--secondary" data-category-prev ${this._navPrev === null ? 'disabled' : ''}>التصنيف السابق</button>
                    <span>${category.label}</span>
                    <button type="button" class="btn btn--primary" data-category-next ${this._navNext === null ? 'disabled' : ''}>التصنيف التالي</button>
                </footer>
            </div>
        `;

        this.bindCategoryEvents(categoryIndex);
        // فوراً بعد الاستبدال لا بعد انتهاء رسم الأقسام: العنوان موجود الآن، ورسم
        // الأقسام أدناه متسلسل بفسحات setTimeout قد تمتد ثوانيَ يبقى فيها التركيز ضائعاً.
        restoreFocusAfterRerender(focusOwner, this.container.querySelector('#categoryPageHeading'));
        // تدقيق أداء 2026-07-11: Promise.all كانت ترسم كل خطوات التصنيف دفعة واحدة
        // متزامنة — وأثقلها (تحليل الخدمات: ~14 تشغيلة محرّك مالي متداخلة) يحجب رسم
        // البقية بالكامل حتى ينتهي، فتبقى الصفحة فارغة طوال تلك المدة. حلقة متسلسلة
        // مع فسحة بين كل خطوة تتيح للمتصفح رسم كل قسم فور جهوزيته بدل انتظار الأبطأ،
        // وتتحقق من تقادم الطلب بين كل خطوة فتوفّر عملاً مهدوراً عند تنقّل سريع.
        // ملاحظة سلامة (تحقّق حي 2026-07-11): استُخدم setTimeout لا requestAnimationFrame
        // للفسحة — rAF لا يُطلَق إطلاقاً في تبويب مخفي (document.hidden)، فيُعلّق الحلقة
        // للأبد ويمنع رسم بقية الخطوات؛ setTimeout مستقل عن الرؤية.
        for (const index of stepIndexes) {
            if (options.isCurrent && !options.isCurrent()) return false;
            await this.renderStepInto(index, options);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (options.isCurrent && !options.isCurrent()) return false;

        this.container.querySelectorAll('.category-step__content').forEach(content => {
            enhanceFieldHelp(content);
            // Initialize Tippy.js for all categories globally
            tippy(content.querySelectorAll('.field-help-icon, .tooltip-icon, .field-help'), {
                content: (reference) => reference.getAttribute('title'),
                theme: 'light-border',
                arrow: true,
                animation: 'fade',
                onMount(instance) {
                    instance.reference.removeAttribute('title');
                }
            });
        });
        
        this.removeChildNavigation();

        const focusIndex = Number.isInteger(options.focusStepIndex) ? options.focusStepIndex : null;
        if (focusIndex != null && stepIndexes.includes(focusIndex) && focusIndex !== stepIndexes[0]) {
            requestAnimationFrame(() => document.getElementById(`category-section-${focusIndex}`)?.scrollIntoView({ block: 'start' }));
        }

        // Onboarding Tour (Category 0)
        if (categoryIndex === 0 && !localStorage.getItem('tour_category0_seen')) {
            localStorage.setItem('tour_category0_seen', 'true');
            setTimeout(() => {
                const driverObj = driver({
                    showProgress: true,
                    // نص التقدّم الافتراضي للمكتبة "{{current}} of {{total}}" كان يظهر
                    // بالإنجليزية وسط فقاعة عربية بالكامل (تحقق حي 2026-07-15). progressText
                    // هو خيار driver.js 1.7.0 الفعلي لتخصيصه (راجع dist/driver.js.mjs).
                    progressText: '{{current}} من {{total}}',
                    doneBtnText: 'بدء الدراسة',
                    nextBtnText: 'التالي',
                    prevBtnText: 'السابق',
                    // زر الإغلاق (×) ليس له خيار تهيئة مباشر لنصه/aria-label في driver.js
                    // 1.7.0 — المكتبة تكتب aria-label="Close" مباشرة داخل createElement
                    // (dist/driver.js.mjs). onPopoverRender هو الـhook الموثّق للوصول إلى
                    // عناصر الفقاعة الفعلية بعد الرسم وتعديلها (closeButton هنا).
                    onPopoverRender: (popover) => {
                        popover.closeButton.setAttribute('aria-label', 'إغلاق');
                    },
                    steps: [
                        { element: '.category-page__header', popover: { title: 'مرحباً بك في دراستك!', description: 'هذه المرحلة مخصصة لتعريف مشروعك بشكل صحيح قبل الدخول في الأرقام.', side: "bottom" }},
                        { element: '[data-category-next]', popover: { title: 'المرحلة التالية', description: 'بعد الانتهاء من أقسام هذه الصفحة، اضغط هنا للانتقال للمرحلة التالية.', side: "top" }}
                    ]
                });
                driverObj.drive();
            }, 1000);
        }

        return true;
    }

    categoryDescription(id) {
        const descriptions = {
            setup: 'عرّف المشروع واختبر الفكرة وحدد ما ستقدمه قبل الدخول في الأرقام.',
            marketing: 'قدّر السوق والطلب والمنافسة ثم حوّلها إلى مصادر إيراد قابلة للحساب.',
            technical: 'حدد الأصول والتشغيل والفريق والموارد والمتطلبات القانونية.',
            advanced: 'حوّل المتطلبات إلى مراحل تنفيذ واضحة قبل بناء خطة التمويل.',
            financial: 'اضبط الافتراضات والتمويل وراجع القوائم والجدوى والتقييم.',
            strategic: 'اختبر قدرة المشروع على الصمود أمام السيناريوهات والتغيرات.',
            appendices: 'اربط الأرقام بأدلة قابلة للمراجعة مثل المصادر وعروض الأسعار.',
            results: 'راجع المؤشرات والقرار وابنِ التقرير ثم تابع الأداء بعد الإطلاق.'
        };
        return descriptions[id] || '';
    }

    bindCategoryEvents(categoryIndex) {
        this.container.querySelector('[data-category-prev]')?.addEventListener('click', () => {
            if (this._navPrev !== null) this.onNavigateCategory(this._navPrev);
        });
        this.container.querySelector('[data-category-next]')?.addEventListener('click', () => {
            if (this._navNext !== null) this.onNavigateCategory(this._navNext);
        });

        // مبدّل نمط العرض: يكتب localStorage.study_mode_preference أولاً (تقرؤه نسخ
        // DynamicTable/Wizard الجديدة في مُنشئها)، ثم يحدّث appSettings.mode عبر الستور
        // — نفس مسار Sidebar.js/applyMode القائم فعلاً في app.js الذي يعيد رسم صفحة
        // التصنيف الحالية حياً (navigateToCategory) دون إعادة تحميل الصفحة.
        this.container.querySelectorAll('.category-mode-toggle__btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                if (!mode) return;
                localStorage.setItem('study_mode_preference', mode);
                const state = (this.store?.getState && this.store.getState()) || (this.store?.get && this.store.get()) || {};
                this.store.update('appSettings', { ...(state.appSettings || {}), mode });
            });
        });
    }

    removeChildNavigation() {
        this.container.querySelectorAll('.category-step .wizard-nav, .category-step .wizard-completion').forEach(element => element.remove());
    }

    navigateFromChild(targetStepIndex) {
        const currentCategory = this.categories[this.currentCategoryIndex];
        if (targetStepIndex >= currentCategory.range[0] && targetStepIndex <= currentCategory.range[1]) {
            document.getElementById(`category-section-${targetStepIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        const targetCategory = this.categories.findIndex(category => targetStepIndex >= category.range[0] && targetStepIndex <= category.range[1]);
        if (targetCategory >= 0) this.onNavigateCategory(targetCategory, targetStepIndex);
    }

    async renderStepInto(index, options) {
        const step = this.steps[index];
        const containerId = `category-step-content-${index}`;
        const onNavigate = target => this.navigateFromChild(target);
        // نسخة Wizard جديدة مربوطة بحاوية هذه الخطوة تحديداً — تُستدعى فقط عند
        // الحاجة (المسار العام أو isOfferingView/isOperatingCosts)، وتُبنى من جديد
        // كل رسم صفحة (نفس السلوك السابق: لا تخزين مؤقت للنسخ عبر صفحة الفئة).
        const wizardFactory = () => new Wizard(containerId, this.store, this.tableSchemas, {
            steps: this.steps,
            onNavigate,
            onGoHome: this.onGoHome
        });

        // موزّع «علَم الخطوة → المكوّن» موحَّد مع app.js عبر stepComponentRegistry.js
        // (تدقيق 2026-07-11) — سبق أن كانت هذه سلسلة if/else مستقلة عن app.js، وكانت
        // ناقصة isComparison/isLoanSchedule ونحوها؛ الآن كلاهما يستهلكان نفس القائمة.
        const { instance } = await renderStepComponent(step, containerId, index, {
            store: this.store,
            onNavigate,
            isCurrent: options.isCurrent || (() => true),
            cache: null,
            wizardFactory,
            runFullModel
        });

        if (instance) this.instances.push(instance);
        trackEvent('wizard_step_view', { stepId: step.id });
        if (index === 0) trackEvent('study_start', { stepId: step.id });
        if (index === this.steps.length - 1) trackEvent('study_complete', { stepId: step.id });
        const content = document.getElementById(containerId);
        if (content) enhanceFieldHelp(content);
    }
}

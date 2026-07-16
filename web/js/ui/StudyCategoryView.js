import { calculateStudy as runFullModel } from '../core/engine.js';
import { STEPS } from '../core/wizardSteps.js';
import { enhanceFieldHelp } from './components/FieldHelpEnhancer.js';
import { attachToolReport } from './components/ToolReport.js';
import { Wizard } from './Wizard.js';
import { renderStepComponent } from './stepComponentRegistry.js';
import { trackEvent } from '../utils/analytics.js';
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
        this.tocObserver = null;
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
        // عدّاد «أنجزت X من Y» من progressTracker الحي الموجود أصلاً في app.js (بند 2.3) —
        // محسوب فقط على أقسام هذا التصنيف، لا إجمالي الدراسة كاملة.
        const completedCount = this.progressTracker
            ? stepIndexes.filter(index => this.progressTracker.isCompleted(index)).length
            : 0;
        this.container.innerHTML = `
            <div class="category-page" data-category-index="${categoryIndex}">
                <header class="category-page__header">
                    <div>
                        <span class="category-page__eyebrow">التصنيف ${categoryNumber} من ${categoryTotal}</span>
                        <h2>${category.label}</h2>
                        <p>${this.categoryDescription(category.id)}</p>
                    </div>
                </header>

                <nav class="category-toc" aria-label="أقسام ${category.label}">
                    ${this.progressTracker && stepIndexes.length ? `
                        <span class="category-toc__progress">أنجزت <strong>${completedCount.toLocaleString('ar-SA')}</strong> من ${stepIndexes.length.toLocaleString('ar-SA')}</span>
                    ` : ''}
                    <div class="category-toc__links">
                        ${stepIndexes.map(index => `<a href="#category-section-${index}" data-category-anchor="${index}"><span>${stepPosition(index)}</span>${this.steps[index].label}</a>`).join('')}
                    </div>
                </nav>

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
        this.setupTocScrollSpy(stepIndexes);

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
                        { element: '.category-toc', popover: { title: 'أقسام المرحلة', description: 'يمكنك القفز المباشر لأي قسم من هنا. كل قسم يحفظ بياناتك تلقائياً.', side: "left" }},
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
        this.container.querySelectorAll('[data-category-anchor]').forEach(anchor => {
            anchor.addEventListener('click', event => {
                event.preventDefault();
                const index = Number(anchor.dataset.categoryAnchor);
                document.getElementById(`category-section-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    /**
     * تظليل رابط القسم النشط في .category-toc أثناء التمرير (scroll-spy). يُفصَل
     * المراقب القديم في بداية كل رسم (وقبل أي إرجاع مبكر عبر render()) كي لا يتراكم
     * أكثر من IntersectionObserver واحد حياً في آن واحد على نفس الصفحة.
     */
    setupTocScrollSpy(stepIndexes) {
        this.tocObserver?.disconnect();
        this.tocObserver = null;
        if (typeof IntersectionObserver === 'undefined' || !stepIndexes.length) return;

        const setActive = (index) => {
            this.container.querySelectorAll('.category-toc__links a[data-category-anchor]').forEach(anchor => {
                const isActive = Number(anchor.dataset.categoryAnchor) === index;
                anchor.classList.toggle('is-active', isActive);
                if (isActive) anchor.setAttribute('aria-current', 'true');
                else anchor.removeAttribute('aria-current');
            });
        };

        // النطاق الأعلى للـroot مُنكمَش بارتفاع الشريط اللاصق تقريباً كي لا يُحتسب قسم
        // كـ«مرئي» وهو لا يزال خلفه، والسفلي مُنكمَش بنسبة كبيرة كي يبقى دوماً قسم واحد
        // أو اثنان مرشّحين لا كل الأقسام معاً في صفحة طويلة.
        const visible = new Set();
        this.tocObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const index = Number(entry.target.dataset.stepIndex);
                if (entry.isIntersecting) visible.add(index);
                else visible.delete(index);
            });
            if (visible.size) setActive(Math.min(...visible));
        }, { root: null, rootMargin: '-120px 0px -65% 0px', threshold: 0 });

        stepIndexes.forEach(index => {
            const section = document.getElementById(`category-section-${index}`);
            if (section) this.tocObserver.observe(section);
        });
        setActive(stepIndexes[0]);
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
        const content = document.getElementById(containerId);
        if (content) enhanceFieldHelp(content);
        // خانة «إصدار تقرير» للأدوات التحليلية/المختلطة (تُتجاهل لخطوات الإدخال).
        attachToolReport(step, containerId, this.store);
    }
}

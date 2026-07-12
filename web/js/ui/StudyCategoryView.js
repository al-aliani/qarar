import { calculateStudy as runFullModel } from '../core/engine.js';
import { STEPS } from '../core/wizardSteps.js';
import { enhanceFieldHelp } from './components/FieldHelpEnhancer.js';
import { attachToolReport } from './components/ToolReport.js';
import { Wizard } from './Wizard.js';
import { renderStepComponent } from './stepComponentRegistry.js';

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
        this.visibleStepIndexes = null;
        this.instances = [];
        this.currentCategoryIndex = 0;
    }

    setVisibleStepIndexes(indexes) {
        this.visibleStepIndexes = Array.isArray(indexes) ? new Set(indexes) : null;
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

        const stepIndexes = this.categoryStepIndexes(category);
        const categoryNumber = (categoryIndex + 1).toLocaleString('ar-SA');
        const categoryTotal = this.categories.length.toLocaleString('ar-SA');
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
                    ${stepIndexes.map(index => `<a href="#category-section-${index}" data-category-anchor="${index}"><span>${(index + 1).toLocaleString('ar-SA')}</span>${this.steps[index].label}</a>`).join('')}
                </nav>

                <div class="category-page__sections">
                    ${stepIndexes.length ? stepIndexes.map(index => `
                        <section class="category-step" id="category-section-${index}" data-step-index="${index}">
                            <div class="category-step__number">القسم ${(index + 1).toLocaleString('ar-SA')} من ${this.steps.length.toLocaleString('ar-SA')}</div>
                            <div id="category-step-content-${index}" class="category-step__content" tabindex="-1"></div>
                        </section>
                    `).join('') : '<div class="empty-state">لا توجد أقسام ظاهرة في هذا التصنيف ضمن وضع العرض الحالي.</div>'}
                </div>

                <footer class="category-page__nav">
                    <button type="button" class="btn btn--secondary" data-category-prev ${categoryIndex === 0 ? 'disabled' : ''}>التصنيف السابق</button>
                    <span>${category.label}</span>
                    <button type="button" class="btn btn--primary" data-category-next ${categoryIndex === this.categories.length - 1 ? 'disabled' : ''}>التصنيف التالي</button>
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

        this.container.querySelectorAll('.category-step__content').forEach(content => enhanceFieldHelp(content));
        this.removeChildNavigation();

        const focusIndex = Number.isInteger(options.focusStepIndex) ? options.focusStepIndex : null;
        if (focusIndex != null && stepIndexes.includes(focusIndex) && focusIndex !== stepIndexes[0]) {
            requestAnimationFrame(() => document.getElementById(`category-section-${focusIndex}`)?.scrollIntoView({ block: 'start' }));
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
        this.container.querySelector('[data-category-prev]')?.addEventListener('click', () => this.onNavigateCategory(categoryIndex - 1));
        this.container.querySelector('[data-category-next]')?.addEventListener('click', () => this.onNavigateCategory(categoryIndex + 1));
        this.container.querySelectorAll('[data-category-anchor]').forEach(anchor => {
            anchor.addEventListener('click', event => {
                event.preventDefault();
                const index = Number(anchor.dataset.categoryAnchor);
                document.getElementById(`category-section-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        const content = document.getElementById(containerId);
        if (content) enhanceFieldHelp(content);
        // خانة «إصدار تقرير» للأدوات التحليلية/المختلطة (تُتجاهل لخطوات الإدخال).
        attachToolReport(step, containerId, this.store);
    }
}

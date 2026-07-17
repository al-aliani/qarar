/**
 * Progress Tracker
 * Tracks user progress through the feasibility study wizard
 */
import { createEmptyStudy } from '../core/schema.js';

// حقول تقنية بحتة (معرّف/طوابع زمنية) قد تُحقَن داخل أي قسم عبر مسارات الحفظ/المزامنة
// (مثال حي 2026-07-15: store.js._syncToCloud تكتب state.projectInfo.id تلقائياً لأول
// مزامنة سحابية، فتُظهر خطوة «معلومات المشروع» كمكتملة رغم عدم كتابة المستخدم لحرف
// واحد) — لا تعكس إدخال مستخدم فتُستبعد من مقارنة "هل يختلف القسم عن دراسة فارغة؟"،
// بنفس قائمة التجاهل المستخدمة في hasMeaningfulUnsavedChanges بـapp.js.
const IGNORED_BOOKKEEPING_KEYS = new Set(['id', 'createdAt', 'updatedAt']);

function normalizeSection(value) {
    return JSON.stringify(value, (key, val) => (IGNORED_BOOKKEEPING_KEYS.has(key) ? undefined : val));
}

export class ProgressTracker {
    constructor(totalSteps) {
        this.totalSteps = totalSteps;
        this.currentStep = 0;
        this.completedSteps = new Set();
        this.manualCompletedSteps = new Set();
    }

    /**
     * Update current step
     */
    setCurrentStep(stepIndex) {
        this.currentStep = stepIndex;
        return this.getProgress();
    }

    /**
     * Mark a step as completed
     */
    markCompleted(stepIndex) {
        this.manualCompletedSteps.add(stepIndex);
        this.completedSteps.add(stepIndex);
        return this.getProgress();
    }

    /**
     * Check if step is completed
     */
    isCompleted(stepIndex) {
        return this.completedSteps.has(stepIndex);
    }

    /**
     * Get progress percentage
     */
    getProgress() {
        let percentage = (this.completedSteps.size / this.totalSteps) * 100;
        percentage = Math.min(percentage, 100);
        return {
            percentage: Math.round(percentage),
            completed: this.completedSteps.size,
            total: this.totalSteps,
            current: this.currentStep
        };
    }

    /**
     * Render progress bar HTML
     */
    render() {
        const progress = this.getProgress();

        return `
      <div class="progress-container">
        <div class="progress-info">
          <span class="progress-text">تقدم الدراسة</span>
          <span class="progress-percentage">${progress.percentage}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress.percentage}%"></div>
        </div>
        <div class="progress-milestones">
          <span class="progress-milestone ${progress.percentage >= 25 ? 'achieved' : ''}">25%</span>
          <span class="progress-milestone ${progress.percentage >= 50 ? 'achieved' : ''}">50%</span>
          <span class="progress-milestone ${progress.percentage >= 75 ? 'achieved' : ''}">75%</span>
          <span class="progress-milestone ${progress.percentage === 100 ? 'achieved' : ''}">100%</span>
        </div>
      </div>
    `;
    }

    /**
     * Render compact version for sidebar — صف رفيع واحد داخل بطاقة الحالة المدمجة
     * (الفئات status-row/track/fill/value معرّفة في chrome-declutter.css)
     */
    renderCompact() {
        const progress = this.getProgress();
        const currentDisplay = typeof progress.current === 'number' ? progress.current + 1 : 1;
        const stepLabel = `الخطوة ${currentDisplay} من ${progress.total}`;
        return `
      <div class="progress-widget status-row" role="status" aria-label="${stepLabel} — ${progress.percentage}%">
        <span class="status-label">${stepLabel}</span>
        <span class="status-track" aria-hidden="true"><span class="status-fill" style="width:${progress.percentage}%"></span></span>
        <span class="status-value">${progress.percentage}%</span>
      </div>`;
    }

    /**
     * Get motivational message based on progress
     */
    getMotivationalMessage() {
        const percentage = this.getProgress().percentage;

        if (percentage === 0) {
            return 'لنبدأ! خطوة بخطوة نحو دراسة جدوى احترافية';
        } else if (percentage < 25) {
            return 'بداية قوية! استمر في التقدم';
        } else if (percentage < 50) {
            return 'ربع الطريق! أنت تسير بشكل رائع';
        } else if (percentage < 75) {
            return 'نصف الطريق! الإنجاز قريب';
        } else if (percentage < 100) {
            return 'تقريباً انتهيت! اللمسات الأخيرة';
        } else {
            return 'مبروك! أكملت الدراسة بنجاح';
        }
    }

    /**
     * Auto-detect completion based on store data
     */
    detectCompletion(storeData, stepConfig) {
        this.completedSteps = new Set(this.manualCompletedSteps);
        const blankStudy = createEmptyStudy();
        
        // إحصاء الخطوات القابلة للتتبع فعلياً (trackable) لاستثنائها من المقام إن لم تكن كذلك
        let trackableCount = 0;

        stepConfig.forEach((step, index) => {
            // الخطوة تعتبر قابلة للتتبع إذا كانت تقبل إدخال بيانات (لها sectionKey يطابق الـ store)
            // أو لها جداول صريحة. الخطوات الاستعراضية والأدوات التحليلية لا تملك بيانات خاصة بها في الـ store عادة.
            const sectionKey = step.dataSection || step.id;
            const isTrackable = (step.tables && step.tables.length > 0) || (sectionKey && blankStudy[sectionKey] !== undefined);
            
            // استثناء الخطوات التي تقع في تصنيفات "إضافية" (optional: true) إذا أردنا ذلك، 
            // لكن يكفينا حالياً استثناء الخطوات غير القابلة للقياس (الأدوات/التحليلات) لضمان الوصول لـ 100%
            if (isTrackable) {
                trackableCount++;
            }

            if (this.isStepComplete(step, storeData, blankStudy)) {
                this.completedSteps.add(index);
            }
        });

        // تحديث إجمالي الخطوات ليعكس فقط الخطوات ذات المعنى الإدخالي
        if (trackableCount > 0) {
            this.totalSteps = trackableCount;
        }

        return this.getProgress();
    }

    /**
     * Check if a specific step has required data
     */
    isStepComplete(step, storeData, blankStudy = {}) {
        // Template selector is always complete if a template was selected
        if (step.isTemplateSelector) {
            return storeData.templateId !== undefined;
        }

        // بعض الخطوات معرّفها فريد وبياناتها في قسم آخر (dataSection) — مثل projectDetails
        const sectionKey = step.dataSection || step.id;

        // For table-based steps, check if tables have data
        if (step.tables && step.tables.length > 0) {
            return step.tables.some(tableName => {
                const section = storeData[sectionKey];
                return section && section[tableName] && section[tableName].length > 0;
            });
        }

        // For custom components, check if section exists AND فعلياً يختلف عن دراسة
        // فارغة تماماً. تحقق حي 2026-07-15: Object.keys(section).length > 0 كانت تتحقق
        // فقط من "شكل" القسم — وcreateEmptyStudy() (schema.js) يملأ كل قسم بمفاتيحه
        // الافتراضية دائماً (نصوص/أصفار/مصفوفات قوالب مثل preliminaryCheck أو
        // smartGoals.goals)، فكانت كل خطوة غير جدولية تُحتسب "مكتملة" فوراً حتى في
        // دراسة جديدة 100% فارغة (مثال حي: 4 من 7 خطوات في أول تصنيف رغم عدم إدخال أي
        // بيانات، بينما الصفحة الرئيسية—عبر QualityCalculator—أظهرت 0% بالمقابل).
        // المقارنة الآن بمثيل فعلي طازج من createEmptyStudy()، بنفس أسلوب
        // hasMeaningfulUnsavedChanges في app.js، بدل عدّ المفاتيح فقط.
        if (sectionKey && storeData[sectionKey]) {
            const section = storeData[sectionKey];
            if (typeof section === 'object') {
                return normalizeSection(section) !== normalizeSection(blankStudy[sectionKey]);
            }
            return true;
        }

        return false;
    }
}

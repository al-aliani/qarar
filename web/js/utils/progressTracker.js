/**
 * Progress Tracker
 * Tracks user progress through the feasibility study wizard
 */

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
        const percentage = (this.completedSteps.size / this.totalSteps) * 100;
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
        // أعد بناء الاكتمال المستنتج كي لا تبقى خطوة «مكتملة» بعد حذف بياناتها،
        // مع الحفاظ فقط على الخطوات التي وُسِمت صراحةً عبر markCompleted().
        this.completedSteps = new Set(this.manualCompletedSteps);
        stepConfig.forEach((step, index) => {
            if (this.isStepComplete(step, storeData)) {
                this.completedSteps.add(index);
            }
        });

        return this.getProgress();
    }

    /**
     * Check if a specific step has required data
     */
    isStepComplete(step, storeData) {
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

        // For custom components, check if section exists
        if (sectionKey && storeData[sectionKey]) {
            const section = storeData[sectionKey];
            // Check if section has any meaningful data
            if (typeof section === 'object') {
                return Object.keys(section).length > 0;
            }
            return true;
        }

        return false;
    }
}

/**
 * صفحة "معاييرنا" / "لماذا تثق بنا" (KPI-2.3)
 * منهجية، جودة (QA)، توافق مخرجات التمويل — لغة محايدة دون ادعاء اعتماد رسمي.
 */
import { TRUST_TAGLINE, PLATFORM_STATS, MONSHAAT_MODEL_URL, IPA_FRAMEWORK_URL } from '../config.js';

export class TrustCriteriaView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onBack = options.onBack || (() => {});
    }

    async render() {
        if (!this.container) return;

        const stats = PLATFORM_STATS || {};
        const hasStats = (stats.studiesCount > 0) || (stats.yearsExperience > 0) || (stats.partnershipsText || '').trim();

        this.container.innerHTML = `
            <div class="trust-criteria-view animate-entry p-6 max-w-3xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="trustCriteriaBack">← رجوع</button>
                <h1 class="text-2xl font-bold mb-2">لماذا تثق بنا</h1>
                ${TRUST_TAGLINE ? `<p class="text-gold text-sm font-medium mb-6">${TRUST_TAGLINE}</p>` : '<p class="text-muted mb-6">معاييرنا ومنهجية العمل.</p>'}

                <div class="card card-hover mb-6 p-6">
                    <h2 class="text-lg font-bold mb-3 text-gold">معيارية المدخلات</h2>
                    <p class="text-sm text-muted mb-4">الافتراضات والمدخلات المالية منظمة عبر مصدر واحد (Named Ranges) — لا أرقام هاربة داخل الصيغ. كل تعديل ينعكس تلقائياً على الحسابات والتقارير. هذا يضمن الشفافية وقابلية التدقيق دون ادعاء اعتماد رسمي إلا بموجب اتفاق.</p>
                </div>

                <div class="card card-hover mb-6 p-6">
                    <h2 class="text-lg font-bold mb-3 text-gold">معايير القالب والمنهجية</h2>
                    <p class="text-sm text-muted mb-4">هيكل الدراسة (الدراسة المبدئية، التسويقية، الفنية، المالية، تقييم المشروع والمخاطر) متوافق مع أطر دراسات الجدوى المعتمدة في معهد الإدارة العامة والقطاع العام والتدريب المهني. القوالب القطاعية مهيكلة لتلبية متطلبات النماذج الرسمية. دون ادعاء اعتماد رسمي من المعهد.</p>
                    ${IPA_FRAMEWORK_URL ? `<p class="text-xs text-muted mb-2">للاطلاع على أطر معهد الإدارة العامة: <a href="${IPA_FRAMEWORK_URL}" target="_blank" rel="noopener" class="text-gold underline">الموقع الرسمي</a>.</p>` : ''}
                </div>

                <div class="card card-hover mb-6 p-6">
                    <h2 class="text-lg font-bold mb-3 text-gold">بوابة الجودة (QA)</h2>
                    <p class="text-sm text-muted mb-4">قبل التصدير أو اتخاذ القرار، تمر الدراسة بفحص جودة: أخطاء حرجة (بيانات ناقصة، تناقضات، #REF!) وتحذيرات (قيم غير معتادة). لا نصدّر تقريراً دون تنبيهك بالمشكلات الحرجة. يمكنك مراجعة لوحة القرار وفحص الجودة في أي وقت. النبرة احترافية وسعودية.</p>
                </div>

                <div class="card card-hover mb-6 p-6">
                    <h2 class="text-lg font-bold mb-3 text-gold">توافق مخرجات التمويل</h2>
                    <p class="text-sm text-muted mb-4">مخرجات المنصة (تقرير PDF، نسخة للممول، هيكل متوافق مع منشآت) مصممة لتلبية متطلبات بنك التنمية الاجتماعية وبرامج التمويل (منشآت، ريادة). المصطلحات والتنسيق مطابقان قدر الإمكان للنماذج الرسمية. المتطلبات الفعلية تختلف حسب كل جهة — يُوصى بمراجعة بوابة منشآت والبنك قبل التقديم.</p>
                    ${MONSHAAT_MODEL_URL ? `<a href="${MONSHAAT_MODEL_URL}" target="_blank" rel="noopener" class="text-gold underline text-sm">النموذج الاسترشادي — منشآت</a>` : ''}
                </div>

                ${hasStats ? `
                <div class="card card-hover mb-6 p-6 bg-white/5 border border-white/10">
                    <h2 class="text-lg font-bold mb-3 text-gold">أرقامنا</h2>
                    <div class="flex flex-wrap gap-4 text-sm">
                        ${stats.studiesCount > 0 ? `<span><strong class="text-gold">${stats.studiesCount}</strong> دراسة مُنشأة</span>` : ''}
                        ${stats.yearsExperience > 0 ? `<span><strong class="text-gold">${stats.yearsExperience}</strong> سنوات خبرة</span>` : ''}
                        ${(stats.partnershipsText || '').trim() ? `<span>${stats.partnershipsText}</span>` : ''}
                        ${stats.yearStarted ? `<span>منذ ${stats.yearStarted}</span>` : ''}
                    </div>
                </div>
                ` : ''}

                <p class="text-xs text-muted">لا ادعاء اعتماد رسمي من بنك أو جهة تمويل إلا بموجب اتفاق مكتوب.</p>
            </div>
        `;

        this.container.querySelector('#trustCriteriaBack')?.addEventListener('click', () => this.onBack());
    }
}

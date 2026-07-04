/**
 * صفحة "توافق المعايير" / "متوافق مع متطلبات منشآت"
 * جدول يربط كل قسم في المنصة بالمكون المطلوب في النموذج الاسترشادي الرسمي. لغة محايدة دون ادعاء اعتماد رسمي.
 * + إشارة توافق المنهجية مع أطر معهد الإدارة العامة (معهد الإدارة العامة).
 */
import { MONSHAAT_MODEL_URL, IPA_FRAMEWORK_URL } from '../config.js';

/** ربط أقسام المنصة بمكونات النموذج الاسترشادي لمنشآت */
const MAPPING = [
    { ourSection: 'معلومات المشروع ونموذج العمل', monshaatComponent: 'تعريف المشروع والفكرة', note: 'هذا القسم يغطي المتطلب حسب النموذج الاسترشادي.' },
    { ourSection: 'الدراسة السوقية', monshaatComponent: 'دراسة السوق', note: 'هذا القسم يغطي المتطلب حسب النموذج الاسترشادي.' },
    { ourSection: 'الدراسة الفنية (الأصول)', monshaatComponent: 'الدراسة الفنية والتشغيلية', note: 'هذا القسم يغطي المتطلب حسب النموذج الاسترشادي.' },
    { ourSection: 'الموارد البشرية واللوجستية والإدارية', monshaatComponent: 'الدراسة الفنية والتشغيلية (الموارد)', note: 'هذا القسم يغطي المتطلب حسب النموذج الاسترشادي.' },
    { ourSection: 'مصادر الإيرادات والتمويل', monshaatComponent: 'الدراسة المالية والتمويل', note: 'هذا القسم يغطي المتطلب حسب النموذج الاسترشادي.' },
    { ourSection: 'الافتراضات والقوائم المالية', monshaatComponent: 'الدراسة المالية (الأرقام والتوقعات)', note: 'هذا القسم يغطي المتطلب حسب النموذج الاسترشادي.' },
    { ourSection: 'تحليل المخاطر', monshaatComponent: 'تحليل المخاطر وخطط المواجهة', note: 'هذا القسم يغطي المتطلب حسب النموذج الاسترشادي.' },
    { ourSection: 'لوحة القرار والملخص التنفيذي', monshaatComponent: 'التوصية والقرار النهائي', note: 'هذا القسم يغطي المتطلب حسب النموذج الاسترشادي.' },
];

export class MonshaatComplianceView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onBack = options.onBack || (() => {});
    }

    async render() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="monshaat-compliance-view animate-entry p-6 max-w-4xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="complianceBack">← رجوع</button>
                <h1 class="text-2xl font-bold mb-2">توافق المعايير</h1>
                <p class="text-muted mb-6">جدول ربط أقسام منصتنا بمكونات النموذج الاسترشادي لدراسة الجدوى (منشآت). لغة محايدة — لا ادعاء اعتماد رسمي إلا بموجب اتفاق.</p>

                <div class="card card-hover mb-6 p-6">
                    <h2 class="text-lg font-bold mb-3 text-gold">المنهجية وتوافق الأطر</h2>
                    <p class="text-sm text-muted mb-4">هيكل الدراسة في المنصة (الدراسة المبدئية، الدراسة التسويقية، الدراسة الفنية، الدراسة المالية، تقييم المشروع والمخاطر) متوافق مع أطر دراسات الجدوى المعتمدة في القطاع العام والتدريب المهني، دون ادعاء اعتماد رسمي من أي جهة.</p>
                    <p class="text-sm text-muted mb-3">المنهجية متوافقة مع أطر معهد الإدارة العامة (IPA) للتدريب المهني والقطاع العام — للاطلاع والمرجعية فقط، دون ادعاء اعتماد رسمي من المعهد.</p>
                    ${IPA_FRAMEWORK_URL ? `<a href="${IPA_FRAMEWORK_URL}" target="_blank" rel="noopener noreferrer" class="text-gold underline text-sm">معهد الإدارة العامة — الموقع الرسمي</a>` : ''}
                </div>

                <div class="card card-hover mb-6 overflow-x-auto">
                    <table class="w-full text-sm" style="border-collapse: collapse;">
                        <thead>
                            <tr class="border-b border-white/10">
                                <th class="text-right p-3 font-bold text-gold">القسم في المنصة</th>
                                <th class="text-right p-3 font-bold text-gold">المكون في النموذج الاسترشادي (منشآت)</th>
                                <th class="text-right p-3 font-bold text-gold">ملاحظة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${MAPPING.map(row => `
                                <tr class="border-b border-white/10">
                                    <td class="p-3">${row.ourSection}</td>
                                    <td class="p-3">${row.monshaatComponent}</td>
                                    <td class="p-3 text-muted text-xs">${row.note}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="card card-hover mb-6 p-6">
                    <h2 class="text-lg font-bold mb-3 text-gold">كيف أصدّر بهيكل متوافق؟</h2>
                    <p class="text-sm text-muted mb-4">من قائمة <strong>التصدير</strong> في لوحة القرار، اختر «<strong>هيكل متوافق مع منشآت</strong>» — سيُنتج تقريراً بأقسام وعناوين مطابقة قدر الإمكان للنموذج الرسمي. يُوصى بمراجعة المتطلبات الحالية على بوابة منشآت.</p>
                </div>

                <div class="card card-hover mb-6 p-6">
                    <h2 class="text-lg font-bold mb-3 text-gold">النموذج الرسمي وتحديثاته</h2>
                    <p class="text-sm text-muted mb-4">للاطلاع على النموذج الاسترشادي الرسمي لدراسة الجدوى وتحديثاته، يُوصى بزيارة بوابة منشآت.</p>
                    <a href="${MONSHAAT_MODEL_URL}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary inline-flex items-center gap-2">
                        📄 النموذج الاسترشادي لدراسة الجدوى — منشآت
                    </a>
                </div>

                <p class="text-xs text-muted">يُوصى بمراجعة المتطلبات الحالية على بوابة منشآت قبل الاعتماد على أي تصدير. لا ادعاء اعتماد رسمي من منشآت إلا بموجب اتفاق.</p>
            </div>
        `;

        this.container.querySelector('#complianceBack')?.addEventListener('click', () => this.onBack());
    }
}

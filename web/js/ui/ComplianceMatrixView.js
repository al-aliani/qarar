
import { html } from '../utils/html.js';
import { toast } from '../utils/toast.js';

export class ComplianceMatrixView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onBack = options.onBack || (() => { });
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="compliance-view animate-fade-in p-6 max-w-4xl mx-auto">
                <div class="flex items-center justify-between mb-8">
                    <div>
                        <button type="button" id="btnBackCompliance" class="btn btn--ghost btn--sm mb-2">
                            <span class="icon">arrow_forward</span> العودة
                        </button>
                        <h1 class="text-2xl font-bold bg-gradient-to-r from-gold to-orange-400 bg-clip-text text-transparent">
                            توافق المعايير (منشآت وبنك التنمية)
                        </h1>
                        <p class="text-muted mt-1">
                            مصفوفة المطابقة: كيف تغطي منصة "محاكي الجدوى" متطلبات الجهات الرسمية.
                        </p>
                    </div>
                    <div class="text-4xl opacity-20">⚖️</div>
                </div>

                <div class="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-6">
                    <div class="overflow-x-auto">
                        <table class="w-full text-right border-collapse">
                            <thead>
                                <tr class="bg-white/5 text-gold border-b border-white/10">
                                    <th class="p-4 font-bold w-1/3">متطلب النموذج الاسترشادي (منشآت)</th>
                                    <th class="p-4 font-bold w-1/3">القسم المقابل في المنصة</th>
                                    <th class="p-4 font-bold w-1/3">حالة التغطية</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-white/5 text-sm">
                                <tr class="hover:bg-white/5 transition-colors">
                                    <td class="p-4">1. الملخص التنفيذي (Executive Summary)</td>
                                    <td class="p-4">قسم "الملخص التنفيذي" (توليد آلي)</td>
                                    <td class="p-4 text-success font-medium">✅ مطابقة تامة</td>
                                </tr>
                                <tr class="hover:bg-white/5 transition-colors">
                                    <td class="p-4">2. وصف المشروع والخدمات</td>
                                    <td class="p-4">قسم "معلومات المشروع"</td>
                                    <td class="p-4 text-success font-medium">✅ مطابقة تامة</td>
                                </tr>
                                <tr class="hover:bg-white/5 transition-colors">
                                    <td class="p-4">3. الدراسة التسويقية (السوق، المنافسون)</td>
                                    <td class="p-4">قسم "الدراسة التسويقية" (تحليل المنافسين، SWOT)</td>
                                    <td class="p-4 text-success font-medium">✅ مطابقة تامة</td>
                                </tr>
                                <tr class="hover:bg-white/5 transition-colors">
                                    <td class="p-4">4. الخطة التشغيلية (الموقع، التراخيص)</td>
                                    <td class="p-4">قسم "الدراسة الفنية"</td>
                                    <td class="p-4 text-success font-medium">✅ مطابقة تامة</td>
                                </tr>
                                <tr class="hover:bg-white/5 transition-colors">
                                    <td class="p-4">5. الهيكل الإداري والوظيفي</td>
                                    <td class="p-4">قسم "الموارد البشرية" + "الهيكل التنظيمي"</td>
                                    <td class="p-4 text-success font-medium">✅ مطابقة تامة</td>
                                </tr>
                                <tr class="hover:bg-white/5 transition-colors">
                                    <td class="p-4">6. الدراسة المالية (5 سنوات)</td>
                                    <td class="p-4">قسم "الدراسة المالية" (قوائم دخل، تدفقات)</td>
                                    <td class="p-4 text-success font-medium">💎 تتفوق (تحليل حساسية + 5 سنوات)</td>
                                </tr>
                                <tr class="hover:bg-white/5 transition-colors">
                                    <td class="p-4">7. تحليل المخاطر</td>
                                    <td class="p-4">قسم "تحليل المخاطر" (مصفوفة الاحتمال والأثر)</td>
                                    <td class="p-4 text-success font-medium">✅ مطابقة تامة</td>
                                </tr>
                                <tr class="hover:bg-white/5 transition-colors">
                                    <td class="p-4">8. التوصية والقرار</td>
                                    <td class="p-4">لوحة "المؤشرات المالية" + نص القرار</td>
                                    <td class="p-4 text-success font-medium">✅ مطابقة تامة</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="p-5 rounded-xl border border-white/10 bg-gradient-to-br from-blue-900/20 to-transparent">
                        <h3 class="font-bold text-lg mb-2 text-blue-200">🔍 معايير بنك التنمية</h3>
                        <ul class="text-sm text-muted space-y-2 list-disc list-inside">
                            <li>تغطية تكاليف التأسيس والتشغيل (يتم حسابها تفصيلياً).</li>
                            <li>تحليل نقطة التعادل (موجود في لوحة القيادة).</li>
                            <li>السعودة والتوظيف (موجود في قسم الموارد البشرية).</li>
                            <li>القدرة على السداد (DSCR) (موجود في التحليل المالي).</li>
                        </ul>
                    </div>
                    
                    <div class="p-5 rounded-xl border border-white/10 bg-gradient-to-br from-green-900/20 to-transparent">
                        <h3 class="font-bold text-lg mb-2 text-green-200">🛡️ ضمان الجودة (QA)</h3>
                        <p class="text-sm text-muted mb-2">
                             المنصة تطبق أكثر من 40 قاعدة تحقق آلي لضمان منطقية الأرقام قبل التصدير، مما يقلل احتمالية رفض الدراسة بسبب أخطاء حسابية.
                        </p>
                        <div class="mt-3 text-xs text-green-400 bg-green-900/30 inline-block px-3 py-1 rounded-full">
                            منهجية معتمدة على أفضل الممارسات
                        </div>
                    </div>
                </div>

                <div class="mt-8 text-center text-xs text-muted">
                    إخلاء مسؤولية: بينما تلتزم المنصة بهياكل النماذج الرسمية، فإن القبول النهائي يعتمد على جودة المدخلات وسياسات الجهة الممولة وقت التقديم.
                </div>
            </div>
        `;

        this.container.querySelector('#btnBackCompliance')?.addEventListener('click', () => {
            this.onBack();
        });
    }
}

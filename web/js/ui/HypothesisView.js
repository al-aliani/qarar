import { store } from '../core/store.js';
import { toast } from '../utils/toast.js';
import { escapeHtml } from '../utils/escape.js';

export class HypothesisView {
    constructor() {
        this.container = null;
    }

    render() {
        this.container = document.createElement('div');
        this.container.className = 'hypothesis-view animate-entry';

        // Get current state from projectInfo ( aligned with schema.js )
        const state = store.getState();
        const projectInfo = state.projectInfo || {};

        // Data mapping
        const hypothesis = projectInfo.startupHypothesis || { problem: '', solution: '', insight: '' };
        const checklist = projectInfo.problemQualityChecklist || {};
        const unfairAdvantage = projectInfo.unfairAdvantage || { types: [], insightText: '' };

        this.container.innerHTML = `
            <div class="view-header mb-6">
                <div class="flex justify-between items-center">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-800">فرضية الرواد (Startup Hypothesis) <svg class="ic" aria-hidden="true"><use href="#i-rocket"/></svg></h1>
                        <p class="text-gray-500 mt-1">هل فكرتك قابلة للنمو السريع؟ تحقق من الأساسيات قبل الغوص في الأرقام (منهجية YC).</p>
                    </div>
                    <button class="btn btn--secondary btn-sm" onclick="window.history.back()">عودة للرئيسية</button>
                </div>
            </div>

            <div class="card p-6 mb-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 class="text-xl font-bold mb-4 text-gray-800">1. جودة المشكلة (The Problem)</h3>
                <p class="text-gray-600 mb-4 text-sm">المشكلة القوية هي أساس النمو. كم من هذه الخصائص تنطبق على المشكلة التي تحلها؟</p>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6" id="problem-checklist">
                    ${this._renderCheckbox('popular', 'شائعة (Popular)', 'يعاني منها ملايين الناس', checklist.popular)}
                    ${this._renderCheckbox('growing', 'نامية (Growing)', 'السوق ينمو 20%+ سنوياً', checklist.growing)}
                    ${this._renderCheckbox('urgent', 'عاجلة (Urgent)', 'يحتاجون الحل الآن/حالاً', checklist.urgent)}
                    ${this._renderCheckbox('expensive', 'مكلفة (Expensive)', 'خسارتها عالية (مال/وقت)', checklist.expensive)}
                    ${this._renderCheckbox('mandatory', 'إلزامية (Mandatory)', 'القانون/الوضع يفرضها', checklist.mandatory)}
                    ${this._renderCheckbox('frequent', 'متكررة (Frequent)', 'تحدث يومياً أو أسبوعياً', checklist.frequent)}
                </div>

                <div class="bg-blue-50 p-4 rounded-lg border-r-4 border-blue-500 mb-6">
                    <h4 class="font-bold text-blue-900 text-sm"><svg class="ic" aria-hidden="true"><use href="#i-lightbulb"/></svg> نصائح (YC):</h4>
                    <ul class="list-disc list-inside text-xs text-blue-800 mt-1">
                        <li>لا تبدأ من الحل وتدور على مشكلة (SISP).</li>
                        <li>المشاكل "المملة" غالباً فرص ذهبية بالملايين.</li>
                    </ul>
                </div>

                <div class="form-group">
                    <label class="block font-bold text-sm mb-2">اشرح المشكلة في جملة واحدة (من يعاني؟ وما هي المعاناة؟)</label>
                    <textarea class="form-input w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" rows="2" data-section="startupHypothesis" data-field="problem" placeholder="مثال: أصحاب المطاعم يعانون من صعوبة بناء دراسة جدوى دقيقة...">${escapeHtml(hypothesis.problem || '')}</textarea>
                </div>
            </div>

            <div class="card p-6 mb-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 class="text-xl font-bold mb-4 text-gray-800">2. الحل (The Solution)</h3>
                <div class="form-group mb-4">
                    <label class="block font-bold text-sm mb-2">ما هي التجربة التي ستجريها لحل المشكلة؟</label>
                    <textarea class="form-input w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" rows="2" data-section="startupHypothesis" data-field="solution" placeholder="مثال: منصة أونلاين تحسب التكاليف تلقائياً وتصدر تقريراً جاهزاً للبنك...">${escapeHtml(hypothesis.solution || '')}</textarea>
                </div>
            </div>

            <div class="card p-6 mb-6 border border-yellow-400 bg-yellow-50/30 rounded-lg shadow-sm">
                <h3 class="text-xl font-bold mb-4 text-purple-900">3. الاستبصار (The Insight) <svg class="ic" aria-hidden="true"><use href="#i-sparkle"/></svg></h3>
                <p class="text-sm text-gray-600 mb-4">لماذا ستفوز شركتك؟ ما هي "الميزة غير العادلة"؟</p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="form-group">
                        <label class="block font-bold text-sm mb-2">نوع الميزة (Unfair Advantage) — يمكن اختيار أكثر من واحدة</label>
                        <div class="space-y-2 p-3 bg-white rounded border">
                             ${this._renderTypeCheckbox('founder', 'مؤسس (Founder)', 'أنت خبير في هذا المجال (Top 1%)', unfairAdvantage.types)}
                             ${this._renderTypeCheckbox('market', 'سوق (Market)', 'السوق ينمو بانفجار (>20%)', unfairAdvantage.types)}
                             ${this._renderTypeCheckbox('product10x', 'منتج (10x Product)', 'أفضل بـ 10 مرات (ليس فقط 10% أفضل)', unfairAdvantage.types)}
                             ${this._renderTypeCheckbox('acquisition', 'اكتساب (0$ Acquisition)', 'النمو مجاني (Word of mouth)', unfairAdvantage.types)}
                             ${this._renderTypeCheckbox('network', 'تأثير شبكي (Network)', 'كلما كبرت الشبكة زادت القيمة وصعبت المنافسة', unfairAdvantage.types)}
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="block font-bold text-sm mb-2">اشرح استبصارك (السحر الخاص بك)</label>
                        <textarea class="form-input w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none h-full" data-section="startupHypothesis" data-field="insight" placeholder="لماذا سنربح نحن وليس غيرنا؟">${escapeHtml(hypothesis.insight || '')}</textarea>
                    </div>
                </div>
            </div>

            <div class="flex justify-between mt-8 pb-10">
                <button class="btn btn--secondary" onclick="window.history.back()">إلغاء</button>
                <div class="flex gap-3">
                    <button class="btn btn--primary px-8" id="save-hypothesis-btn">حفظ الفرضية <svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></button>
                    <!-- <button class="btn btn--outline" id="next-step-btn">التالي: الدراسة المالية ➡️</button> -->
                </div>
            </div>
        `;

        this._attachEvents();
        return this.container;
    }

    _renderCheckbox(key, label, desc, isChecked) {
        return `
            <label class="flex items-start p-3 border rounded bg-white hover:bg-gray-50 cursor-pointer transition-colors duration-200">
                <input type="checkbox" class="hypothesis-check mt-1 ml-2 w-4 h-4 text-blue-600 rounded focus:ring-blue-500" value="${key}" ${isChecked ? 'checked' : ''}>
                <div>
                    <span class="font-bold block text-gray-800 text-sm">${label}</span>
                    <span class="text-xs text-gray-500 mt-1 block">${desc}</span>
                </div>
            </label>
        `;
    }

    _renderTypeCheckbox(value, label, desc, currentTypes) {
        // القيم موحّدة مع schema.js وIntroductionView (founder/market/product10x/acquisition/network)
        const isChecked = Array.isArray(currentTypes) ? currentTypes.includes(value) : (currentTypes === value);

        return `
            <label class="flex items-center p-2 rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" class="insight-type-check ml-2 text-purple-600 focus:ring-purple-500" value="${value}" ${isChecked ? 'checked' : ''}>
                <span class="text-sm">
                    <span class="font-bold">${label}</span> - <span class="text-gray-500 text-xs">${desc}</span>
                </span>
            </label>
        `;
    }

    _attachEvents() {
        // Save functionality
        this.container.querySelector('#save-hypothesis-btn').addEventListener('click', () => {
            this._saveData();
            toast.success('تم حفظ الفرضية بنجاح');
        });

        // Auto-save on textarea changes
        this.container.querySelectorAll('textarea').forEach(el => {
            el.addEventListener('change', () => this._saveData());
        });
    }

    _saveData() {
        // 1. Narrative Fields
        const hypothesis = {
            problem: this.container.querySelector('[data-field="problem"]').value,
            solution: this.container.querySelector('[data-field="solution"]').value,
            insight: this.container.querySelector('[data-field="insight"]').value
        };

        // 2. Checklist
        const checklist = {};
        this.container.querySelectorAll('.hypothesis-check').forEach(cb => {
            checklist[cb.value] = cb.checked;
        });

        // 3. Insight/Unfair Advantage — مصفوفة كاملة كي لا يمسح الحفظ الاختيارات المتعددة من IntroductionView
        const types = Array.from(this.container.querySelectorAll('.insight-type-check:checked')).map(el => el.value);
        const unfairAdvantage = {
            types,
            insightText: hypothesis.insight // Sync insight text here as well
        };

        // Update Store (projectInfo section)
        store.update('projectInfo', {
            ...(store.getState().projectInfo || {}),
            startupHypothesis: hypothesis,
            problemQualityChecklist: checklist,
            unfairAdvantage: unfairAdvantage
        });
    }
}

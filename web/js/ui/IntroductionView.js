/**
 * مقدمة الجدوى الموحدة
 * الأهداف (SMART)، المنتجات، الخدمات، القيمة لكل عميل
 * وفق المعايير: محدد، قابل للقياس، قابل للتحقيق، مرتبط بالفكرة والهوية، إطار زمني
 */

import { toast } from '../utils/toast.js';
import { InternalAIGenerator } from '../services/InternalAIGenerator.js';
import { FINANCIAL_TERMS } from '../utils/glossary.js';

const PRODUCT_TYPES = [
    { value: 'primary', label: 'أولي (خام)' },
    { value: 'semi', label: 'نصف مصنع' },
    { value: 'final', label: 'نهائي' }
];
const SERVICE_TYPES = [
    { value: 'essential', label: 'أساسية' },
    { value: 'supportive', label: 'داعمة' },
    { value: 'secondary', label: 'ثانوية' }
];

export class IntroductionView {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        const pi = state.projectInfo || {};
        const ic = pi.ideaCriteria || {};
        const la = pi.locationAnalysis || {};
        const sh = pi.startupHypothesis || {};
        const pq = pi.problemQualityChecklist || {};
        const ua = pi.unfairAdvantage || { types: [], insightText: "" };
        const products = Array.isArray(pi.products) ? pi.products : [];
        const introServices = Array.isArray(pi.introServices) ? pi.introServices : [];
        const customerValues = Array.isArray(pi.customerValues) ? pi.customerValues : [];
        const goals = state.smartGoals?.goals || [];

        const isQuickMode = localStorage.getItem('study_mode_preference') === 'quick';
        const esc = (s) => (s || '').toString().replace(/</g, '&lt;').replace(/"/g, '&quot;');

        if (isQuickMode && !sessionStorage.getItem('quick_welcome')) {
            setTimeout(() => {
                toast.show('🚀 مسار الدراسة السريع مفعّل: تم إخفاء التفاصيل المعقدة.', 'magic', 4000);
                sessionStorage.setItem('quick_welcome', 'true');
            }, 800);
        }

        this.container.innerHTML = `
            <div class="introduction-view">
                <h2 class="section-title">📋 مقدمة الجدوى الموحدة</h2>
                <p class="text-muted text-sm mb-4">الفكرة، الهوية، الأهداف الذكية، المنتجات، الخدمات، والقيمة لكل عميل — تُستخدم في التسويق والدراسة الفنية</p>

                <!-- تنبيهات وإرشادات (الفجوة المعيارية) -->
                ${!isQuickMode ? `
                <div class="alert alert--info mb-4" style="font-size: 0.85rem; border-right: 4px solid var(--c-p-500);">
                    <strong>📌 تذكّر:</strong>
                    <ul class="mb-0 mt-2" style="padding-right: 1.25rem;">
                        <li><strong>لا تستقيل</strong> من الوظيفة إلا بعد إكمال دراسة جدوى حقيقية ومتكاملة.</li>
                        <li><strong>أنت المصدر الرئيسي</strong> للمعلومات — لا تترك مكاتب الاستشارات تختلق البيانات دون مراجعتك.</li>
                        <li>نسبة فشل المشاريع الصغيرة قد تصل <strong>80%</strong> — الدراسة الجيدة تخفّف المخاطر.</li>
                        <li>الدراسة قد تخضع للمتغيرات — <strong>المستقبل مجهول</strong>، والمتغيرات قد تتغير.</li>
                        <li><strong>خسارة على الورق</strong> = تكلفة الورق والوقت (20–50 ريال). <strong>خسارة بدون دراسة</strong> = قد تصل لعشرات الآلاف.</li>
                        <li><strong>السوقية</strong> = المستهلكون والمنافسون. <strong>التسويقية</strong> = كيف تسوّق (المزيج التسويقي).</li>
                        <li>الدراسة تقول <strong>ابدأ أم لا</strong>؛ الاختبار الأولي يتعلم من التجربة في السوق.</li>
                        <li><strong>لا بديل لدراسة الجدوى</strong> — البيزنس موديل أو خطة عمل ليست بديلاً؛ الدراسة ترافق المشروع كخطة عمل في كل المراحل (استثمار، تشغيل، تقييم).</li>
                        <li><strong>مبدأ تعدد الخيارات:</strong> يجب أن يكون لديك أكثر من بديل استثماري للمفاضلة قبل الدخول — المفاضلة تتطلب أكثر من خيار واحد.</li>
                        <li><strong>لا تضع البيض في سلة واحدة</strong> — توزيع المخاطر عبر أكثر من مشروع أو خط استثماري يقلّل الخسارة.</li>
                        <li><strong>لا تستثمر في مشروع واحد بدون مقارنة</strong> — ابحث عن 2–3 أفكار وقارنها قبل التفصيل.</li>
                        <li><strong>المؤهل العكسي:</strong> فكرة قليلة + خبرة قليلة = أموال كثيرة مطلوبة. فكرة عظيمة + خبرة كبيرة = أموال قليلة تكفي.</li>
                        <li><strong>تكلفة إعداد الدراسة:</strong> غالباً 2.5–8% من رأس مال المشروع حسب التعقيد — أغلب التكلفة في دراسة السوق.</li>
                        <li><strong>لا تبدأ من الحل:</strong> ابدأ من <strong>المشكلة</strong> التي يعانيها الناس ثم اختر الحل المناسب — لا تبدأ من تقنية أو منتج ثم تبحث عن مشكلة (تجنّب «حل يبحث عن مشكلة» SISP).</li>
                    </ul>
                </div>
                ` : ''}

                <div class="flex-between mb-4">
                    <span></span>
                    <button type="button" class="btn-xs btn-magic btn-generate-intro" title="توليد مقترح" aria-label="توليد مقدمة الجدوى تلقائياً">✨ توليد تلقائي</button>
                </div>

                ${!isQuickMode ? `
                <!-- مبادئ الاستثمار والمفاضلة (د. الروضي) -->
                <details class="card analysis-card" style="margin-bottom: 1rem;">
                    <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">⚖️ مبادئ الاستثمار والمفاضلة</summary>
                    <div class="mt-3" style="font-size: 0.9rem;">
                        <p class="text-muted mb-2"><strong>التكلفة الفرصية:</strong> استخدام المورد في مكان واحد — المفاضلة بين المشاريع تستند إلى تكلفة الفرصة البديلة. المال والوقت المستثمر هنا لا يُستخدم هناك.</p>
                        <p class="text-muted mb-0"><strong>استكشاف الفرص قبل الدراسة:</strong> قبل الدراسة التفصيلية: استكشف الفرص عبر الغرف التجارية، الوزارات، مجلات الاستثمار — ثم ما قبل الجدوى: هل الحكومة تمنع؟ التمويل متوفر؟</p>
                    </div>
                </details>

                <!-- إرشاد الفرنشايز -->
                <details class="card analysis-card" style="margin-bottom: 1rem;">
                    <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">🏪 مشروع فرنشايز؟</summary>
                    <div class="mt-3" style="font-size: 0.9rem;">
                        <p class="text-muted mb-2">الفرنشايز يحتاج دراسة جدوى أيضاً — المكان، الطلب، الملاءمة. اختر "فرنشايز" في نموذج العمل وأدخل تفاصيل الامتياز.</p>
                    </div>
                </details>

                <!-- استراتيجية التركيز والعلامة التجارية -->
                <details class="card analysis-card" style="margin-bottom: 1rem;">
                    <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">🎯 استراتيجية التركيز والعلامة التجارية</summary>
                    <div class="mt-3" style="font-size: 0.9rem;">
                        <p class="text-muted mb-2"><strong>استراتيجية التركيز:</strong> ابدأ بنوع واحد من المنتجات أو خدمة محددة — بعد النجاح والتوسع أضف المزيد. التنوع المبكر يشتّت الموارد.</p>
                        <p class="text-muted mb-0"><strong>العلامة التجارية:</strong> ابدأ بدون علامة تجارية — أي خطأ مبكر قد يؤثر على سمعة العلامة. أضفها بعد اكتساب الخبرة والفهم الكامل للسوق.</p>
                    </div>
                </details>

                <!-- نطاق المنصة وترتيب الدراسة ومراحل الجدوى -->
                <details class="card analysis-card" style="margin-bottom: 1rem;">
                    <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">📋 نطاق المنصة وترتيب الدراسة ومراحل الجدوى</summary>
                    <div class="mt-3" style="font-size: 0.9rem;">
                        <p class="text-muted mb-2"><strong>المنصة تصلح لـ:</strong> مشاريع جديدة، صيانة، توسع، منتج جديد، تغيير إنتاج، تغيير مجال.</p>
                        <p class="text-muted mb-2"><strong>الترتيب المنطقي:</strong> سوقية (حجم المبيعات) → تسويقية (كيف تصل للعميل) → فنية (التكاليف) → تمويلية → مالية. كل مرحلة تغذي التي تليها.</p>
                        <p class="text-muted mb-0"><strong>مراحل الجدوى:</strong> مبدئية (خطوط عريضة) → تفصيلية اقتصادية (قرار استمرار/توقف) → فنية (تفاصيل الآلات، العمالة، الموقع).</p>
                    </div>
                </details>

                <!-- متى تستعين بمختص -->
                <details class="card analysis-card" style="margin-bottom: 1rem;">
                    <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">👥 متى تستعين بمختص؟</summary>
                    <div class="mt-3" style="font-size: 0.9rem;">
                        <p class="text-muted mb-2">الدراسة الجيدة متعددة التخصصات — تسويق، فني، مالي، قانوني. المنصة تساعدك على الهيكل والبيانات. استعن بمختص حين: المشروع كبير، أو تحتاج بيانات دقيقة من السوق، أو تريد مراجعة قبل التقديم لجهة تمويل.</p>
                    </div>
                </details>
                ` : ''}

                <!-- تقييم الفرضية (مشكلة — حل — استبصار) — YC / أفكار الستارت آب -->
                <div class="card analysis-card mb-4">
                    <h3 class="card-title">🎯 ${isQuickMode ? 'وصف المشروع المختصر' : 'تقييم الفرضية (مشكلة — حل — استبصار)'}</h3>
                    <p class="text-muted text-sm mb-3">
                        ${isQuickMode ? 'اشرح فكرة مشروعك بإيجاز: المشكلة التي تحلها والحل الذي تقدمه.' : 'الفكرة = فرضية عن سبب نمو المشروع. اكتب في سطر أو سطرين: <strong>المشكلة</strong> (لمن؟ ما الظرف؟)، <strong>الحل</strong> (ماذا تقدم؟)، <strong>الاستبصار</strong> (لماذا أنت ستربح؟). إن لم تستطع كتابة الاستبصار بوضوح، هذا أول شيء يجب أن تصلحه.'}
                    </p>
                    <div class="form-group relative">
                        <div class="flex-between mb-1">
                            <label for="hypothesis-problem">1. المشكلة (الظروف الأولية)</label>
                            <button type="button" class="btn-xs btn-magic text-xs text-gold hover:underline btn-ai-suggest" data-target="hypothesis-problem">✨ اقتراح</button>
                        </div>
                        <textarea id="hypothesis-problem" class="input" rows="2" placeholder="ما المشكلة؟ لمن؟ ما الظرف الذي يسمح بالمشروع؟">${esc(sh.problem)}</textarea>
                    </div>
                    <div class="form-group relative">
                        <div class="flex-between mb-1">
                            <label for="hypothesis-solution">2. الحل (التجربة / المنتج أو الخدمة)</label>
                            <button type="button" class="btn-xs btn-magic text-xs text-gold hover:underline btn-ai-suggest" data-target="hypothesis-solution">✨ اقتراح</button>
                        </div>
                        <textarea id="hypothesis-solution" class="input" rows="2" placeholder="ما الحل الذي تقدمه؟ ما التجربة التي تجرّبها؟">${esc(sh.solution)}</textarea>
                    </div>
                    ${!isQuickMode ? `
                    <div class="form-group relative">
                        <div class="flex-between mb-1">
                            <label for="hypothesis-insight">3. الاستبصار (لماذا سنربح؟)</label>
                            <button type="button" class="btn-xs btn-magic text-xs text-gold hover:underline btn-ai-suggest" data-target="hypothesis-insight">✨ اقتراح</button>
                        </div>
                        <textarea id="hypothesis-insight" class="input" rows="2" placeholder="لماذا أنت ستفوز؟ الميزة غير العادلة — مؤسس، سوق، منتج 10x، اكتساب، تأثير شبكي">${esc(sh.insight)}</textarea>
                    </div>
                    ` : ''}
                </div>

                ${!isQuickMode ? `
                <!-- قائمة تحقق جودة المشكلة -->
                <div class="card analysis-card mb-4">
                    <h3 class="card-title">✅ قائمة تحقق جودة المشكلة</h3>
                    <p class="text-muted text-sm mb-3">المشكلات الجيدة تحقق واحداً أو أكثر من التالي. إن كانت قليلة، إما تعيد تعريف المشكلة أو تتوقع صعوبة في الإقناع أو النمو.</p>
                    <div class="form-row form-row--2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 1rem;">
                        <label class="checkbox-label"><input type="checkbox" id="pq-popular" ${pq.popular ? 'checked' : ''}> شائع — كثيرون يعانون المشكلة</label>
                        <label class="checkbox-label"><input type="checkbox" id="pq-growing" ${pq.growing ? 'checked' : ''}> نامٍ — السوق/المشكلة نامية</label>
                        <label class="checkbox-label"><input type="checkbox" id="pq-urgent" ${pq.urgent ? 'checked' : ''}> عاجل — يحتاج حلاً فورياً</label>
                        <label class="checkbox-label"><input type="checkbox" id="pq-expensive" ${pq.expensive ? 'checked' : ''}> مكلف — حلّه يعطي قيمة عالية</label>
                        <label class="checkbox-label"><input type="checkbox" id="pq-mandatory" ${pq.mandatory ? 'checked' : ''}> إلزامي — قانون/تنظيم يفرض حلها</label>
                        <label class="checkbox-label"><input type="checkbox" id="pq-frequent" ${pq.frequent ? 'checked' : ''}> متكرر — فرص تحويل متعددة (يومي/أسبوعي)</label>
                    </div>
                </div>

                <!-- لماذا سنربح — المزايا غير العادلة -->
                <div class="card analysis-card mb-4">
                    <h3 class="card-title">🏆 لماذا سنربح؟ (المزايا غير العادلة)</h3>
                    <p class="text-muted text-sm mb-3">اختر واحداً على الأقل يفسر لماذا مشروعك سينمو ويتفوق. بدون استبصار واحد على الأقل يصعب على مستثمر أو شريك «تخيّل» النجاح.</p>
                    <div class="form-group mb-3">
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem 1rem;">
                            <label class="checkbox-label"><input type="checkbox" class="ua-type" value="founder" ${(ua.types || []).includes('founder') ? 'checked' : ''}> مؤسس — خبرة/معرفة نادرة (واحد من قلة قليلة)</label>
                            <label class="checkbox-label"><input type="checkbox" class="ua-type" value="market" ${(ua.types || []).includes('market') ? 'checked' : ''}> سوق — السوق نامٍ (مثلاً 20% سنوياً)</label>
                            <label class="checkbox-label"><input type="checkbox" class="ua-type" value="product10x" ${(ua.types || []).includes('product10x') ? 'checked' : ''}> منتج 10x — المنتج أفضل بعشر مرات من المنافس</label>
                            <label class="checkbox-label"><input type="checkbox" class="ua-type" value="acquisition" ${(ua.types || []).includes('acquisition') ? 'checked' : ''}> اكتساب — نمو بكلمة شفاهية (بدون إعلان ثقيل)</label>
                            <label class="checkbox-label"><input type="checkbox" class="ua-type" value="network" ${(ua.types || []).includes('network') ? 'checked' : ''}> تأثير شبكي — كلما كبرت الشبكة زادت القيمة</label>
                        </div>
                    </div>
                    <div class="form-group relative">
                        <div class="flex-between mb-1">
                            <label for="ua-insight-text">شرح موجز للاستبصار (اختياري)</label>
                            <button type="button" class="btn-xs btn-magic text-xs text-gold hover:underline btn-ai-suggest" data-target="ua-insight-text">✨ ولّد</button>
                        </div>
                        <textarea id="ua-insight-text" class="input" rows="2" placeholder="لماذا أنت ستفوز؟ سطر أو سطران للملخص أو العرض على مستثمر">${esc(ua.insightText)}</textarea>
                    </div>
                </div>

                <!-- ملف المستثمر ومحددات المشروع (المرحلة 2) -->
                <div class="card analysis-card mb-4">
                    <h3 class="card-title">ملف المستثمر ومحددات المشروع</h3>
                    <p class="text-muted text-sm mb-3">اختياري — يساعد في توجيه التوصيات وتوافق المشروع معك</p>
                    <div class="form-group">
                        <label for="investor-profile">ملف المستثمر</label>
                        <select id="investor-profile" class="input">
                            <option value="">-- اختر --</option>
                            <option value="conservative" ${(pi.investorProfile || '') === 'conservative' ? 'selected' : ''}>محافظ — يقدّم الأمان أولوية، لا يدخل مشاريع عالية المخاطر</option>
                            <option value="speculator" ${(pi.investorProfile || '') === 'speculator' ? 'selected' : ''}>مضارب — الربحية أساس، قد يغامر</option>
                            <option value="balanced" ${(pi.investorProfile || '') === 'balanced' ? 'selected' : ''}>متوازن — يوازن بين العائد المتوقع ودرجة المخاطرة</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="tech-investment">مدى استفادة المشروع من التكنولوجيا الحديثة</label>
                        <select id="tech-investment" class="input">
                            <option value="">-- اختر --</option>
                            <option value="low" ${(pi.techInvestmentLevel || '') === 'low' ? 'selected' : ''}>منخفضة</option>
                            <option value="medium" ${(pi.techInvestmentLevel || '') === 'medium' ? 'selected' : ''}>متوسطة</option>
                            <option value="high" ${(pi.techInvestmentLevel || '') === 'high' ? 'selected' : ''}>عالية — مشاريع تقنية تحمل مخاطر اختراق</option>
                        </select>
                    </div>
                    <div class="form-group relative">
                        <div class="flex-between mb-1">
                            <label for="national-importance">أهمية المشروع للاقتصاد/الأمن القومي (اختياري)</label>
                            <button type="button" class="btn-xs btn-magic text-xs text-gold hover:underline btn-ai-suggest" data-target="national-importance">✨ ولّد</button>
                        </div>
                        <textarea id="national-importance" class="input" rows="2" placeholder="بعض المشاريع تُفضّل لأهميتها للاقتصاد أو الأمن القومي">${esc(pi.nationalEconomicImportance)}</textarea>
                    </div>
                </div>
                ` : ''}

                <!-- المؤهل العكسي — قيّم نفسك (حسين بكري) -->
                <details class="card analysis-card mb-4">
                    <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">🔄 المؤهل العكسي — قيّم نفسك</summary>
                    <div class="mt-3" style="font-size: 0.9rem;">
                        <p class="text-muted mb-3">فكرة قليلة + خبرة قليلة = أموال كثيرة مطلوبة. فكرة عظيمة + خبرة كبيرة = أموال قليلة تكفي.</p>
                        <div class="form-row form-row--2">
                            <div class="form-group">
                                <label for="idea-strength">قوة فكرة المشروع</label>
                                <select id="idea-strength" class="input">
                                    <option value="">-- اختر --</option>
                                    <option value="weak" ${((pi.inverseQualification || {}).ideaStrength || '') === 'weak' ? 'selected' : ''}>ضعيفة</option>
                                    <option value="medium" ${((pi.inverseQualification || {}).ideaStrength || '') === 'medium' ? 'selected' : ''}>متوسطة</option>
                                    <option value="strong" ${((pi.inverseQualification || {}).ideaStrength || '') === 'strong' ? 'selected' : ''}>قوية</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="experience-level">خبرتك في المجال</label>
                                <select id="experience-level" class="input">
                                    <option value="">-- اختر --</option>
                                    <option value="low" ${((pi.inverseQualification || {}).experienceLevel || '') === 'low' ? 'selected' : ''}>قليلة</option>
                                    <option value="medium" ${((pi.inverseQualification || {}).experienceLevel || '') === 'medium' ? 'selected' : ''}>متوسطة</option>
                                    <option value="high" ${((pi.inverseQualification || {}).experienceLevel || '') === 'high' ? 'selected' : ''}>كبيرة</option>
                                </select>
                            </div>
                        </div>
                        <div id="inverse-qual-hint" class="alert alert--info mt-2" style="font-size: 0.85rem; display: none;"></div>
                    </div>
                </details>

                <!-- 1. معايير الفكرة -->
                <div class="card analysis-card">
                    <h3 class="card-title">1. معايير صياغة فكرة المشروع</h3>
                    <div class="form-group">
                        <label>الإمكانية التنفيذية</label>
                        <input type="text" id="ic-feasibility" class="input" placeholder="هل الفكرة قابلة للتنفيذ؟" value="${esc(ic.feasibility)}">
                    </div>
                    <div class="form-group">
                        <label>التميز والتفرد</label>
                        <input type="text" id="ic-uniqueness" class="input" placeholder="ما الذي يميز المشروع؟" value="${esc(ic.uniqueness)}">
                    </div>
                    <div class="form-group">
                        <label>ملاءمة السوق</label>
                        <input type="text" id="ic-marketFit" class="input" placeholder="كيف تلبي الفكرة حاجة السوق؟" value="${esc(ic.marketFit)}">
                    </div>
                    <div class="form-group">
                        <label>توفر الموارد</label>
                        <input type="text" id="ic-resourceAvailability" class="input" placeholder="توفر المال، الكوادر، البنية..." value="${esc(ic.resourceAvailability)}">
                    </div>
                </div>

                <!-- مصادر البيانات الرسمية (الفجوة المعيارية) -->
                <details class="card analysis-card" style="margin-bottom: 1rem;">
                    <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">📊 مصادر البيانات الرسمية السعودية</summary>
                    <div class="mt-3" style="font-size: 0.9rem;">
                        <p class="text-muted mb-3">مصادر مقترحة لجمع بيانات الدراسة:</p>
                        <ul style="padding-right: 1.25rem;">
                            <li><a href="https://www.stats.gov.sa" target="_blank" rel="noopener">الهيئة العامة للإحصاء (GASTAT)</a> — التعداد، الديموغرافيا، متوسط دخل الأسرة</li>
                            <li><strong>الغرفة التجارية</strong> — بيانات القطاع التجاري</li>
                            <li><strong>الغرفة الصناعية</strong> — بيانات القطاع الصناعي</li>
                            <li><strong>معهد الإدارة العامة</strong> — دراسات متخصصة</li>
                            <li><a href="https://www.sama.gov.sa" target="_blank" rel="noopener">البنك المركزي السعودي (ساما)</a> — معدل التضخم، معدل الخصم</li>
                        </ul>
                        <p class="text-muted mt-3 mb-2 font-medium">دليل ربط الحقول بالمصادر:</p>
                        <table class="table-mini" style="font-size: 0.85rem; width: 100%; border-collapse: collapse;">
                            <tr style="border-bottom: 1px solid var(--c-border, #e2e8f0);"><td style="padding: 4px 8px;">التعداد، الديموغرافيا، السكان</td><td style="padding: 4px 8px;">← GASTAT</td></tr>
                            <tr style="border-bottom: 1px solid var(--c-border, #e2e8f0);"><td style="padding: 4px 8px;">بيانات القطاع، المنافسون</td><td style="padding: 4px 8px;">← الغرفة التجارية/الصناعية</td></tr>
                            <tr style="border-bottom: 1px solid var(--c-border, #e2e8f0);"><td style="padding: 4px 8px;">معدل الخصم، التضخم</td><td style="padding: 4px 8px;">← ساما</td></tr>
                            <tr style="border-bottom: 1px solid var(--c-border, #e2e8f0);"><td style="padding: 4px 8px;">المنافسون، الطلب، السعر</td><td style="padding: 4px 8px;">← زيارة ميدانية، استبيان</td></tr>
                            <tr style="border-bottom: 1px solid var(--c-border, #e2e8f0);"><td style="padding: 4px 8px;">التكاليف، الأسعار</td><td style="padding: 4px 8px;">← عروض أسعار، بنك مقارنات</td></tr>
                        </table>
                    </div>
                </details>

                <!-- تعريف المصطلحات (الفجوة المعيارية) -->
                <details class="card analysis-card" style="margin-bottom: 1rem;">
                    <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">📖 تعريف المصطلحات والرموز المستخدمة في الدراسة</summary>
                    <div class="mt-3" style="font-size: 0.9rem;">
                        <p class="text-muted mb-3">المصطلحات المالية الرئيسية الواردة في هذه الدراسة:</p>
                        <div style="display: grid; gap: 0.75rem;">
                            ${Object.values(FINANCIAL_TERMS || {}).slice(0, 8).map(t => `
                                <div style="border-right: 3px solid var(--c-p-500); padding-right: 0.75rem;">
                                    <strong>${t.term} (${t.abbr})</strong>: ${t.definition}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </details>

                <!-- 2. الهوية -->
                <div class="card analysis-card">
                    <h3 class="card-title">2. الهوية لفكرة المشروع</h3>
                    <div class="form-group relative">
                        <div class="flex-between mb-1">
                            <label>الهوية (وصف موجز للمشروع وهويته)</label>
                            <button type="button" class="btn-xs btn-magic text-xs text-gold hover:underline btn-ai-suggest" data-target="identity">✨ اقتراح</button>
                        </div>
                        <textarea id="identity" class="input" rows="2" placeholder="هوية المشروع وتميّزه...">${esc(pi.identityStatement)}</textarea>
                    </div>
                </div>

                ${!isQuickMode ? `
                <!-- 3. الأهداف الذكية (مرجعية) -->
                <div class="card analysis-card">
                    <h3 class="card-title">3. أهداف المشروع (الأهداف الذكية)</h3>
                    <p class="text-muted text-sm mb-3">الأهداف يجب أن تحقق الفكرة والهوية، وتُصاغ وفق SMART: <strong>محدد</strong>، <strong>قابل للقياس</strong>، <strong>قابل للتحقيق</strong>، <strong>مرتبط بالفكرة</strong>، <strong>ضمن إطار زمني</strong> (تاريخ بداية ونهاية)</p>
                    <div class="flex gap-2 flex-wrap">
                        <span class="badge">أهداف مسجلة: ${goals.length}</span>
                        <button type="button" class="btn-xs btn--primary btn-go-goals">← الانتقال إلى الأهداف الذكية</button>
                    </div>
                </div>
                ` : ''}

                <!-- 4. المنتجات -->
                <div class="card analysis-card">
                    <h3 class="card-title">3. المنتجات والخدمات</h3>
                    <p class="text-muted text-sm mb-3">أضف المنتجات والخدمات الرئيسية التي ستقدمها.</p>
                    <div class="products-section">
                        ${products.length === 0 ? '<p class="text-muted">لا توجد منتجات. اضغط "إضافة منتج"</p>' : products.map((p, i) => this.renderProductRow(p, i, esc)).join('')}
                    </div>
                    <button type="button" class="btn btn--sm btn--ghost btn-add-product mt-2">+ إضافة منتج</button>
                    
                    ${!isQuickMode ? `
                    <hr class="my-4 border-white/10">
                    <h4 class="text-sm font-bold mb-2">الخدمات</h4>
                    <div class="services-section">
                        ${introServices.length === 0 ? '<p class="text-muted">لا توجد خدمات. اضغط "إضافة خدمة"</p>' : introServices.map((s, i) => this.renderServiceRow(s, i, esc)).join('')}
                    </div>
                    <button type="button" class="btn btn--sm btn--ghost btn-add-service mt-2">+ إضافة خدمة</button>
                    ` : ''}
                </div>

                ${!isQuickMode ? `
                <!-- 6. القيمة لكل عميل -->
                <div class="card analysis-card">
                    <h3 class="card-title">6. القيمة في المشروع (لكل شريحة عميل)</h3>
                    <p class="text-muted text-sm mb-3">القيمة = تلبية احتياج + حل مشكلة. حدّد كل عميل: من هو، ماذا يريد، القيمة التي نقدمها (مثال: صاحب المقهى / المستهلك المباشر / الأسر المنتجة)</p>
                    <div class="customer-values-section">
                        ${customerValues.length === 0 ? '<p class="text-muted">لا توجد شرائح. اضغط "إضافة شريحة عميل"</p>' : customerValues.map((c, i) => this.renderCustomerValueRow(c, i, esc)).join('')}
                    </div>
                    <button type="button" class="btn btn--sm btn--ghost btn-add-customer mt-2">+ إضافة شريحة عميل</button>
                </div>
                ` : ''}

                <!-- 7. تحليل الموقع والجغرافي المكاني -->
                <div class="card analysis-card">
                    <h3 class="card-title">${isQuickMode ? '4. الموقع' : '7. تحليل اختيار الموقع (التحليل الجغرافي المكاني)'}</h3>
                    ${!isQuickMode ? `
                    <p class="text-muted text-sm mb-3">الإحداثيات، العنوان، الخريطة، ومقارنة المواقع البديلة لزيادة فرص النجاح</p>
                    <div class="form-row form-row--2">
                        <div class="form-group">
                            <label>خط العرض (Latitude)</label>
                            <input type="text" id="la-lat" class="input" placeholder="24.7136" value="${esc(la.coordinates?.lat ?? '')}">
                        </div>
                        <div class="form-group">
                            <label>خط الطول (Longitude)</label>
                            <input type="text" id="la-lng" class="input" placeholder="46.6753" value="${esc(la.coordinates?.lng ?? '')}">
                        </div>
                    </div>
                    <button type="button" class="btn btn--sm btn--ghost btn-geolocate mb-3" title="تحديد موقعي الحالي" aria-label="تحديد الموقع باستخدام GPS">📍 تحديد موقعي (GPS)</button>
                    ` : ''}
                    
                    <div class="form-group">
                        <label>العنوان ${!isQuickMode ? 'التفصيلي' : '(المدينة والحي)'}</label>
                        <input type="text" id="la-address" class="input" placeholder="المدينة، الحي، الشارع" value="${esc(la.address ?? '')}">
                    </div>

                    ${!isQuickMode ? `
                    ${this.renderMapIframe(la.coordinates)}
                    <hr class="my-4">
                    <div class="form-group relative">
                        <div class="flex-between mb-1">
                            <label>عوامل اختيار الموقع</label>
                            <button type="button" class="btn-xs btn-magic text-xs text-gold hover:underline btn-ai-suggest" data-target="la-factors">✨ ولّد</button>
                        </div>
                        <textarea id="la-factors" class="input" rows="2" placeholder="الكثافة السكانية، قرب العملاء، قرب المواصلات، مواقف السيارات، التكلفة، الواجهة...">${esc(la.selectionFactors)}</textarea>
                    </div>
                    <div class="form-group">
                        <label>سبب اختيار الموقع الحالي</label>
                        <input type="text" id="la-reason" class="input" placeholder="لماذا هذا الموقع؟" value="${esc(la.chosenReason)}">
                    </div>
                    <h4 class="mt-4 mb-2">مقارنة المواقع البديلة</h4>
                    <div class="location-alternatives-section">
                        ${(la.locationAlternatives || []).length === 0 ? '<p class="text-muted">لا توجد مواقع بديلة. اضغط "إضافة موقع"</p>' : (la.locationAlternatives || []).map((alt, i) => this.renderLocationAltRow(alt, i, esc)).join('')}
                    </div>
                    <button type="button" class="btn btn--sm btn--ghost btn-add-location-alt mt-2">+ إضافة موقع بديل</button>
                    ` : ''}
                </div>

                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents();
        this.checkQuickMode();
    }

    checkQuickMode() {
        const mode = localStorage.getItem('study_mode_preference');
        if (mode === 'quick') {
            // 1. Highlight Magic Buttons
            this.container.querySelectorAll('.btn-ai-suggest').forEach(btn => {
                btn.style.boxShadow = '0 0 8px var(--c-p-500)';
                btn.style.borderColor = 'var(--c-p-500)';
                btn.classList.add('animate-pulse'); // Ensure this class exists or add inline animation
            });

            // 2. Auto-open important sections
            const importantDetails = [
                'المؤهل العكسي', 
                'تقييم الفرضية'
            ];
            this.container.querySelectorAll('details').forEach(d => {
                const summaryText = d.querySelector('summary')?.textContent || '';
                if (importantDetails.some(k => summaryText.includes(k))) {
                    d.open = true;
                }
            });

            // 3. Show a helper toast if first time
            if (!sessionStorage.getItem('quick_mode_toast_shown')) {
                toast.info('💡 في الوضع السريع: استخدم الأزرار السحرية ✨ لتوليد المحتوى تلقائياً!');
                sessionStorage.setItem('quick_mode_toast_shown', 'true');
            }
        }
    }

    renderProductRow(p, i, esc) {
        const typeVal = p.type || 'final';
        return `
            <div class="product-card" data-idx="${i}">
                <div class="flex-between mb-2">
                    <select class="input input--sm product-type">
                        ${PRODUCT_TYPES.map(t => `<option value="${t.value}" ${typeVal === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                    </select>
                    <button type="button" class="btn-icon btn-remove-product" data-idx="${i}">🗑️</button>
                </div>
                <div class="form-group">
                    <input type="text" class="input product-name" placeholder="اسم المنتج" value="${esc(p.name)}">
                </div>
                <div class="form-group">
                    <textarea class="input input--sm product-desc" rows="2" placeholder="وصف المنتج">${esc(p.description)}</textarea>
                </div>
                <div class="form-group">
                    <input type="text" class="input product-unique" placeholder="الخصائص الفريدة" value="${esc(p.uniqueCharacteristics)}">
                </div>
                <div class="form-group">
                    <input type="text" class="input product-value" placeholder="القيمة المضافة" value="${esc(p.addedValue)}">
                </div>
                <div class="form-group">
                    <input type="text" class="input product-benefit" placeholder="فائدة للعميل" value="${esc(p.customerBenefit)}">
                </div>
            </div>
        `;
    }

    renderServiceRow(s, i, esc) {
        const typeVal = s.type || 'supportive';
        return `
            <div class="service-card" data-idx="${i}">
                <div class="flex-between mb-2">
                    <input type="text" class="input input--sm service-name" placeholder="اسم الخدمة" value="${esc(s.name)}">
                    <div class="flex gap-2">
                        <select class="input input--sm service-type">
                            ${SERVICE_TYPES.map(t => `<option value="${t.value}" ${typeVal === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                        </select>
                        <button type="button" class="btn-icon btn-remove-service" data-idx="${i}">🗑️</button>
                    </div>
                </div>
                <div class="form-group">
                    <textarea class="input input--sm service-desc" rows="2" placeholder="وصف الخدمة">${esc(s.description)}</textarea>
                </div>
            </div>
        `;
    }

    renderMapIframe(coords) {
        const lat = parseFloat(coords?.lat);
        const lng = parseFloat(coords?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
        const delta = 0.01;
        const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
        return `
            <div class="map-container mt-2 mb-3">
                <iframe width="100%" height="220" style="border:1px solid #ccc;border-radius:8px;" 
                    src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}" 
                    title="خريطة الموقع"></iframe>
            </div>
        `;
    }

    renderLocationAltRow(alt, i, esc) {
        return `
            <div class="location-alt-card" data-idx="${i}">
                <div class="flex-between mb-2">
                    <input type="text" class="input input--sm loc-alt-name" placeholder="اسم الموقع" value="${esc(alt.name)}">
                    <button type="button" class="btn-icon btn-remove-loc-alt" data-idx="${i}">🗑️</button>
                </div>
                <div class="form-group">
                    <input type="text" class="input input--sm loc-alt-address" placeholder="العنوان" value="${esc(alt.address)}">
                </div>
                <div class="form-row form-row--2">
                    <input type="text" class="input input--sm loc-alt-lat" placeholder="خط العرض" value="${esc(alt.lat ?? '')}">
                    <input type="text" class="input input--sm loc-alt-lng" placeholder="خط الطول" value="${esc(alt.lng ?? '')}">
                </div>
                <div class="form-group">
                    <input type="text" class="input input--sm loc-alt-notes" placeholder="ملاحظات / التقييم" value="${esc(alt.notes)}">
                </div>
            </div>
        `;
    }

    renderCustomerValueRow(c, i, esc) {
        return `
            <div class="customer-value-card" data-idx="${i}">
                <div class="flex-between mb-2">
                    <input type="text" class="input input--sm customer-type" placeholder="نوع العميل (مثال: صاحب المقهى)" value="${esc(c.customerType)}">
                    <button type="button" class="btn-icon btn-remove-customer" data-idx="${i}">🗑️</button>
                </div>
                <div class="form-group">
                    <input type="text" class="input customer-need" placeholder="ماذا يريد العميل؟" value="${esc(c.customerNeed)}">
                </div>
                <div class="form-group">
                    <input type="text" class="input customer-value" placeholder="القيمة التي نقدمها له" value="${esc(c.valueWeProvide)}">
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => this.onNavigate?.(this.stepIndex - 1));
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            this.saveAll();
            this.onNavigate?.(this.stepIndex + 1);
        });

        this.container.querySelector('.btn-go-goals')?.addEventListener('click', () => {
            this.onNavigate?.(this.stepIndex + 1);
        });

        this.container.querySelectorAll('#ic-feasibility, #ic-uniqueness, #ic-marketFit, #ic-resourceAvailability, #identity, #la-factors, #la-reason, #la-lat, #la-lng, #la-address').forEach(el => {
            el?.addEventListener('blur', () => this.save());
        });
        this.container.querySelectorAll('#hypothesis-problem, #hypothesis-solution, #hypothesis-insight, #ua-insight-text').forEach(el => {
            el?.addEventListener('blur', () => this.saveHypothesisAndAdvantage());
        });
        this.container.querySelectorAll('#pq-popular, #pq-growing, #pq-urgent, #pq-expensive, #pq-mandatory, #pq-frequent').forEach(el => {
            el?.addEventListener('change', () => this.saveHypothesisAndAdvantage());
        });
        this.container.querySelectorAll('.ua-type').forEach(el => {
            el?.addEventListener('change', () => this.saveHypothesisAndAdvantage());
        });
        this.container.querySelectorAll('#investor-profile, #tech-investment, #national-importance, #idea-strength, #experience-level').forEach(el => {
            el?.addEventListener('change', () => this.saveInvestorFields());
        });
        this.container.querySelector('.btn-geolocate')?.addEventListener('click', () => this.geolocate());
        this.container.querySelectorAll('.loc-alt-name, .loc-alt-address, .loc-alt-lat, .loc-alt-lng, .loc-alt-notes').forEach(el => {
            el?.addEventListener('change', () => this.saveLocationAlternatives());
        });
        this.container.querySelector('.btn-add-location-alt')?.addEventListener('click', () => this.addLocationAlt());
        this.container.querySelectorAll('.btn-remove-loc-alt').forEach(btn => btn.addEventListener('click', (e) => this.removeLocationAlt(parseInt(e.target.dataset.idx, 10))));

        this.container.querySelectorAll('.product-type, .product-name, .product-desc, .product-unique, .product-value, .product-benefit').forEach(el => {
            el?.addEventListener('change', () => this.saveProducts());
        });
        this.container.querySelectorAll('.service-name, .service-type, .service-desc').forEach(el => {
            el?.addEventListener('change', () => this.saveServices());
        });
        this.container.querySelectorAll('.customer-type, .customer-need, .customer-value').forEach(el => {
            el?.addEventListener('change', () => this.saveCustomerValues());
        });

        this.container.querySelector('.btn-generate-intro')?.addEventListener('click', () => this.generateIntro());
        this.container.querySelector('.btn-add-product')?.addEventListener('click', () => this.addProduct());
        this.container.querySelector('.btn-add-service')?.addEventListener('click', () => this.addService());
        this.container.querySelector('.btn-add-customer')?.addEventListener('click', () => this.addCustomer());

        this.container.querySelectorAll('.btn-remove-product').forEach(btn => btn.addEventListener('click', (e) => this.removeProduct(parseInt(e.target.dataset.idx, 10))));
        this.container.querySelectorAll('.btn-remove-service').forEach(btn => btn.addEventListener('click', (e) => this.removeService(parseInt(e.target.dataset.idx, 10))));
        this.container.querySelectorAll('.btn-remove-customer').forEach(btn => btn.addEventListener('click', (e) => this.removeCustomer(parseInt(e.target.dataset.idx, 10))));

        // AI Suggest Buttons
        this.container.querySelectorAll('.btn-ai-suggest').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = btn.dataset.target;
                this.generateFieldSuggestion(targetId);
            });
        });
    }

    generateFieldSuggestion(fieldId) {
        try {
            const state = this.store.getState();
            const el = this.container.querySelector('#' + fieldId);
            if (!el) return;

            // نص العميل المكتوب لا يُستبدل بلا إذن — كان الزر يمسح صياغته المخصصة فوراً
            // ويستبدلها بنص مولّد عام (فقدان عمل موثق في تدقيق ٢٠٢٦-٠٧-٠٦).
            if ((el.value || '').trim().length > 20) {
                const okReplace = window.confirm('يوجد نص مكتوب في هذا الحقل.\n\nموافق = استبداله بالنص المولد.\nإلغاء = الإبقاء على نصك.');
                if (!okReplace) return;
            }

            // Show loading state
            const originalVal = el.value;
            el.setAttribute('disabled', 'true');
            el.value = 'جاري التوليد...';

            setTimeout(() => {
                const suggestion = InternalAIGenerator.generateFieldSuggestion(fieldId, originalVal, state);
                el.value = suggestion;
                el.removeAttribute('disabled');

                // Trigger save
                if (fieldId === 'identity' || fieldId === 'la-factors') this.save();
                else if (fieldId === 'national-importance') this.saveInvestorFields();
                else this.saveHypothesisAndAdvantage();

                toast.success('تم اقتراح النص بنجاح ✨');
            }, 600); // Fake delay for UX
        } catch (err) {
            console.error(err);
            toast.error('حدث خطأ أثناء التوليد');
            // Restore?
            const el = this.container.querySelector('#' + fieldId);
            if (el) el.removeAttribute('disabled');
        }
    }

    saveHypothesisAndAdvantage() {
        const pi = { ...this.store.getState().projectInfo };
        pi.startupHypothesis = {
            problem: this.container.querySelector('#hypothesis-problem')?.value?.trim() || '',
            solution: this.container.querySelector('#hypothesis-solution')?.value?.trim() || '',
            insight: this.container.querySelector('#hypothesis-insight')?.value?.trim() || ''
        };
        pi.problemQualityChecklist = {
            popular: !!this.container.querySelector('#pq-popular')?.checked,
            growing: !!this.container.querySelector('#pq-growing')?.checked,
            urgent: !!this.container.querySelector('#pq-urgent')?.checked,
            expensive: !!this.container.querySelector('#pq-expensive')?.checked,
            mandatory: !!this.container.querySelector('#pq-mandatory')?.checked,
            frequent: !!this.container.querySelector('#pq-frequent')?.checked
        };
        const uaTypes = Array.from(this.container.querySelectorAll('.ua-type:checked')).map(el => el.value);
        pi.unfairAdvantage = {
            types: uaTypes,
            insightText: this.container.querySelector('#ua-insight-text')?.value?.trim() || ''
        };
        this.store.update('projectInfo', pi);
    }

    saveInvestorFields() {
        const pi = { ...this.store.getState().projectInfo };
        pi.investorProfile = this.container.querySelector('#investor-profile')?.value || '';
        pi.techInvestmentLevel = this.container.querySelector('#tech-investment')?.value || '';
        pi.nationalEconomicImportance = this.container.querySelector('#national-importance')?.value || '';
        const ideaStrength = this.container.querySelector('#idea-strength')?.value || '';
        const experienceLevel = this.container.querySelector('#experience-level')?.value || '';
        pi.inverseQualification = { ideaStrength, experienceLevel };
        this.store.update('projectInfo', pi);
        const hintEl = this.container.querySelector('#inverse-qual-hint');
        if (hintEl && ideaStrength === 'weak' && experienceLevel === 'low') {
            hintEl.textContent = 'فكرة ضعيفة + خبرة قليلة = ستحتاج أموالاً أكثر وتدقيقاً أكبر. عزّز الفكرة والخبرة أولاً أو ابحث عن شريك ذي خبرة.';
            hintEl.style.display = 'block';
        } else if (hintEl) hintEl.style.display = 'none';
    }

    save() {
        const pi = { ...this.store.getState().projectInfo };
        pi.ideaCriteria = {
            feasibility: this.container.querySelector('#ic-feasibility')?.value || '',
            uniqueness: this.container.querySelector('#ic-uniqueness')?.value || '',
            marketFit: this.container.querySelector('#ic-marketFit')?.value || '',
            resourceAvailability: this.container.querySelector('#ic-resourceAvailability')?.value || ''
        };
        pi.identityStatement = this.container.querySelector('#identity')?.value || '';
        const latVal = this.container.querySelector('#la-lat')?.value?.trim();
        const lngVal = this.container.querySelector('#la-lng')?.value?.trim();
        const lat = latVal ? parseFloat(latVal) : null;
        const lng = lngVal ? parseFloat(lngVal) : null;
        pi.locationAnalysis = {
            ...(pi.locationAnalysis || {}),
            selectionFactors: this.container.querySelector('#la-factors')?.value || '',
            alternativesComparison: pi.locationAnalysis?.alternativesComparison || '',
            chosenReason: this.container.querySelector('#la-reason')?.value || '',
            coordinates: { lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null },
            address: this.container.querySelector('#la-address')?.value || '',
            locationAlternatives: pi.locationAnalysis?.locationAlternatives || []
        };
        this.store.update('projectInfo', pi);
    }

    collectProducts() {
        const cards = this.container.querySelectorAll('.product-card');
        return Array.from(cards).map(card => ({
            type: card.querySelector('.product-type')?.value || 'final',
            name: card.querySelector('.product-name')?.value || '',
            description: card.querySelector('.product-desc')?.value || '',
            uniqueCharacteristics: card.querySelector('.product-unique')?.value || '',
            addedValue: card.querySelector('.product-value')?.value || '',
            customerBenefit: card.querySelector('.product-benefit')?.value || ''
        }));
    }

    collectServices() {
        const cards = this.container.querySelectorAll('.service-card');
        return Array.from(cards).map(card => ({
            name: card.querySelector('.service-name')?.value || '',
            type: card.querySelector('.service-type')?.value || 'supportive',
            description: card.querySelector('.service-desc')?.value || ''
        }));
    }

    collectCustomerValues() {
        const cards = this.container.querySelectorAll('.customer-value-card');
        return Array.from(cards).map(card => ({
            customerType: card.querySelector('.customer-type')?.value || '',
            customerNeed: card.querySelector('.customer-need')?.value || '',
            valueWeProvide: card.querySelector('.customer-value')?.value || ''
        }));
    }

    saveProducts() {
        const pi = { ...this.store.getState().projectInfo, products: this.collectProducts() };
        this.store.update('projectInfo', pi);
    }

    saveServices() {
        const pi = { ...this.store.getState().projectInfo, introServices: this.collectServices() };
        this.store.update('projectInfo', pi);
    }

    saveCustomerValues() {
        const pi = { ...this.store.getState().projectInfo, customerValues: this.collectCustomerValues() };
        this.store.update('projectInfo', pi);
    }

    collectLocationAlternatives() {
        const cards = this.container.querySelectorAll('.location-alt-card');
        return Array.from(cards).map(card => ({
            name: card.querySelector('.loc-alt-name')?.value || '',
            address: card.querySelector('.loc-alt-address')?.value || '',
            lat: card.querySelector('.loc-alt-lat')?.value || null,
            lng: card.querySelector('.loc-alt-lng')?.value || null,
            notes: card.querySelector('.loc-alt-notes')?.value || ''
        }));
    }

    saveLocationAlternatives() {
        const pi = { ...this.store.getState().projectInfo };
        pi.locationAnalysis = { ...(pi.locationAnalysis || {}), locationAlternatives: this.collectLocationAlternatives() };
        this.store.update('projectInfo', pi);
    }

    addLocationAlt() {
        const pi = { ...this.store.getState().projectInfo };
        const alts = [...(pi.locationAnalysis?.locationAlternatives || []), { name: '', address: '', lat: '', lng: '', notes: '' }];
        pi.locationAnalysis = { ...(pi.locationAnalysis || {}), locationAlternatives: alts };
        this.store.update('projectInfo', pi);
        this.render(this.stepIndex);
    }

    removeLocationAlt(idx) {
        const pi = { ...this.store.getState().projectInfo };
        const alts = (pi.locationAnalysis?.locationAlternatives || []).filter((_, i) => i !== idx);
        pi.locationAnalysis = { ...(pi.locationAnalysis || {}), locationAlternatives: alts };
        this.store.update('projectInfo', pi);
        this.render(this.stepIndex);
    }

    saveAll() {
        this.save();
        this.saveInvestorFields();
        this.saveHypothesisAndAdvantage();
        const pi = { ...this.store.getState().projectInfo };
        pi.products = this.collectProducts();
        pi.introServices = this.collectServices();
        pi.customerValues = this.collectCustomerValues();
        pi.locationAnalysis = { ...(pi.locationAnalysis || {}), locationAlternatives: this.collectLocationAlternatives() };
        this.store.update('projectInfo', pi);
    }

    addProduct() {
        const pi = { ...this.store.getState().projectInfo };
        pi.products = [...(pi.products || []), { type: 'final', name: '', description: '', uniqueCharacteristics: '', addedValue: '', customerBenefit: '' }];
        this.store.update('projectInfo', pi);
        this.render(this.stepIndex);
    }

    addService() {
        const pi = { ...this.store.getState().projectInfo };
        pi.introServices = [...(pi.introServices || []), { name: '', type: 'supportive', description: '' }];
        this.store.update('projectInfo', pi);
        this.render(this.stepIndex);
    }

    addCustomer() {
        const pi = { ...this.store.getState().projectInfo };
        pi.customerValues = [...(pi.customerValues || []), { customerType: '', customerNeed: '', valueWeProvide: '' }];
        this.store.update('projectInfo', pi);
        this.render(this.stepIndex);
    }

    removeProduct(idx) {
        const pi = { ...this.store.getState().projectInfo };
        pi.products = (pi.products || []).filter((_, i) => i !== idx);
        this.store.update('projectInfo', pi);
        this.render(this.stepIndex);
    }

    removeService(idx) {
        const pi = { ...this.store.getState().projectInfo };
        pi.introServices = (pi.introServices || []).filter((_, i) => i !== idx);
        this.store.update('projectInfo', pi);
        this.render(this.stepIndex);
    }

    removeCustomer(idx) {
        const pi = { ...this.store.getState().projectInfo };
        pi.customerValues = (pi.customerValues || []).filter((_, i) => i !== idx);
        this.store.update('projectInfo', pi);
        this.render(this.stepIndex);
    }

    geolocate() {
        if (!navigator.geolocation) {
            toast.error('المتصفح لا يدعم تحديد الموقع.');
            return;
        }
        const btn = this.container.querySelector('.btn-geolocate');
        if (btn) { btn.disabled = true; btn.textContent = 'جاري التحديد...'; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude.toFixed(6);
                const lng = pos.coords.longitude.toFixed(6);
                const latEl = this.container.querySelector('#la-lat');
                const lngEl = this.container.querySelector('#la-lng');
                if (latEl) latEl.value = lat;
                if (lngEl) lngEl.value = lng;
                this.save();
                toast.success('تم تحديد الموقع.');
                if (btn) { btn.disabled = false; btn.textContent = '📍 تحديد موقعي'; }
            },
            (err) => {
                toast.error('لم يتم تحديد الموقع: ' + (err.message || 'رفض أو غير متاح'));
                if (btn) { btn.disabled = false; btn.textContent = '📍 تحديد موقعي'; }
            },
            { timeout: 15000, enableHighAccuracy: false }
        );
    }

    generateIntro() {
        try {
            const state = this.store.getState();
            const out = InternalAIGenerator.generateIntroSuggestions(state);
            const pi = { ...state.projectInfo };

            // «التوليد التلقائي» كان يستبدل كل شيء بصمت — نقرة واحدة مسحت ٩ حقول كتبها
            // المستخدم بيده (هوية، قيمة مقترحة، معايير الفكرة، تحليل الموقع بإحداثياته —
            // تدقيق ٢٠٢٦-٠٧-٠٦). السلوك الجديد: تعبئة الحقول الفارغة فقط افتراضياً،
            // والاستبدال الشامل لا يتم إلا بموافقة صريحة.
            const filled = (v) => typeof v === 'string' && v.trim().length > 0;
            const overwriteTargets = [];
            if (filled(pi.identityStatement)) overwriteTargets.push('بيان الهوية');
            if (filled(pi.valueProposition)) overwriteTargets.push('القيمة المقترحة');
            if (Object.values(pi.ideaCriteria || {}).some(filled)) overwriteTargets.push('معايير الفكرة');
            if (Object.values(pi.locationAnalysis || {}).some(filled)) overwriteTargets.push('تحليل الموقع');
            if ((pi.products || []).length > 0) overwriteTargets.push('المنتجات');
            if ((pi.introServices || []).length > 0) overwriteTargets.push('الخدمات');
            if ((pi.customerValues || []).length > 0) overwriteTargets.push('القيمة للعميل');

            let replaceAll = false;
            if (overwriteTargets.length > 0) {
                replaceAll = window.confirm(
                    'الحقول التالية معبأة مسبقاً:\n• ' + overwriteTargets.join('\n• ') +
                    '\n\nموافق = استبدالها كلها بالنص المولد.\nإلغاء = تعبئة الحقول الفارغة فقط والإبقاء على ما كتبته.'
                );
            }

            const take = (genVal, curVal) => (replaceAll || !filled(curVal)) ? (genVal || curVal) : curVal;
            pi.identityStatement = take(out.identityStatement, pi.identityStatement);
            pi.valueProposition = take(out.valueProposition, pi.valueProposition);
            const ic = { ...(pi.ideaCriteria || {}) };
            Object.entries(out.ideaCriteria || {}).forEach(([k, v]) => { ic[k] = take(v, ic[k]); });
            pi.ideaCriteria = ic;
            const la = { ...(pi.locationAnalysis || {}) };
            Object.entries(out.locationAnalysis || {}).forEach(([k, v]) => {
                if (typeof v === 'string') la[k] = take(v, la[k]);
                else if (replaceAll || la[k] == null) la[k] = v;
            });
            pi.locationAnalysis = la;
            if (Array.isArray(out.products) && out.products.length > 0 && (replaceAll || (pi.products || []).length === 0)) pi.products = out.products;
            if (Array.isArray(out.introServices) && out.introServices.length > 0 && (replaceAll || (pi.introServices || []).length === 0)) pi.introServices = out.introServices;
            if (Array.isArray(out.customerValues) && out.customerValues.length > 0 && (replaceAll || (pi.customerValues || []).length === 0)) pi.customerValues = out.customerValues;

            this.store.update('projectInfo', pi);
            toast.success(replaceAll || overwriteTargets.length === 0
                ? 'تم توليد مقترح مقدمة الجدوى.'
                : 'تمت تعبئة الحقول الفارغة فقط — نصوصك المكتوبة لم تُمس.');
            this.render(this.stepIndex);
        } catch (e) {
            console.error('generateIntro error:', e);
            toast.error('فشل التوليد: ' + (e?.message || 'خطأ'));
        }
    }
}

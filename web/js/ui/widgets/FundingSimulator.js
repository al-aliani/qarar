/**
 * FundingSimulator.js
 * محاكي الموافقة المسبقة للتمويل (بنك التنمية الاجتماعية)
 * يفحص أهلية المستفيد والمشروع ويعطي نسبة قبول تقديرية.
 */

import { getLabel } from '../../core/labels.js';
import { calculateStudy as runFullModel } from '../../core/engine.js';

/**
 * دالة تقييم نقية (بلا DOM/متجر) — نفس قواعد بنك التنمية الاجتماعية الأصلية كما هي
 * تماماً، بالإضافة اختيارياً لمؤشرات حقيقية من دراسة المستخدم (DSCR محسوب من المحرك +
 * قيمة الضمانات المُدخلة في خطوة التمويل). المدخلات الإضافية اختيارية بالكامل: غيابها
 * (كالاستدعاء القديم) يترك النتيجة مطابقة تماماً لسلوك ما قبل هذا التعديل.
 */
export function computeEligibilityScore({
    age,
    nationality,
    isEmployed,
    hasDefaults,
    sector,
    computedDscr = null,
    targetDSCR = null,
    guaranteesValue = 0
} = {}) {
    let score = 100;
    let reasons = [];
    let status = 'high'; // high, medium, low, rejected

    // 2. Rules Engine (Based on SDB / Nufath)

    // Rule: Nationality
    if (nationality !== 'saudi') {
        score = 0;
        status = 'rejected';
        reasons.push('❌ التمويل متاح للسعوديين فقط حالياً.');
    }

    // Rule: Age (18-65) - some products 21-60
    if (age < 18) {
        score = 0;
        status = 'rejected';
        reasons.push('❌ العمر أقل من 18 سنة.');
    } else if (age > 65) {
        score = 0;
        status = 'rejected';
        reasons.push('❌ العمر تجاوز 65 سنة.');
    } else if (age < 21) {
        score -= 20; // Risk
        reasons.push('⚠️ العمر أقل من 21 (قد يتطلب كفيلاً أو منتجات محدودة).');
    } else if (age > 60) {
        score -= 20; // Risk
        reasons.push('⚠️ العمر فوق 60 (قد يتطلب شروطاً إضافية).');
    } else {
        reasons.push('✅ العمر مناسب (18-65).');
    }

    // Rule: Credit Defaults
    if (hasDefaults) {
        score -= 50; // Major impact
        status = score > 0 ? 'low' : 'rejected';
        reasons.push('🛑 وجود تعثرات مالية يقلل فرص القبول بشكل كبير (يجب المعالجة).');
    } else {
        reasons.push('✅ السجل الائتماني سليم.');
    }

    // Rule: Employment
    if (isEmployed) {
        // New rules allow employed but with specific products (Mumars Plus)
        score -= 10;
        reasons.push('ℹ️ الموظفون مؤهلون لمنتجات محددة (ممارسة) وليس التفرغ الكامل.');
    } else {
        reasons.push('✅ التفرغ يعزز فرص تمويل المشاريع الناشئة (ريادة).');
    }

    // Sector Check (Basic)
    if (/مقاولات|عقار|تأمين/i.test(sector)) {
        score -= 10;
        reasons.push('⚠️ بعض النشاطات (مقاولات/عقار) قد تكون مقيدة أو تتطلب خبرة محددة.');
    }

    // امتداد إضافي: مؤشرات حقيقية من نموذج الدراسة المالي (DSCR محسوب/ضمانات موثّقة) —
    // تُحسّن السجل فقط إن لم يكن مرفوضاً أصلاً بقاعدة أساسية، ولا تُطبَّق إطلاقاً حين تغيب
    // (توافق خلفي كامل مع أي استدعاء لا يمرّرها).
    if (status !== 'rejected') {
        if (computedDscr != null && targetDSCR != null) {
            if (computedDscr >= targetDSCR) {
                score += 10;
                reasons.push(`✅ نسبة تغطية خدمة الدين المحسوبة من نموذجك المالي ${computedDscr.toFixed(2)}x تفوق المستهدف ${targetDSCR.toFixed(2)}x.`);
            } else {
                score -= 10;
                reasons.push(`⚠️ نسبة تغطية خدمة الدين المحسوبة ${computedDscr.toFixed(2)}x أقل من المستهدف ${targetDSCR.toFixed(2)}x.`);
            }
        }
        if (guaranteesValue > 0) {
            score += 5;
            reasons.push('✅ وجود ضمانات موثّقة (رهن/كفالة) في خطوة التمويل يعزز فرص القبول.');
        }
    }

    if (score < 0) score = 0;
    if (score > 100) score = 100;

    return { score, status, reasons };
}

export class FundingSimulator {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.state = {
            age: 25,
            nationality: 'saudi',
            govEmployee: false,
            hasCommercialRegister: false, // هل لديك سجل تجاري سابق؟
            defaults: false,              // هل لديك تعثرات؟
            sector: ''
        };
    }

    render() {
        if (!this.container) return;

        // Get project info from store to pre-fill
        const projectInfo = this.store.get().projectInfo || {};
        this.state.sector = projectInfo.sector || projectInfo.concept || '';

        this.container.innerHTML = `
            <div class="funding-simulator card border-gold">
                <div class="card-header flex-between">
                    <h3 class="text-lg font-bold text-gold">🏦 محاكي قبول التمويل</h3>
                    <span class="badge badge--outline">Beta</span>
                </div>
                <div class="card-body">
                    <p class="text-sm text-muted mb-4">
                        افحص احتمالية قبول تمويلك لدى <strong class="text-white">بنك التنمية الاجتماعية</strong> قبل التقديم الرسمي.
                        <br><span class="text-xs text-red-300">* هذه النتائج تقديرية بناءً على الشروط العامة المعلنة.</span>
                    </p>

                    <form id="fundingSimForm" class="space-y-4">
                        <!-- Nationality -->
                        <div class="form-group">
                            <label for="simNationality" class="text-sm">الجنسية</label>
                            <select id="simNationality" name="nationality" class="input input-sm w-full">
                                <option value="saudi" selected>سعودي</option>
                                <option value="resident">مقيم</option>
                                <option value="gcc">خليجي</option>
                            </select>
                        </div>

                        <!-- Age -->
                        <div class="form-group">
                            <label for="simAge" class="text-sm">عمر المتقدم (سنة)</label>
                            <input type="number" id="simAge" name="age" class="input input-sm w-full" value="25" min="15" max="90">
                        </div>

                        <!-- Employment -->
                        <div class="form-group flex items-center gap-2">
                            <input type="checkbox" id="simGov" name="isEmployed" class="checkbox">
                            <label for="simGov" class="text-sm cursor-pointer">موظف حكومي / قطاع خاص؟</label>
                        </div>

                        <!-- Credit History -->
                        <div class="form-group flex items-center gap-2">
                            <input type="checkbox" id="simDefaults" name="hasDefaults" class="checkbox">
                            <label for="simDefaults" class="text-sm cursor-pointer text-red-300">هل لديك تعثرات مالية (سمة)؟</label>
                        </div>

                        <!-- Project Sector -->
                        <div class="form-group">
                            <label for="simSector" class="text-sm">نشاط المشروع</label>
                            <input type="text" id="simSector" name="sector" class="input input-sm w-full" value="${this.state.sector}" placeholder="مثال: مقهى، متجر...">
                        </div>

                        <button type="submit" class="btn btn--primary w-full mt-2">
                            🔍 احسب نسبة القبول
                        </button>
                    </form>

                    <div id="simResult" class="mt-4 hidden animate-fade-in p-3 rounded bg-white/5 border border-white/10">
                        <!-- Results render here -->
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const form = this.container.querySelector('#fundingSimForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.calculateEligibility();
        });
    }

    calculateEligibility() {
        // 1. Gather Data
        const age = parseInt(this.container.querySelector('#simAge').value) || 0;
        const nationality = this.container.querySelector('#simNationality').value;
        const isEmployed = this.container.querySelector('#simGov').checked;
        const hasDefaults = this.container.querySelector('#simDefaults').checked;
        const sector = this.container.querySelector('#simSector').value;

        // مدخلات حقيقية اختيارية من دراسة المستخدم نفسها: DSCR محسوب فعلياً من المحرك المالي
        // (فقط إن وُجد قرض بنكي مُدخل) + إجمالي قيمة الضمانات المسجَّلة في خطوة التمويل.
        // تعذّر أيٍّ منها (لا قرض/لا محرك/لا متجر) يُبقي التقييم على القواعد الأساسية فقط.
        let computedDscr = null;
        let targetDSCR = null;
        let guaranteesValue = 0;
        try {
            const state = this.store?.get ? this.store.get() : null;
            const financing = state?.financing || {};
            const guarantees = Array.isArray(financing.guarantees) ? financing.guarantees : [];
            guaranteesValue = guarantees.reduce((sum, g) => sum + (Number(g?.value) || 0), 0);
            const loanAmount = Number(financing.sources?.bankLoan?.amount || 0);
            if (state && loanAmount > 0) {
                const results = runFullModel(state);
                computedDscr = results?.indicators?.dscr ?? null;
                targetDSCR = Number.isFinite(Number(financing.targetDSCR)) ? Number(financing.targetDSCR) : 1.25;
            }
        } catch (_) {
            computedDscr = null;
        }

        const { score, status, reasons } = computeEligibilityScore({
            age, nationality, isEmployed, hasDefaults, sector,
            computedDscr, targetDSCR, guaranteesValue
        });

        // 3. Render Result
        let colorClass = 'text-green-500';
        let statusText = 'فرصة ممتازة';

        if (status === 'rejected' || score < 40) {
            colorClass = 'text-red-500';
            statusText = 'غير مؤهل حالياً';
        } else if (score < 70) {
            colorClass = 'text-yellow-500';
            statusText = 'فرصة متوسطة';
        }

        const resultDiv = this.container.querySelector('#simResult');
        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = `
            <div class="text-center mb-3">
                <span class="text-3xl font-bold ${colorClass}">${score}%</span>
                <p class="text-sm text-muted">${statusText}</p>
            </div>
            <ul class="text-xs space-y-2 text-right">
                ${reasons.map(r => `<li>${r}</li>`).join('')}
            </ul>
            <div class="mt-3 text-center">
                <a href="https://www.sdb.gov.sa/ar-sa/products/individual/riada" target="_blank" class="text-gold text-xs underline">🔗 تفاصيل منتجات بنك التنمية</a>
            </div>
        `;
    }
}

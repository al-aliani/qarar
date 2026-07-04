/**
 * الدراسة المبدئية — 3–5 أسئلة تأهيلية قبل الدخول في التفاصيل
 * "هل المشروع ممكن؟ مناسب للبيئة؟ لديك موارد أولية؟"
 * يمكن تخطيها للمستخدمين المتقدمين.
 */

export class PreliminaryCheckView {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
    }

    render() {
        const state = this.store.getState();
        const pc = state.preliminaryCheck || {};

        const esc = (s) => (s || '').toString().replace(/</g, '&lt;').replace(/"/g, '&quot;');

        this.container.innerHTML = `
            <div class="preliminary-check-view">
                <h2 class="section-title">🔍 الدراسة المبدئية</h2>
                <p class="text-muted mb-4">قبل الدخول في التفاصيل — أجب على الأسئلة التالية بناءً على جمع بيانات بسيطة من الأهل والأصدقاء والمعارف. <strong>يمكنك تخطي هذه الخطوة</strong> إذا كنت متقدماً.</p>

                <div class="alert alert--info mb-4" style="font-size: 0.9rem;">
                    <strong>المرحلة الأولى من دراسات الجدوى:</strong> جمع بيانات ومعلومات بشكل بسيط للإجابة: هل المشروع ممكن؟ مناسب للبيئة التي سأعمل فيها؟
                </div>
                <div class="alert alert--info mb-4" style="font-size: 0.85rem;">
                    <strong>استكشاف الفرص قبل الدراسة التفصيلية:</strong> استكشف الفرص عبر الغرف التجارية، الوزارات، مجلات الاستثمار — ثم ما قبل الجدوى: هل الحكومة تمنع؟ التمويل متوفر؟
                </div>

                <div class="card analysis-card mb-4">
                    <h3 class="card-title">أسئلة تأهيلية</h3>
                    <div class="form-group">
                        <label>1. هل المشروع ممكن تنفيذه؟ (بناءً على معلومات أولية)</label>
                        <textarea id="pc-feasible" class="input" rows="2" placeholder="نعم / غير متأكد / لا — وسبب مختصر">${esc(pc.isProjectFeasible)}</textarea>
                    </div>
                    <div class="form-group">
                        <label>2. هل المشروع مناسب للبيئة التي ستعمل فيها؟</label>
                        <textarea id="pc-environment" class="input" rows="2" placeholder="الموقع، المنطقة، طبيعة السوق...">${esc(pc.suitableForEnvironment)}</textarea>
                    </div>
                    <div class="form-group">
                        <label>3. هل لديك موارد أولية؟ (مال، خبرة، شبكة علاقات)</label>
                        <textarea id="pc-resources" class="input" rows="2" placeholder="ما المتوفر لديك للمشروع؟">${esc(pc.hasInitialResources)}</textarea>
                    </div>
                    <div class="form-group">
                        <label>4. هل أنت جاهز للدراسة التفصيلية؟</label>
                        <textarea id="pc-ready" class="input" rows="2" placeholder="هل لديك وقت وبيانات لإكمال الدراسة؟">${esc(pc.readyForDetailedStudy)}</textarea>
                    </div>
                </div>

                <!-- مبدأ الملاءمة (د. الروضي) — اختياري -->
                <details class="card analysis-card mb-4">
                    <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">✅ مبدأ الملاءمة — هل المشروع يناسبك؟</summary>
                    <div class="mt-3" style="font-size: 0.9rem;">
                        <p class="text-muted mb-2">اختر المجال الأنسب لسنك، دخلك، دولتك، بيئتك. تأمّل:</p>
                        <ul style="padding-right: 1.25rem; margin: 0;">
                            <li>هل يناسب سنك ومرحلة حياتك؟</li>
                            <li>هل يناسب البيئة/الدولة التي تعمل فيها؟</li>
                            <li>هل القطاع ملائم لخبرتك؟</li>
                            <li>هل الدخل المتوقع يتناسب مع أهدافك؟</li>
                        </ul>
                    </div>
                </details>

                <div class="flex-between gap-3">
                    <button type="button" class="btn btn--ghost btn-skip-preliminary">تخطي — لدي تجربة</button>
                    <button type="button" class="btn btn--primary btn-continue-preliminary">متابعة للدراسة التفصيلية ←</button>
                </div>
            </div>
        `;

        this._bindEvents();
    }

    _bindEvents() {
        const save = () => {
            const pc = {
                isProjectFeasible: document.getElementById('pc-feasible')?.value?.trim() || "",
                suitableForEnvironment: document.getElementById('pc-environment')?.value?.trim() || "",
                hasInitialResources: document.getElementById('pc-resources')?.value?.trim() || "",
                readyForDetailedStudy: document.getElementById('pc-ready')?.value?.trim() || ""
            };
            this.store.updatePath('preliminaryCheck', null, pc);
        };

        this.container.querySelector('.btn-continue-preliminary')?.addEventListener('click', () => {
            save();
            this.onNavigate(1); // templates
        });

        this.container.querySelector('.btn-skip-preliminary')?.addEventListener('click', () => {
            this.onNavigate(1); // templates — skip without saving
        });

        // Save on blur
        ['pc-feasible', 'pc-environment', 'pc-resources', 'pc-ready'].forEach(id => {
            document.getElementById(id)?.addEventListener('blur', save);
        });
    }
}

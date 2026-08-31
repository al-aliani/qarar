export class FranchiseHubView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="franchise-hub-view animate-entry">
                <!-- Header -->
                <div class="fh-header">
                    <div>
                        <h2 class="fh-title">
                            <svg class="ic" aria-hidden="true"><use href="#i-home"/></svg>
                            منصة الامتياز التجاري (Franchise Hub)
                        </h2>
                        <p class="fh-desc">عرض مفاهيمي لما يمكن أن تبدو عليه أداة تجهيز العلامة التجارية للامتياز — لا يوجد حالياً سوق مستثمرين متصل أو نشر فعلي للعلامة، والأرقام أدناه أمثلة توضيحية وليست محسوبة من بيانات مشروعك.</p>
                    </div>
                    <div class="fh-badge">
                        <div class="fh-badge-dot"></div>
                        <span>بيانات تجريبية (Demo)</span>
                    </div>
                </div>

                <div class="fh-grid">
                    <!-- Calculator -->
                    <div class="fh-panel">
                        <h3 class="fh-panel-title">
                            <svg class="ic" aria-hidden="true"><use href="#i-percent"/></svg>
                            حاسبة رسوم الامتياز العادلة
                        </h3>

                        <!-- Input Sliders Simulation -->
                        <div class="fh-slider-row">
                            <div class="fh-slider-head">
                                <label>قوة العلامة في السوق</label>
                                <span>متوسطة (جديدة نسبياً)</span>
                            </div>
                            <div class="fh-slider-track">
                                <div class="fh-slider-fill" style="width: 40%;"></div>
                            </div>
                        </div>

                        <div class="fh-slider-row">
                            <div class="fh-slider-head">
                                <label>هامش الربح الصافي للفرع</label>
                                <span>22%</span>
                            </div>
                            <div class="fh-slider-track">
                                <div class="fh-slider-fill fh-slider-fill--success" style="width: 60%;"></div>
                            </div>
                        </div>

                        <!-- Results -->
                        <div class="fh-results">
                            <div class="fh-result-row">
                                <span>النسبة المقترحة (Royalty Fee)</span>
                                <span class="fh-result-value">5.5%</span>
                            </div>
                            <div class="fh-result-row">
                                <span>رسوم التسويق الإلزامية</span>
                                <span class="fh-result-value">1.5%</span>
                            </div>
                            <div class="fh-result-row">
                                <span>الرسوم التأسيسية (Initial Fee)</span>
                                <span class="fh-result-value fh-result-value--plain">150,000 ريال</span>
                            </div>
                        </div>
                    </div>

                    <!-- Operations Manual & Readiness -->
                    <div class="fh-col">
                        <!-- Readiness Score -->
                        <div class="fh-readiness">
                            <h3>جاهزية منح الامتياز (Readiness Score)</h3>
                            <div class="fh-readiness-row">
                                <div class="fh-readiness-value">68<small>%</small></div>
                                <div class="fh-readiness-note">مشروعك بحاجة إلى توثيق دليل التشغيل واعتماد هوية بصرية صارمة قبل الطرح.</div>
                            </div>
                        </div>

                        <!-- Documents Gen -->
                        <div class="fh-panel fh-docs">
                            <h3 class="fh-panel-title">الأدلة التشغيلية (SOPs)</h3>
                            <p class="fh-docs-desc">سر نجاح أي فرنشايز هو "نقل المعرفة". قم بتوليد مسودات أدلة التشغيل القياسية بناءً على قطاع مشروعك.</p>

                            <div class="fh-doc-list">
                                <button class="fh-doc-btn" disabled title="بيانات تجريبية — توليد الأدلة غير متاح حالياً">
                                    <div>
                                        <div class="fh-doc-title">دليل العمليات اليومي</div>
                                        <div class="fh-doc-sub">Opening & Closing Procedures</div>
                                    </div>
                                    <svg class="ic" aria-hidden="true"><use href="#i-file-text"/></svg>
                                </button>

                                <button class="fh-doc-btn" disabled title="بيانات تجريبية — توليد الأدلة غير متاح حالياً">
                                    <div>
                                        <div class="fh-doc-title">دليل الموارد البشرية والتدريب</div>
                                        <div class="fh-doc-sub">Employee Handbook</div>
                                    </div>
                                    <svg class="ic" aria-hidden="true"><use href="#i-users"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: var(--s-4);">
                    <button type="button" class="btn btn--secondary btn-back-dashboard">
                        <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg>
                        العودة للوحة التحكم
                    </button>
                </div>
            </div>
        `;

        this.container.querySelector('.btn-back-dashboard')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        return this.container;
    }
}

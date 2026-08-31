export class DigitalReputationRadarView {
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
            <div class="digital-reputation-view animate-entry">
                <!-- Header -->
                <div class="dr-header">
                    <div>
                        <h2 class="dr-title">
                            <svg class="ic" aria-hidden="true"><use href="#i-target"/></svg>
                            رادار السمعة الرقمية (Reputation Radar)
                        </h2>
                        <p class="dr-desc">تصوّر لما يمكن أن تعرضه أداة مراقبة السمعة الرقمية على منصات مثل X وTikTok وGoogle Maps — الربط الفعلي بهذه المنصات غير متاح حالياً، ويحتاج اشتراكات API مدفوعة مع كل منصة على حدة.</p>
                    </div>
                    <div class="dr-badge">
                        <div class="dr-badge-dot"></div>
                        <span>بيانات تجريبية (Demo)</span>
                    </div>
                </div>

                <div class="dr-grid">
                    <!-- Global Sentiment -->
                    <div class="dr-col">
                        <div class="dr-sentiment-card">
                            <h3>مؤشر المشاعر العام — مثال توضيحي</h3>

                            <div class="dr-sentiment-value">75%</div>
                            <div class="dr-sentiment-caption">مثال افتراضي لمشاعر إيجابية (ليست بيانات حقيقية)</div>

                            <div class="dr-row">
                                <span class="dr-row-label">X (Twitter)</span>
                                <span class="dr-row-value dr-row-value--neutral">50% (محايد)</span>
                            </div>
                            <div class="dr-row">
                                <span class="dr-row-label">TikTok</span>
                                <span class="dr-row-value dr-row-value--negative">35% (سلبي)</span>
                            </div>
                            <div class="dr-row">
                                <span class="dr-row-label">Google Maps</span>
                                <span class="dr-row-value dr-row-value--positive">92% (إيجابي)</span>
                            </div>
                        </div>

                        <!-- Brand Keywords -->
                        <div class="dr-keyword-card">
                            <h4>أمثلة كلمات مفتاحية متكررة (توضيحي)</h4>
                            <div class="dr-chips">
                                <span class="dr-chip dr-chip--positive">"طعم رائع" (42)</span>
                                <span class="dr-chip dr-chip--negative">"تأخير الطلب" (18)</span>
                                <span class="dr-chip dr-chip--neutral">"التغليف" (12)</span>
                                <span class="dr-chip dr-chip--info">"الموقع" (8)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Example Feed & Alerts -->
                    <div class="dr-col">
                        <!-- Example Alert -->
                        <div class="dr-alert">
                            <div class="dr-alert-head">
                                <div class="dr-alert-title">
                                    <svg class="ic" aria-hidden="true"><use href="#i-warning"/></svg>
                                    مثال: إنذار مبكر لأزمة محتملة على TikTok
                                </div>
                                <div class="dr-alert-tag">مثال توضيحي</div>
                            </div>
                            <p class="dr-alert-body">هكذا يمكن أن يبدو تنبيه عندما يشتكي عميل من تأخر التوصيل ووصول القهوة باردة، لو كانت الأداة متصلة فعلياً بمصدر بيانات حقيقي.</p>

                            <div class="dr-alert-actions">
                                <button class="dr-alert-btn dr-alert-btn--primary" disabled title="مثال توضيحي — غير مفعّل">
                                    إطلاق كود خصم للاعتذار
                                </button>
                                <button class="dr-alert-btn" disabled title="مثال توضيحي — غير مفعّل">
                                    الرد المباشر على الحساب
                                </button>
                            </div>
                        </div>

                        <!-- Example Mentions Feed -->
                        <h3 class="dr-feed-title">أمثلة على إشارات متداولة (Mentions) — توضيحي</h3>

                        <div class="dr-mentions">
                            <!-- Mention 1 -->
                            <div class="dr-mention">
                                <div class="dr-mention-avatar">X</div>
                                <div class="dr-mention-body">
                                    <div class="dr-mention-top">
                                        <div class="dr-mention-name">@user_2910</div>
                                        <div class="dr-mention-tag">مثال</div>
                                    </div>
                                    <p class="dr-mention-text">تطبيقكم الجديد يفوز! واجهة سريعة وخدمة عملاء راقية. شكراً لكم</p>
                                </div>
                            </div>

                            <!-- Mention 2 -->
                            <div class="dr-mention">
                                <div class="dr-mention-avatar dr-mention-avatar--alt">
                                    <svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg>
                                </div>
                                <div class="dr-mention-body">
                                    <div class="dr-mention-top">
                                        <div class="dr-mention-name">Google Maps Review (فرع الملقا)</div>
                                        <div class="dr-mention-tag">مثال</div>
                                    </div>
                                    <div class="dr-mention-stars"><svg class="ic" aria-hidden="true"><use href="#i-star"/></svg><svg class="ic" aria-hidden="true"><use href="#i-star"/></svg><svg class="ic" aria-hidden="true"><use href="#i-star"/></svg><svg class="ic" aria-hidden="true"><use href="#i-star"/></svg><svg class="ic" aria-hidden="true"><use href="#i-star"/></svg></div>
                                    <p class="dr-mention-text">المكان هادئ ومناسب للعمل، والقهوة ممتازة كالعادة.</p>
                                </div>
                            </div>

                            <!-- Mention 3 -->
                            <div class="dr-mention dr-mention--flag">
                                <div class="dr-mention-avatar">X</div>
                                <div class="dr-mention-body">
                                    <div class="dr-mention-top">
                                        <div class="dr-mention-name">@angry_client</div>
                                        <div class="dr-mention-tag">مثال</div>
                                    </div>
                                    <p class="dr-mention-text">أسوأ تجربة! طلبت من ساعة ونص وللحين ما وصل الطلب ومحد يرد على خدمة العملاء</p>
                                    <div class="dr-mention-note">مثال — إنشاء تذكرة دعم فني تلقائياً غير متاح حالياً</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: var(--s-4);">
                    <button type="button" class="btn btn--secondary btn-back-dashboard">
                        <svg class="ic" aria-hidden="true"><use href="#i-home"/></svg>
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

/**
 * صفحة "استشارة إضافية" — متى تحتاج مراجعة استشاري + نموذج تواصل / رابط حجز.
 * استنساخ لنقاط قوة "جدوى الأعمال": روابط توجيهية لاستشارة تسويقية أو مراجعة إدارية.
 */
import { ConsultationModal } from './ConsultationModal.js';

export class AdvisoryView {
    constructor(containerId, store, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onBack = options.onBack || (() => {});
    }

    async render() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="advisory-view animate-entry p-6 max-w-3xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="advisoryBack">← رجوع</button>
                <h1 class="text-2xl font-bold mb-2">استشارة إضافية</h1>
                <p class="text-muted mb-6">متى تحتاج مراجعة استشاري؟ ومتى تكفي المنصة وحدها؟</p>

                <div class="card card-hover mb-6 p-6">
                    <h2 class="text-lg font-bold mb-4 text-gold">متى ننصح بمراجعة استشاري؟</h2>
                    <ul class="space-y-3 text-sm">
                        <li><strong>مرحلة التوسع:</strong> عند الانتقال من مشروع صغير إلى فروع أو استثمار أكبر، مراجعة استشاري تساعد في ضبط الأرقام والهيكل التمويلي.</li>
                        <li><strong>طلب تمويل كبير:</strong> عند التقديم لبنك أو جهة تمويل بمبالغ كبيرة، مراجعة مسبقة من محلل يزيد فرص القبول ويوضح نقاط القوة والضعف.</li>
                        <li><strong>تعقيد قانوني أو ضريبي:</strong> إذا كان المشروع يتضمن شراكات، امتيازات، أو التزامات زكوية/ضريبية معقدة، استشارة قانونية أو ضريبية مكملة للجدوى ضرورية.</li>
                        <li><strong>سوق تنافسي أو قطاع جديد:</strong> عند الدخول لقطاع لا تعرفه جيداً أو سوق مشبع، تحليل استشاري للسوق والمنافسين يكمّل الدراسة الرقمية.</li>
                    </ul>
                </div>

                <div class="card card-hover mb-6 p-6">
                    <h2 class="text-lg font-bold mb-4 text-gold">متى تكفي المنصة وحدها؟</h2>
                    <p class="text-sm text-muted mb-4">للأفكار الأولى، المشاريع الصغيرة والمتوسطة، وتقديم طلبات تمويل بمبالغ معقولة — إكمال دراسة الجدوى في المنصة وتصدير «نسخة للممول» غالباً كافٍ. يمكنك لاحقاً طلب استشارة إذا احتجت مراجعة قبل التقديم.</p>
                </div>

                <div class="card card-hover mb-6 p-6">
                    <h2 class="text-lg font-bold mb-4 text-gold">استشارة تسويقية أو مراجعة إدارية</h2>
                    <p class="text-sm text-muted mb-3">جدوى الأعمال — روابط توجيهية لمراجعة استشاري:</p>
                    <ul class="space-y-2 text-sm text-muted mb-4">
                        <li><strong class="text-gold">استشارة تسويقية:</strong> مراجعة تحليل السوق، المنافسين، خطة التسويق، وتوقعات المبيعات. مناسبة عند قطاع تنافسي أو سوق جديد.</li>
                        <li><strong class="text-gold">مراجعة إدارية:</strong> مراجعة الهيكل التنظيمي، الحوكمة، الموارد البشرية، وخطة التشغيل. مناسبة عند توسع أو تعقيد إداري.</li>
                    </ul>
                    <p class="text-xs text-muted mb-0">يمكنك حجز استشارة مع خبير عبر الزر أدناه — النبرة مساعدة وواضحة.</p>
                </div>

                <div class="flex flex-col sm:flex-row gap-3">
                    <button type="button" class="btn btn--primary" id="advisoryBookConsultation">
                        📞 احجز استشارة مع خبير
                    </button>
                    <button type="button" class="btn btn--ghost" id="advisoryBack2">← رجوع</button>
                </div>

                <p class="text-xs text-muted mt-6">النبرة مساعدة وواضحة. لا نعد باعتماد رسمي من جهة تمويل إلا بموجب اتفاق.</p>
            </div>
        `;

        this.container.querySelector('#advisoryBack')?.addEventListener('click', () => this.onBack());
        this.container.querySelector('#advisoryBack2')?.addEventListener('click', () => this.onBack());
        this.container.querySelector('#advisoryBookConsultation')?.addEventListener('click', () => {
            const modal = new ConsultationModal('consultationModalOverlay', this.store);
            modal.open();
        });
    }
}

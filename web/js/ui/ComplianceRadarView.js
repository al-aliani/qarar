export class ComplianceRadarView {
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
            <div class="compliance-radar-view" style="max-width:900px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnComplianceRadarBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>

                <div class="card glass-card mb-4" style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;">
                    <div>
                        <h2 class="section-title mb-2"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg> رادار التشريعات والامتثال (Compliance Radar)</h2>
                        <p class="text-muted mb-0">فكرة مبدئية لشاشة ترصد تحديثات الأنظمة والتراخيص المؤثرة على نشاطك — لا يوجد حالياً اتصال فعلي بأي جهة حكومية أو مصدر تشريعي حي، والأمثلة أدناه توضيحية فقط.</p>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;background:var(--c-bg-panel);padding:6px 12px;border-radius:999px;border:1px solid var(--c-border);white-space:nowrap;">
                        <span style="width:8px;height:8px;border-radius:50%;background:var(--c-warning);display:inline-block;"></span>
                        <span class="text-xs" style="font-weight:700;">بيانات تجريبية (Demo)</span>
                    </div>
                </div>

                <div class="alert alert--info mb-4">
                    <p class="mb-0">هذا العرض مفهوم قيد التطوير وليس ميزة فعّالة. الاشتراطات النظامية والتراخيص الخاصة بمنشأتك تُراجع من مصادرها الرسمية (مثل بلدية منطقتك أو الدفاع المدني أو هيئة الزكاة والضريبة والجمارك).</p>
                </div>

                <h3 class="card-title mb-2" style="font-size:.9rem;">مثال توضيحي لشكل تنبيه امتثال</h3>
                <div class="card mb-4" style="position:relative;overflow:hidden;">
                    <div style="position:absolute;inset-inline-start:0;top:0;width:4px;height:100%;background:var(--c-danger);"></div>
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span class="badge badge--danger">مثال — عالي الأهمية</span>
                            <span class="text-xs text-muted">وزارة الشؤون البلدية والقروية والإسكان (اسم توضيحي)</span>
                        </div>
                    </div>
                    <h4 class="mb-2" style="font-weight:700;">مثال: إلزام تركيب كاميرات مراقبة مرتبطة أمنياً</h4>
                    <p class="text-sm text-muted mb-3">هذا نص توضيحي لشكل التنبيه الذي قد تعرضه هذه الأداة مستقبلاً — وليس تنبيهاً حقيقياً صادراً عن أي جهة. تحقق دائماً من الاشتراطات الفعلية لنشاطك من الجهة الرسمية المختصة.</p>
                    <div class="alert alert--warning mb-0">
                        <p class="mb-0 text-sm">تكلفة تقديرية توضيحية للمثال: <strong>8,500 ريال</strong> — رقم افتراضي لأغراض العرض فقط، وليس تقديراً محسوباً من بيانات مشروعك.</p>
                    </div>
                </div>

                <h3 class="card-title mb-2" style="font-size:.9rem;">مثال توضيحي لمؤشرات جاهزية الامتثال</h3>
                <div class="card mb-4">
                    <p class="text-xs text-muted mb-3">الأرقام التالية أمثلة ثابتة لتوضيح شكل الواجهة المستقبلية، وليست محسوبة من بيانات دراستك.</p>
                    <div style="display:grid;gap:10px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                            <span class="text-sm">التراخيص سارية المفعول (مثال)</span>
                            <span class="badge badge--success">مثال: 100%</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                            <span class="text-sm">الامتثال الضريبي — فوترة إلكترونية (مثال)</span>
                            <span class="badge badge--success">مثال: 100%</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                            <span class="text-sm">اشتراطات الدفاع المدني (مثال)</span>
                            <span class="badge badge--warning">مثال: 75%</span>
                        </div>
                    </div>
                </div>

                <p class="text-xs text-muted mb-0">ملاحظة: لمتابعة نسب التوطين (نطاقات) ومقارنة تكلفة التوظيف الفعلية، استخدم «محاكي الموارد البشرية والرواتب» — وهو الأداة الحية المخصصة لهذا الغرض.</p>
            </div>
        `;

        this.container.querySelector('#btnComplianceRadarBack')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        return this.container;
    }
}

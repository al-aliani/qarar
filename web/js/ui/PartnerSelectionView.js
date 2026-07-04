/**
 * رحلة "معايير اختيار شريك أو ممول" (التحسين الاختياري — المنافس 2 الجدوى)
 * صفحة مخصّصة لاختيار شريك استثماري أو ممول: معايير، قائمة تحقق، روابط.
 */

import { RESOURCES_GUIDANCE_LINKS } from '../config.js';

export class PartnerSelectionView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onBack = options.onBack || (() => {});
    }

    render() {
        if (!this.container) return;

        const criteria = [
            { title: 'التوافق الاستراتيجي', desc: 'أن تتفق رؤية الشريك/الممول مع رؤية المشروع ومرحلة النمو (بذرة، نمو، توسع).' },
            { title: 'الشروط والضمانات', desc: 'وضوح نسبة الفائدة، فترة السماح، الضمانات المطلوبة، والالتزامات القانونية.' },
            { title: 'المرونة والجدولة', desc: 'إمكانية إعادة الجدولة أو الهيكلة عند ظروف استثنائية دون عقوبات مبالغ فيها.' },
            { title: 'الدعم غير المالي', desc: 'هل يقدم الممول أو الشريك إرشاداً أو شبكة علاقات (مثلاً مسرّعات وحاضنات).' },
            { title: 'السمعة والشفافية', desc: 'التحقق من سمعة الجهة ومراجعة عقود ونماذج من مستفيدين سابقين إن أمكن.' }
        ];

        const checklist = [
            'دراسة الجدوى مكتملة وجاهزة للمراجعة',
            'ملخص تنفيذي ومالي واضح',
            'تحليل مخاطر وخطط مواجهة',
            'بيانات الاتصال والفريق محدثة',
            'معرفة متطلبات الجهة المستهدفة (بنك، صندوق، مسرّعة)'
        ];

        const linksHtml = (RESOURCES_GUIDANCE_LINKS || []).slice(0, 4).map(item => `
            <a href="${item.url || '#'}" target="_blank" rel="noopener noreferrer" class="text-gold font-medium">${item.name}</a>
        `).join(' • ');

        this.container.innerHTML = `
            <div class="partner-selection-view animate-entry p-6 max-w-2xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="partnerBack">← رجوع</button>
                <h1 class="text-2xl font-bold mb-2">رحلة الشريك — معايير الممول</h1>
                <p class="text-gold text-sm font-medium mb-2">معايير اختيار شريك أو ممول</p>
                <p class="text-muted mb-6">رحلة مساعدة لاختيار جهة تمويل أو شريك استثماري بناءً على معايير واضحة. المنصة لا تقدم التمويل ولا تتعهد بنتائج التقديم.</p>

                <h2 class="text-lg font-bold text-gold mb-3">معايير أساسية</h2>
                <ul class="space-y-3 mb-8">
                    ${criteria.map(c => `
                        <li class="card p-4">
                            <strong>${c.title}</strong>
                            <p class="text-sm text-muted mt-1">${c.desc}</p>
                        </li>
                    `).join('')}
                </ul>

                <h2 class="text-lg font-bold text-gold mb-3">قائمة تحقق قبل التقديم</h2>
                <ul class="list-disc list-inside space-y-2 mb-6 text-sm">
                    ${checklist.map(item => `<li>${item}</li>`).join('')}
                </ul>

                <div class="card p-4 bg-white/5 border border-white/10 mb-6">
                    <p class="text-sm font-medium mb-2">جهات مفيدة للتمويل والشراكات:</p>
                    <p class="text-sm text-muted">${linksHtml}</p>
                    <p class="text-xs text-muted mt-2">للاستشارة الميدانية أو الربط بممول، تواصل مع الغرفة التجارية في منطقتك أو الجهة المعنية أعلاه.</p>
                </div>
            </div>
        `;

        this.container.querySelector('#partnerBack')?.addEventListener('click', () => this.onBack());
    }
}

/**
 * صفحة "موارد وإرشاد" — جهات مفيدة (الغرفة التجارية، تمويل، منشآت)
 * ربط المستخدم بالجهات المفيدة دون التعهد بخدمات طرف ثالث. نبرة مساعدة ومحايدة.
 */
import { RESOURCES_GUIDANCE_LINKS } from '../config.js';
import { escapeHtml } from '../utils/escape.js';

export class ResourcesGuideView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onBack = options.onBack || (() => {});
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="resources-guide-view animate-entry p-6 max-w-2xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="resourcesBack">← رجوع</button>
                <h1 class="text-2xl font-bold mb-2">موارد وإرشاد</h1>
                <h2 class="text-lg text-gold mb-6">أين أذهب بعد الدراسة؟</h2>
                <p class="text-muted mb-6">قائمة بجهات مفيدة للاستشارة الميدانية أو الربط بالتمويل والخدمات. المنصة لا تقدم خدمات هذه الجهات ولا تتعهد بها.</p>

                <div class="space-y-4 mb-8">
                    ${(RESOURCES_GUIDANCE_LINKS || []).map(item => `
                        <div class="card card-hover p-4">
                            <a href="${escapeHtml(item.url || '#')}" target="_blank" rel="noopener noreferrer" class="text-gold font-bold block mb-2">${escapeHtml(item.name)}</a>
                            <p class="text-sm text-muted">${escapeHtml(item.description || '')}</p>
                            ${item.name === 'منشآت' ? '<p class="text-xs text-muted mt-2">للاطلاع على النموذج الاسترشادي الرسمي لدراسة الجدوى وتحديثاته، استخدم الرابط أعلاه.</p>' : ''}
                        </div>
                    `).join('')}
                </div>

                <div class="card p-4 bg-white/5 border border-white/10">
                    <p class="text-sm text-gold font-medium mb-1">جملة توجيهية (الغرفة التجارية):</p>
                    <p class="text-sm">للحصول على استشارة ميدانية أو ربط بممول، يمكن التواصل مع <strong>الغرفة التجارية في منطقتك</strong> أو الجهة المعنية أعلاه. المنصة لا تتعهد بخدمات هذه الجهات.</p>
                </div>
            </div>
        `;

        this.container.querySelector('#resourcesBack')?.addEventListener('click', () => this.onBack());
    }
}

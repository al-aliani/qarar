import { escapeAttr, escapeHtml } from '../utils/escape.js';
import { trackEvent } from '../utils/analytics.js';

const downloadIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>';
const fileIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';
const searchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>';

// بطاقة الدراسة تعرض شارة مصدر صريحة حين لا يكون البلد "SA" — قرار لجنة
// استشارية ثلاثية (امتثال قانوني/محتوى/ثقة عميل): التنويه العام أعلى الصفحة
// وحده لا يكفي لأن حقل country نفسه كان كذباً حقلياً صريحاً لـ97+ دراسة.
const SOURCE_COUNTRY_LABELS = { JO: 'الأردن', EG: 'مصر', IQ: 'العراق', UNSPECIFIED: 'غير محدد' };

export class ReadyStudiesView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.catalog = null;
        this.search = '';
        this.categories = [];
        this.tags = [];
        this.languages = [];
        this.loaded = false;
    }

    async render() {
        if (!this.container) return;
        if (!this.loaded) {
            this.container.innerHTML = `
                <div class="rs-loading" role="status" aria-live="polite">
                    <div class="loader"></div>
                    <p>جاري تجهيز فهرس دراسات الجدوى…</p>
                </div>
            `;
            try {
                const response = await fetch('/data/ready-studies.json', { cache: 'no-store' });
                if (!response.ok) throw new Error(`studies catalogue request failed: ${response.status}`);
                this.catalog = await response.json();
                this.loaded = true;
            } catch (error) {
                console.error('Ready studies catalogue failed:', error);
                this.container.innerHTML = `
                    <div class="rs-error" role="alert">
                        <strong>تعذّر تحميل فهرس الدراسات.</strong>
                        <p>تأكد من وجود مجلد «درسات جدوى» ثم أعد المحاولة.</p>
                        <button type="button" class="btn btn--secondary" data-rs-retry>إعادة المحاولة</button>
                    </div>
                `;
                this.container.querySelector('[data-rs-retry]')?.addEventListener('click', () => {
                    this.loaded = false;
                    this.render();
                });
                return;
            }
        }
        this.draw();
    }

    getFilteredStudies() {
        const studies = this.catalog?.studies || [];
        const query = this.search.trim().toLocaleLowerCase('ar');
        return studies.filter((study) => {
            const matchesCategory = !this.categories.length || this.categories.includes(study.category);
            const matchesTag = !this.tags.length || (study.tags || []).some((tag) => this.tags.includes(tag));
            const matchesLanguage = !this.languages.length || this.languages.includes(study.language);
            if (!matchesCategory || !matchesTag || !matchesLanguage) return false;
            if (!query) return true;
            const haystack = [study.title, study.filename, study.categoryLabel, study.excerpt, ...(study.tags || [])]
                .join(' ')
                .toLocaleLowerCase('ar');
            return haystack.includes(query);
        });
    }

    getSearchSuggestions() {
        const query = this.search.trim().toLocaleLowerCase('ar');
        if (query.length < 2) return [];
        const suggestions = new Map();
        const add = (value, type) => {
            const text = String(value || '').trim();
            if (!text || suggestions.has(text)) return;
            const normalized = text.toLocaleLowerCase('ar');
            const position = normalized.indexOf(query);
            if (position === -1) return;
            suggestions.set(text, { text, type, score: position === 0 ? 0 : 1 });
        };
        for (const study of this.catalog?.studies || []) {
            add(study.title, 'دراسة');
            add(study.categoryLabel, 'تصنيف');
            for (const tag of study.tags || []) add(tag, 'وسم');
        }
        return [...suggestions.values()]
            .sort((a, b) => a.score - b.score || a.text.localeCompare(b.text, 'ar'))
            .slice(0, 8);
    }

    getLanguageOptions() {
        const labels = { ar: 'عربي', en: 'إنجليزي', mixed: 'عربي وإنجليزي' };
        const counts = new Map();
        for (const study of this.catalog?.studies || []) {
            const lang = study.language;
            if (!lang) continue;
            counts.set(lang, (counts.get(lang) || 0) + 1);
        }
        return [...counts.entries()]
            .map(([value, count]) => ({ value, label: labels[value] || value, count }))
            .sort((a, b) => b.count - a.count);
    }

    draw() {
        const catalog = this.catalog || { total: 0, categories: [], tags: [], studies: [] };
        const filtered = this.getFilteredStudies();
        const categories = catalog.categories || [];
        const tags = catalog.tags || [];
        const hasFilters = Boolean(this.search.trim() || this.categories.length || this.tags.length || this.languages.length);
        const suggestions = this.getSearchSuggestions();
        const languageOptions = this.getLanguageOptions();
        const categorySummary = this.categories.length ? `${this.categories.length} محدد` : 'كل التصنيفات';
        const tagSummary = this.tags.length ? `${this.tags.length} محدد` : 'كل الوسوم';
        const languageSummary = this.languages.length ? `${this.languages.length} محدد` : 'كل اللغات';
        const categoryOptions = categories.map((category) => `
            <label class="rs-filter-option">
                <input type="checkbox" data-rs-category-option value="${escapeAttr(category.id)}" ${this.categories.includes(category.id) ? 'checked' : ''} />
                <span>${escapeHtml(category.label)}</span><small>${escapeHtml(category.count)}</small>
            </label>
        `).join('');
        const tagOptions = tags.map((tag) => `
            <label class="rs-filter-option">
                <input type="checkbox" data-rs-tag-option value="${escapeAttr(tag.label)}" ${this.tags.includes(tag.label) ? 'checked' : ''} />
                <span>${escapeHtml(tag.label)}</span><small>${escapeHtml(tag.count)}</small>
            </label>
        `).join('');
        const languageOptionsHtml = languageOptions.map((lang) => `
            <label class="rs-filter-option">
                <input type="checkbox" data-rs-language-option value="${escapeAttr(lang.value)}" ${this.languages.includes(lang.value) ? 'checked' : ''} />
                <span>${escapeHtml(lang.label)}</span><small>${escapeHtml(lang.count)}</small>
            </label>
        `).join('');
        const suggestionsHtml = suggestions.length ? `
            <div class="rs-suggestions" role="listbox" aria-label="اقتراحات البحث">
                ${suggestions.map((suggestion) => `
                    <button type="button" class="rs-suggestion" data-rs-suggestion="${escapeAttr(suggestion.text)}" role="option">
                        <span>${escapeHtml(suggestion.text)}</span><small>${escapeHtml(suggestion.type)}</small>
                    </button>
                `).join('')}
            </div>
        ` : '';

        const disclosureNote = catalog.disclosureNote || '';
        this.container.innerHTML = `
            <div class="ready-studies" dir="rtl">
                ${disclosureNote ? `
                <div class="rs-notice" role="note">
                    <span class="rs-notice__mark">!</span>
                    <span>${escapeHtml(disclosureNote)}</span>
                </div>
                ` : ''}
                <div class="rs-hero">
                    <div class="rs-hero__icon">${fileIcon}</div>
                    <div>
                        <p class="rs-eyebrow">مكتبة جاهزة للتحميل</p>
                        <h2 class="dv-section__title">دراسات جدوى جاهزة</h2>
                        <p class="rs-hero__copy">نماذج ودراسات جاهزة مرتبة حسب النشاط، مع وسوم تساعدك على الوصول للملف المناسب بسرعة.</p>
                    </div>
                    <div class="rs-hero__stats" aria-label="إحصاءات المكتبة">
                        <strong>${escapeHtml(catalog.total)}</strong>
                        <span>ملف قابل للتحميل</span>
                    </div>
                </div>

                <div class="rs-intro-box">
                    <h3>فكرة مكتبة دراسات الجدوى الجاهزة:</h3>
                    <ul>
                        <li><strong>الاسترشاد والاستلهام:</strong> فهم كيفية تنظيم المشاريع في قطاعك وتسعيرها وتجهيزها.</li>
                        <li><strong>معرفة هيكل التكاليف:</strong> تصور مبدئي لرأس المال المطلوب والتشغيل لتجنب التخمين الخاطئ.</li>
                        <li><strong>تسريع قرار اختيار الفكرة:</strong> مقارنة الأرباح والمخاطر لعدة أفكار لاختيار الأنسب لك.</li>
                        <li><strong>نموذج تعليمي:</strong> خريطة طريق توضح لك شكل التقرير الاحترافي قبل استخدام أدواتنا لإنشاء دراستك المخصصة بأرقامك الواقعية.</li>
                    </ul>
                </div>

                <div class="rs-notice" role="note">
                    <span class="rs-notice__mark">م</span>
                    <span>هذه الملفات نماذج للاسترشاد وبناء التصور الأولي. راجع الأرقام والاشتراطات حسب مدينتك ونشاطك قبل الاعتماد أو التقديم لجهة تمويل.</span>
                </div>

                <div class="rs-toolbar" role="search" aria-label="البحث في دراسات الجدوى الجاهزة">
                    <div class="rs-search-wrap">
                        <label class="rs-search">
                            ${searchIcon}
                            <span class="sr-only">ابحث في الدراسات</span>
                            <input type="search" data-rs-search placeholder="اكتب حرفين على الأقل لعرض الاقتراحات…" value="${escapeAttr(this.search)}" autocomplete="off" />
                        </label>
                        ${suggestionsHtml}
                    </div>
                    <details class="rs-multi-select">
                        <summary><span>التصنيفات</span><strong>${escapeHtml(categorySummary)}</strong></summary>
                        <div class="rs-filter-menu">
                            <button type="button" class="rs-filter-clear" data-rs-clear-categories>عرض كل التصنيفات</button>
                            ${categoryOptions}
                        </div>
                    </details>
                    <details class="rs-multi-select">
                        <summary><span>الوسوم</span><strong>${escapeHtml(tagSummary)}</strong></summary>
                        <div class="rs-filter-menu">
                            <button type="button" class="rs-filter-clear" data-rs-clear-tags>عرض كل الوسوم</button>
                            ${tagOptions}
                        </div>
                    </details>
                    <details class="rs-multi-select">
                        <summary><span>اللغة</span><strong>${escapeHtml(languageSummary)}</strong></summary>
                        <div class="rs-filter-menu">
                            <button type="button" class="rs-filter-clear" data-rs-clear-languages>عرض كل اللغات</button>
                            ${languageOptionsHtml}
                        </div>
                    </details>
                    ${hasFilters ? '<button type="button" class="btn btn--ghost btn--sm" data-rs-clear>مسح التصفية</button>' : ''}
                </div>

                <div class="rs-results-bar">
                    <strong>${escapeHtml(filtered.length)} دراسة معروضة</strong>
                    <span>${hasFilters ? `من أصل ${escapeHtml(catalog.total)}` : 'مرتبة حسب مجلدات المصدر'}</span>
                </div>

                ${filtered.length ? `<div class="rs-grid">${filtered.map((study) => this.renderCard(study)).join('')}</div>` : `
                    <div class="rs-empty">
                        <div class="rs-empty__icon">${searchIcon}</div>
                        <h3>لا توجد نتائج بهذه التصفية</h3>
                        <p>جرّب كلمة بحث أخرى أو اعرض كل التصنيفات.</p>
                        <button type="button" class="btn btn--secondary btn--sm" data-rs-clear>عرض كل الدراسات</button>
                    </div>
                `}
            </div>
        `;
        this.bindEvents();
    }

    renderCard(study) {
        const tags = (study.tags || []).slice(0, 4).map((tag) => `<span class="rs-tag">${escapeHtml(tag)}</span>`).join('');
        const excerpt = study.excerpt || 'دراسة جدوى جاهزة للاطلاع والتحميل.';
        const sourceCountryBadge = (study.country && study.country !== 'SA')
            ? `<span class="rs-card__source-badge">مصدر: ${escapeHtml(SOURCE_COUNTRY_LABELS[study.country] || study.country)}</span>`
            : '';
        return `
            <article class="rs-card">
                <div class="rs-card__meta">
                    <span class="rs-card__category">${escapeHtml(study.categoryLabel)}</span>
                    <span class="rs-card__format">${escapeHtml(study.format)} · ${escapeHtml(study.sizeLabel)}</span>
                </div>
                ${sourceCountryBadge}
                <h3 class="rs-card__title">${escapeHtml(study.title)}</h3>
                <p class="rs-card__excerpt">${escapeHtml(excerpt)}</p>
                <div class="rs-card__tags">${tags}</div>
                <div class="rs-card__actions">
                    <a class="btn btn--primary btn--sm" href="${escapeAttr(study.url)}" download="${escapeAttr(study.downloadName || `${study.title}.pdf`)}" data-rs-track data-study-id="${escapeAttr(study.id)}" data-category="${escapeAttr(study.category)}" data-action="download">${downloadIcon} تحميل الدراسة</a>
                    <a class="rs-card__preview" href="${escapeAttr(study.url)}" target="_blank" rel="noopener noreferrer" data-rs-track data-study-id="${escapeAttr(study.id)}" data-category="${escapeAttr(study.category)}" data-action="preview">عرض الملف</a>
                </div>
            </article>
        `;
    }

    bindEvents() {
        const search = this.container.querySelector('[data-rs-search]');
        search?.addEventListener('input', (event) => {
            this.search = event.target.value || '';
            this.draw();
            const input = this.container.querySelector('[data-rs-search]');
            input?.focus();
            input?.setSelectionRange(this.search.length, this.search.length);
        });
        this.container.querySelectorAll('[data-rs-category-option]').forEach((input) => {
            input.addEventListener('change', () => {
                this.categories = [...this.container.querySelectorAll('[data-rs-category-option]:checked')]
                    .map((option) => option.value);
                this.draw();
            });
        });
        this.container.querySelectorAll('[data-rs-tag-option]').forEach((input) => {
            input.addEventListener('change', () => {
                this.tags = [...this.container.querySelectorAll('[data-rs-tag-option]:checked')]
                    .map((option) => option.value);
                this.draw();
            });
        });
        this.container.querySelectorAll('[data-rs-language-option]').forEach((input) => {
            input.addEventListener('change', () => {
                this.languages = [...this.container.querySelectorAll('[data-rs-language-option]:checked')]
                    .map((option) => option.value);
                this.draw();
            });
        });
        this.container.querySelectorAll('[data-rs-suggestion]').forEach((button) => {
            button.addEventListener('click', () => {
                this.search = button.dataset.rsSuggestion || '';
                this.draw();
                const input = this.container.querySelector('[data-rs-search]');
                input?.focus();
                input?.setSelectionRange(this.search.length, this.search.length);
            });
        });
        this.container.querySelector('[data-rs-clear-categories]')?.addEventListener('click', () => {
            this.categories = [];
            this.draw();
        });
        this.container.querySelector('[data-rs-clear-tags]')?.addEventListener('click', () => {
            this.tags = [];
            this.draw();
        });
        this.container.querySelector('[data-rs-clear-languages]')?.addEventListener('click', () => {
            this.languages = [];
            this.draw();
        });
        this.container.querySelectorAll('[data-rs-clear]').forEach((button) => {
            button.addEventListener('click', () => {
                this.search = '';
                this.categories = [];
                this.tags = [];
                this.languages = [];
                this.draw();
            });
        });
        this.container.querySelectorAll('[data-rs-track]').forEach((link) => {
            link.addEventListener('click', () => {
                trackEvent('ready_study_opened', {
                    study_id: link.dataset.studyId,
                    category: link.dataset.category,
                    action: link.dataset.action,
                });
            });
        });
    }
}

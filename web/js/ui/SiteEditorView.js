import * as SiteContent from '../services/SiteContentService.js';
import { escapeHtml } from '../utils/escape.js';
import { toast } from '../utils/toast.js';
import * as AdminService from '../services/AdminService.js';

const STATUS_LABELS = { draft: 'مسودة', published: 'منشورة', disabled: 'معطلة' };
const LOCATION_LABELS = { header: 'القائمة الرئيسية', footer_platform: 'فوتر المنصة', footer_company: 'فوتر الشركة', footer_legal: 'الفوتر القانوني' };

export class SiteEditorView {
    constructor(container) {
        this.container = container;
        this.mode = 'pages';
        this.pages = [];
        this.navigation = [];
        this.partners = [];
    }

    async render() {
        this.container.innerHTML = '<p class="admin-loading">جارٍ تحميل محرر الموقع…</p>';
        const [pages, navigation, partners, analytics] = await Promise.all([
            SiteContent.listPages(), SiteContent.listNavigation(), SiteContent.listPartners(), AdminService.getEventsStats('page_view', 30, 'path'),
        ]);
        if (![pages, navigation, partners].every((result) => result.ok)) {
            this.container.innerHTML = `<p class="admin-error">تعذر تحميل المحرر: ${escapeHtml([pages, navigation, partners].find((r) => !r.ok)?.error)}</p>`;
            return;
        }
        this.pages = pages.data;
        this.navigation = navigation.data;
        this.partners = partners.data;
        this.pageViews = new Map((analytics.ok ? analytics.data?.by_prop || [] : []).map(item => [String(item.value || item.key || ''), Number(item.count || 0)]));
        this._renderShell();
    }

    _renderShell() {
        this.container.innerHTML = `
            <section class="admin-executive-hero admin-cms-hero"><div><span class="admin-eyebrow">إدارة بدون أكواد</span><h2>محرر الموقع</h2><p>أنشئ الصفحات وعدّل الرئيسية والروابط والصور والشركاء، ثم راجع المسودة قبل نشرها.</p></div><span class="admin-period-badge">حفظ نسخ تلقائي</span></section>
            <div class="admin-cms-tabs" role="tablist">
                <button class="btn btn--sm btn--primary" data-cms-mode="pages">الصفحات</button>
                <button class="btn btn--sm btn--ghost" data-cms-mode="navigation">القوائم والروابط</button>
                <button class="btn btn--sm btn--ghost" data-cms-mode="partners">الشركاء</button>
                <button class="btn btn--sm btn--ghost" data-cms-mode="media">مكتبة الصور</button>
            </div>
            <div id="cmsWorkspace"></div>`;
        this.container.querySelectorAll('[data-cms-mode]').forEach((button) => button.addEventListener('click', () => {
            this.mode = button.dataset.cmsMode;
            this.container.querySelectorAll('[data-cms-mode]').forEach((item) => {
                item.classList.toggle('btn--primary', item === button);
                item.classList.toggle('btn--ghost', item !== button);
            });
            this._renderWorkspace();
        }));
        this._renderWorkspace();
    }

    _renderWorkspace() {
        if (this.mode === 'pages') this._renderPages();
        if (this.mode === 'navigation') this._renderNavigation();
        if (this.mode === 'partners') this._renderPartners();
        if (this.mode === 'media') this._renderMedia();
    }

    _renderPages() {
        const workspace = this.container.querySelector('#cmsWorkspace');
        workspace.innerHTML = `
            <div class="admin-cms-toolbar"><div><span class="admin-eyebrow">المحتوى</span><h3>صفحات الموقع</h3></div><button id="cmsNewPage" class="btn btn--primary btn--sm">إضافة صفحة</button></div>
            <div class="admin-cms-list">${this.pages.map((page) => `<article class="admin-cms-row">
                <div><strong>${escapeHtml(page.title)}</strong><small>/${escapeHtml(page.slug)} · آخر تعديل ${escapeHtml(new Date(page.updated_at).toLocaleString('ar-SA'))} · ${this._pageViewCount(page)} مشاهدة/30 يوم</small></div>
                <span class="admin-status admin-status--${page.status === 'published' ? 'connected' : page.status === 'draft' ? 'instrumented' : 'planned'}">${STATUS_LABELS[page.status]}</span>
                <div class="admin-cms-row__actions"><button class="btn btn--sm btn--ghost" data-edit-page="${page.id}">تعديل</button><button class="btn btn--sm btn--ghost" data-preview-page="${page.id}">معاينة</button><button class="btn btn--sm btn--ghost" data-history-page="${page.id}">السجل</button>${page.slug !== 'home' ? `<button class="btn btn--sm btn--ghost" data-delete-page="${page.id}">حذف</button>` : ''}</div>
            </article>`).join('') || '<p class="admin-table__empty">لا توجد صفحات.</p>'}</div>`;
        workspace.querySelector('#cmsNewPage')?.addEventListener('click', () => this._renderPageForm());
        workspace.querySelectorAll('[data-edit-page]').forEach((button) => button.addEventListener('click', () => this._renderPageForm(this.pages.find((page) => page.id === button.dataset.editPage))));
        workspace.querySelectorAll('[data-preview-page]').forEach((button) => button.addEventListener('click', () => this._previewPage(this.pages.find((page) => page.id === button.dataset.previewPage))));
        workspace.querySelectorAll('[data-history-page]').forEach((button) => button.addEventListener('click', () => this._renderPageHistory(this.pages.find((page) => page.id === button.dataset.historyPage))));
        workspace.querySelectorAll('[data-delete-page]').forEach((button) => button.addEventListener('click', async () => {
            if (!window.confirm('حذف الصفحة؟ ستبقى نسخة منها في سجل التعديلات.')) return;
            const result = await SiteContent.deletePage(button.dataset.deletePage);
            if (!result.ok) return toast.error(result.error);
            this.pages = this.pages.filter((page) => page.id !== button.dataset.deletePage);
            toast.success('تم حذف الصفحة');
            this._renderPages();
        }));
    }

    _pageViewCount(page) {
        const slug = page.slug === 'home' ? '/landing.html' : `/p/${page.slug}`;
        return this.pageViews?.get(slug) || this.pageViews?.get(page.slug) || 0;
    }

    async _renderPageHistory(page) {
        const workspace = this.container.querySelector('#cmsWorkspace');
        workspace.innerHTML = '<p class="admin-loading">جارٍ تحميل سجل التعديلات…</p>';
        const result = await SiteContent.listRevisions('page', page.id);
        if (!result.ok) { workspace.innerHTML = `<p class="admin-error">${escapeHtml(result.error)}</p>`; return; }
        workspace.innerHTML = `<div class="admin-cms-toolbar"><div><span class="admin-eyebrow">نسخ تلقائية</span><h3>سجل ${escapeHtml(page.title)}</h3></div><button class="btn btn--sm btn--ghost" data-back>رجوع</button></div><div class="admin-cms-list">${result.data.map((revision) => `<article class="admin-cms-row"><div><strong>${escapeHtml(new Date(revision.created_at).toLocaleString('ar-SA'))}</strong><small>${escapeHtml(STATUS_LABELS[revision.snapshot?.status] || revision.snapshot?.status || '')}</small></div><span></span><button class="btn btn--sm btn--ghost" data-restore="${revision.id}">استعادة هذه النسخة</button></article>`).join('') || '<p class="admin-table__empty">لا توجد نسخة سابقة بعد.</p>'}</div>`;
        workspace.querySelector('[data-back]').onclick = () => this._renderPages();
        workspace.querySelectorAll('[data-restore]').forEach((button) => button.onclick = async () => {
            const revision = result.data.find((item) => String(item.id) === button.dataset.restore);
            if (!revision || !window.confirm('استعادة هذه النسخة؟ سيُحفظ الوضع الحالي تلقائياً في السجل.')) return;
            const restored = await SiteContent.savePage({ ...revision.snapshot, id: page.id });
            if (!restored.ok) return toast.error(restored.error);
            this.pages[this.pages.findIndex((item) => item.id === page.id)] = restored.data;
            toast.success('تمت استعادة النسخة');
            this._renderPages();
        });
    }

    _sectionRow(section = {}) {
        return `<div class="admin-cms-block">
            <div class="admin-cms-block__head"><select class="admin-select" data-field="type"><option value="text" ${section.type === 'text' ? 'selected' : ''}>نص</option><option value="image" ${section.type === 'image' ? 'selected' : ''}>صورة مع نص</option><option value="cta" ${section.type === 'cta' ? 'selected' : ''}>دعوة لاتخاذ إجراء</option></select><button type="button" class="btn btn--sm btn--ghost" data-remove-block>إزالة</button></div>
            <label>العنوان<input class="admin-input" data-field="title" value="${escapeHtml(section.title)}"></label>
            <label>النص<textarea class="admin-input admin-cms-textarea" data-field="body">${escapeHtml(section.body)}</textarea></label>
            <div class="admin-cms-two"><label>رابط الصورة<input class="admin-input" data-field="image_url" value="${escapeHtml(section.image_url)}"></label><label>النص البديل للصورة<input class="admin-input" data-field="image_alt" value="${escapeHtml(section.image_alt)}"></label></div>
            <div class="admin-cms-two"><label>نص الزر<input class="admin-input" data-field="button_label" value="${escapeHtml(section.button_label)}"></label><label>رابط الزر<input class="admin-input" data-field="button_url" value="${escapeHtml(section.button_url)}"></label></div>
        </div>`;
    }

    _renderPageForm(page = null) {
        const workspace = this.container.querySelector('#cmsWorkspace');
        const content = page?.content || { sections: [] };
        const hero = content.hero || {};
        const finalCta = content.final_cta || {};
        workspace.innerHTML = `<form id="cmsPageForm" class="admin-card admin-cms-form">
            <div class="admin-cms-toolbar"><div><span class="admin-eyebrow">${page ? 'تعديل' : 'صفحة جديدة'}</span><h3>${escapeHtml(page?.title || 'إنشاء صفحة')}</h3></div><button type="button" id="cmsBackPages" class="btn btn--sm btn--ghost">رجوع</button></div>
            <div class="admin-cms-two"><label>اسم الصفحة<input name="title" class="admin-input" required maxlength="160" value="${escapeHtml(page?.title)}"></label><label>الرابط المختصر<input name="slug" class="admin-input" required pattern="[a-z0-9][a-z0-9-]{0,79}" dir="ltr" ${page?.slug === 'home' ? 'readonly' : ''} value="${escapeHtml(page?.slug)}"><small>حروف إنجليزية وأرقام وشرطة فقط</small></label></div>
            <div class="admin-cms-three"><label>الحالة<select name="status" class="admin-select"><option value="draft">مسودة</option><option value="published">منشورة</option><option value="disabled">معطلة</option></select></label><label>القالب<select name="template" class="admin-select"><option value="standard">صفحة عادية</option><option value="landing">صفحة هبوط</option><option value="article">مقال</option></select></label><label>صورة المشاركة<input name="social_image_url" class="admin-input" value="${escapeHtml(page?.social_image_url)}"></label></div>
            <details open class="admin-cms-details"><summary>العنوان الرئيسي</summary><div class="admin-cms-form-grid"><label>النص الصغير<input name="hero_eyebrow" class="admin-input" value="${escapeHtml(hero.eyebrow)}"></label><label>العنوان الكبير<input name="hero_title" class="admin-input" value="${escapeHtml(hero.title)}"></label><label class="admin-review-form__full">الوصف<textarea name="hero_description" class="admin-input admin-cms-textarea">${escapeHtml(hero.description)}</textarea></label><label>نص الزر الأساسي<input name="primary_label" class="admin-input" value="${escapeHtml(hero.primary_label)}"></label><label>رابطه<input name="primary_url" class="admin-input" value="${escapeHtml(hero.primary_url)}"></label><label>نص الزر الثاني<input name="secondary_label" class="admin-input" value="${escapeHtml(hero.secondary_label)}"></label><label>رابطه<input name="secondary_url" class="admin-input" value="${escapeHtml(hero.secondary_url)}"></label></div></details>
            <details class="admin-cms-details"><summary>تهيئة محركات البحث SEO</summary><div class="admin-cms-form-grid"><label>عنوان نتائج البحث<input name="seo_title" maxlength="160" class="admin-input" value="${escapeHtml(page?.seo_title)}"></label><label class="admin-review-form__full">وصف نتائج البحث<textarea name="seo_description" maxlength="320" class="admin-input admin-cms-textarea">${escapeHtml(page?.seo_description)}</textarea></label></div></details>
            <details class="admin-cms-details"><summary>الدعوة الختامية</summary><div class="admin-cms-form-grid"><label>العنوان<input name="final_title" class="admin-input" value="${escapeHtml(finalCta.title)}"></label><label class="admin-review-form__full">الوصف<textarea name="final_description" class="admin-input admin-cms-textarea">${escapeHtml(finalCta.description)}</textarea></label></div></details>
            <div class="admin-cms-toolbar"><div><span class="admin-eyebrow">مكوّنات الصفحة</span><h3>الأقسام</h3></div><button type="button" id="cmsAddBlock" class="btn btn--sm btn--ghost">إضافة قسم</button></div>
            <div id="cmsBlocks">${(content.sections || []).map((section) => this._sectionRow(section)).join('')}</div>
            <div class="admin-cms-actions"><button class="btn btn--primary" type="submit">حفظ التغييرات</button><button class="btn btn--ghost" type="button" id="cmsPreviewDraft">معاينة</button><span id="cmsSaveStatus" aria-live="polite"></span></div>
        </form>`;
        const form = workspace.querySelector('#cmsPageForm');
        form.elements.namedItem('status').value = page?.status || 'draft';
        form.elements.namedItem('template').value = page?.template || (page?.slug === 'home' ? 'landing' : 'standard');
        workspace.querySelector('#cmsBackPages').addEventListener('click', () => this._renderPages());
        workspace.querySelector('#cmsAddBlock').addEventListener('click', () => {
            workspace.querySelector('#cmsBlocks').insertAdjacentHTML('beforeend', this._sectionRow());
            this._bindRemoveBlocks();
        });
        this._bindRemoveBlocks();
        const collect = () => {
            const fields = new FormData(form);
            const sections = [...workspace.querySelectorAll('.admin-cms-block')].map((block) => Object.fromEntries([...block.querySelectorAll('[data-field]')].map((input) => [input.dataset.field, input.value.trim()])));
            return {
                ...(page || {}), title: fields.get('title').trim(), slug: fields.get('slug').trim().toLowerCase(), status: fields.get('status'), template: fields.get('template'),
                seo_title: fields.get('seo_title').trim() || null, seo_description: fields.get('seo_description').trim() || null, social_image_url: fields.get('social_image_url').trim() || null,
                content: { hero: { eyebrow: fields.get('hero_eyebrow').trim(), title: fields.get('hero_title').trim(), description: fields.get('hero_description').trim(), primary_label: fields.get('primary_label').trim(), primary_url: fields.get('primary_url').trim(), secondary_label: fields.get('secondary_label').trim(), secondary_url: fields.get('secondary_url').trim() }, final_cta: { title: fields.get('final_title').trim(), description: fields.get('final_description').trim() }, sections },
            };
        };
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const status = workspace.querySelector('#cmsSaveStatus');
            status.textContent = 'جارٍ الحفظ…';
            const result = await SiteContent.savePage(collect());
            if (!result.ok) { status.textContent = result.error; return toast.error(result.error); }
            const index = this.pages.findIndex((item) => item.id === result.data.id);
            if (index >= 0) this.pages[index] = result.data; else this.pages.unshift(result.data);
            status.textContent = result.data.status === 'published' ? 'تم الحفظ والنشر' : 'تم حفظ المسودة';
            toast.success(status.textContent);
            page = result.data;
        });
        workspace.querySelector('#cmsPreviewDraft').addEventListener('click', () => this._previewPage(collect()));
    }

    _bindRemoveBlocks() {
        this.container.querySelectorAll('[data-remove-block]').forEach((button) => button.onclick = () => button.closest('.admin-cms-block').remove());
    }

    _previewPage(page) {
        localStorage.setItem('qarar_cms_preview', JSON.stringify({ page, expires_at: Date.now() + 5 * 60 * 1000 }));
        window.open(page.slug === 'home' ? '/landing.html?cms_preview=1' : `/p/${encodeURIComponent(page.slug)}?cms_preview=1`, '_blank', 'noopener');
    }

    _renderNavigation() {
        const workspace = this.container.querySelector('#cmsWorkspace');
        workspace.innerHTML = `<div class="admin-cms-toolbar"><div><span class="admin-eyebrow">التنقل</span><h3>القوائم والروابط</h3></div><button id="cmsAddNav" class="btn btn--sm btn--primary">إضافة رابط</button></div><div class="admin-cms-list">${this.navigation.map((item) => this._entityRow('nav', item, `${LOCATION_LABELS[item.location]} · ${item.href}`)).join('')}</div>`;
        workspace.querySelector('#cmsAddNav').addEventListener('click', () => this._renderNavigationForm());
        this._bindEntityActions('nav', this.navigation, (item) => this._renderNavigationForm(item), SiteContent.deleteNavigation);
    }

    _renderNavigationForm(item = {}) {
        const workspace = this.container.querySelector('#cmsWorkspace');
        workspace.innerHTML = `<form id="cmsEntityForm" class="admin-card admin-cms-form"><div class="admin-cms-toolbar"><h3>${item.id ? 'تعديل الرابط' : 'إضافة رابط'}</h3><button type="button" class="btn btn--sm btn--ghost" data-back>رجوع</button></div><div class="admin-cms-two"><label>النص<input name="label" required class="admin-input" value="${escapeHtml(item.label)}"></label><label>الرابط<input name="href" required class="admin-input" value="${escapeHtml(item.href)}"></label><label>الموقع<select name="location" class="admin-select">${Object.entries(LOCATION_LABELS).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label><label>الترتيب<input name="sort_order" type="number" class="admin-input" value="${Number(item.sort_order || 0)}"></label></div><label class="admin-review-form__checkbox"><input name="enabled" type="checkbox" ${item.enabled !== false ? 'checked' : ''}> مفعّل</label><label class="admin-review-form__checkbox"><input name="open_new_tab" type="checkbox" ${item.open_new_tab ? 'checked' : ''}> فتح في نافذة جديدة</label><div class="admin-cms-actions"><button class="btn btn--primary">حفظ</button></div></form>`;
        const form = workspace.querySelector('form'); form.elements.namedItem('location').value = item.location || 'header';
        workspace.querySelector('[data-back]').onclick = () => this._renderNavigation();
        form.onsubmit = async (event) => { event.preventDefault(); const values = new FormData(form); const result = await SiteContent.saveNavigation({ ...item, label: values.get('label').trim(), href: values.get('href').trim(), location: values.get('location'), sort_order: Number(values.get('sort_order') || 0), enabled: form.elements.namedItem('enabled').checked, open_new_tab: form.elements.namedItem('open_new_tab').checked }); if (!result.ok) return toast.error(result.error); await this.render(); this.mode = 'navigation'; this._renderWorkspace(); toast.success('تم حفظ الرابط'); };
    }

    _renderPartners() {
        const workspace = this.container.querySelector('#cmsWorkspace');
        workspace.innerHTML = `<div class="admin-cms-toolbar"><div><span class="admin-eyebrow">الثقة</span><h3>الشركاء</h3></div><button id="cmsAddPartner" class="btn btn--sm btn--primary">إضافة شريك</button></div><div class="admin-cms-list">${this.partners.map((item) => this._entityRow('partner', item, item.website_url || 'بدون رابط', item.logo_url)).join('')}</div>`;
        workspace.querySelector('#cmsAddPartner').onclick = () => this._renderPartnerForm();
        this._bindEntityActions('partner', this.partners, (item) => this._renderPartnerForm(item), SiteContent.deletePartner);
    }

    _entityRow(type, item, subtitle, image = '') {
        return `<article class="admin-cms-row">${image ? `<img class="admin-cms-logo" src="${escapeHtml(image)}" alt="">` : ''}<div><strong>${escapeHtml(item.label || item.name)}</strong><small>${escapeHtml(subtitle)}</small></div><span class="admin-status admin-status--${item.enabled ? 'connected' : 'planned'}">${item.enabled ? 'مفعّل' : 'معطّل'}</span><div class="admin-cms-row__actions"><button class="btn btn--sm btn--ghost" data-edit-${type}="${item.id}">تعديل</button><button class="btn btn--sm btn--ghost" data-delete-${type}="${item.id}">حذف</button></div></article>`;
    }

    _bindEntityActions(type, items, edit, remove) {
        this.container.querySelectorAll(`[data-edit-${type}]`).forEach((button) => button.onclick = () => edit(items.find((item) => item.id === button.dataset[`edit${type[0].toUpperCase()}${type.slice(1)}`])));
        this.container.querySelectorAll(`[data-delete-${type}]`).forEach((button) => button.onclick = async () => { if (!window.confirm('تأكيد الحذف؟')) return; const id = button.dataset[`delete${type[0].toUpperCase()}${type.slice(1)}`]; const result = await remove(id); if (!result.ok) return toast.error(result.error); await this.render(); this.mode = type === 'nav' ? 'navigation' : 'partners'; this._renderWorkspace(); });
    }

    _renderPartnerForm(item = {}) {
        const workspace = this.container.querySelector('#cmsWorkspace');
        workspace.innerHTML = `<form class="admin-card admin-cms-form"><div class="admin-cms-toolbar"><h3>${item.id ? 'تعديل الشريك' : 'إضافة شريك'}</h3><button type="button" class="btn btn--sm btn--ghost" data-back>رجوع</button></div><div class="admin-cms-two"><label>اسم الشريك<input name="name" required class="admin-input" value="${escapeHtml(item.name)}"></label><label>الموقع الإلكتروني<input name="website_url" class="admin-input" value="${escapeHtml(item.website_url)}"></label><label>رابط الشعار<input name="logo_url" class="admin-input" value="${escapeHtml(item.logo_url)}"></label><label>الترتيب<input name="sort_order" type="number" class="admin-input" value="${Number(item.sort_order || 0)}"></label></div><label>وصف مختصر<textarea name="description" maxlength="500" class="admin-input admin-cms-textarea">${escapeHtml(item.description)}</textarea></label><label class="admin-review-form__checkbox"><input name="enabled" type="checkbox" ${item.enabled !== false ? 'checked' : ''}> إظهار في الموقع</label><div class="admin-cms-actions"><button class="btn btn--primary">حفظ</button></div></form>`;
        const form = workspace.querySelector('form'); workspace.querySelector('[data-back]').onclick = () => this._renderPartners();
        form.onsubmit = async (event) => { event.preventDefault(); const values = new FormData(form); const result = await SiteContent.savePartner({ ...item, name: values.get('name').trim(), website_url: values.get('website_url').trim() || null, logo_url: values.get('logo_url').trim() || null, description: values.get('description').trim() || null, sort_order: Number(values.get('sort_order') || 0), enabled: form.elements.namedItem('enabled').checked }); if (!result.ok) return toast.error(result.error); await this.render(); this.mode = 'partners'; this._renderWorkspace(); toast.success('تم حفظ الشريك'); };
    }

    async _renderMedia() {
        const workspace = this.container.querySelector('#cmsWorkspace');
        workspace.innerHTML = `<section class="admin-card admin-cms-upload"><span class="admin-eyebrow">الصور والشعارات</span><h3>رفع صورة</h3><p>JPEG أو PNG أو WebP أو SVG، بحد أقصى 5MB. بعد الرفع يُنسخ الرابط لاستخدامه في أي صفحة أو شريك.</p><input id="cmsMediaFile" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml"><button id="cmsUploadMedia" class="btn btn--primary">رفع الصورة</button><div id="cmsMediaResult" aria-live="polite"></div></section><section class="admin-card"><h3 class="admin-card__title">الصور المرفوعة</h3><div id="cmsMediaGrid" class="admin-cms-media-grid"><p class="admin-loading">جارٍ التحميل…</p></div></section>`;
        const drawMedia = async () => {
            const result = await SiteContent.listMedia();
            const grid = workspace.querySelector('#cmsMediaGrid');
            if (!result.ok) { grid.innerHTML = `<p class="admin-error">${escapeHtml(result.error)}</p>`; return; }
            grid.innerHTML = result.data.map((file) => `<article><img src="${escapeHtml(file.url)}" alt=""><small>${escapeHtml(file.name)}</small><div><button class="btn btn--sm btn--ghost" data-copy-media="${escapeHtml(file.url)}">نسخ الرابط</button><button class="btn btn--sm btn--ghost" data-delete-media="${escapeHtml(file.path)}">حذف</button></div></article>`).join('') || '<p class="admin-table__empty">لم تُرفع صور بعد.</p>';
            grid.querySelectorAll('[data-copy-media]').forEach((button) => button.onclick = async () => { await navigator.clipboard.writeText(button.dataset.copyMedia); toast.success('تم نسخ الرابط'); });
            grid.querySelectorAll('[data-delete-media]').forEach((button) => button.onclick = async () => { if (!window.confirm('حذف الصورة نهائياً؟')) return; const removed = await SiteContent.deleteMedia(button.dataset.deleteMedia); if (!removed.ok) return toast.error(removed.error); await drawMedia(); });
        };
        workspace.querySelector('#cmsUploadMedia').onclick = async () => { const file = workspace.querySelector('#cmsMediaFile').files[0]; if (!file) return toast.error('اختر صورة أولاً'); const resultBox = workspace.querySelector('#cmsMediaResult'); resultBox.textContent = 'جارٍ الرفع…'; const result = await SiteContent.uploadMedia(file); if (!result.ok) { resultBox.textContent = result.error; return toast.error(result.error); } resultBox.innerHTML = `<img src="${escapeHtml(result.data)}" alt="معاينة الصورة المرفوعة"><input class="admin-input" dir="ltr" readonly value="${escapeHtml(result.data)}"><button class="btn btn--sm btn--ghost" data-copy>نسخ الرابط</button>`; resultBox.querySelector('[data-copy]').onclick = async () => { await navigator.clipboard.writeText(result.data); toast.success('تم نسخ الرابط'); }; };
        await drawMedia();
    }
}

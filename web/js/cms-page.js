import { getPublishedPage } from './services/SiteContentService.js';

const host = document.getElementById('cmsPage');
const params = new URLSearchParams(location.search);
const safeHref = (value) => /^(https?:\/\/|mailto:|tel:|\/|\.\/|#)/i.test(String(value || '').trim()) ? String(value).trim() : '#';

function appendCopy(parent, section, headingLevel = 'h2') {
    const copy = document.createElement('div');
    if (section.title) { const heading = document.createElement(headingLevel); heading.textContent = section.title; copy.appendChild(heading); }
    if (section.description || section.body) { const body = document.createElement('p'); body.textContent = section.description || section.body; copy.appendChild(body); }
    if (section.button_label && section.button_url) { const link = document.createElement('a'); link.className = 'cms-page-button'; link.textContent = section.button_label; link.href = safeHref(section.button_url); copy.appendChild(link); }
    parent.appendChild(copy);
}

function render(page) {
    const content = page.content || {};
    document.title = page.seo_title || page.title;
    const meta = document.querySelector('meta[name="description"]');
    if (page.seo_description) meta.content = page.seo_description;
    host.replaceChildren();
    const hero = document.createElement('section'); hero.className = 'cms-page-hero';
    const heroInner = document.createElement('div');
    if (content.hero?.eyebrow) { const small = document.createElement('small'); small.textContent = content.hero.eyebrow; heroInner.appendChild(small); }
    appendCopy(heroInner, { ...content.hero, title: content.hero?.title || page.title, body: content.hero?.description, button_label: content.hero?.primary_label, button_url: content.hero?.primary_url }, 'h1');
    hero.appendChild(heroInner); host.appendChild(hero);
    (content.sections || []).forEach((section) => {
        const wrapper = document.createElement('section'); wrapper.className = `cms-page-section cms-page-section--${section.type || 'text'}`;
        const inner = document.createElement('div'); appendCopy(inner, section);
        if (section.type === 'image' && section.image_url) { const image = document.createElement('img'); image.src = safeHref(section.image_url); image.alt = section.image_alt || ''; image.loading = 'lazy'; inner.appendChild(image); }
        wrapper.appendChild(inner); host.appendChild(wrapper);
    });
}

(async () => {
    document.getElementById('cmsYear').textContent = new Date().getFullYear();
    let page = null;
    if (params.get('cms_preview') === '1') {
        try {
            const preview = JSON.parse(localStorage.getItem('qarar_cms_preview') || 'null');
            if (preview?.expires_at > Date.now()) page = preview.page;
            localStorage.removeItem('qarar_cms_preview');
        } catch { /* invalid preview */ }
    }
    if (!page) { const result = await getPublishedPage(params.get('slug') || ''); if (result.ok) page = result.data; }
    if (!page) { host.innerHTML = '<div class="cms-page-error"><h1>الصفحة غير موجودة</h1><p>ربما لم تُنشر بعد أو تم تعطيلها.</p><a href="/">العودة للرئيسية</a></div>'; return; }
    render(page);
})();

import { getPublishedPage, listNavigation, listPartners } from './services/SiteContentService.js';

const params = new URLSearchParams(window.location.search);

function readPath(object, path) {
    return path.split('.').reduce((value, key) => value?.[key], object);
}

function safeHref(value) {
    const href = String(value || '').trim();
    if (/^(https?:\/\/|mailto:|tel:|\/|\.\/|#)/i.test(href)) return href;
    return '#';
}

function applyTextContent(content) {
    document.querySelectorAll('[data-cms-text]').forEach((element) => {
        const value = readPath(content, element.dataset.cmsText);
        if (typeof value === 'string' && value.trim()) element.textContent = value;
    });
    document.querySelectorAll('[data-cms-link]').forEach((element) => {
        const value = readPath(content, element.dataset.cmsLink);
        if (typeof value === 'string' && value.trim()) element.setAttribute('href', safeHref(value));
    });
}

function sectionElement(section) {
    const wrapper = document.createElement('section');
    wrapper.className = `cms-public-section cms-public-section--${section.type || 'text'}`;
    const inner = document.createElement('div');
    inner.className = 'wrap cms-public-section__inner';
    const copy = document.createElement('div');
    if (section.title) { const heading = document.createElement('h2'); heading.textContent = section.title; copy.appendChild(heading); }
    if (section.body) { const body = document.createElement('p'); body.textContent = section.body; copy.appendChild(body); }
    if (section.button_label && section.button_url) { const link = document.createElement('a'); link.className = 'btn btn-primary'; link.textContent = section.button_label; link.href = safeHref(section.button_url); copy.appendChild(link); }
    inner.appendChild(copy);
    if (section.type === 'image' && section.image_url) { const image = document.createElement('img'); image.src = safeHref(section.image_url); image.alt = section.image_alt || ''; image.loading = 'lazy'; inner.appendChild(image); }
    wrapper.appendChild(inner);
    return wrapper;
}

function renderSections(sections = []) {
    const host = document.getElementById('cmsHomeSections');
    if (!host) return;
    host.replaceChildren(...sections.map(sectionElement));
}

function renderNavigation(items = []) {
    const grouped = Object.groupBy ? Object.groupBy(items.filter((item) => item.enabled), (item) => item.location) : items.filter((item) => item.enabled).reduce((map, item) => { (map[item.location] ||= []).push(item); return map; }, {});
    document.querySelectorAll('[data-cms-navigation]').forEach((nav) => {
        const rows = grouped[nav.dataset.cmsNavigation] || [];
        if (!rows.length) return;
        nav.replaceChildren(...rows.map((item) => {
            const link = document.createElement('a'); link.textContent = item.label; link.href = safeHref(item.href);
            if (item.open_new_tab) { link.target = '_blank'; link.rel = 'noopener'; }
            return link;
        }));
    });
}

function renderPartners(items = []) {
    const host = document.getElementById('cmsPartners');
    if (!host || !items.length) return;
    const wrap = document.createElement('div'); wrap.className = 'wrap';
    const heading = document.createElement('div'); heading.className = 'sec-head'; heading.innerHTML = '<span class="eyebrow">شركاء النجاح</span><h2>جهات نعتز بالعمل معها</h2>';
    const grid = document.createElement('div'); grid.className = 'cms-partners-grid';
    items.forEach((item) => {
        const card = document.createElement(item.website_url ? 'a' : 'div'); card.className = 'cms-partner-card';
        if (item.website_url) { card.href = safeHref(item.website_url); card.target = '_blank'; card.rel = 'noopener'; }
        if (item.logo_url) { const image = document.createElement('img'); image.src = safeHref(item.logo_url); image.alt = `شعار ${item.name}`; image.loading = 'lazy'; card.appendChild(image); }
        const name = document.createElement('strong'); name.textContent = item.name; card.appendChild(name);
        if (item.description) { const description = document.createElement('span'); description.textContent = item.description; card.appendChild(description); }
        grid.appendChild(card);
    });
    wrap.append(heading, grid); host.appendChild(wrap); host.hidden = false;
}

function injectStyles() {
    const style = document.createElement('style');
    style.textContent = '.cms-public-section{padding:64px 0}.cms-public-section:nth-child(even){background:var(--mint-50,#f5faf7)}.cms-public-section__inner{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:40px}.cms-public-section__inner h2{margin-top:0}.cms-public-section__inner p{color:var(--muted);white-space:pre-line}.cms-public-section__inner img{width:100%;max-height:420px;object-fit:cover;border-radius:16px}.cms-partners-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px}.cms-partner-card{display:grid;place-items:center;gap:10px;min-height:150px;padding:20px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:16px}.cms-partner-card img{max-width:130px;max-height:70px;object-fit:contain}.cms-partner-card span{font-size:13px;color:var(--muted)}@media(max-width:700px){.cms-public-section__inner{grid-template-columns:1fr}.cms-public-section{padding:44px 0}}';
    document.head.appendChild(style);
}

(async () => {
    injectStyles();
    let page = null;
    if (params.get('cms_preview') === '1') {
        try {
            const preview = JSON.parse(localStorage.getItem('qarar_cms_preview') || 'null');
            if (preview?.expires_at > Date.now()) page = preview.page;
            localStorage.removeItem('qarar_cms_preview');
        } catch { /* invalid preview */ }
    }
    if (!page) {
        const result = await getPublishedPage('home');
        if (result.ok) page = result.data;
    }
    if (page?.content) {
        applyTextContent(page.content);
        renderSections(page.content.sections);
        if (page.seo_title) document.title = page.seo_title;
        const description = document.querySelector('meta[name="description"]');
        if (description && page.seo_description) description.content = page.seo_description;
    }
    const [navigation, partners] = await Promise.all([listNavigation(), listPartners(false)]);
    if (navigation.ok) renderNavigation(navigation.data);
    if (partners.ok) renderPartners(partners.data);
})();

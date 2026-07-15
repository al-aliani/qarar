import sys
import re

with open('web/js/ui/DashboardViewV2.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Change class name
content = content.replace('export class DashboardView {', 'export class DashboardViewV2 {')

# Rewrite the main structure of renderList replacing 'dv-' with 'dv2-' and changing the layout
render_list_pattern = re.compile(r'(this\.container\.innerHTML = `).*?(`;)', re.DOTALL)

new_html = r'''
            <div class="dv2-workspace animate-entry">
                <!-- Sidebar -->
                <aside class="dv2-sidebar">
                    <div class="dv2-brand">
                        <div class="dv2-brand-mark">ق</div>
                        قرار
                    </div>
                    
                    <div style="margin-top: 32px; display: flex; flex-direction: column; gap: 8px;">
                        <button class="dv2-nav-btn is-active">
                            <svg class="ic" aria-hidden="true"><use href="#i-folder"/></svg>
                            مساحة العمل
                        </button>
                        <button class="dv2-nav-btn">
                            <svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg>
                            التحليلات المالية
                        </button>
                        <button class="dv2-nav-btn">
                            <svg class="ic" aria-hidden="true"><use href="#i-clipboard"/></svg>
                            المستودعات
                        </button>
                        <button class="dv2-nav-btn">
                            <svg class="ic" aria-hidden="true"><use href="#i-users"/></svg>
                            الموارد البشرية
                        </button>
                    </div>
                    
                    <div style="margin-top: auto;">
                        <div class="dv2-view-toggle">
                            <button type="button" onclick="window.location.hash='#/home'">الكلاسيكية</button>
                            <button type="button" class="active">المتطورة (V2)</button>
                        </div>
                    </div>
                </aside>

                <!-- Main Content -->
                <main class="dv2-main">
                    <!-- Topbar -->
                    <header class="dv2-topbar dv2-glass-panel">
                        <div style="font-weight: 600;">مرحباً بك في قرار! 👋</div>
                        <div class="dv2-topbar-actions">
                            ${!this.currentUser ? `
                                <button type="button" id="dashboardLogin" class="dv2-btn-secondary">تسجيل الدخول</button>
                            ` : `
                                <span style="font-weight: 500; font-size: 0.9rem;">${userEmail}</span>
                                <button type="button" id="btnLogout" class="dv2-btn-secondary dv-logout" style="padding: 8px 16px;">خروج</button>
                            `}
                        </div>
                    </header>

                    <!-- Hero Section -->
                    <section class="dv2-hero">
                        <h1>دراسة الجدوى، أصبحت أسهل وأذكى</h1>
                        <p>ابدأ مشروعك الجديد بثقة مع أدوات التحليل المالي والمحاكاة الذكية التي نوفرها لك.</p>
                        <div class="dv2-hero-actions">
                            <button type="button" id="cardFullStudy" class="dv2-btn-primary">
                                <svg class="ic" aria-hidden="true"><use href="#i-plus"/></svg>
                                دراسة جديدة
                            </button>
                            <button type="button" id="cardQuickFeasibility" class="dv2-btn-secondary">
                                <svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg>
                                جدوى سريعة
                            </button>
                        </div>
                    </section>

                    <!-- Projects -->
                    <section>
                        <div class="dv2-projects-header">
                            <h2>دراساتك المحفوظة</h2>
                            ${hasProjects ? `
                                <div style="display: flex; gap: 12px;">
                                    <select id="dashboardFolderFilter" class="input input--sm" style="background: var(--v2-glass-bg); border-radius: 8px; border: 1px solid var(--v2-glass-border); padding: 8px 12px;">
                                        ${folderOptions}
                                    </select>
                                    <input type="text" id="dashboardSearch" class="input input--sm" placeholder="ابحث في دراساتك..." style="background: var(--v2-glass-bg); border-radius: 8px; border: 1px solid var(--v2-glass-border); padding: 8px 12px;" value="${(this.searchQuery || '').replace(/"/g, '&quot;')}" />
                                </div>
                            ` : ''}
                        </div>
                        
                        ${!hasProjects ? this.renderEmptyState() : `
                            <div class="dv2-grid" id="projectsGrid">
                                ${filtered.map(p => {
                                    try {
                                        let cardHtml = this.renderProjectCard(p);
                                        cardHtml = cardHtml.replace('class="dv-card', 'class="dv2-card');
                                        return cardHtml;
                                    } catch (err) {
                                        console.error('Error rendering project card:', err);
                                        return '<div class="dv2-card">خطأ في عرض المشروع</div>';
                                    }
                                }).join('')}
                            </div>
                        `}
                    </section>
                </main>
                
                <!-- Hidden roots to satisfy DashboardView JS logic -->
                <div id="readyStudiesRoot" class="hidden"></div>
                <div id="databaseFilesRoot" class="hidden"></div>
                <div id="warehouseDatabaseFilesRoot" class="hidden"></div>
                <div id="warehouseHrFilesRoot" class="hidden"></div>
                <div id="hrFilesRoot" class="hidden"></div>
                <div id="sensitivity-widget-root" class="hidden"></div>
                <div id="funding-sim-root" class="dv-modal hidden">
                    <div class="dv-modal__panel">
                        <button id="btnCloseFundingSim" class="dv-modal__close" aria-label="إغلاق">&times;</button>
                        <div id="funding-sim-container"></div>
                    </div>
                </div>
                <div id="founder-card-root" class="hidden"></div>
            </div>
'''

new_content = render_list_pattern.sub(r'\1' + new_html + r'\2', content)

with open('web/js/ui/DashboardViewV2.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('DashboardViewV2.js rewritten successfully.')

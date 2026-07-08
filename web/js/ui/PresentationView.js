/**
 * Presentation View (Pitch Deck Mode)
 * Converts project data into an interactive slideshow.
 */
import { calculateStudy as runFullModel } from '../core/engine.js';
import { calculateProjectScore } from '../core/scoring.js';

export class PresentationView {
    constructor(store) {
        this.store = store;
        this.currentSlide = 0;
        this.slides = [];
        this.container = null;
        this._keyHandler = null;
    }

    // Cleanup method
    cleanup() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    render() {
        // Create full screen overlay
        if (!document.getElementById('presentationOverlay')) {
            this.container = document.createElement('div');
            this.container.id = 'presentationOverlay';
            this.container.className = 'fixed inset-0 bg-black z-[100] flex flex-col animate-fade-in text-white overflow-hidden';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('presentationOverlay');
            this.container.classList.remove('hidden');
        }

        const state = this.store.getState();
        const results = runFullModel(state);
        const score = calculateProjectScore(state, results);

        // Generate Slides Content
        this.slides = this.generateSlides(state, results, score);

        this.renderFrame();
        this.showSlide(0);

        // Bind Keys
        this._keyHandler = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this._keyHandler);
    }

    close() {
        this.cleanup();
    }

    handleKeyDown(e) {
        if (e.key === 'ArrowRight' || e.key === ' ') {
            this.nextSlide();
        } else if (e.key === 'ArrowLeft') {
            this.prevSlide();
        } else if (e.key === 'Escape') {
            this.close();
        }
    }

    generateSlides(state, results, score) {
        const project = state.projectInfo || {};
        const market = state.marketSizing || {};
        const financing = state.financing || {};
        const exec = state.executiveSummary || {};

        return [
            // Slide 1: Title
            {
                type: 'title',
                template: `
                    <div class="h-full flex flex-col items-center justify-center text-center p-12 bg-gradient-to-br from-indigo-900 to-black">
                        <div class="text-6xl mb-6">🚀</div>
                        <h1 class="text-6xl font-black mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            ${project.name || 'مشروع جديد'}
                        </h1>
                        <p class="text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
                            ${project.description || 'فرصة استثمارية واعدة'}
                        </p>
                        <div class="mt-12 text-sm text-gray-500">
                            ${new Date().toLocaleDateString('ar-SA')} | عرض تقديمي للمستثمرين
                        </div>
                    </div>
                `
            },

            // Slide 2: Problem & Solution
            {
                type: 'split',
                title: 'المشكلة والحل',
                left: `
                    <div class="p-8 bg-red-900/20 rounded-2xl border border-red-500/20 h-full">
                        <h2 class="text-3xl font-bold text-red-400 mb-6">🛑 المشكلة</h2>
                        <p class="text-xl leading-relaxed text-gray-200">
                            ${exec.problemStatement || 'لم يتم تحديد المشكلة بعد...'}
                        </p>
                    </div>
                `,
                right: `
                    <div class="p-8 bg-green-900/20 rounded-2xl border border-green-500/20 h-full">
                        <h2 class="text-3xl font-bold text-green-400 mb-6">💡 الحل المقترح</h2>
                        <p class="text-xl leading-relaxed text-gray-200">
                            ${project.concept || exec.solutionStatement || 'لم يتم تحديد الحل...'}
                        </p>
                        <div class="mt-6 pt-6 border-t border-white/10">
                            <h4 class="text-green-300 font-bold mb-2">✨ القيمة المميزة:</h4>
                            <p>${exec.uniqueValueProposition || ''}</p>
                        </div>
                    </div>
                `
            },

            // Slide 3: Market Opportunity
            {
                type: 'center',
                title: 'حجم السوق والفرصة',
                content: `
                    <div class="flex items-end justify-center gap-8 h-96 mt-12 bg-white/5 rounded-3xl p-8 border border-white/10">
                        <div class="flex flex-col items-center w-48 group">
                            <div class="text-xl mb-4 font-bold text-gray-400">TAM</div>
                            <div class="w-full bg-blue-900/50 rounded-t-xl group-hover:bg-blue-800 transition-colors relative" style="height: 100%;">
                                <div class="absolute inset-0 flex items-center justify-center font-bold text-2xl">
                                    ${this.formatCurrency(market.tam?.value)}
                                </div>
                            </div>
                            <div class="mt-4 text-sm text-gray-400">إجمالي السوق المتاح</div>
                        </div>
                         <div class="flex flex-col items-center w-48 group">
                            <div class="text-xl mb-4 font-bold text-gray-400">SAM</div>
                            <div class="w-full bg-blue-600/50 rounded-t-xl group-hover:bg-blue-600 transition-colors relative" style="height: 60%;">
                                <div class="absolute inset-0 flex items-center justify-center font-bold text-2xl">
                                    ${this.formatCurrency(market.sam?.value)}
                                </div>
                            </div>
                            <div class="mt-4 text-sm text-gray-400">السوق المستهدف</div>
                        </div>
                         <div class="flex flex-col items-center w-48 group">
                            <div class="text-xl mb-4 font-bold text-gold">SOM</div>
                            <div class="w-full bg-gold rounded-t-xl shadow-[0_0_30px_rgba(255,215,0,0.3)] relative" style="height: 25%;">
                                <div class="absolute -top-12 inset-x-0 text-center font-black text-3xl text-gold">
                                    ${this.formatCurrency(market.som?.value)}
                                </div>
                            </div>
                            <div class="mt-4 text-sm text-gold font-bold">حصتنا السوقية</div>
                        </div>
                    </div>
                `
            },

            // Slide 4: Financial Highlights
            {
                type: 'grid',
                title: 'أبرز المؤشرات المالية (5 سنوات)',
                items: [
                    { label: 'صافي القيمة الحالية', value: this.formatCurrency(results.indicators?.npv), color: 'text-green-400' },
                    { label: 'معدل العائد الداخلي', value: ((results.indicators?.irr || 0) * 100).toFixed(1) + '%', color: 'text-blue-400' },
                    { label: 'فترة الاسترداد', value: this.formatPayback(results.indicators?.paybackPeriod ?? results.indicators?.payback), color: 'text-purple-400' },
                    { label: 'متوسط هامش الربح', value: (((results.indicators?.netMargin ?? (results.incomeStatement?.[0]?.revenue > 0 ? (results.incomeStatement[0].netIncome / results.incomeStatement[0].revenue) : 0)) || 0) * 100).toFixed(1) + '%', color: 'text-yellow-400' },
                ]
            },

            // Slide 5: Team & Execution
            {
                type: 'center',
                title: 'الفريق والتنفيذ',
                content: `
                    <div class="grid grid-cols-2 gap-8 w-full max-w-4xl">
                        <div class="bg-white/5 p-8 rounded-2xl border border-white/10">
                            <h3 class="text-2xl font-bold mb-6 text-blue-400">👥 الهيكل التنظيمي</h3>
                            <div class="space-y-4">
                                ${(state.hr?.positions || []).slice(0, 4).map(pos => `
                                    <div class="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                                        <span class="font-medium">${pos.position || 'منصب'}</span>
                                        <span class="text-sm text-gray-400">${pos.count || 1} موظف</span>
                                    </div>
                                `).join('') || '<p class="text-gray-400">لم يتم تحديد الفريق بعد</p>'}
                            </div>
                        </div>
                        <div class="bg-white/5 p-8 rounded-2xl border border-white/10">
                            <h3 class="text-2xl font-bold mb-6 text-purple-400">📅 الجدول الزمني</h3>
                            <div class="space-y-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span>البدء: ${project.timeline?.projectStart || 'قريباً'}</span>
                                </div>
                                <div class="flex items-center gap-3">
                                    <div class="w-3 h-3 rounded-full bg-blue-500"></div>
                                    <span>التشغيل: ${project.timeline?.operationStart || 'قريباً'}</span>
                                </div>
                                <div class="flex items-center gap-3">
                                    <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <span>المدة: ${project.timeline?.constructionMonths || 6} شهر</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `
            },

            // Slide 6: Key Risks & Mitigation
            {
                type: 'split',
                title: 'المخاطر الرئيسية',
                left: `
                    <div class="p-8 bg-orange-900/20 rounded-2xl border border-orange-500/20 h-full">
                        <h2 class="text-3xl font-bold text-orange-400 mb-6">⚠️ المخاطر</h2>
                        <div class="space-y-4">
                            ${(state.riskAnalysis?.risks || []).slice(0, 3).map(risk => `
                                <div class="p-4 bg-white/5 rounded-lg">
                                    <div class="font-bold mb-2">${risk.name || 'خطر غير محدد'}</div>
                                    <div class="text-sm text-gray-300">${risk.type || ''} | ${risk.probability || ''} | ${risk.impact || ''}</div>
                                </div>
                            `).join('') || '<p class="text-gray-400">لم يتم تحديد المخاطر بعد</p>'}
                        </div>
                    </div>
                `,
                right: `
                    <div class="p-8 bg-blue-900/20 rounded-2xl border border-blue-500/20 h-full">
                        <h2 class="text-3xl font-bold text-blue-400 mb-6">🛡️ خطة المواجهة</h2>
                        <div class="space-y-4">
                            ${(state.riskAnalysis?.risks || []).slice(0, 3).map(risk => `
                                <div class="p-4 bg-white/5 rounded-lg">
                                    <div class="text-sm text-gray-300">${risk.mitigation || 'لم يتم تحديد خطة المواجهة'}</div>
                                </div>
                            `).join('') || '<p class="text-gray-400">لم يتم تحديد خطط المواجهة بعد</p>'}
                        </div>
                    </div>
                `
            },

            // Slide 7: The Ask (Investment)
            {
                type: 'title',
                template: `
                    <div class="h-full flex flex-col items-center justify-center text-center p-12 bg-gradient-to-t from-green-900 to-black">
                        <h2 class="text-4xl font-bold mb-12 text-gray-300">التمويل المطلوب</h2>
                        
                        <div class="text-8xl font-black text-green-500 mb-8 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse">
                            ${this.formatCurrency(financing.totalInvestment || financing.sources?.equity?.amount + financing.sources?.bankLoan?.amount || 0)}
                        </div>

                        <div class="grid grid-cols-2 gap-8 max-w-2xl mx-auto w-full text-left bg-white/5 p-8 rounded-2xl">
                            <div>
                                <div class="text-sm text-gray-400">رأس المال (Equity)</div>
                                <div class="text-2xl font-bold">${this.formatCurrency(financing.sources?.equity?.amount || 0)}</div>
                            </div>
                            <div>
                                <div class="text-sm text-gray-400">القروض (Debt)</div>
                                <div class="text-2xl font-bold">${this.formatCurrency(financing.sources?.bankLoan?.amount || 0)}</div>
                            </div>
                        </div>

                        <div class="mt-16 inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 border border-white/20">
                            <span class="w-3 h-3 rounded-full ${score.recommendation === 'go' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}"></span>
                            <span class="font-bold">قرار النظام: ${score.recommendationLabel || 'يحتاج مراجعة'}</span>
                        </div>
                    </div>
                `
            },

            // Slide 8: Call to Action
            {
                type: 'title',
                template: `
                    <div class="h-full flex flex-col items-center justify-center text-center p-12 bg-gradient-to-br from-purple-900 via-indigo-900 to-black">
                        <div class="text-8xl mb-8 animate-bounce">🤝</div>
                        <h1 class="text-6xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                            لنبدأ معاً
                        </h1>
                        <p class="text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed mb-12">
                            نبحث عن شركاء استراتيجيين يؤمنون برؤيتنا
                        </p>
                        <div class="flex gap-6">
                            <div class="bg-white/10 p-6 rounded-2xl backdrop-blur">
                                <div class="text-3xl mb-2">📧</div>
                                <div class="text-sm text-gray-400">للتواصل</div>
                            </div>
                            <div class="bg-white/10 p-6 rounded-2xl backdrop-blur">
                                <div class="text-3xl mb-2">📅</div>
                                <div class="text-sm text-gray-400">للمقابلة</div>
                            </div>
                        </div>
                        <div class="mt-12 text-sm text-gray-500">
                            شكراً لوقتك
                        </div>
                    </div>
                `
            }
        ];
    }

    renderFrame() {
        this.container.innerHTML = `
            <!-- Controls -->
            <div class="absolute top-0 left-0 w-full p-6 flex justify-between z-20 pointer-events-none">
                <button class="pointer-events-auto btn btn--sm btn--secondary bg-black/50 hover:bg-white/20 backdrop-blur" id="btnExitPitch">
                    ✕ خروج
                </button>
                <div class="text-white/50 text-sm font-mono">
                    <span id="slideCurrent">1</span> / <span id="slideTotal">${this.slides.length}</span>
                </div>
            </div>

            <!-- Slide Container -->
            <div id="slideContent" class="flex-1 w-full h-full relative perspective-1000">
                <!-- Slides injected here -->
            </div>

            <!-- Nav Controls -->
            <div class="absolute bottom-6 right-6 flex gap-2 z-20">
                <button class="btn btn--circle bg-white/10 hover:bg-white/20 backdrop-blur" id="btnPrevSlide">←</button>
                <button class="btn btn--circle bg-white/10 hover:bg-white/20 backdrop-blur" id="btnNextSlide">→</button>
            </div>
        `;

        const btnExit = this.container.querySelector('#btnExitPitch');
        const btnPrev = this.container.querySelector('#btnPrevSlide');
        const btnNext = this.container.querySelector('#btnNextSlide');

        if (btnExit) {
            btnExit.addEventListener('click', () => this.close());
        }
        if (btnPrev) {
            btnPrev.addEventListener('click', () => this.prevSlide());
        }
        if (btnNext) {
            btnNext.addEventListener('click', () => this.nextSlide());
        }
    }

    showSlide(index) {
        if (index < 0 || index >= this.slides.length) return;

        const content = document.getElementById('slideContent');
        const slide = this.slides[index];

        // Animate Out old slide
        if (content.children.length > 0) {
            content.firstElementChild.classList.add('slide-out-left');
            setTimeout(() => {
                content.innerHTML = '';
                this.renderSlideContent(slide, content);
            }, 300);
        } else {
            this.renderSlideContent(slide, content);
        }

        this.currentSlide = index;
        document.getElementById('slideCurrent').textContent = index + 1;
    }

    renderSlideContent(slide, container) {
        let html = '';
        if (slide.template) {
            html = slide.template;
        } else if (slide.type === 'split') {
            html = `
                <div class="h-full flex p-12 gap-12 slide-in-right">
                    <div class="flex-1">${slide.left}</div>
                    <div class="flex-1">${slide.right}</div>
                </div>
            `;
        } else if (slide.type === 'center') {
            html = `
                <div class="h-full flex flex-col items-center justify-center p-12 slide-in-right">
                    <h2 class="text-5xl font-bold mb-12">${slide.title}</h2>
                    ${slide.content}
                </div>
            `;
        } else if (slide.type === 'grid') {
            html = `
                <div class="h-full flex flex-col items-center justify-center p-12 slide-in-right">
                    <h2 class="text-5xl font-bold mb-16">${slide.title}</h2>
                    <div class="grid grid-cols-2 gap-12 w-full max-w-5xl">
                        ${slide.items.map(item => `
                            <div class="bg-white/5 p-8 rounded-2xl border border-white/10 flex flex-col items-center text-center">
                                <div class="text-gray-400 mb-2">${item.label}</div>
                                <div class="text-6xl font-black ${item.color}">${item.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const el = document.createElement('div');
        el.className = 'w-full h-full absolute inset-0 animate-slide-in';
        el.innerHTML = html;
        container.appendChild(el);
    }

    nextSlide() {
        if (this.currentSlide < this.slides.length - 1) {
            this.showSlide(this.currentSlide + 1);
        }
    }

    prevSlide() {
        if (this.currentSlide > 0) {
            this.showSlide(this.currentSlide - 1);
        }
    }

    formatCurrency(n) {
        if (!n) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + ' مليون';
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
    }

    formatPayback(n) {
        const value = Number(n);
        return Number.isFinite(value) && value > 0 ? value.toFixed(1) + ' سنة' : 'غير محقق';
    }
}

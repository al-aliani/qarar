/**
 * TemplateGallery.js
 * معرض القوالب الجاهزة (مكتبة الدراسات — Replica من منافسين مثل Imtiaz/Mudarrij)
 * يظهر عند إنشاء مشروع جديد. المستخدم يختار قطاعاً جاهزاً (مقهى، مطعم بخاري، تطبيق توصيل، متجر عطور)
 * فيُملأ الـ Store ببيانات افتراضية واقعية لهذا القطاع ليعدّل الأرقام فقط.
 */

import { createEmptyStudy } from '../core/schema.js';

/** معدل إهلاك سنوي من عمر الأصل (مثلاً 7 سنوات → 1/7) */
const depRate = (years) => (years > 0 ? 1 / years : 0.15);

export class TemplateGallery {
    constructor(overlayId, store) {
        this.overlay = document.getElementById(overlayId);
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = overlayId || 'templateGalleryOverlay';
            this.overlay.className = 'modal-overlay';
            document.body.appendChild(this.overlay);
        }
        this.store = store;
        this.templates = this.getTemplates();
    }

    getTemplates() {
        return [
            {
                id: 'cafe',
                name: 'مقهى مختص',
                icon: '☕',
                description: 'دراسة جاهزة لمقهى يقدم قهوة مختصة وحلويات. تشمل تكلفة ماكينة الإسبريسو 30,000 ريال والتجهيز.',
                data: this.buildCafeData()
            },
            {
                id: 'bukhari_restaurant',
                name: 'مطعم بخاري',
                icon: '🍛',
                description: 'مطعم أرز بخاري ووجبات يومية. معدات مطبخ، عمالة، وإيجار موقع بحي تجاري.',
                data: this.buildBukhariData()
            },
            {
                id: 'delivery_app',
                name: 'تطبيق توصيل',
                icon: '🛵',
                description: 'منصة توصيل محلية أو مطبخ يعتمد على تطبيقات التوصيل. عمولات، تسويق، وتشغيل.',
                data: this.buildDeliveryAppData()
            },
            {
                id: 'perfume_store',
                name: 'متجر عطور',
                icon: '🌸',
                description: 'متجر عطور وتجزئة. مخزون أولي، ديكور، وهامش ربح على البيع بالتجزئة.',
                data: this.buildPerfumeStoreData()
            },
            {
                id: 'empty',
                name: 'مشروع فارغ (من الصفر)',
                icon: '📄',
                description: 'ابدأ من الصفر. صفحة بيضاء لتبني دراستك الخاصة.',
                data: null
            }
        ];
    }

    /** مقهى: ماكينة إسبريسو 30,000 ريال كما طُلِب، وباقي البيانات واقعية */
    buildCafeData() {
        const empty = createEmptyStudy();
        return {
            projectInfo: {
                ...empty.projectInfo,
                name: 'مقهى القمة',
                sector: 'مطاعم ومقاهي',
                city: 'الرياض',
                concept: 'مقهى مختص يقدم قهوة مختصة وحلويات خفيفة'
            },
            technical: {
                ...empty.technical,
                equipment: [
                    { name: 'ماكينة إسبريسو', quantity: 1, price: 30000, depreciationRate: depRate(7), notes: 'ماكينة احترافية للمقهى' },
                    { name: 'طواحين قهوة (2)', quantity: 2, price: 6000, depreciationRate: depRate(5), notes: '' },
                    { name: 'ثلاجات عرض وحلويات', quantity: 2, price: 12000, depreciationRate: depRate(7), notes: '' },
                    { name: 'نقاط بيع POS', quantity: 1, price: 5000, depreciationRate: depRate(3), notes: '' }
                ],
                furniture: [
                    { name: 'ديكور وتأثيث صالة', quantity: 1, price: 120000, depreciationRate: depRate(5), notes: '' },
                    { name: 'طاولات وكراسي', quantity: 1, price: 35000, depreciationRate: depRate(5), notes: '' }
                ],
                buildings: [
                    { name: 'تشطيب داخلي وبار', quantity: 1, price: 80000, depreciationRate: depRate(5), notes: '' }
                ]
            },
            revenue: {
                streams: [
                    { service: 'إسبريسو ومشروبات حارة', customersPerMonth: 3000, avgPrice: 18, growthRate: 0.06, type: 'operating' },
                    { service: 'مشروبات باردة وعصائر', customersPerMonth: 2000, avgPrice: 22, growthRate: 0.05, type: 'operating' },
                    { service: 'حلويات وكيك', customersPerMonth: 1500, avgPrice: 25, growthRate: 0.05, type: 'operating' }
                ]
            },
            hr: {
                ...empty.hr,
                positions: [
                    { position: 'باريستا رئيسي', count: 1, months: 12, salary: 6000, nationality: 'saudi', isVariable: false },
                    { position: 'باريستا', count: 2, months: 12, salary: 4500, nationality: 'saudi', isVariable: false },
                    { position: 'خدمة ونظافة', count: 1, months: 12, salary: 3000, nationality: 'saudi', isVariable: false }
                ]
            },
            administrative: {
                administrative: [
                    { name: 'إيجار سنوي (شهرياً)', monthly: 10000, notes: 'موقع 120م²' },
                    { name: 'كهرباء ومياه', monthly: 2000, notes: '' },
                    { name: 'بن قهوة ومستلزمات', monthly: 5000, notes: '' }
                ]
            },
            marketSizing: {
                ...empty.marketSizing,
                tam: { value: 50000000, description: 'السوق الكلي للمقاهي في الرياض' },
                sam: { value: 10000000, description: 'السوق المتاح للمقاهي المختصة' },
                som: { value: 1500000, description: 'حصتك المستهدفة' }
            },
            timeline: {
                activities: [
                    { id: 1, name: 'استخراج السجل والتراخيص', startMonth: 1, duration: 2, category: 'legal' },
                    { id: 2, name: 'استئجار الموقع والتشطيب', startMonth: 2, duration: 4, category: 'technical' },
                    { id: 3, name: 'شراء ماكينة الإسبريسو والمعدات', startMonth: 6, duration: 2, category: 'technical' },
                    { id: 4, name: 'التوظيف والتدريب', startMonth: 7, duration: 2, category: 'hr' },
                    { id: 5, name: 'الافتتاح والحملة التسويقية', startMonth: 9, duration: 2, category: 'marketing' }
                ]
            }
        };
    }

    /** مطعم بخاري */
    buildBukhariData() {
        const empty = createEmptyStudy();
        return {
            projectInfo: {
                ...empty.projectInfo,
                name: 'مطعم الأصالة البخاري',
                sector: 'مطاعم',
                city: 'الرياض',
                concept: 'مطعم أرز بخاري ووجبات يومية للعائلات والموظفين'
            },
            technical: {
                ...empty.technical,
                equipment: [
                    { name: 'قدور بخاري صناعية', quantity: 4, price: 8000, depreciationRate: depRate(5), notes: '' },
                    { name: 'ثلاجات تبريد وتجميد', quantity: 3, price: 25000, depreciationRate: depRate(7), notes: '' },
                    { name: 'شوايات وفرن', quantity: 2, price: 15000, depreciationRate: depRate(5), notes: '' },
                    { name: 'نقاط بيع ومكائن مشروبات', quantity: 1, price: 7000, depreciationRate: depRate(3), notes: '' }
                ],
                furniture: [
                    { name: 'طاولات وكراسي صالة', quantity: 1, price: 45000, depreciationRate: depRate(5), notes: '' },
                    { name: 'ديكور وتشطيب', quantity: 1, price: 90000, depreciationRate: depRate(5), notes: '' }
                ],
                buildings: [
                    { name: 'تشطيب مطبخ وشفاطات', quantity: 1, price: 120000, depreciationRate: depRate(7), notes: '' }
                ]
            },
            revenue: {
                streams: [
                    { service: 'وجبات بخاري (داخل المطعم)', customersPerMonth: 4000, avgPrice: 28, growthRate: 0.05, type: 'operating' },
                    { service: 'طلبات توصيل', customersPerMonth: 1500, avgPrice: 35, growthRate: 0.10, type: 'operating' },
                    { service: 'مشروبات', customersPerMonth: 3500, avgPrice: 5, growthRate: 0.03, type: 'operating' }
                ]
            },
            hr: {
                ...empty.hr,
                positions: [
                    { position: 'شيف رئيسي', count: 1, months: 12, salary: 7000, nationality: 'saudi', isVariable: false },
                    { position: 'طباخين', count: 3, months: 12, salary: 4500, nationality: 'saudi', isVariable: false },
                    { position: 'كاشير وخدمة', count: 2, months: 12, salary: 3500, nationality: 'saudi', isVariable: false },
                    { position: 'نظافة', count: 1, months: 12, salary: 2800, nationality: 'saudi', isVariable: false }
                ]
            },
            administrative: {
                administrative: [
                    { name: 'إيجار موقع (حي تجاري)', monthly: 15000, notes: '200م²' },
                    { name: 'كهرباء وماء وغاز', monthly: 4000, notes: '' },
                    { name: 'مواد خام (أرز، لحم، خضار)', monthly: 35000, notes: '' }
                ]
            },
            marketSizing: {
                ...empty.marketSizing,
                tam: { value: 80000000, description: 'سوق المطاعم اليومية في الرياض' },
                sam: { value: 15000000, description: 'مطاعم بخاري ووجبات' },
                som: { value: 2000000, description: 'حصتك المستهدفة' }
            },
            timeline: {
                activities: [
                    { id: 1, name: 'تراخيص وبلدية', startMonth: 1, duration: 2, category: 'legal' },
                    { id: 2, name: 'استئجار وتشطيب المطبخ', startMonth: 2, duration: 4, category: 'technical' },
                    { id: 3, name: 'شراء المعدات والأثاث', startMonth: 6, duration: 2, category: 'technical' },
                    { id: 4, name: 'التوظيف والتدريب', startMonth: 7, duration: 2, category: 'hr' },
                    { id: 5, name: 'الافتتاح والتسويق', startMonth: 9, duration: 2, category: 'marketing' }
                ]
            }
        };
    }

    /** تطبيق توصيل (مطبخ سحابي أو منصة توصيل محلية) */
    buildDeliveryAppData() {
        const empty = createEmptyStudy();
        return {
            projectInfo: {
                ...empty.projectInfo,
                name: 'تطبيق توصيل — مطبخي',
                sector: 'توصيل وخدمات رقمية',
                city: 'جدة',
                concept: 'مطبخ يعتمد على طلبات تطبيقات التوصيل (هنقرستشن، جاهز، إلخ)'
            },
            technical: {
                ...empty.technical,
                equipment: [
                    { name: 'معدات مطبخ (قلايات، ثلاجات)', quantity: 1, price: 55000, depreciationRate: depRate(5), notes: '' },
                    { name: 'نظام طلبات وPOS', quantity: 1, price: 8000, depreciationRate: depRate(3), notes: '' }
                ],
                furniture: [
                    { name: 'تجهيز تعبئة وتغليف', quantity: 1, price: 15000, depreciationRate: depRate(5), notes: '' }
                ],
                buildings: [
                    { name: 'تجهيز موقع مطبخ (بدون صالة)', quantity: 1, price: 70000, depreciationRate: depRate(5), notes: '' }
                ]
            },
            revenue: {
                streams: [
                    { service: 'طلبات من تطبيقات التوصيل', customersPerMonth: 3500, avgPrice: 45, growthRate: 0.12, type: 'operating' },
                    { service: 'طلبات مباشرة (واتساب)', customersPerMonth: 500, avgPrice: 40, growthRate: 0.15, type: 'operating' }
                ]
            },
            hr: {
                ...empty.hr,
                positions: [
                    { position: 'مدير تشغيل', count: 1, months: 12, salary: 6000, nationality: 'saudi', isVariable: false },
                    { position: 'طباخين', count: 2, months: 12, salary: 4500, nationality: 'saudi', isVariable: false },
                    { position: 'منسق طلبات', count: 1, months: 12, salary: 3500, nationality: 'saudi', isVariable: false }
                ]
            },
            administrative: {
                administrative: [
                    { name: 'إيجار مطبخ (بدون صالة)', monthly: 8000, notes: '' },
                    { name: 'عمولة تطبيقات توصيل (تقريباً)', monthly: 18000, notes: 'حوالي 18–20% من المبيعات' },
                    { name: 'تسويق رقمي وإعلانات', monthly: 5000, notes: '' },
                    { name: 'مواد خام وتغليف', monthly: 22000, notes: '' }
                ]
            },
            marketSizing: {
                ...empty.marketSizing,
                tam: { value: 120000000, description: 'سوق التوصيل في المنطقة' },
                sam: { value: 25000000, description: 'المطاعم المعتمدة على التوصيل' },
                som: { value: 3000000, description: 'حصتك المستهدفة' }
            },
            timeline: {
                activities: [
                    { id: 1, name: 'تراخيص واتفاقيات التطبيقات', startMonth: 1, duration: 2, category: 'legal' },
                    { id: 2, name: 'تجهيز المطبخ والمعدات', startMonth: 2, duration: 3, category: 'technical' },
                    { id: 3, name: 'التوظيف والتدريب', startMonth: 5, duration: 1, category: 'hr' },
                    { id: 4, name: 'الإطلاق على التطبيقات', startMonth: 6, duration: 1, category: 'launch' }
                ]
            }
        };
    }

    /** متجر عطور */
    buildPerfumeStoreData() {
        const empty = createEmptyStudy();
        return {
            projectInfo: {
                ...empty.projectInfo,
                name: 'متجر أناقة العطور',
                sector: 'تجزئة عطور ومستحضرات',
                city: 'الرياض',
                concept: 'متجر عطور نسائية ورجالية وتجزئة ماركات محلية وعالمية'
            },
            technical: {
                ...empty.technical,
                equipment: [
                    { name: 'أرفف عرض ووحدات إضاءة', quantity: 1, price: 25000, depreciationRate: depRate(5), notes: '' },
                    { name: 'نقاط بيع وكاشير', quantity: 1, price: 6000, depreciationRate: depRate(3), notes: '' }
                ],
                furniture: [
                    { name: 'ديكور وتأثيث المتجر', quantity: 1, price: 55000, depreciationRate: depRate(5), notes: '' }
                ],
                buildings: [
                    { name: 'تشطيب محل (واجهة + داخلي)', quantity: 1, price: 70000, depreciationRate: depRate(5), notes: '' }
                ]
            },
            revenue: {
                streams: [
                    { service: 'عطور نسائية', customersPerMonth: 200, avgPrice: 350, growthRate: 0.08, type: 'operating' },
                    { service: 'عطور رجالية', customersPerMonth: 150, avgPrice: 280, growthRate: 0.07, type: 'operating' },
                    { service: 'اكسسوارات وهدايا', customersPerMonth: 100, avgPrice: 120, growthRate: 0.05, type: 'operating' }
                ]
            },
            hr: {
                ...empty.hr,
                positions: [
                    { position: 'مدير متجر', count: 1, months: 12, salary: 5500, nationality: 'saudi', isVariable: false },
                    { position: 'بائعين', count: 2, months: 12, salary: 4000, nationality: 'saudi', isVariable: false }
                ]
            },
            administrative: {
                administrative: [
                    { name: 'إيجار محل (موقع تجاري)', monthly: 12000, notes: '80م²' },
                    { name: 'كهرباء وإضاءة', monthly: 1500, notes: '' },
                    { name: 'تسويق وسوشال ميديا', monthly: 3000, notes: '' }
                ]
            },
            marketSizing: {
                ...empty.marketSizing,
                tam: { value: 40000000, description: 'سوق العطور والتجزئة في الرياض' },
                sam: { value: 8000000, description: 'متاجر العطور المتخصصة' },
                som: { value: 1200000, description: 'حصتك المستهدفة' }
            },
            timeline: {
                activities: [
                    { id: 1, name: 'سجل تجاري وتراخيص', startMonth: 1, duration: 2, category: 'legal' },
                    { id: 2, name: 'استئجار المحل والتشطيب', startMonth: 2, duration: 3, category: 'technical' },
                    { id: 3, name: 'شراء مخزون أولي وعرض', startMonth: 5, duration: 2, category: 'technical' },
                    { id: 4, name: 'التوظيف والافتتاح', startMonth: 7, duration: 2, category: 'hr' }
                ]
            }
        };
    }

    open() {
        this.render();
        this.overlay.classList.add('is-open');
    }

    close() {
        this.overlay.classList.remove('is-open');
    }

    render() {
        this.overlay.innerHTML = `
            <div class="modal-card template-modal animate-scale-in">
                <div class="modal-header">
                    <h3>🚀 اختر نقطة البداية</h3>
                    <button class="btn-close" type="button" aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body">
                    <p class="text-muted mb-4">ابدأ بنسخة جاهزة لقطاعك وعدّل الأرقام فقط — لا حاجة للبدء من الصفر.</p>
                    <div class="templates-grid">
                        ${this.templates.map(t => `
                            <button class="template-card" type="button" data-id="${t.id}">
                                <div class="t-icon">${t.icon}</div>
                                <div class="t-info">
                                    <h4>${t.name}</h4>
                                    <p>${t.description}</p>
                                </div>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        this.overlay.querySelector('.btn-close').onclick = () => this.close();
        this.overlay.querySelectorAll('.template-card').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                this.selectTemplate(id);
            };
        });
    }

    async selectTemplate(id) {
        const template = this.templates.find(t => t.id === id);
        if (template && template.data) {
            const dataCopy = JSON.parse(JSON.stringify(template.data));
            const merged = this.store.mergeWithDefaults(dataCopy);
            this.store.set(merged);

            window.dispatchEvent(new CustomEvent('project-loaded', { detail: { source: 'template', name: template.name } }));

            try {
                const { toast } = await import('../utils/toast.js');
                if (toast && toast.success) toast.success(`تم تحميل قالب: ${template.name}`);
            } catch (_) {}
        } else {
            if (this.store.reset) await this.store.reset();
        }
        this.close();
    }
}

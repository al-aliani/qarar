/**
 * Sector-Specific Templates Data
 * Rich data for different business types based on Saudi Market Standards (2026)
 * All prices in SAR, reflecting real market conditions in major cities
 */

export const TEMPLATES = {
    BURGER_JOINT: {
        id: 'burger_joint',
        label: 'مطعم برجر (تصميم صناعي)',
        icon: '🍔',
        description: 'قالب تفصيلي لمطعم برجر حديث. يشمل تكاليف الشوايات، الثلاجات، وتكاليف العمالة والتشغيل المتوقعة في السوق السعودي.',
        suitableForProjectLike: 'مناسب لمشروع مثل: مطعم برجر، وجبات سريعة، أو نقطة طعام في مول أو شارع تجاري.',
        priceLabel: 'مجاني',
        data: {
            projectInfo: {
                name: 'مطعم برجر سيجنتشر',
                type: 'commercial',
                duration: 5,
                currency: 'SAR',
                city: 'الرياض'
            },
            technical: {
                buildings: [
                    { name: 'أعمال ديكور وتشطيب (Industrial Style)', price: 180000, quantity: 1, depreciationYears: 5 },
                    { name: 'تركيب شفاطات وتهوية مركزية معتمدة', price: 65000, quantity: 1, depreciationYears: 10 },
                    { name: 'نظام إطفاء حريق وسلامة معتمد من الدفاع المدني', price: 28000, quantity: 1, depreciationYears: 10 },
                    { name: 'تجهيز دورات مياه وسباكة', price: 35000, quantity: 1, depreciationYears: 7 }
                ],
                equipment: [
                    { name: 'شواية جريل (Flat Top Grill) صناعي', price: 14000, quantity: 2, depreciationYears: 5 },
                    { name: 'قلاية بطاطس مزدوجة (Deep Fryer)', price: 9500, quantity: 2, depreciationYears: 5 },
                    { name: 'ثلاجة تبريد وتجميد عمودية', price: 10500, quantity: 3, depreciationYears: 7 },
                    { name: 'طاولة تحضير ستانلس ستيل مع ثلاجة', price: 7200, quantity: 2, depreciationYears: 7 },
                    { name: 'جهاز POS متكامل مع طابعة', price: 5000, quantity: 2, depreciationYears: 3 },
                    { name: 'فريزر رأسي للمجمدات', price: 8500, quantity: 2, depreciationYears: 7 }
                ],
                furniture: [
                    { name: 'طاولات خشبية (صناعية)', price: 900, quantity: 15, depreciationYears: 5 },
                    { name: 'كراسي معدنية مريحة', price: 380, quantity: 40, depreciationYears: 5 },
                    { name: 'كاونتر استقبال وكاشير', price: 12000, quantity: 1, depreciationYears: 7 }
                ]
            },
            hr: {
                positions: [
                    { title: 'مدير فرع', salary: 8000, count: 1, annualUnknown: 0 },
                    { title: 'شيف برجر (Grill Master)', salary: 6000, count: 2, annualUnknown: 0 },
                    { title: 'مساعد مطبخ', salary: 3500, count: 2, annualUnknown: 0 },
                    { title: 'كاشير / خدمة عملاء', salary: 4000, count: 2, annualUnknown: 0 },
                    { title: 'عامل نظافة', salary: 2500, count: 1, annualUnknown: 0 }
                ]
            },
            opex: {
                costItems: [
                    { name: 'إيجار شهري (موقع تجاري 150م²)', monthlyAmount: 15000, annualUnknown: 0 },
                    { name: 'كهرباء ومياه وغاز', monthlyAmount: 4000, annualUnknown: 0 },
                    { name: 'تسويق رقمي وإعلانات', monthlyAmount: 6000, annualUnknown: 0 },
                    { name: 'صيانة ونظافة شهرية', monthlyAmount: 2000, annualUnknown: 0 },
                    // عمولة التوصيل نُمذجت كنسبة من مبيعات قناة التوصيل (variableCostRate) — لا كبند ثابت لا يتحرك مع المبيعات
                    { name: 'رخصة بلدية (سنوية/12)', monthlyAmount: 200, annualUnknown: 0 },
                    { name: 'تأمين GOSI (11.75% من الرواتب)', monthlyAmount: 3200, annualUnknown: 0 },
                    { name: 'تأمينات ورسوم إقامات', monthlyAmount: 800, annualUnknown: 0 }
                ]
            },
            revenue: {
                streams: [
                    // variableCostRate = تكلفة الطعام (Food Cost) + عمولة المنصات لقناة التوصيل — تتناسب مع المبيعات
                    { name: 'وجبات برجر (Dine-in)', customersPerMonth: 1200, avgPrice: 58, growthRate: 0.05, variableCostRate: 0.32 },
                    { name: 'طلبات تطبيقات التوصيل (Jahez/HungerStation)', customersPerMonth: 2800, avgPrice: 62, growthRate: 0.10, variableCostRate: 0.52 }, // 32% طعام + 20% عمولة منصات
                    { name: 'طلبات خارجية (Pickup)', customersPerMonth: 900, avgPrice: 52, growthRate: 0.03, variableCostRate: 0.32 }
                ]
            }
        }
    },

    COFFEE_SHOP: {
        id: 'coffee_shop',
        label: 'كافيه مختص (Specialty Coffee)',
        icon: '☕',
        description: 'مشروع مقهى مختص يركز على جودة القهوة وتجربة الجلوس. بيانات دقيقة لتكلفة البار والكادر في السوق السعودي.',
        suitableForProjectLike: 'مناسب لمشروع مثل: كافيه مختص، حلوى وعصائر، أو نقطة قهوة في مكان راقٍ.',
        priceLabel: 'مجاني',
        data: {
            projectInfo: {
                name: 'كافيه مختص - Third Wave',
                type: 'commercial',
                duration: 5,
                currency: 'SAR',
                city: 'الرياض'
            },
            technical: {
                buildings: [
                    { name: 'ديكور داخلي وإضاءة (Minimalist)', price: 280000, quantity: 1, depreciationYears: 5 },
                    { name: 'بار (Counter) مخصص مع رخام/كوريان', price: 55000, quantity: 1, depreciationYears: 10 },
                    { name: 'أعمال سباكة وكهرباء مكثفة', price: 45000, quantity: 1, depreciationYears: 10 }
                ],
                equipment: [
                    { name: 'ماكينة إسبريسو (La Marzocco Linea)', price: 85000, quantity: 1, depreciationYears: 7 },
                    { name: 'طاحونة قهوة إسبريسو (Mazzer/Eureka)', price: 14000, quantity: 2, depreciationYears: 5 },
                    { name: 'طاحونة قهوة مقطرة (Filter)', price: 10000, quantity: 1, depreciationYears: 5 },
                    { name: 'أدوات تقطير (V60, Chemex, Aeropress)', price: 6000, quantity: 1, depreciationYears: 3 },
                    { name: 'غسالة أكواب صناعية', price: 9500, quantity: 1, depreciationYears: 5 },
                    { name: 'ثلاجات عرض للحلويات والعصائر', price: 12000, quantity: 2, depreciationYears: 7 },
                    { name: 'نقاط بيع (POS) وشاشات عرض', price: 6000, quantity: 1, depreciationYears: 3 }
                ],
                furniture: [
                    { name: 'كنب وجلسات مريحة (Cozy Seating)', price: 55000, quantity: 1, depreciationYears: 5 },
                    { name: 'طاولات خشب/رخام صغيرة', price: 700, quantity: 22, depreciationYears: 5 },
                    { name: 'ديكورات وإكسسوارات', price: 18000, quantity: 1, depreciationYears: 5 }
                ]
            },
            hr: {
                positions: [
                    { title: 'هيد باريستا (SCA معتمد)', salary: 7000, count: 1, annualUnknown: 0 },
                    { title: 'باريستا', salary: 5000, count: 3, annualUnknown: 0 },
                    { title: 'ويتر / خدمة طاولات', salary: 3200, count: 2, annualUnknown: 0 },
                    { title: 'عامل نظافة', salary: 2500, count: 1, annualUnknown: 0 }
                ]
            },
            opex: {
                costItems: [
                    { name: 'إيجار موقع راقي (120م²)', monthlyAmount: 18000, annualUnknown: 0 },
                    // الحبوب والحليب تكاليف متغيرة (variableCostRate في مصادر الإيراد) — إبقاؤها هنا يخصمها مرتين
                    { name: 'كهرباء وإنترنت وماء', monthlyAmount: 3000, annualUnknown: 0 },
                    { name: 'تسويق وسوشال ميديا', monthlyAmount: 4000, annualUnknown: 0 },
                    { name: 'GOSI وتأمينات اجتماعية', monthlyAmount: 2800, annualUnknown: 0 },
                    { name: 'بلدية ورسوم صحية سنوية', monthlyAmount: 180, annualUnknown: 0 }
                ]
            },
            revenue: {
                streams: [
                    // variableCostRate = تكلفة المواد (حبوب/حليب/مخبوزات) كنسبة من الإيراد — بدل بنود ثابتة لا تتحرك مع المبيعات
                    { name: 'مشروبات القهوة المختصة', customersPerMonth: 5000, avgPrice: 24, growthRate: 0.08, variableCostRate: 0.28 },
                    { name: 'حلويات ومخبوزات طازجة', customersPerMonth: 2200, avgPrice: 30, growthRate: 0.06, variableCostRate: 0.35 },
                    { name: 'بيع حبوب قهوة (Retail)', customersPerMonth: 180, avgPrice: 75, growthRate: 0.12, variableCostRate: 0.55 },
                    { name: 'ورش تدريب باريستا (شهرية)', customersPerMonth: 8, avgPrice: 500, growthRate: 0.05, variableCostRate: 0.10 }
                ]
            }
        }
    },

    SOFTWARE_SAAS: {
        id: 'software_saas',
        label: 'شركة برمجيات (SaaS)',
        icon: '💻',
        description: 'نموذج عمل لشركة تقنية تقدم خدمة باشتراكات. تركيز على الرواتب التقنية بالسوق السعودي، السيرفرات، والتسويق الرقمي.',
        suitableForProjectLike: 'مناسب لمشروع مثل: منصة SaaS، تطبيق اشتراك، أو شركة برمجيات ناشئة.',
        priceLabel: 'مجاني',
        data: {
            projectInfo: {
                name: 'منصة إدارة مهام SaaS',
                type: 'tech',
                duration: 5,
                currency: 'SAR',
                city: 'الرياض'
            },
            technical: {
                buildings: [
                    { name: 'تجهيز مكتب (Open Space - Co-working)', price: 80000, quantity: 1, depreciationYears: 5 }
                ],
                equipment: [
                    { name: 'لابتوب MacBook Pro M3', price: 12500, quantity: 5, depreciationYears: 3 },
                    { name: 'شاشات ومستلزمات مكتبية', price: 18000, quantity: 1, depreciationYears: 3 },
                    { name: 'سيرفر محلي (اختياري)', price: 25000, quantity: 1, depreciationYears: 5 }
                ],
                furniture: [
                    { name: 'مكاتب قابلة للتعديل (Standing)', price: 32000, quantity: 1, depreciationYears: 5 }
                ]
            },
            hr: {
                positions: [
                    { title: 'مطور واجهات (Frontend - React)', salary: 15000, count: 1, annualUnknown: 0 },
                    { title: 'مطور خلفية (Backend - Node/Python)', salary: 17000, count: 1, annualUnknown: 0 },
                    { title: 'مدير منتج (Product Manager)', salary: 18000, count: 1, annualUnknown: 0 },
                    { title: 'أخصائي تسويق نمو (Growth)', salary: 12000, count: 1, annualUnknown: 0 },
                    { title: 'مصمم UI/UX', salary: 10000, count: 1, annualUnknown: 0 }
                ]
            },
            opex: {
                costItems: [
                    { name: 'استضافة سحابية (AWS/Azure)', monthlyAmount: 3000, annualUnknown: 0 },
                    { name: 'أدوات برمجية (Jira, Slack, GitHub, Analytics)', monthlyAmount: 2000, annualUnknown: 0 },
                    { name: 'إيجار مساحة عمل مشتركة', monthlyAmount: 6000, annualUnknown: 0 },
                    { name: 'حملات تسويق رقمي (Google/Meta Ads)', monthlyAmount: 20000, annualUnknown: 0 },
                    { name: 'GOSI وتأمينات', monthlyAmount: 8500, annualUnknown: 0 },
                    { name: 'محاسب/خدمات قانونية', monthlyAmount: 2500, annualUnknown: 0 }
                ]
            },
            revenue: {
                streams: [
                    { name: 'اشتراك أساسي (Basic) - 10 مستخدمين', customersPerMonth: 600, avgPrice: 59, growthRate: 0.15 },
                    { name: 'اشتراك احترافي (Pro) - 50 مستخدم', customersPerMonth: 200, avgPrice: 249, growthRate: 0.10 },
                    { name: 'اشتراك شركات (Enterprise) - Unlimited', customersPerMonth: 15, avgPrice: 1499, growthRate: 0.05 }
                ]
            }
        }
    },

    CLOUD_KITCHEN: {
        id: 'cloud_kitchen',
        label: 'مطبخ سحابي (Cloud Kitchen)',
        icon: '📦',
        description: 'نموذج عمل مطبخ بدون صالة جلوس، يعتمد كلياً على التوصيل. استثمار أقل، هوامش ربح أعلى، مثالي للأحياء السكنية.',
        suitableForProjectLike: 'مناسب لمشروع مثل: مطبخ توصيل فقط، أو علامة طعام على تطبيقات التوصيل.',
        priceLabel: 'مجاني',
        data: {
            projectInfo: {
                name: 'مطبخ سحابي - برجر & فرايز',
                type: 'commercial',
                duration: 5,
                currency: 'SAR',
                city: 'جدة'
            },
            technical: {
                buildings: [
                    { name: 'تجهيز مطبخ صناعي (بدون صالة)', price: 90000, quantity: 1, depreciationYears: 5 },
                    { name: 'شفاطات وتهوية', price: 35000, quantity: 1, depreciationYears: 10 },
                    { name: 'بلاط وسيراميك ومقاوم للماء', price: 20000, quantity: 1, depreciationYears: 10 },
                    { name: 'إطفاء حريق وسلامة', price: 18000, quantity: 1, depreciationYears: 10 }
                ],
                equipment: [
                    { name: 'شوايات برجر صناعية', price: 13000, quantity: 2, depreciationYears: 5 },
                    { name: 'قلايات بطاطس عميقة', price: 8000, quantity: 2, depreciationYears: 5 },
                    { name: 'ثلاجات تبريد وتجميد', price: 9000, quantity: 3, depreciationYears: 7 },
                    { name: 'طاولات تحضير ستانلس', price: 5000, quantity: 3, depreciationYears: 7 },
                    { name: 'أفران (للخبز إذا لزم)', price: 7000, quantity: 1, depreciationYears: 5 },
                    { name: 'نظام POS للطلبات', price: 4000, quantity: 1, depreciationYears: 3 },
                    { name: 'أرفف تخزين ستانلس', price: 6000, quantity: 1, depreciationYears: 7 }
                ],
                furniture: [
                    { name: 'طاولة تعبئة وتغليف', price: 3000, quantity: 2, depreciationYears: 5 }
                ]
            },
            hr: {
                positions: [
                    { title: 'مدير تشغيل / شيف', salary: 7000, count: 1, annualUnknown: 0 },
                    { title: 'طباخ رئيسي', salary: 5000, count: 2, annualUnknown: 0 },
                    { title: 'مساعد مطبخ', salary: 3000, count: 2, annualUnknown: 0 },
                    { title: 'منسق طلبات (Dispatcher)', salary: 3500, count: 1, annualUnknown: 0 },
                    { title: 'عامل نظافة', salary: 2200, count: 1, annualUnknown: 0 }
                ]
            },
            opex: {
                costItems: [
                    { name: 'إيجار شهري (80م² - حي سكني)', monthlyAmount: 8000, annualUnknown: 0 },
                    { name: 'كهرباء وماء وغاز', monthlyAmount: 2500, annualUnknown: 0 },
                    // العمولة والمواد الخام نُمذجت كنِسب متغيرة في مصادر الإيراد (variableCostRate) — لا كبنود ثابتة
                    { name: 'تغليف وباكجينج (Branded)', monthlyAmount: 5000, annualUnknown: 0 },
                    { name: 'تسويق رقمي (Instagram Ads)', monthlyAmount: 4000, annualUnknown: 0 },
                    { name: 'GOSI وتأمينات', monthlyAmount: 2400, annualUnknown: 0 },
                    { name: 'رخصة بلدية وفحص دوري', monthlyAmount: 150, annualUnknown: 0 },
                    { name: 'صيانة وطوارئ', monthlyAmount: 1000, annualUnknown: 0 }
                ]
            },
            revenue: {
                streams: [
                    // variableCostRate = مواد خام (~35%) + عمولة المنصة لكل قناة — تتناسب مع مبيعات كل قناة
                    { name: 'طلبات Jahez', customersPerMonth: 1800, avgPrice: 55, growthRate: 0.12, variableCostRate: 0.57 }, // 35% مواد + 22% عمولة
                    { name: 'طلبات HungerStation', customersPerMonth: 1500, avgPrice: 58, growthRate: 0.10, variableCostRate: 0.57 },
                    { name: 'طلبات Mrsool', customersPerMonth: 800, avgPrice: 52, growthRate: 0.08, variableCostRate: 0.55 }, // عمولة أخف 20%
                    { name: 'طلبات مباشرة (WhatsApp/موقع)', customersPerMonth: 400, avgPrice: 50, growthRate: 0.15, variableCostRate: 0.35 } // بلا عمولة منصات
                ]
            }
        }
    },

    RETAIL: {
        id: 'retail',
        label: 'متجر تجزئة (Retail)',
        icon: '🛒',
        description: 'نموذج لمتجر بيع بالتجزئة بمساحة متوسطة. يشمل تكاليف المحل، الرفوف، المخزون الأولي، والكادر.',
        suitableForProjectLike: 'مناسب لمشروع مثل: متجر إلكترونيات، بوتيك ملابس، أو بقالة/سوبرماركت صغير.',
        priceLabel: 'مجاني',
        data: {
            projectInfo: {
                name: 'متجر تجزئة - عرض ومنافسة',
                type: 'commercial',
                duration: 5,
                currency: 'SAR',
                city: 'الرياض'
            },
            technical: {
                buildings: [
                    { name: 'تشطيب محل تجاري (120م²)', price: 120000, quantity: 1, depreciationYears: 5 },
                    { name: 'إضاءة وواجهة عرض', price: 35000, quantity: 1, depreciationYears: 7 }
                ],
                equipment: [
                    { name: 'رفوف وعرض منتجات', price: 25000, quantity: 1, depreciationYears: 7 },
                    { name: 'نظام نقاط بيع (POS) وكاشير', price: 8000, quantity: 2, depreciationYears: 3 },
                    { name: 'كاميرات مراقبة وأمن', price: 12000, quantity: 1, depreciationYears: 5 }
                ],
                furniture: [
                    { name: 'كاونتر استقبال', price: 6000, quantity: 1, depreciationYears: 5 },
                    { name: 'طاولات عرض', price: 2000, quantity: 5, depreciationYears: 5 }
                ]
            },
            hr: {
                positions: [
                    { title: 'مدير متجر', salary: 7000, count: 1, annualUnknown: 0 },
                    { title: 'بائع', salary: 4000, count: 3, annualUnknown: 0 },
                    { title: 'كاشير', salary: 3500, count: 2, annualUnknown: 0 },
                    { title: 'عامل مخزن', salary: 3000, count: 1, annualUnknown: 0 }
                ]
            },
            opex: {
                costItems: [
                    { name: 'إيجار شهري (موقع تجاري)', monthlyAmount: 18000, annualUnknown: 0 },
                    { name: 'كهرباء وإنترنت', monthlyAmount: 2500, annualUnknown: 0 },
                    { name: 'تسويق وإعلانات', monthlyAmount: 5000, annualUnknown: 0 },
                    { name: 'GOSI وتأمينات', monthlyAmount: 3500, annualUnknown: 0 },
                    { name: 'مخزون أولي وتشغيل', monthlyAmount: 15000, annualUnknown: 0 }
                ]
            },
            revenue: {
                streams: [
                    { name: 'مبيعات من داخل المحل', customersPerMonth: 1500, avgPrice: 180, growthRate: 0.06 },
                    { name: 'طلبات عبر الهاتف/الواتساب', customersPerMonth: 300, avgPrice: 220, growthRate: 0.10 }
                ]
            }
        }
    },

    SERVICE: {
        id: 'service',
        label: 'مشروع خدمي (خدمات)',
        icon: '🛠️',
        description: 'نموذج لمشروع يقدّم خدمات (صيانة، استشارات، تدريب، أو خدمات منزلية). تركيز على الكادر والعمليات.',
        suitableForProjectLike: 'مناسب لمشروع مثل: مركز صيانة، مكتب استشارات، معهد تدريب، أو شركة خدمات منزلية.',
        priceLabel: 'مجاني',
        data: {
            projectInfo: {
                name: 'مركز خدمات - احترافي',
                type: 'commercial',
                duration: 5,
                currency: 'SAR',
                city: 'جدة'
            },
            technical: {
                buildings: [
                    { name: 'تجهيز مكتب/وحدة خدمية', price: 80000, quantity: 1, depreciationYears: 5 }
                ],
                equipment: [
                    { name: 'أجهزة ومعدات عمل', price: 35000, quantity: 1, depreciationYears: 5 },
                    { name: 'حواسيب ونظام إدارة', price: 15000, quantity: 1, depreciationYears: 3 }
                ],
                furniture: [
                    { name: 'مكاتب وكراسي واستقبال', price: 20000, quantity: 1, depreciationYears: 5 }
                ]
            },
            hr: {
                positions: [
                    { title: 'مدير تشغيل', salary: 9000, count: 1, annualUnknown: 0 },
                    { title: 'فني/مختص خدمة', salary: 5500, count: 2, annualUnknown: 0 },
                    { title: 'موظف استقبال', salary: 3500, count: 1, annualUnknown: 0 }
                ]
            },
            opex: {
                costItems: [
                    { name: 'إيجار شهري', monthlyAmount: 12000, annualUnknown: 0 },
                    { name: 'كهرباء وإنترنت واتصالات', monthlyAmount: 2000, annualUnknown: 0 },
                    { name: 'تسويق وعلاقات عملاء', monthlyAmount: 4000, annualUnknown: 0 },
                    { name: 'GOSI وتأمينات', monthlyAmount: 3200, annualUnknown: 0 },
                    { name: 'مستلزمات تشغيل', monthlyAmount: 3000, annualUnknown: 0 }
                ]
            },
            revenue: {
                streams: [
                    { name: 'خدمات أساسية (فاتورة متوسطة)', customersPerMonth: 120, avgPrice: 850, growthRate: 0.08 },
                    { name: 'خدمات إضافية/صيانة دورية', customersPerMonth: 60, avgPrice: 450, growthRate: 0.05 }
                ]
            }
        }
    },

    /** قالب خطة عمل + جدوى (مشروعك / Mashrouak): بنية الخطة مع الأرقام والتحليل المالي. مخرج واحد يضم الاثنين. */
    BUSINESS_PLAN_FEASIBILITY: {
        id: 'business_plan_feasibility',
        label: 'خطة عمل + جدوى',
        icon: '📋',
        description: 'قالب يجمع بنية الخطة (الرؤية، الأهداف، المنتج، السوق) مع الأرقام والتحليل المالي. مسار يبدأ بأسئلة الخطة ثم مدخلات الجدوى. مخرج واحد يضم الاثنين.',
        suitableForProjectLike: 'مناسب لمشروع مثل: أي فكرة تحتاج خطة عمل قصيرة مع دراسة جدوى مالية — استخدم تصدير «تقرير جدوى + ملخص خطة عمل».',
        priceLabel: 'متضمن في الاشتراك',
        data: {
            projectInfo: {
                name: 'مشروع خطة عمل + جدوى',
                description: 'أضف وصف المشروع والمنتج/الخدمة هنا. ثم أكمل الرؤية والأهداف في الأقسام المناسبة.',
                city: 'الرياض',
                concept: '',
                identityStatement: '',
                valueProposition: '',
                areaSize: 0
            },
            executiveSummary: {
                projectOverview: '',
                problemStatement: '',
                proposedSolution: '',
                uniqueValueProposition: ''
            },
            smartGoals: {
                goals: [
                    { id: '1', specific: 'هدف أول محدد وقابل للقياس', measurable: '', achievable: '', relevant: '', timeBound: '', category: 'financial', targetValue: 0, status: 'pending' },
                    { id: '2', specific: 'هدف ثانٍ', measurable: '', achievable: '', relevant: '', timeBound: '', category: 'operational', targetValue: 0, status: 'pending' },
                    { id: '3', specific: 'هدف ثالث', measurable: '', achievable: '', relevant: '', timeBound: '', category: 'marketing', targetValue: 0, status: 'pending' }
                ]
            }
        }
    }
};


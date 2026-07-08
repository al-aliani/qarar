/**
 * Data Service
 * Central service for data manipulation and comparison logic
 */
import { ProjectManager } from './ProjectManager.js';
import { calculateStudy as runFullModel } from '../core/engine.js';

export class DataService {
    /**
     * Compare two studies and return diff analysis
     */
    static async compareStudies(currentStudy, savedStudyId) {
        const result = await ProjectManager.loadProject(savedStudyId);
        const savedStudy = result?.data ?? null;

        if (!savedStudy) {
            throw new Error('Study not found');
        }

        // Run models for both
        const currentResults = runFullModel(currentStudy);
        const savedResults = runFullModel(savedStudy);

        return {
            meta: {
                currentName: currentStudy.projectInfo?.name || 'الدراسة الحالية',
                savedName: savedStudy.projectInfo?.name || 'الدراسة المحفوظة',
                date: new Date()
            },
            comparison: {
                npv: this.calcDiff(currentResults.indicators.npv, savedResults.indicators.npv),
                irr: this.calcDiff(currentResults.indicators.irr, savedResults.indicators.irr, true),
                roi: this.calcDiff(currentResults.indicators.roi, savedResults.indicators.roi, true),
                payback: this.calcDiff(currentResults.indicators.paybackPeriod, savedResults.indicators.paybackPeriod, false, true),

                capex: this.calcDiff(currentResults.capex.total, savedResults.capex.total, false, true),
                opex: this.calcDiff(currentResults.opex.totalAnnual, savedResults.opex.totalAnnual, false, true),

                revenue: this.calcDiff(
                    currentResults.incomeStatement[0].revenue,
                    savedResults.incomeStatement[0].revenue
                )
            }
        };
    }

    /**
     * Calculate difference and percentage change
     * @param {number} current 
     * @param {number} base 
     * @param {boolean} isPercent 
     * @param {boolean} lowerIsBetter 
     */
    static calcDiff(current, base, isPercent = false, lowerIsBetter = false) {
        if (!Number.isFinite(current) || !Number.isFinite(base)) {
            return { current: '--', base: '--', diff: 0, pct: 0, status: 'neutral' };
        }

        const diff = current - base;

        // Handle division by zero
        let pct = 0;
        if (Math.abs(base) > 0.0001) {
            pct = (diff / Math.abs(base)) * 100;
        } else if (Math.abs(current) > 0.0001) {
            pct = 100; // From 0 to something is 100% increase effectively
        }

        // Determine status (positive/negative/neutral)
        let status = 'neutral';
        if (Math.abs(diff) < 0.001) {
            status = 'neutral';
        } else {
            // For revenue, NPV: higher is better
            // For costs, payback: lower is better
            const isImprovement = lowerIsBetter ? diff < 0 : diff > 0;
            status = isImprovement ? 'positive' : 'negative';
        }

        return {
            current,
            base,
            diff,
            pct,
            status,
            isPercent
        };
    }

    /**
     * Get all available studies for selection
     */
    static async getAvailableStudiesForComparison(currentId) {
        const projects = await ProjectManager.getAllProjects();
        return (projects || [])
            .filter(p => p.id !== currentId)
            .map(p => ({
                id: p.id,
                name: p.name,
                date: p.lastModified
            }));
    }

    /**
     * Get default SMART Goals templates
     * أهداف نموذجية محسّنة لمشاريع دراسات الجدوى
     */
    static getSmartGoalsTemplates() {
        const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const sixMonthsFromNow = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const threeMonthsFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const nineMonthsFromNow = new Date(Date.now() + 270 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        return [
            {
                specific: 'تحقيق إيرادات سنوية تصل إلى 2 مليون ريال',
                measurable: '2,000,000 ريال سنوياً',
                achievable: 'من خلال تنفيذ خطة التسويق والوصول إلى عدد العملاء المستهدف',
                relevant: 'هذا الهدف أساسي لتحقيق الربحية واستدامة المشروع',
                timeBound: 'خلال السنة الأولى من التشغيل',
                category: 'financial',
                targetValue: 2000000,
                currentValue: 0,
                deadline: oneYearFromNow,
                status: 'pending'
            },
            {
                specific: 'الوصول إلى 1000 عميل نشط شهرياً',
                measurable: '1000 عميل/شهر',
                achievable: 'من خلال الحملات التسويقية المستهدفة وبرامج الولاء',
                relevant: 'زيادة قاعدة العملاء تزيد الإيرادات وتقلل الاعتماد على عملاء محددين',
                timeBound: 'خلال 6 أشهر من بدء التشغيل',
                category: 'market',
                targetValue: 1000,
                currentValue: 0,
                deadline: sixMonthsFromNow,
                status: 'pending'
            },
            {
                specific: 'تحقيق معدل رضا عملاء لا يقل عن 85%',
                measurable: '85% من العملاء راضون (بناءً على استطلاعات الرأي)',
                achievable: 'من خلال تحسين جودة الخدمة والتدريب المستمر للفريق',
                relevant: 'رضا العملاء يضمن الاستمرارية وزيادة الإحالات والتوصيات',
                timeBound: 'خلال 3 أشهر من بدء التشغيل',
                category: 'operational',
                targetValue: 85,
                currentValue: 0,
                deadline: threeMonthsFromNow,
                status: 'pending'
            },
            {
                specific: 'استقطاب وتدريب 15 موظف مؤهل',
                measurable: '15 موظف متدرب ومؤهل',
                achievable: 'من خلال برامج التوظيف والتدريب المستمر',
                relevant: 'الموظفون المؤهلون هم أساس جودة الخدمة والكفاءة التشغيلية',
                timeBound: 'خلال 9 أشهر من بدء التشغيل',
                category: 'hr',
                targetValue: 15,
                currentValue: 0,
                deadline: nineMonthsFromNow,
                status: 'pending'
            },
            {
                specific: 'تحقيق نقطة التعادل (Breakeven) خلال 12 شهر',
                measurable: 'الإيرادات = التكاليف (شهرياً)',
                achievable: 'من خلال إدارة التكاليف بكفاءة وزيادة الإيرادات تدريجياً',
                relevant: 'نقطة التعادل تحدد اللحظة التي يصبح فيها المشروع مستداماً مالياً',
                timeBound: 'خلال 12 شهر من بدء التشغيل',
                category: 'financial',
                targetValue: 12,
                currentValue: 0,
                deadline: oneYearFromNow,
                status: 'pending'
            },
            {
                specific: 'الحصول على جميع التراخيص والتصاريح المطلوبة',
                measurable: '100% من التراخيص المطلوبة',
                achievable: 'من خلال متابعة الإجراءات القانونية وإكمال المتطلبات',
                relevant: 'التراخيص ضرورية لتشغيل المشروع بشكل قانوني وتجنب المخاطر',
                timeBound: 'قبل بدء التشغيل',
                category: 'operational',
                targetValue: 100,
                currentValue: 0,
                deadline: threeMonthsFromNow,
                status: 'pending'
            },
            {
                specific: 'تحقيق هامش ربح إجمالي لا يقل عن 30%',
                measurable: 'هامش ربح إجمالي 30%',
                achievable: 'من خلال إدارة تكاليف البضائع المباعة وتحسين التسعير',
                relevant: 'الهامش الإجمالي الصحي يضمن الربحية على المدى الطويل',
                timeBound: 'خلال 6 أشهر من بدء التشغيل',
                category: 'financial',
                targetValue: 30,
                currentValue: 0,
                deadline: sixMonthsFromNow,
                status: 'pending'
            }
        ];
    }

    /**
     * Suggest staffing based on project size and type
     * @param {number} size Area size in sq meters
     * @param {string} type Activity type
     */
    static recommendStaffing(size, type) {
        const activity = String(type || '').toLowerCase();
        const isCafe = /مقهى|كافيه|قهوة|بن|cafe|coffee/.test(activity);
        if (isCafe) {
            const baristaCount = Math.max(2, Math.ceil(Number(size || 100) / 45));
            return [
                { position: 'مدير/مديرة فرع', nationality: 'saudi', count: 1, salary: 7000, months: 12, isVariable: false },
                { position: 'باريستا رئيسي', nationality: 'saudi', count: 1, salary: 5500, months: 12, isVariable: false },
                { position: 'باريستا', nationality: 'saudi', count: baristaCount, salary: 4500, months: 12, isVariable: false },
                { position: 'كاشير وخدمة عملاء', nationality: 'saudi', count: 1, salary: 4200, months: 12, isVariable: false },
                { position: 'عامل خدمة ونظافة', nationality: 'expat', count: 1, salary: 2800, months: 12, isVariable: true }
            ];
        }

        const staffing = [];
        // Default logic
        staffing.push({ position: 'مدير مشروع', nationality: 'saudi', count: 1, salary: 6000, months: 12, isVariable: false });

        if (size > 100) {
            staffing.push({ position: 'محاسب', nationality: 'saudi', count: 1, salary: 4000, months: 12, isVariable: false });
        }

        const workers = Math.max(2, Math.ceil(size / 50));
        staffing.push({ position: 'موظف/عامل', nationality: 'expat', count: workers, salary: 3000, months: 12, isVariable: true });

        return staffing;
    }
}

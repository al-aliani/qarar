/**
 * محاكاة تجربة المستخدم - اختبار تلقائي لجميع الأزرار
 * يعمل في بيئة Node.js مع jsdom أو في المتصفح
 */

// قائمة بجميع الأزرار المطلوب اختبارها
const BUTTONS_TO_TEST = [
    // DashboardView
    { id: 'btnLogin', component: 'DashboardView', description: 'تسجيل الدخول' },
    { id: 'btnLogout', component: 'DashboardView', description: 'تسجيل الخروج' },
    { id: 'btnNewProject', component: 'DashboardView', description: 'مشروع جديد' },
    { id: 'btnNewProjectEmpty', component: 'DashboardView', description: 'مشروع فارغ' },
    
    // MarketAnalysis
    { selector: '.btn-prev-step', component: 'MarketAnalysis', description: 'السابق' },
    { selector: '.btn-next-step', component: 'MarketAnalysis', description: 'التالي' },
    { selector: '.btn-add-segment', component: 'MarketAnalysis', description: 'إضافة شريحة' },
    { selector: '.btn-add-competitor', component: 'MarketAnalysis', description: 'إضافة منافس' },
    { selector: '.ai-competitors-btn', component: 'MarketAnalysis', description: 'اقتراح AI للمنافسين' },
    { selector: '.ai-segments-btn', component: 'MarketAnalysis', description: 'اقتراح AI للشرائح' },
    
    // SmartGoals
    { selector: '.btn-add-goal', component: 'SmartGoals', description: 'إضافة هدف' },
    { selector: '.btn-suggest-goals', component: 'SmartGoals', description: 'اقتراح أهداف' },
    { selector: '.btn-prev-step', component: 'SmartGoals', description: 'السابق' },
    { selector: '.btn-next-step', component: 'SmartGoals', description: 'التالي' },
    
    // DecisionDashboard
    { id: 'btnExecutiveSummary', component: 'DecisionDashboard', description: 'الملخص التنفيذي' },
    { id: 'btnPitchMode', component: 'DecisionDashboard', description: 'عرض المستثمر' },
    { id: 'btnExportPDF', component: 'DecisionDashboard', description: 'تصدير PDF' },
    { id: 'btnSaveStudy', component: 'DecisionDashboard', description: 'حفظ الدراسة' },
    { id: 'btnExportExcel', component: 'DecisionDashboard', description: 'تصدير Excel' },
    
    // FinancialDashboard
    { selector: '.ai-consultant-btn', component: 'FinancialDashboard', description: 'طلب تقرير AI' },
    { id: 'btnPresentationMode', component: 'FinancialDashboard', description: 'عرض تقديمي' },
    { selector: '[data-chart="revenue"]', component: 'FinancialDashboard', description: 'عرض الإيرادات' },
    { selector: '[data-chart="profit"]', component: 'FinancialDashboard', description: 'عرض الأرباح' },
    
    // Wizard
    { id: 'btnPrevStep', component: 'Wizard', description: 'السابق' },
    { id: 'btnNextStep', component: 'Wizard', description: 'التالي' },
    { id: 'btnExportSection', component: 'Wizard', description: 'تصدير القسم' },
    
    // MonteCarloAnalysis
    { id: 'btnRunSim', component: 'MonteCarloAnalysis', description: 'تشغيل المحاكاة' },
    
    // OperationalSim
    { id: 'btnRunSim', component: 'OperationalSim', description: 'تشغيل محاكاة التشغيل' },
    
    // ExportMenu
    { selector: '.btn-close', component: 'ExportMenu', description: 'إغلاق' },
    { selector: '[data-type="pdf"]', component: 'ExportMenu', description: 'تصدير PDF' },
    { selector: '[data-type="excel"]', component: 'ExportMenu', description: 'تصدير Excel' },
    
    // app.js
    { id: 'btnExportMenu', component: 'app.js', description: 'قائمة التصدير' },
    { id: 'btnSaveStudy', component: 'app.js', description: 'حفظ الدراسة' },
    { id: 'btnLoadStudy', component: 'app.js', description: 'تحميل دراسة' },
];

/**
 * اختبار زر واحد
 */
async function testButton(buttonConfig, container = document) {
    const result = {
        component: buttonConfig.component,
        description: buttonConfig.description,
        found: false,
        clickable: false,
        error: null
    };
    
    try {
        // البحث عن الزر
        let button = null;
        if (buttonConfig.id) {
            button = container.querySelector(`#${buttonConfig.id}`) || 
                     container.getElementById(buttonConfig.id);
        } else if (buttonConfig.selector) {
            button = container.querySelector(buttonConfig.selector);
        }
        
        if (!button) {
            result.error = 'الزر غير موجود في DOM';
            return result;
        }
        
        result.found = true;
        
        // التحقق من أن الزر قابل للنقر
        if (button.disabled || button.style.display === 'none' || 
            button.classList.contains('hidden')) {
            result.error = 'الزر معطل أو مخفي';
            return result;
        }
        
        result.clickable = true;
        
        // محاولة النقر (بدون تنفيذ فعلي)
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        
        // التحقق من وجود event listener
        const hasListener = button.onclick !== null || 
                           button.getAttribute('data-listener') === 'true';
        
        if (!hasListener) {
            // محاولة النقر لاختبار ما إذا كان هناك listener
            try {
                button.dispatchEvent(clickEvent);
                result.clicked = true;
            } catch (e) {
                result.error = `خطأ عند النقر: ${e.message}`;
            }
        } else {
            result.clicked = true;
        }
        
    } catch (error) {
        result.error = error.message;
    }
    
    return result;
}

/**
 * اختبار جميع الأزرار
 */
async function testAllButtons() {
    const results = [];
    const summary = {
        total: BUTTONS_TO_TEST.length,
        found: 0,
        clickable: 0,
        errors: 0
    };
    
    console.log('🚀 بدء اختبار الأزرار...\n');
    
    for (const buttonConfig of BUTTONS_TO_TEST) {
        const result = await testButton(buttonConfig);
        results.push(result);
        
        if (result.found) summary.found++;
        if (result.clickable) summary.clickable++;
        if (result.error) summary.errors++;
        
        // طباعة النتيجة
        const status = result.found && result.clickable ? '✅' : 
                      result.found ? '⚠️' : '❌';
        console.log(`${status} ${result.component}: ${result.description}`);
        if (result.error) {
            console.log(`   ⚠️ ${result.error}`);
        }
    }
    
    console.log('\n📊 ملخص النتائج:');
    console.log(`   إجمالي الأزرار: ${summary.total}`);
    console.log(`   ✅ موجودة: ${summary.found}`);
    console.log(`   ✅ قابلة للنقر: ${summary.clickable}`);
    console.log(`   ❌ أخطاء: ${summary.errors}`);
    
    return { results, summary };
}

/**
 * اختبار تفاعلي في المتصفح
 */
function runBrowserTest() {
    if (typeof window === 'undefined') {
        console.error('يجب تشغيل هذا السكريبت في المتصفح');
        return;
    }
    
    // انتظار تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => testAllButtons(), 1000);
        });
    } else {
        setTimeout(() => testAllButtons(), 1000);
    }
}

// تصدير للاستخدام في Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testButton, testAllButtons, BUTTONS_TO_TEST };
}

// تشغيل تلقائي في المتصفح
if (typeof window !== 'undefined') {
    runBrowserTest();
}

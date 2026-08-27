import { store } from '../core/store.js';
import { calculateStudy } from '../core/engine.js';

export function initHeaderIndicators() {
    const syncIndicator = document.getElementById('cloudSyncIndicator');
    const ticker = document.getElementById('liveFinancialTicker');

    if (syncIndicator) {
        const syncText = syncIndicator.querySelector('.sync-text');
        
        // Listen to store save status
        store.subscribeSaveStatus((status) => {
            if (status.saving) {
                syncText.textContent = 'جاري الحفظ...';
                syncIndicator.style.opacity = '0.7';
                syncIndicator.style.color = 'var(--c-text-muted)';
            } else if (status.success) {
                if (status.location === 'both') {
                    syncText.textContent = 'محفوظ في السحابة';
                    syncIndicator.style.color = 'var(--c-success)';
                } else if (status.cloudSyncFailed) {
                    // دفعة 5 (2026-08-27، طبقة Availability): كان يعرض نفس "محفوظ محلياً"
                    // المحايدة سواء المستخدم غير مسجَّل دخول (طبيعي) أو مسجَّل لكن فشلت
                    // مزامنته السحابية فعلياً بعد كل محاولات إعادة المحاولة — تعتيم كامل
                    // لمستخدم قد يعمل ساعات أثناء انقطاع اتصال بلا أي تحذير حقيقي.
                    syncText.textContent = 'محفوظ محلياً فقط — تعذّرت المزامنة السحابية';
                    syncIndicator.style.color = 'var(--c-warning)';
                } else {
                    syncText.textContent = 'محفوظ محلياً';
                    syncIndicator.style.color = 'var(--c-text-muted)';
                }
                syncIndicator.style.opacity = '1';
            } else {
                syncText.textContent = 'غير محفوظ';
                syncIndicator.style.color = 'var(--c-danger)';
            }
        });
    }

    if (ticker) {
        const tickerText = ticker.querySelector('.ticker-text');
        let throttleTimer;

        // Listen to store data changes to calculate live NPV/IRR
        store.subscribe((state) => {
            if (throttleTimer) clearTimeout(throttleTimer);
            throttleTimer = setTimeout(() => {
                try {
                    // Check if we have basic data to calculate
                    if (!state.projectInfo?.projectName && !state.revenue?.streams?.length) {
                        ticker.style.display = 'none';
                        return;
                    }

                    const results = calculateStudy(state);
                    const npv = results.indicators?.npv || 0;
                    
                    if (npv > 0) {
                        tickerText.textContent = `مُجدي (NPV: ${formatCurrency(npv)})`;
                        tickerText.style.color = 'var(--c-success)';
                        ticker.querySelector('.ic').style.color = 'var(--c-success)';
                    } else if (npv < 0) {
                        tickerText.textContent = `خطر (NPV: ${formatCurrency(npv)})`;
                        tickerText.style.color = 'var(--c-danger)';
                        ticker.querySelector('.ic').style.color = 'var(--c-danger)';
                    } else {
                        tickerText.textContent = 'أدخل البيانات المالية';
                        tickerText.style.color = 'var(--c-text-main)';
                        ticker.querySelector('.ic').style.color = 'var(--c-text-muted)';
                    }
                    ticker.style.display = 'flex';
                } catch (e) {
                    // Ignore calculation errors on incomplete data
                    ticker.style.display = 'none';
                }
            }, 500); // 500ms throttle
        });
    }
}

function formatCurrency(val) {
    if (!val) return '0';
    if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'K';
    return Math.round(val).toString();
}

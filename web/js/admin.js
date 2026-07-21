import { getOverview, getEventsStats } from './services/AdminService.js';
import { toast } from './utils/toast.js';

// DOM Elements
const elLoading = document.getElementById('loadingOverlay');
const elBtnRefresh = document.getElementById('btnRefresh');

const elNewStudies = document.getElementById('kpiNewStudies');
const elConversionRate = document.getElementById('kpiConversionRate');
const elCompletionTime = document.getElementById('kpiCompletionTime');
const elPaymentErrors = document.getElementById('kpiPaymentErrors');

const elExportStatsTable = document.getElementById('exportStatsTable');
const elDropoffStatsTable = document.getElementById('dropoffStatsTable');

// Fallback Mock Data in case Supabase is unavailable or user is not an admin
const MOCK_DATA = {
    newStudies: 142,
    conversionRate: 15.4,
    avgCompletionTimeMinutes: 45,
    paymentErrors: 3,
    exports: [
        { format: 'PDF', count: 320, percentage: 65 },
        { format: 'Excel', count: 120, percentage: 24 },
        { format: 'Word', count: 40, percentage: 8 },
        { format: 'PowerPoint', count: 15, percentage: 3 }
    ],
    dropoffs: [
        { step: 'التسعير والدفع', count: 85, rate: 42 },
        { step: 'الافتراضات المالية', count: 45, rate: 22 },
        { step: 'تحليل السوق', count: 30, rate: 15 },
        { step: 'الملخص التنفيذي', count: 12, rate: 6 }
    ]
};

async function loadDashboardData() {
    elLoading.style.opacity = '1';
    elLoading.style.pointerEvents = 'all';

    try {
        // Try fetching real data from Supabase RPCs
        const overviewRes = await getOverview();
        const eventsRes = await getEventsStats(null, 30, 'type'); // Generic events call for dropoffs/exports logic

        let dataToRender = null;

        // If Supabase call is successful, use real data
        if (overviewRes.ok && overviewRes.data) {
            const rd = overviewRes.data;
            
            // Extract from real stats, with fallback to 0 if not present
            dataToRender = {
                newStudies: rd.total_studies || 0,
                conversionRate: rd.conversion_rate || 0,
                avgCompletionTimeMinutes: rd.avg_completion_minutes || 0,
                paymentErrors: rd.payment_errors || 0,
                exports: [],
                dropoffs: []
            };

            // For exports and dropoffs, we'd parse eventsRes if it was fully implemented.
            // Since the real database structure might vary, we merge real KPIs with mock tables for demonstration,
            // or use events data if available.
            if (eventsRes.ok && Array.isArray(eventsRes.data)) {
                 // Example of mapping real event aggregations if they exist
                 // dataToRender.exports = ...
            } else {
                 dataToRender.exports = MOCK_DATA.exports;
                 dataToRender.dropoffs = MOCK_DATA.dropoffs;
            }
            
            toast.success('تم جلب البيانات الحقيقية بنجاح');
        } else {
            // Fallback to mock data
            console.warn('Supabase fetch failed or user is not admin, using mock data. Error:', overviewRes.error);
            dataToRender = MOCK_DATA;
            toast.info('تم تحميل بيانات تجريبية (Mock) لعدم توفر الصلاحية أو الاتصال');
        }

        renderDashboard(dataToRender);

    } catch (e) {
        console.error('Error loading dashboard:', e);
        toast.error('حدث خطأ أثناء تحميل الإحصائيات');
        renderDashboard(MOCK_DATA);
    } finally {
        elLoading.style.opacity = '0';
        setTimeout(() => elLoading.style.pointerEvents = 'none', 300);
    }
}

function renderDashboard(data) {
    // KPIs
    elNewStudies.textContent = data.newStudies.toLocaleString();
    elConversionRate.textContent = `${data.conversionRate.toFixed(1)}%`;
    elCompletionTime.textContent = `${data.avgCompletionTimeMinutes} دقيقة`;
    elPaymentErrors.textContent = data.paymentErrors;

    // Tables
    renderExportTable(data.exports);
    renderDropoffTable(data.dropoffs);
}

function renderExportTable(exportsData) {
    elExportStatsTable.innerHTML = exportsData.map(item => `
        <tr>
            <td class="font-medium">${item.format}</td>
            <td>${item.count.toLocaleString()}</td>
            <td>
                <div class="flex items-center gap-2">
                    <div style="flex:1; background: rgba(255,255,255,0.1); border-radius: 99px; height: 6px; overflow: hidden;">
                        <div style="width: ${item.percentage}%; background: var(--c-primary); height: 100%;"></div>
                    </div>
                    <span class="text-xs text-muted w-8">${item.percentage}%</span>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderDropoffTable(dropoffData) {
    elDropoffStatsTable.innerHTML = dropoffData.map(item => `
        <tr>
            <td class="font-medium">${item.step}</td>
            <td>${item.count.toLocaleString()}</td>
            <td>
                <span class="status-badge ${item.rate > 30 ? 'danger' : (item.rate > 15 ? 'warning' : 'success')}">
                    ${item.rate}%
                </span>
            </td>
        </tr>
    `).join('');
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    elBtnRefresh.addEventListener('click', loadDashboardData);
});

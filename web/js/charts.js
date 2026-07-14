// charts.js - Powered by Chart.js
document.addEventListener('DOMContentLoaded', () => {
    // 1. Revenue vs Costs Line Chart (Break-even)
    const ctxRevenue = document.getElementById('revenueChart').getContext('2d');
    new Chart(ctxRevenue, {
        type: 'line',
        data: {
            labels: ['السنة 1', 'السنة 2', 'السنة 3', 'السنة 4', 'السنة 5'],
            datasets: [
                {
                    label: 'الإيرادات المتوقعة',
                    data: [50000, 120000, 200000, 310000, 450000],
                    borderColor: '#10b981', // Green
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'التكاليف التراكمية',
                    data: [150000, 180000, 210000, 240000, 270000],
                    borderColor: '#ef4444', // Red
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: false }
            }
        }
    });

    // 2. Costs Distribution Doughnut Chart
    const ctxCosts = document.getElementById('costsChart').getContext('2d');
    new Chart(ctxCosts, {
        type: 'doughnut',
        data: {
            labels: ['الرواتب', 'التسويق', 'الإيجار', 'المواد الخام'],
            datasets: [{
                data: [40, 20, 15, 25],
                backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']
            }]
        },
        options: {
            responsive: true,
            cutout: '60%'
        }
    });
});

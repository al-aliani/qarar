export class Charts {
    constructor(canvasId) {
        this.ctx = document.getElementById(canvasId)?.getContext('2d');
        this.chart = null;
    }

    render(pnlData) {
        if (!this.ctx) return;

        // Extract 5-Year Revenue vs NetIncome
        const labels = pnlData.map(y => `Year ${y.year}`);
        const revenue = pnlData.map(y => y.revenueTotal);
        const netIncome = pnlData.map(y => y.netIncome);

        if (this.chart) {
            this.chart.data.labels = labels;
            this.chart.data.datasets[0].data = revenue;
            this.chart.data.datasets[1].data = netIncome;
            this.chart.update();
            return;
        }

        this.chart = new Chart(this.ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'الإيرادات',
                        data: revenue,
                        backgroundColor: '#8a5f1c',
                    },
                    {
                        label: 'صافي الربح',
                        data: netIncome,
                        backgroundColor: '#238636',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--c-text-main').trim() || '#1a1a1a' } }
                },
                scales: {
                    y: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--c-text-muted').trim() || '#555' }, grid: { color: 'rgba(0,0,0,0.06)' } },
                    x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--c-text-muted').trim() || '#555' }, grid: { display: false } }
                }
            }
        });
    }
}

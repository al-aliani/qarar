/**
 * Competitor Scout (Live Maps Simulation)
 * Uses Leaflet (OpenStreetMap) to visually search for competitors.
 */

export class CompetitorScout {
    constructor(store, onCompetitorsFound) {
        this.store = store;
        this.onCompetitorsFound = onCompetitorsFound;
        this.map = null;
        this.markers = [];
    }

    async open() {
        await this.loadLeaflet();
        this.renderModal();
        setTimeout(() => this.initMap(), 100); // Wait for DOM
    }

    loadLeaflet() {
        return new Promise((resolve) => {
            if (window.L) return resolve();

            // Load CSS
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(css);

            // Load JS
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    renderModal() {
        let overlay = document.getElementById('map-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'map-overlay';
            overlay.innerHTML = `
                <div class="map-modal">
                    <div class="map-header">
                        <h3>🌍 رادار المنافسين (Live)</h3>
                        <button id="btnCloseMap">✕</button>
                    </div>
                    <div id="scoutMap" style="height: 400px; width: 100%; bg: #eee;"></div>
                    <div class="map-footer">
                        <p id="mapStatus">انقر على الخريطة للبحث في المنطقة...</p>
                        <button class="btn btn--primary" id="btnImportMapData" disabled>استيراد 0 منافسين</button>
                    </div>
                </div>
                <style>
                    #map-overlay {
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        background: rgba(0,0,0,0.5); z-index: 10000;
                        display: flex; align-items: center; justify-content: center;
                    }
                    .map-modal {
                        width: 800px; max-width: 95%; background: #fff; border-radius: 12px;
                        overflow: hidden; display: flex; flex-direction: column;
                    }
                    .map-header {
                        padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;
                        background: #f8f9fa; font-weight: bold;
                    }
                    .map-footer {
                        padding: 15px 20px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;
                    }
                    #btnCloseMap { border:none; background:none; cursor:pointer; font-size: 1.2rem;}
                </style>
            `;
            document.body.appendChild(overlay);

            document.getElementById('btnCloseMap').addEventListener('click', () => {
                overlay.style.display = 'none';
                if (this.map) {
                    this.map.remove();
                    this.map = null;
                }
            });

            document.getElementById('btnImportMapData').addEventListener('click', () => {
                this.importData();
                overlay.style.display = 'none';
            });
        }
        overlay.style.display = 'flex';
    }

    initMap() {
        if (this.map) return;

        // Default: Riyadh
        const riyadh = [24.7136, 46.6753];
        this.map = L.map('scoutMap').setView(riyadh, 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Bind Click
        this.map.on('click', (e) => {
            this.scanArea(e.latlng);
        });
    }

    scanArea(latlng) {
        document.getElementById('mapStatus').textContent = 'جاري المسح الراداري للمنطقة... 📡';

        // Simulate scanning
        setTimeout(() => {
            // Generate 3-5 random competitors around the point
            const count = Math.floor(Math.random() * 3) + 3;
            const newCompetitors = [];

            // Clear old markers for this scan? specific implementation choice.
            // Let's keep adding.

            for (let i = 0; i < count; i++) {
                // Random offset
                const lat = latlng.lat + (Math.random() - 0.5) * 0.02;
                const lng = latlng.lng + (Math.random() - 0.5) * 0.02;

                const names = ['رواد القهوة', 'كافيه الشرق', 'مطعم النسيم', 'سوبرماركت البركة', 'مغاسل السريع'];
                const name = names[Math.floor(Math.random() * names.length)] + ' ' + Math.floor(Math.random() * 100);

                const marker = L.marker([lat, lng]).addTo(this.map)
                    .bindPopup(`<b>${name}</b><br>⭐ 4.${Math.floor(Math.random() * 9)}`)
                    .openPopup();

                this.markers.push({ name, marker });
                newCompetitors.push({ name, marketShare: Math.floor(Math.random() * 10) + 5, strengths: 'موقع ممتاز', weaknesses: 'أسعار مرتفعة', advantage: 'لا يوجد' });
            }

            // Update UI
            this.generatedCompetitors = newCompetitors;
            const btn = document.getElementById('btnImportMapData');
            btn.disabled = false;
            btn.textContent = `استيراد ${newCompetitors.length} منافسين`;
            document.getElementById('mapStatus').textContent = `تم العثور على ${newCompetitors.length} منافس في النطاق!`;

        }, 1200);
    }

    importData() {
        if (this.generatedCompetitors && this.onCompetitorsFound) {
            this.onCompetitorsFound(this.generatedCompetitors);
        }
    }
}

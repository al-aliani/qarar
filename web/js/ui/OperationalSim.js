/**
 * Operational Simulation Component (Queueing Theory)
 * Simulates customer flow to detect bottlenecks and wait times.
 */
// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

export class OperationalSim {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
        this.simInterval = null;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState(); // Fix typo: store.get() -> store.getState()
        // تدقيق 2026-07-08 (ملاحظة عالية #26): operational قسم معرَّف الآن في
        // SECTIONS/createEmptyStudy (schema.js) — الاحتياطي هنا فقط لدراسات محفوظة
        // قبل هذا التسجيل.
        const operational = state.operational || { arrivalRate: 30, serviceTime: 5, servers: 2 };
        // تدقيق دفعة 3 (2026-07-12): peakFactor حقل اختياري جديد — لم يُضَف لتعريف
        // createEmptyStudy الافتراضي عمداً (كي لا يكسر operationalSection.schema.test.js
        // الذي يثبّت شكل القسم الافتراضي بدقة)؛ الاحتياطي هنا فقط لدراسات بلا القيمة.
        const peakFactor = Number(operational.peakFactor) || 1.5;

        this.container.innerHTML = `
            <div class="operational-sim animate-entry">
                <h2 class="section-title">محاكاة التشغيل</h2>
                <p class="text-muted mb-6">اختبر قدرة مشروعك على تحمل ضغط العملاء واكتشف "طوابير الانتظار" قبل الافتتاح.</p>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Controls -->
                    <div class="card">
                        <h3 class="card-title mb-4">${icon('i-settings')} إعدادات المحاكاة</h3>
                        
                        <div class="form-group mb-4">
                            <label>معدل وصول العملاء (عميل/ساعة)</label>
                            <input type="range" class="input-range" id="arrivalRate" min="5" max="200" value="${operational.arrivalRate}">
                            <div class="flex-between text-sm text-gold"><span id="arrivalVal">${operational.arrivalRate}</span> عميل/ساعة</div>
                        </div>

                        <div class="form-group mb-4">
                            <label>مدة الخدمة للعميل الواحد (دقيقة)</label>
                            <input type="range" class="input-range" id="serviceTime" min="1" max="30" value="${operational.serviceTime}">
                            <div class="flex-between text-sm text-gold"><span id="serviceVal">${operational.serviceTime}</span> دقيقة</div>
                        </div>

                        <div class="form-group mb-4">
                            <label>عدد نقاط الخدمة/الموظفين</label>
                            <input type="range" class="input-range" id="servers" min="1" max="20" value="${operational.servers}">
                            <div class="flex-between text-sm text-gold"><span id="serversVal">${operational.servers}</span> موظف</div>
                        </div>

                        <div class="form-group mb-6">
                            <label>معامل ذروة الطلب (مقابل المتوسط)</label>
                            <input type="range" class="input-range" id="peakFactor" min="1" max="3" step="0.1" value="${peakFactor}">
                            <div class="flex-between text-sm text-gold"><span id="peakFactorVal">${peakFactor.toFixed(1)}</span>×</div>
                            <p class="text-xs text-muted mt-1">مثال: 1.5× يعني ساعة الذروة تستقبل ضعف ونصف عدد عملاء الساعة العادية — النتائج أدناه تعرض المتوسط والذروة معاً.</p>
                        </div>

                        <button class="btn btn--primary w-full" id="btnRunSim">${icon('i-play')} تشغيل المحاكاة</button>
                    </div>

                    <!-- Visualizer -->
                    <div class="card lg:col-span-2 flex flex-col items-center justify-center bg-dark" style="min-height:300px; position:relative; overflow:hidden;">
                        <canvas id="simCanvas" width="600" height="300" style="max-width:100%; height:auto;"></canvas>
                        <div id="simOverlay" class="text-center">
                            <h2 class="text-white text-2xl mb-2">اضغط تشغيل</h2>
                            <p class="text-gray-400">لتبدأ محاكاة حركة العملاء</p>
                        </div>
                    </div>
                </div>

                <!-- Results: المتوسط -->
                <p class="text-sm text-muted mt-6 mb-2" id="simResultsAvgLabel">في ساعة عادية (متوسط الطلب):</p>
                <div class="results-grid grid grid-cols-1 md:grid-cols-3 gap-4" id="simResults" style="opacity:0.5; pointer-events:none;">
                    <div class="kpi-card">
                        <div class="kpi-label">معدل وقت الانتظار</div>
                        <div class="kpi-value" id="resWaitTime">-- دقيقة</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">طول الطابور المتوقع</div>
                        <div class="kpi-value" id="resQueueLen">-- عميل</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">ضغط الموظفين (نسبة الانشغال)</div>
                        <div class="kpi-value" id="resUtil">--%</div>
                    </div>
                </div>

                <!-- Results: الذروة -->
                <p class="text-sm text-muted mt-4 mb-2" id="simResultsPeakLabel">في ساعة الذروة (<span id="peakFactorLabelVal">${peakFactor.toFixed(1)}</span>× المتوسط):</p>
                <div class="results-grid grid grid-cols-1 md:grid-cols-3 gap-4" id="simResultsPeak" style="opacity:0.5; pointer-events:none;">
                    <div class="kpi-card">
                        <div class="kpi-label">وقت الانتظار وقت الذروة</div>
                        <div class="kpi-value" id="resPeakWaitTime">-- دقيقة</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">طول الطابور وقت الذروة</div>
                        <div class="kpi-value" id="resPeakQueueLen">-- عميل</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">ضغط الموظفين وقت الذروة</div>
                        <div class="kpi-value" id="resPeakUtil">--%</div>
                    </div>
                </div>

                <div class="alert mt-4 hidden" id="simAlert"></div>

                <p class="text-xs text-muted mt-2" id="simAdvisoryNote">
                    <strong>ملاحظة:</strong> هذه محاكاة استرشادية (نظرية الطوابير) لأوقات الانتظار والازدحام
                    فقط، لاستكشاف الأثر التقريبي لعدد نقاط الخدمة — <strong>لا تُحدّث تلقائياً</strong> خطة
                    التوظيف الفعلية أو الرواتب في قسم «الموارد البشرية» بالدراسة. إن قررت تغيير عدد
                    الموظفين بناءً على النتيجة هنا، حدِّثه يدوياً هناك.
                </p>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const arrivalInput = this.container.querySelector('#arrivalRate');
        const serviceInput = this.container.querySelector('#serviceTime');
        const serversInput = this.container.querySelector('#servers');
        const peakFactorInput = this.container.querySelector('#peakFactor');

        [arrivalInput, serviceInput, serversInput].forEach(inp => {
            inp.addEventListener('input', (e) => {
                e.target.nextElementSibling.querySelector('span').textContent = e.target.value;
                // Live update if you want, but btnRun is better for sim
            });
        });

        // تدقيق دفعة 3 (2026-07-12): يحدّث نص التسمية أعلى بطاقات نتائج الذروة أيضاً
        // (رقمان منفصلان في الصفحة يعرضان نفس القيمة) كي لا يتناقضا أثناء السحب.
        peakFactorInput?.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value).toFixed(1);
            const valEl = this.container.querySelector('#peakFactorVal');
            const labelEl = this.container.querySelector('#peakFactorLabelVal');
            if (valEl) valEl.textContent = v;
            if (labelEl) labelEl.textContent = v;
        });

        this.container.querySelector('#btnRunSim').addEventListener('click', () => {
            const params = {
                arrivalRate: parseInt(arrivalInput.value),
                serviceTime: parseInt(serviceInput.value),
                servers: parseInt(serversInput.value),
                peakFactor: peakFactorInput ? parseFloat(peakFactorInput.value) : 1.5
            };
            this.runSimulation(params);
        });

        // Navigation
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });
    }

    /**
     * إحصاءات الطابور (Erlang-C) لمعدل وصول معيّن — مستخرجة من runSimulation كي
     * تُستدعى مرتين دون تكرار الصيغة (متوسط الطلب + ذروته)، تدقيق دفعة 3 (2026-07-12).
     * @returns {{ rho:number, waitTime:number|'infinite', queueLen:number|'infinite' }}
     */
    computeQueueStats(arrivalRate, serviceTime, servers) {
        const m = servers;
        const lambda = arrivalRate / 60; // per minute
        const mu = 1 / serviceTime;      // per minute (capacity per server)
        const rho = lambda / (m * mu);   // Utilization

        if (rho >= 1) {
            return { rho, waitTime: 'infinite', queueLen: 'infinite' };
        }

        // Erlang-C Probability of Waiting P(W) — C(m, lambda/mu)
        const trafficIntensity = lambda / mu; // u (or A)
        let sum = 0;
        for (let k = 0; k < m; k++) {
            sum += (Math.pow(trafficIntensity, k) / this.factorial(k));
        }
        const numerator = (Math.pow(trafficIntensity, m) / this.factorial(m)) * (m / (m - trafficIntensity));
        const probabilityWait = numerator / (sum + numerator);

        const waitTime = (probabilityWait * serviceTime) / (m * (1 - rho)); // E(W)
        const queueLen = waitTime * lambda; // Little's Law: Lq = lambda * Wq
        return { rho, waitTime, queueLen };
    }

    runSimulation(params) {
        const avg = this.computeQueueStats(params.arrivalRate, params.serviceTime, params.servers);

        // تدقيق دفعة 3 (2026-07-12، اختبار عميل بقالة): معدل الوصول وحده لا يعكس ضغط
        // ساعة الذروة (رمضان/نهاية الأسبوع...) — نحسب ونعرض سيناريو الذروة (معدل×معامل
        // الذروة) جنباً إلى جنب مع المتوسط، دون أن يغيّر ذلك منطق تنبيه/اقتراح التوظيف
        // أدناه (يبقى مبنياً على المتوسط كسابقاً — الذروة معلومة إضافية استرشادية فقط).
        const peakFactor = Number(params.peakFactor) > 0 ? Number(params.peakFactor) : 1.5;
        const peak = this.computeQueueStats(params.arrivalRate * peakFactor, params.serviceTime, params.servers);

        // Display visuals... (keep as is)
        const canvas = document.getElementById('simCanvas');
        const overlay = document.getElementById('simOverlay');
        overlay.style.display = 'none';

        if (this.simInterval) clearInterval(this.simInterval);
        this.animateDots(canvas, params);

        document.getElementById('simResults').style.opacity = '1';
        document.getElementById('simResultsPeak').style.opacity = '1';
        this.showResults(avg.waitTime, avg.queueLen, avg.rho);
        this.showPeakResults(peak.waitTime, peak.queueLen, peak.rho);

        // بند 1.1 (دفعة 1): نحسب عدد نقاط الخدمة الأمثل دوماً (لا فقط عند تجاوز 5 دقائق)
        // كي يُخزَّن في lastResult ويقرأه جدول الرواتب كاقتراح اختياري — لا علاقة له
        // بزر «جرّب هذا الرقم هنا» المحلي أدناه (يبقى محلياً بالكامل لهذه الشاشة).
        const optimal = this.findOptimalStaffing(params.arrivalRate, params.serviceTime, 5);
        let avgWaitTimeResult = null;

        // Calculation
        if (avg.rho >= 1) {
            this.showAlert('danger', '<strong>نظام غير مستقر:</strong> نسبة الانشغال وصلت إلى 100% أو أكثر؛ يجب زيادة عدد الموظفين فوراً.');
        } else {
            // computeQueueStats (دفعة 3) يحسب avg.waitTime بالفعل أعلى الدالة؛ showResults
            // استُدعيت مسبقاً أعلاه غير مشروطة — لا داعي لتكرار حساب Erlang-C يدوياً هنا.
            const avgWaitTime = avg.waitTime;
            avgWaitTimeResult = avgWaitTime;

            if (avgWaitTime > 5) {
                this.showAlert('warning', `وقت الانتظار مرتفع (${Math.round(avgWaitTime)} د). للحفاظ على أقل من 5 دقائق، نقترح تعيين <strong>${optimal}</strong> موظفين في نقاط الخدمة هنا (محاكاة استرشادية — لا تُطبَّق تلقائياً على خطة التوظيف الفعلية). <button class="btn-xs btn--text underline" id="btnApplyOptim">جرّب هذا الرقم هنا</button>`);

                // Bind apply button
                setTimeout(() => {
                    document.getElementById('btnApplyOptim')?.addEventListener('click', () => {
                        document.getElementById('servers').value = optimal;
                        document.getElementById('servers').dispatchEvent(new Event('input'));
                        document.getElementById('btnRunSim').click();
                    });
                }, 100);
            } else {
                this.showAlert('success', '<strong>نظام ممتاز:</strong> أوقات الانتظار ضمن الحدود المقبولة.');
            }
        }

        // Save to store — نضيف lastResult (اقتراح نقاط الخدمة الأمثل) بجانب معاملات
        // المحاكاة نفسها. هذا لا يزال محلياً بالكامل لقسم operational ولا يكتب لأي
        // مكان آخر في الدراسة (hr.positions تبقى بمنأى — راجع batch6.operationalSimDisclosure).
        // جدول الرواتب (OrgStructure/Wizard) يقرأ lastResult ويعرضه كاقتراح بزر صريح فقط.
        this.store.update('operational', {
            ...params,
            lastResult: {
                recommendedServers: optimal,
                utilization: avg.rho,
                avgWaitTime: avgWaitTimeResult
            }
        });
    }

    showResults(wait, queue, rho) {
        const utilPercent = (rho * 100).toFixed(1) + '%';

        document.getElementById('resWaitTime').textContent = wait === 'infinite' ? '∞' : (wait.toFixed(1) + ' دقيقة');
        document.getElementById('resQueueLen').textContent = queue === 'infinite' ? '∞' : (queue.toFixed(1) + ' عميل');

        const utilEl = document.getElementById('resUtil');
        utilEl.textContent = utilPercent;
        utilEl.className = `kpi-value ${rho > 0.85 ? 'text-danger' : 'text-success'}`;
    }

    /** بطاقات نتائج ساعة الذروة — نفس منطق showResults على عناصر resPeak* المنفصلة (دفعة 3، 2026-07-12). */
    showPeakResults(wait, queue, rho) {
        const utilPercent = (rho * 100).toFixed(1) + '%';

        document.getElementById('resPeakWaitTime').textContent = wait === 'infinite' ? '∞' : (wait.toFixed(1) + ' دقيقة');
        document.getElementById('resPeakQueueLen').textContent = queue === 'infinite' ? '∞' : (queue.toFixed(1) + ' عميل');

        const utilEl = document.getElementById('resPeakUtil');
        utilEl.textContent = utilPercent;
        utilEl.className = `kpi-value ${rho >= 1 || rho > 0.85 ? 'text-danger' : 'text-success'}`;
    }

    /**
     * Find min servers to keep wait time < targetWaitTime
     */
    findOptimalStaffing(arrivalRate, serviceTime, targetWaitTime = 5) {
        let servers = 1;
        while (servers < 50) {
            const lambda = arrivalRate / 60;
            const mu = 1 / serviceTime;
            const rho = lambda / (servers * mu);

            if (rho < 1) {
                // Calc Wait Time (Simplified Erlang-C logic reused)
                const trafficIntensity = lambda / mu;
                let sum = 0;
                for (let k = 0; k < servers; k++) {
                    sum += (Math.pow(trafficIntensity, k) / this.factorial(k));
                }
                const num = (Math.pow(trafficIntensity, servers) / this.factorial(servers)) * (servers / (servers - trafficIntensity));
                const probWait = num / (sum + num);
                const wait = (probWait * serviceTime) / (servers * (1 - rho));

                if (wait <= targetWaitTime) return servers;
            }
            servers++;
        }
        return servers;
    }


    animateDots(canvas, params) {
        const ctx = canvas.getContext('2d');
        const customers = [];
        const servers = [];

        // Init servers
        for (let i = 0; i < params.servers; i++) {
            servers.push({ x: 500, y: 50 + (i * (200 / params.servers)), busy: 0 });
        }

        let frame = 0;
        this.simInterval = setInterval(() => {
            frame++;
            ctx.clearRect(0, 0, 600, 300);

            // Spawn customers (Poisson-ish)
            if (Math.random() < (params.arrivalRate / 60 / 60 * 5)) { // scaled for 60fps approx
                customers.push({ x: 0, y: 150, state: 'queue' });
            }

            // Draw Servers
            ctx.fillStyle = '#333';
            servers.forEach((s, i) => {
                ctx.fillRect(s.x, s.y, 40, 40);
                // Busy indicator
                if (s.busy > 0) {
                    ctx.fillStyle = 'red';
                    ctx.beginPath(); ctx.arc(s.x + 20, s.y + 20, 10, 0, Math.PI * 2); ctx.fill();
                    s.busy--;
                } else {
                    ctx.fillStyle = '#0f0';
                    ctx.beginPath(); ctx.arc(s.x + 20, s.y + 20, 5, 0, Math.PI * 2); ctx.fill();
                }
            });

            // Move Customers
            customers.forEach((c, i) => {
                if (c.state === 'queue') {
                    // Move to queue line
                    if (c.x < 450 - (i * 10)) c.x += 2;

                    // Assign to server if free
                    const freeServer = servers.find(s => s.busy <= 0);
                    if (freeServer && c.x > 400) {
                        c.state = 'serving';
                        c.targetY = freeServer.y + 10;
                        freeServer.busy = params.serviceTime * 10; // Simulation steps
                    }
                } else if (c.state === 'serving') {
                    c.x += 2;
                    c.y += (c.targetY - c.y) * 0.1;
                    if (c.x > 500) c.state = 'done';
                }
            });

            // Draw Customers
            ctx.fillStyle = '#3b82f6';
            customers.filter(c => c.state !== 'done').forEach(c => {
                ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI * 2); ctx.fill();
            });

        }, 20);
    }

    factorial(n) {
        if (n === 0) return 1;
        return n * this.factorial(n - 1);
    }

    showAlert(type, msg) {
        const alert = document.getElementById('simAlert');
        alert.className = `alert alert--${type} mt-4 animate-entry`;
        alert.innerHTML = msg;
        alert.classList.remove('hidden');
    }
}

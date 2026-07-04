## Web bundle (ready to copy)

هذا الملف يجمع كود الواجهة الثلاثة ملفات:
- `web/index.html`
- `web/styles.css`
- `web/app.js`

---

### `web/index.html`

```html
<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>قالب دراسة جدوى تفاعلي — Decision First</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <header class="topbar">
      <div class="brand">
        <div class="brand__title">قالب دراسة جدوى تفاعلي</div>
        <div class="brand__subtitle">Decision‑First · سيناريوهات · حساسية · QA Gate</div>
      </div>
      <div class="topbar__actions">
        <button id="btnRunQA" class="btn btn--primary">تشغيل التدقيق</button>
        <button id="btnExport" class="btn">تصدير JSON</button>
        <button id="btnExportAudit" class="btn">تصدير Audit Pack</button>
        <label class="btn btn--ghost filebtn">
          استيراد JSON
          <input id="fileImport" type="file" accept="application/json" />
        </label>
        <button id="btnReset" class="btn btn--danger">إعادة ضبط</button>
      </div>
    </header>

    <main class="layout">
      <aside class="sidebar">
        <nav class="nav">
          <button class="nav__item is-active" data-tab="sheet-break-even">تحليل التعادل </button>
          <button class="nav__item" data-tab="sheet-income">قائمة الدخل التقديرية</button>
          <button class="nav__item" data-tab="sheet-kpis-pool">مؤشرات التقييم المسبح</button>
          <button class="nav__item" data-tab="sheet-kpis-padel">مؤشرات التقييم البادل</button>
          <button class="nav__item" data-tab="sheet-kpis-field">مؤشرات التقييم الملعب</button>
          <button class="nav__item" data-tab="sheet-kpis-gym">مؤشرات التقييم الصالة الرياضية</button>
          <button class="nav__item" data-tab="sheet-payback">فترة الاسترداد</button>
          <button class="nav__item" data-tab="sheet-kpis-project">مؤشرات تقييم المشروع </button>
          <button class="nav__item" data-tab="sheet-pricing-1">اسعار الخدمات </button>
          <button class="nav__item" data-tab="sheet-financial">الدراسة المالية</button>
          <button class="nav__item" data-tab="sheet-technical">الدراسة الفنية </button>
          <button class="nav__item" data-tab="sheet-revenue-est">تقدير الإيرادات </button>
          <button class="nav__item" data-tab="sheet-pricing-2">اسعار الخدمات</button>
          <button class="nav__item" data-tab="sheet-legal">الدراسة القانونية </button>
          <button class="nav__item" data-tab="sheet-hr">دراسة الموارد البشرية </button>
          <button class="nav__item" data-tab="sheet-it">دراسة الموارد التقنية </button>
          <button class="nav__item" data-tab="sheet-logistics">دراسة الموارد اللوجستية  </button>
          <button class="nav__item" data-tab="sheet-admin">دراسة الموارد الإدارية  </button>
          <button class="nav__item" data-tab="sheet-marketing">الدراسة التسويقية   </button>
        </nav>

        <section class="sidebar__summary">
          <div class="kpi">
            <div class="kpi__label">الحكم</div>
            <div id="kpiDecision" class="kpi__value">—</div>
          </div>
          <div class="kpi">
            <div class="kpi__label">NPV (Base)</div>
            <div id="kpiNPV" class="kpi__value">—</div>
          </div>
          <div class="kpi">
            <div class="kpi__label">IRR (Base)</div>
            <div id="kpiIRR" class="kpi__value">—</div>
          </div>
          <div class="kpi">
            <div class="kpi__label">Payback</div>
            <div id="kpiPayback" class="kpi__value">—</div>
          </div>
          <div class="kpi">
            <div class="kpi__label">PI (Base)</div>
            <div id="kpiPI" class="kpi__value">—</div>
          </div>
          <div class="kpi">
            <div class="kpi__label">استثمار/إيراد (Y1)</div>
            <div id="kpiRatio" class="kpi__value">—</div>
          </div>
          <div class="hint">
            افتح المشروع عبر: <code>http://localhost:5173/web/</code>
          </div>
        </section>
      </aside>

      <section class="content">
        <!-- Sheet: تحليل التعادل -->
        <section class="tab is-active" id="tab-sheet-break-even">
          <h2>تحليل التعادل </h2>
          <div class="grid">
            <div class="card">
              <h3>التعادل (محسوب من النموذج)</h3>
              <p class="muted">يعتمد على التكاليف الثابتة (Opex) ونسبة التكاليف المتغيرة من الإيرادات.</p>
              <div id="kpisPanel" class="kpis"></div>
            </div>

            <div class="card">
              <h3>قائمة الدخل (Preview)</h3>
              <div id="incomeTable" class="table"></div>
            </div>
          </div>
        </section>

        <!-- Sheet: قائمة الدخل التقديرية -->
        <section class="tab" id="tab-sheet-income">
          <h2>قائمة الدخل التقديرية</h2>
          <div class="card">
            <p class="muted">هذه الصفحة تُبنى تلقائياً من (تقدير الإيرادات) + (التكاليف الثابتة والمتغيرة) + (Capex والإهلاك).</p>
            <div class="grid">
              <div class="card">
                <h3>قائمة الدخل</h3>
                <div id="incomeTable_dup" class="table"></div>
              </div>
              <div class="card">
                <h3>التدفقات النقدية</h3>
                <div id="cashflowTable" class="table"></div>
              </div>
            </div>
          </div>
        </section>

        <!-- Sheet: مؤشرات التقييم (المسبح/البادل/الملعب/الصالة) -->
        <section class="tab" id="tab-sheet-kpis-pool"><h2>مؤشرات التقييم المسبح</h2><div class="card"><div id="decisionPanel" class="decision"></div></div></section>
        <section class="tab" id="tab-sheet-kpis-padel"><h2>مؤشرات التقييم البادل</h2><div class="card"><div id="scenarioTable" class="table"></div></div></section>
        <section class="tab" id="tab-sheet-kpis-field"><h2>مؤشرات التقييم الملعب</h2><div class="card"><div id="sensitivityTable" class="table"></div></div></section>
        <section class="tab" id="tab-sheet-kpis-gym"><h2>مؤشرات التقييم الصالة الرياضية</h2><div class="card"><div id="risksTable" class="table"></div></div></section>

        <!-- Sheet: فترة الاسترداد -->
        <section class="tab" id="tab-sheet-payback"><h2>فترة الاسترداد</h2><div class="card"><div id="cashflowTable_dup" class="table"></div></div></section>

        <!-- Sheet: مؤشرات تقييم المشروع -->
        <section class="tab" id="tab-sheet-kpis-project">
          <h2>مؤشرات تقييم المشروع </h2>
          <div class="grid">
            <div class="card">
              <h3>قرار + QA</h3>
              <div id="qaVerdict" class="verdict">—</div>
              <div id="qaList" class="qa"></div>
            </div>
            <div class="card">
              <h3>Audit / Traceability</h3>
              <div id="auditSummary" class="auditSummary">—</div>
              <div id="auditQASnapshot" class="qa"></div>
            </div>
          </div>
          <div class="card" style="margin-top:12px">
            <h3 style="margin-top:0">مضاعفات السيناريو (Base / Best / Worst)</h3>
            <div class="form">
              <div class="row row--gap">
                <div class="pill">Best</div>
                <label class="field field--inline"><span>حجم الإيراد</span><input id="scBestRev" type="number" step="0.01" /></label>
                <label class="field field--inline"><span>Opex</span><input id="scBestOpex" type="number" step="0.01" /></label>
                <label class="field field--inline"><span>Capex</span><input id="scBestCapex" type="number" step="0.01" /></label>
              </div>
              <div class="row row--gap" style="margin-top:10px">
                <div class="pill">Worst</div>
                <label class="field field--inline"><span>حجم الإيراد</span><input id="scWorstRev" type="number" step="0.01" /></label>
                <label class="field field--inline"><span>Opex</span><input id="scWorstOpex" type="number" step="0.01" /></label>
                <label class="field field--inline"><span>Capex</span><input id="scWorstCapex" type="number" step="0.01" /></label>
              </div>
            </div>
          </div>
          <div class="card" style="margin-top:12px">
            <div class="row row--between">
              <h3 style="margin:0">Traceability Table (المدخلات + المصادر)</h3>
              <div class="row">
                <button id="btnCopyAuditJson" class="btn btn--ghost">نسخ Audit JSON</button>
                <button id="btnPrintAudit" class="btn btn--ghost">طباعة / حفظ PDF</button>
              </div>
            </div>
            <div id="auditTable" class="table"></div>
          </div>
        </section>

        <!-- Sheet: اسعار الخدمات (نسخة 1/2) -->
        <section class="tab" id="tab-sheet-pricing-1">
          <h2>اسعار الخدمات </h2>
          <div class="card">
            <div class="row row--between">
              <p class="muted">كتالوج الخدمات (اسم + فئة + سعر + تكلفة متغيرة/وحدة). يمكنك إرسال الخدمة إلى “تقدير الإيرادات”.</p>
              <button id="btnAddService" class="btn btn--primary">إضافة خدمة</button>
            </div>
            <div id="servicesTable1" class="table"></div>
          </div>
        </section>
        <section class="tab" id="tab-sheet-pricing-2">
          <h2>اسعار الخدمات</h2>
          <div class="card">
            <p class="muted">نفس كتالوج الخدمات (عرض مكرر مثل ملف Excel).</p>
            <div id="servicesTable2" class="table"></div>
          </div>
        </section>

        <!-- Sheet: الدراسة المالية -->
        <section class="tab" id="tab-sheet-financial">
          <h2>الدراسة المالية</h2>
          <div class="grid">
            <div class="card">
              <h3>الافتراضات (Inputs)</h3>
              <div class="form">
                <label class="field">
                  <span>نوع المشروع (للمقارنة بمعايير الاستثمار/الإيراد)</span>
                  <select id="assProjectType">
                    <option value="saas">منصة رقمية / SaaS</option>
                    <option value="ecommerce">تجارة إلكترونية</option>
                    <option value="cafe">مطعم / مقهى</option>
                    <option value="sports_club">نادي رياضي / ترفيهي</option>
                    <option value="factory">مصنع / إنتاج</option>
                    <option value="other">أخرى</option>
                  </select>
                </label>
                <label class="field"><span>عدد سنوات النموذج</span><input id="assYears" type="number" min="1" max="20" step="1" /></label>
                <label class="field"><span>معدل الخصم</span><input id="assDiscount" type="number" min="0" max="1" step="0.001" /></label>
                <label class="field"><span>معدل الضريبة</span><input id="assTax" type="number" min="0" max="1" step="0.001" /></label>
                <label class="field"><span>التضخم</span><input id="assInflation" type="number" min="0" max="1" step="0.001" /></label>
                <label class="field"><span>نسبة التكاليف المتغيرة</span><input id="assVarCostRatio" type="number" min="0" max="1" step="0.01" /></label>
              </div>
            </div>
            <div class="card">
              <h3>حدود القرار</h3>
              <div class="form">
                <label class="field"><span>حد NPV الأدنى (≥)</span><input id="thMinNPV" type="number" step="1" /></label>
                <label class="field"><span>حد IRR الأدنى (≥)</span><input id="thMinIRR" type="number" min="0" max="2" step="0.001" /></label>
                <label class="field"><span>حد Payback الأقصى (≤)</span><input id="thMaxPayback" type="number" min="0" step="0.1" /></label>
                <label class="field"><span>IRR Premium</span><input id="thIrrPremium" type="number" min="0" max="1" step="0.001" /></label>
              </div>
            </div>
          </div>
        </section>

        <!-- Sheet: الدراسة الفنية + الموارد + القانونية + التسويقية -->
        <section class="tab" id="tab-sheet-technical"><h2>الدراسة الفنية </h2><div class="card"><button id="btnAddCapex" class="btn btn--primary">إضافة بند Capex</button><div id="capexTable" class="table"></div></div></section>
        <section class="tab" id="tab-sheet-revenue-est">
          <h2>تقدير الإيرادات </h2>
          <div class="card">
            <div class="row row--between">
              <p class="muted">مصادر الإيرادات يمكن أن تُضاف يدوياً أو تأتي تلقائياً من “اسعار الخدمات”.</p>
              <button id="btnAddRevenue" class="btn btn--primary">إضافة مصدر إيراد</button>
            </div>
            <div id="revenueTable" class="table"></div>
          </div>
        </section>
        <section class="tab" id="tab-sheet-legal"><h2>الدراسة القانونية </h2><div class="card"><p class="muted">محتوى وصفي/تتبعي (سيُضاف كـ Notes لاحقاً).</p><pre id="standardsText" class="pre">جارٍ التحميل…</pre></div></section>
        <section class="tab" id="tab-sheet-hr"><h2>دراسة الموارد البشرية </h2><div class="card"><button id="btnAddOpex" class="btn btn--primary">إضافة بند تكلفة</button><div id="opexTable" class="table"></div></div></section>
        <section class="tab" id="tab-sheet-it"><h2>دراسة الموارد التقنية </h2><div class="card"><p class="muted">يمكن ربطها بـ Capex/Opex حسب البنود.</p></div></section>
        <section class="tab" id="tab-sheet-logistics"><h2>دراسة الموارد اللوجستية  </h2><div class="card"><p class="muted">يمكن ربطها بـ Opex حسب البنود.</p></div></section>
        <section class="tab" id="tab-sheet-admin"><h2>دراسة الموارد الإدارية  </h2><div class="card"><p class="muted">يمكن ربطها بـ Opex حسب البنود.</p></div></section>
        <section class="tab" id="tab-sheet-marketing"><h2>الدراسة التسويقية   </h2><div class="card"><button id="btnAddRisk" class="btn btn--primary">إضافة خطر</button><div id="risksTable_dup2" class="table"></div></div></section>
      </section>
    </main>

    <footer class="footer">
      <div>
        مبني ليحل محل Excel مع نفس فلسفة: الدقة قبل الشمولية · القرار قبل التوثيق · الواقعية قبل التفاؤل
      </div>
      <div>
        المصدر: <code>templates/standards_from_docx.txt</code>
      </div>
    </footer>

    <script type="module" src="./app.js"></script>
  </body>
</html>
```

---

### `web/styles.css`

```css
:root{
  --bg:#0b1220;
  --panel:#0f1a30;
  --card:#111f3a;
  --muted:#a9b6d3;
  --text:#e9eefc;
  --border:rgba(255,255,255,.08);
  --primary:#4f8cff;
  --danger:#ff5a6a;
  --ok:#39d98a;
  --warn:#ffcc66;
  --shadow: 0 10px 30px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family: system-ui, "Segoe UI", Tahoma, Arial, sans-serif;
  background: radial-gradient(1200px 800px at 80% -200px, rgba(79,140,255,.25), transparent 60%),
              radial-gradient(900px 600px at 10% -150px, rgba(57,217,138,.18), transparent 55%),
              var(--bg);
  color:var(--text);
}
code{background:rgba(255,255,255,.06); padding:2px 6px; border-radius:8px}
h2{margin:0 0 14px 0; font-size:20px}
h3{margin:0 0 12px 0; font-size:16px}
p{margin:0 0 10px 0}
.muted{color:var(--muted)}
.topbar{
  position:sticky; top:0; z-index:10;
  display:flex; justify-content:space-between; align-items:center;
  padding:14px 16px;
  border-bottom:1px solid var(--border);
  background: rgba(15,26,48,.65);
  backdrop-filter: blur(10px);
}
.brand__title{font-weight:800; letter-spacing:.2px}
.brand__subtitle{font-size:12px; color:var(--muted); margin-top:2px}
.topbar__actions{display:flex; gap:8px; flex-wrap:wrap}
.btn{
  border:1px solid var(--border);
  background:rgba(255,255,255,.05);
  color:var(--text);
  padding:8px 10px;
  border-radius:10px;
  cursor:pointer;
  transition: transform .05s ease, background .15s ease, border-color .15s ease;
  font-weight:600;
}
.btn:hover{background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.14)}
.btn:active{transform: translateY(1px)}
.btn--primary{background:rgba(79,140,255,.18); border-color:rgba(79,140,255,.35)}
.btn--danger{background:rgba(255,90,106,.16); border-color:rgba(255,90,106,.35)}
.btn--ghost{background:transparent}
.filebtn{position:relative; overflow:hidden}
.filebtn input{position:absolute; inset:0; opacity:0; cursor:pointer}
.layout{
  display:grid;
  grid-template-columns: 320px 1fr;
  gap:14px;
  padding:14px;
  max-width: 1400px;
  margin:0 auto;
}
.sidebar{
  position:sticky; top:74px;
  align-self:start;
  border:1px solid var(--border);
  background:rgba(17,31,58,.55);
  backdrop-filter: blur(8px);
  border-radius:16px;
  box-shadow: var(--shadow);
  overflow:hidden;
}
.nav{display:flex; flex-direction:column; padding:10px}
.nav__item{
  text-align:right;
  padding:10px 10px;
  border-radius:12px;
  border:1px solid transparent;
  background:transparent;
  color:var(--text);
  cursor:pointer;
  font-weight:700;
}
.nav__item:hover{background:rgba(255,255,255,.05)}
.nav__item.is-active{
  background:rgba(79,140,255,.16);
  border-color:rgba(79,140,255,.25);
}
.sidebar__summary{
  border-top:1px solid var(--border);
  padding:12px;
  display:grid;
  gap:10px;
}
.kpi{
  display:flex; justify-content:space-between; align-items:center;
  padding:10px;
  border:1px solid var(--border);
  border-radius:12px;
  background:rgba(255,255,255,.04);
}
.kpi__label{color:var(--muted); font-size:12px; font-weight:700}
.kpi__value{font-weight:900}
.hint{font-size:12px; color:var(--muted)}
.content{
  border:1px solid var(--border);
  background:rgba(17,31,58,.35);
  border-radius:16px;
  box-shadow: var(--shadow);
  padding:14px;
}
.tab{display:none}
.tab.is-active{display:block}
.grid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:12px;
}
@media (max-width: 980px){
  .layout{grid-template-columns: 1fr}
  .sidebar{position:static}
  .grid{grid-template-columns: 1fr}
}
.card{
  border:1px solid var(--border);
  background:rgba(15,26,48,.55);
  border-radius:16px;
  padding:12px;
}
.form{display:grid; gap:10px}
.field{display:grid; gap:6px}
.field span{font-weight:800}
.field small{color:var(--muted)}
.field input, .field select, .field textarea{
  padding:10px 10px;
  border-radius:12px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.04);
  color:var(--text);
  outline:none;
}
.field textarea{min-height:90px; resize:vertical}
.field--inline{min-width: 0}
.row{display:flex; align-items:center; gap:10px; flex-wrap:wrap}
.row--between{justify-content:space-between}
.row--gap{gap:12px}
.pill{
  display:inline-flex; align-items:center; gap:8px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.04);
  padding:6px 10px;
  border-radius:999px;
  font-weight:800;
}
.table{
  overflow:auto;
  border:1px solid var(--border);
  border-radius:14px;
}
table{border-collapse:collapse; width:100%; min-width:720px}
th,td{
  border-bottom:1px solid var(--border);
  padding:10px;
  text-align:right;
  vertical-align:top;
}
th{
  position:sticky; top:0;
  background:rgba(11,18,32,.8);
  backdrop-filter: blur(10px);
  z-index:1;
  font-size:12px;
  color:var(--muted);
}
tr:hover td{background:rgba(255,255,255,.03)}
.mini{
  min-width:auto !important;
  padding:8px 8px;
  border-radius:10px;
}
.btnIcon{
  padding:6px 10px;
  border-radius:10px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.05);
  cursor:pointer;
  color:var(--text);
  font-weight:900;
}
.btnIcon:hover{background:rgba(255,255,255,.08)}
.note{
  margin-top:10px;
  padding:10px;
  border-radius:12px;
  border:1px dashed rgba(255,255,255,.14);
  color:var(--muted);
}
.kpis{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:10px;
}
.kpiCard{
  border:1px solid var(--border);
  background:rgba(255,255,255,.04);
  border-radius:12px;
  padding:10px;
}
.kpiCard__label{color:var(--muted); font-size:12px; font-weight:800}
.kpiCard__value{font-weight:950; font-size:18px; margin-top:4px}
.decision{
  padding:14px;
  border-radius:14px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.04);
}
.decision .big{font-size:28px; font-weight:950}
.decision .sub{color:var(--muted); margin-top:6px}
.pre{
  white-space: pre-wrap;
  background:rgba(255,255,255,.04);
  border:1px solid var(--border);
  border-radius:14px;
  padding:12px;
  min-height:240px;
  max-height:520px;
  overflow:auto;
}
.verdict{
  font-weight:950;
  font-size:26px;
  padding:10px 12px;
  border-radius:14px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.04);
}
.qa{display:grid; gap:8px}
.auditSummary{
  border:1px solid var(--border);
  border-radius:14px;
  padding:12px;
  background:rgba(255,255,255,.04);
  display:grid;
  gap:8px;
}
.qaItem{
  border:1px solid var(--border);
  border-radius:12px;
  padding:10px;
  background:rgba(255,255,255,.04);
}
.badge{
  display:inline-flex;
  align-items:center;
  padding:4px 8px;
  border-radius:999px;
  font-weight:900;
  font-size:12px;
  border:1px solid var(--border);
}
.badge--ok{background:rgba(57,217,138,.14); border-color:rgba(57,217,138,.35)}
.badge--warn{background:rgba(255,204,102,.14); border-color:rgba(255,204,102,.35)}
.badge--err{background:rgba(255,90,106,.14); border-color:rgba(255,90,106,.35)}
.footer{
  max-width:1400px;
  margin: 0 auto;
  padding: 10px 14px 18px;
  color: var(--muted);
  display:flex;
  justify-content:space-between;
  gap:10px;
  flex-wrap:wrap;
}
```

---

### `web/app.js`

> ملاحظة: هذا الملف طويل، فتم إدراجه كما هو. إذا احتجت نسخة “مقسّمة” (جزء-جزء) للنسخ داخل محادثة، قلّي.

```javascript
// Feasibility Interactive Template (Decision-First)

const STORAGE_KEY = "feasibility_model_v1";

const fmtSAR = new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });
const fmtPct = new Intl.NumberFormat("ar-SA", { style: "percent", maximumFractionDigits: 1 });
const fmtNum = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 });

async function sha256Hex(text) {
  try {
    const enc = new TextEncoder();
    const bytes = enc.encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const arr = Array.from(new Uint8Array(digest));
    return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function toNum(v) {
  if (v === "" || v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  // Allow comma separators
  const s = String(v).replace(/,/g, "").trim();
  return Number(s);
}

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function defaultModel() {
  return {
    assumptions: {
      projectType: "saas",
      years: 5,
      discount: 0.12,
      tax: 0.15,
      inflation: 0.02,
      varCostRatio: 0.35,
    },
    thresholds: {
      minNPV: 0,
      minIRR: 0.18,
      maxPayback: 4,
      irrPremium: 0.06, // discount + premium
    },
    scenarios: {
      best: { rev: 1.2, opex: 0.95, capex: 0.95 },
      worst: { rev: 0.8, opex: 1.1, capex: 1.1 },
    },
    revenue: [
      { name: "المنصة", customersPerMonth: 300, price: 75, growth: 0.07, source: "" },
      { name: "الاستديو", customersPerMonth: 105, price: 195, growth: 0.07, source: "" },
      { name: "أخرى", customersPerMonth: 90, price: 177, growth: 0.07, source: "" },
    ],
    services: [
      { id: "svc_pool_monthly", category: "المسبح", name: "اشتراك مسبح (شهري)", unitPrice: 0, unitVarCost: 0, source: "" },
      { id: "svc_padel_session", category: "بادل", name: "حجز بادل (ساعة)", unitPrice: 0, unitVarCost: 0, source: "" },
      { id: "svc_field_session", category: "الملعب", name: "حجز ملعب (ساعة)", unitPrice: 0, unitVarCost: 0, source: "" },
      { id: "svc_gym_monthly", category: "الصالة الرياضية", name: "اشتراك صالة (شهري)", unitPrice: 0, unitVarCost: 0, source: "" },
    ],
    opex: [
      { name: "رواتب", annualYear1: 330000, inflation: null, source: "" },
      { name: "تسويق", annualYear1: 250000, inflation: null, source: "" },
      { name: "تشغيل/خدمات", annualYear1: 120000, inflation: null, source: "" },
    ],
    capex: [
      { name: "تجهيزات/أصول", cost: 450000, year: 0, lifeYears: 5, source: "" },
    ],
    risks: [
      { name: "عدم وضوح نموذج العمل", probability: 0.4, impact: 500000, kill: true, owner: "المالك", mitigation: "تحديد نموذج واحد + Pilot" },
    ],
  };
}

function mergeModel(parsed) {
  const d = defaultModel();
  return {
    ...d,
    ...(parsed || {}),
    assumptions: { ...d.assumptions, ...((parsed && parsed.assumptions) || {}) },
    thresholds: { ...d.thresholds, ...((parsed && parsed.thresholds) || {}) },
    scenarios: {
      ...d.scenarios,
      ...((parsed && parsed.scenarios) || {}),
      best: { ...d.scenarios.best, ...((parsed && parsed.scenarios && parsed.scenarios.best) || {}) },
      worst: { ...d.scenarios.worst, ...((parsed && parsed.scenarios && parsed.scenarios.worst) || {}) },
    },
    revenue: parsed && Array.isArray(parsed.revenue) ? parsed.revenue : d.revenue,
    services: parsed && Array.isArray(parsed.services) ? parsed.services : d.services,
    opex: parsed && Array.isArray(parsed.opex) ? parsed.opex : d.opex,
    capex: parsed && Array.isArray(parsed.capex) ? parsed.capex : d.capex,
    risks: parsed && Array.isArray(parsed.risks) ? parsed.risks : d.risks,
  };
}

let model = loadModel();

function loadModel() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultModel();
    const parsed = JSON.parse(raw);
    return mergeModel(parsed);
  } catch {
    return defaultModel();
  }
}

function saveModel() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
}

// ---------- Finance math ----------

function npv(rate, cashflows) {
  // cashflows[0] is at t=0
  let out = 0;
  for (let t = 0; t < cashflows.length; t++) {
    out += cashflows[t] / Math.pow(1 + rate, t);
  }
  return out;
}

function irr(cashflows) {
  // Newton-Raphson with safeguards
  let r = 0.2;
  for (let i = 0; i < 50; i++) {
    let f = 0;
    let df = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const ct = cashflows[t];
      const den = Math.pow(1 + r, t);
      f += ct / den;
      if (t > 0) {
        df += (-t * ct) / (den * (1 + r));
      }
    }
    if (!Number.isFinite(f) || !Number.isFinite(df) || df === 0) break;
    const rNext = r - f / df;
    if (Math.abs(rNext - r) < 1e-7) return rNext;
    // Keep reasonable bounds
    r = clamp(rNext, -0.95, 10);
  }

  // Fallback: bisection if sign change exists
  let lo = -0.9;
  let hi = 2.0;
  let fLo = npv(lo, cashflows);
  let fHi = npv(hi, cashflows);
  if (Number.isFinite(fLo) && Number.isFinite(fHi) && fLo * fHi < 0) {
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const fMid = npv(mid, cashflows);
      if (Math.abs(fMid) < 1e-6) return mid;
      if (fLo * fMid < 0) {
        hi = mid;
        fHi = fMid;
      } else {
        lo = mid;
        fLo = fMid;
      }
    }
    return (lo + hi) / 2;
  }

  return NaN;
}

function paybackYears(cashflows) {
  // uses undiscounted cashflows
  let cum = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const prev = cum;
    cum += cashflows[t];
    if (t === 0) continue;
    if (prev < 0 && cum >= 0) {
      const frac = (0 - prev) / (cum - prev);
      return (t - 1) + frac;
    }
  }
  return Infinity;
}

function discountedPaybackYears(rate, cashflows) {
  if (!Number.isFinite(rate)) return Infinity;
  let cum = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const prev = cum;
    const disc = cashflows[t] / Math.pow(1 + rate, t);
    cum += disc;
    if (t === 0) continue;
    if (prev < 0 && cum >= 0) {
      const frac = (0 - prev) / (cum - prev);
      return (t - 1) + frac;
    }
  }
  return Infinity;
}

function profitabilityIndex(rate, cashflows) {
  if (!Number.isFinite(rate)) return NaN;
  let pvIn = 0;
  let pvOut = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const pv = cashflows[t] / Math.pow(1 + rate, t);
    if (pv >= 0) pvIn += pv;
    else pvOut += -pv;
  }
  return pvOut > 0 ? pvIn / pvOut : NaN;
}

function depreciationSchedule(capexItems, years) {
  // Straight-line depreciation; assumes year index 0..years-1 correspond to years 1..years
  const dep = Array(years).fill(0);
  for (const it of capexItems) {
    const cost = toNum(it.cost);
    const life = Math.max(1, Math.floor(toNum(it.lifeYears)));
    const yr = Math.floor(toNum(it.year)); // 0-based purchase year (0 = start)
    if (!Number.isFinite(cost) || !Number.isFinite(life) || !Number.isFinite(yr)) continue;
    const annual = cost / life;
    // Depreciate starting year after purchase year, inclusive. If year=0 -> year1..life
    for (let i = 0; i < years; i++) {
      const yearNumber = i + 1; // 1..years
      const purchaseYearNumber = yr + 1;
      if (yearNumber >= purchaseYearNumber && yearNumber < purchaseYearNumber + life) {
        dep[i] += annual;
      }
    }
  }
  return dep;
}

function capexCashSchedule(capexItems, years) {
  // cash outflows: year 0 (t=0) and year 1..years
  const out = Array(years + 1).fill(0);
  for (const it of capexItems) {
    const cost = toNum(it.cost);
    const yr = Math.floor(toNum(it.year));
    if (!Number.isFinite(cost) || !Number.isFinite(yr)) continue;
    const t = clamp(yr, 0, years); // yr=0 -> t=0, yr=1 -> t=1
    out[t] += cost;
  }
  return out;
}

function computeScenario(baseModel, multipliers) {
  const years = Math.max(1, Math.floor(toNum(baseModel.assumptions.years)));
  const discount = toNum(baseModel.assumptions.discount);
  const tax = toNum(baseModel.assumptions.tax);
  const inflation = toNum(baseModel.assumptions.inflation);
  const varCostRatioRaw = toNum(baseModel.assumptions.varCostRatio);
  const varCostRatio = Number.isFinite(varCostRatioRaw) ? clamp(varCostRatioRaw, 0, 0.95) : 0.35;

  // Revenue & variable costs per year
  const revenue = Array(years).fill(0);
  const varCosts = Array(years).fill(0);
  const servicesById = new Map((baseModel.services || []).map((x) => [x.id, x]));

  for (const s of baseModel.revenue) {
    const cpm = toNum(s.customersPerMonth);
    const price = toNum(s.price);
    const growth = toNum(s.growth);
    if (![cpm, price, growth].every(Number.isFinite)) continue;

    const svc = s.serviceId ? servicesById.get(s.serviceId) : null;
    const unitVarCost = svc ? toNum(svc.unitVarCost) : NaN; // per unit (same unit as customersPerMonth)

    for (let i = 0; i < years; i++) {
      const qty = cpm * 12 * Math.pow(1 + growth, i);
      const rev = qty * price;
      revenue[i] += rev;

      // If service has explicit unit variable cost, use it; otherwise fall back to global varCostRatio.
      const vc = Number.isFinite(unitVarCost) ? qty * unitVarCost : rev * varCostRatio;
      varCosts[i] += vc;
    }
  }
  for (let i = 0; i < years; i++) {
    revenue[i] *= multipliers.rev;
    varCosts[i] *= multipliers.rev;
  }

  // Opex per year
  const opex = Array(years).fill(0);
  for (const it of baseModel.opex) {
    const a1 = toNum(it.annualYear1);
    const infl = it.inflation === null || it.inflation === undefined ? inflation : toNum(it.inflation);
    if (!Number.isFinite(a1) || !Number.isFinite(infl)) continue;
    for (let i = 0; i < years; i++) {
      opex[i] += a1 * Math.pow(1 + infl, i);
    }
  }
  for (let i = 0; i < years; i++) opex[i] *= multipliers.opex;

  // Total operating costs = fixed opex + variable costs
  const totalOpex = opex.map((f, i) => f + varCosts[i]);

  // Depreciation
  const dep = depreciationSchedule(
    baseModel.capex.map((x) => ({ ...x, cost: toNum(x.cost) * multipliers.capex })),
    years
  );

  // EBIT, Tax, Net income
  const ebitda = revenue.map((r, i) => r - totalOpex[i]);
  const ebit = ebitda.map((x, i) => x - dep[i]);
  const taxExpense = ebit.map((x) => (x > 0 ? x * tax : 0));
  const netIncome = ebit.map((x, i) => x - taxExpense[i]);

  // Capex cash schedule (t=0..years)
  const capexOut = capexCashSchedule(
    baseModel.capex.map((x) => ({ ...x, cost: toNum(x.cost) * multipliers.capex })),
    years
  );

  // Cashflows: t=0..years (year1..years)
  const cashflows = Array(years + 1).fill(0);
  cashflows[0] = -capexOut[0];
  for (let i = 0; i < years; i++) {
    cashflows[i + 1] = netIncome[i] + dep[i] - capexOut[i + 1];
  }

  const baseNPV = Number.isFinite(discount) ? npv(discount, cashflows) : NaN;
  const baseIRR = irr(cashflows);
  const pb = paybackYears(cashflows);
  const dpb = discountedPaybackYears(discount, cashflows);
  const totalCapex = capexOut.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  const pi = totalCapex > 0 ? (baseNPV + totalCapex) / totalCapex : NaN;
  const investmentRevenueRatio = revenue[0] > 0 ? totalCapex / revenue[0] : Infinity;

  // Breakeven: fixed costs / contribution margin
  const impliedVarRatioY1 = revenue[0] > 0 ? varCosts[0] / revenue[0] : varCostRatio;
  const contributionMarginPct = clamp(1 - impliedVarRatioY1, 0.001, 1);
  const fixedYear1 = opex[0];
  const breakevenRevenue = contributionMarginPct > 0 ? fixedYear1 / contributionMarginPct : Infinity;

  return {
    years,
    revenue,
    varCosts,
    opex,
    totalOpex,
    dep,
    ebitda,
    ebit,
    taxExpense,
    netIncome,
    capexOut,
    cashflows,
    kpis: {
      npv: baseNPV,
      irr: baseIRR,
      payback: pb,
      discountedPayback: dpb,
      pi,
      investmentRevenueRatio,
      totalCapex,
      breakevenRevenue,
    },
  };
}

function computeAll() {
  const base = computeScenario(model, { rev: 1, opex: 1, capex: 1 });
  const best = computeScenario(model, model.scenarios.best);
  const worst = computeScenario(model, model.scenarios.worst);
  return { base, best, worst };
}

function buildTraceRows(calcs) {
  const rows = [];
  // Assumptions
  rows.push({
    section: "الافتراضات",
    item: "نوع المشروع",
    value: String(model.assumptions.projectType || "other"),
    source: "—",
  });
  rows.push({ section: "الافتراضات", item: "Discount Rate", value: String(model.assumptions.discount), source: "—" });
  rows.push({ section: "الافتراضات", item: "Tax Rate", value: String(model.assumptions.tax), source: "—" });
  rows.push({ section: "الافتراضات", item: "Inflation", value: String(model.assumptions.inflation), source: "—" });
  rows.push({ section: "الافتراضات", item: "Var Cost Ratio", value: String(model.assumptions.varCostRatio), source: "—" });

  // Services catalog
  (model.services || []).forEach((s) => {
    rows.push({
      section: "اسعار الخدمات",
      item: `${s.category || "—"} · ${s.name || "—"}`,
      value: `سعر/وحدة=${s.unitPrice} | تكلفة/وحدة=${s.unitVarCost}`,
      source: s.source || "",
    });
  });

  // Revenue
  model.revenue.forEach((r) => {
    rows.push({
      section: "الإيرادات",
      item: r.name,
      value: `عملاء/شهر=${r.customersPerMonth} | سعر=${r.price} | نمو=${r.growth}`,
      source: r.source || "",
    });
  });

  // Opex
  model.opex.forEach((o) => {
    rows.push({
      section: "التكاليف التشغيلية (ثابتة)",
      item: o.name,
      value: `سنة1=${o.annualYear1} | تضخم=${o.inflation ?? "افتراضي"}`,
      source: o.source || "",
    });
  });

  // Capex
  model.capex.forEach((c) => {
    rows.push({
      section: "الاستثمار (Capex)",
      item: c.name,
      value: `تكلفة=${c.cost} | سنة=${c.year} | عمر=${c.lifeYears}`,
      source: c.source || "",
    });
  });

  // KPIs snapshot
  const k = calcs.base.kpis;
  rows.push({ section: "المخرجات", item: "NPV (Base)", value: String(k.npv), source: "محسوب" });
  rows.push({ section: "المخرجات", item: "IRR (Base)", value: String(k.irr), source: "محسوب" });
  rows.push({ section: "المخرجات", item: "PI (Base)", value: String(k.pi), source: "محسوب" });
  rows.push({ section: "المخرجات", item: "Payback (Base)", value: String(k.payback), source: "محسوب" });
  rows.push({
    section: "المخرجات",
    item: "استثمار/إيراد (Y1)",
    value: String(k.investmentRevenueRatio),
    source: "محسوب",
  });

  return rows;
}

async function buildAuditPack(calcs) {
  const qa = runQA(calcs);
  const decision = computeDecision(calcs);
  const now = new Date().toISOString();
  const modelJson = JSON.stringify(model);
  const modelHash = await sha256Hex(modelJson);

  const pack = {
    generatedAt: now,
    modelHashSha256: modelHash,
    verdict: qa.verdict,
    decision: decision.decision,
    decisionReasons: decision.reasons,
    thresholds: deepClone(model.thresholds),
    assumptions: deepClone(model.assumptions),
    scenarios: deepClone(model.scenarios),
    kpis: {
      base: deepClone(calcs.base.kpis),
      best: deepClone(calcs.best.kpis),
      worst: deepClone(calcs.worst.kpis),
    },
    qaItems: qa.items,
    traceability: buildTraceRows(calcs),
    model: deepClone(model),
  };
  return pack;
}

function renderAuditTab(calcs) {
  const qa = runQA(calcs);
  const decision = computeDecision(calcs);
  const k = calcs.base.kpis;

  const summary = `
    <div class="row row--between">
      <div><strong>Decision:</strong> ${escapeHtml(String(decision.decision))}</div>
      <div><strong>QA:</strong> ${escapeHtml(String(qa.verdict))}</div>
    </div>
    <div class="muted">NPV: ${escapeHtml(money(k.npv))} · IRR: ${escapeHtml(percent(k.irr))} · PI: ${
      Number.isFinite(k.pi) ? escapeHtml(num(k.pi)) : "—"
    } · Ratio: ${Number.isFinite(k.investmentRevenueRatio) ? escapeHtml(`${num(k.investmentRevenueRatio)}:1`) : "—"}</div>
  `;
  el("auditSummary").innerHTML = summary;

  el("auditQASnapshot").innerHTML = qa.items.length
    ? qa.items.map(renderQaItem).join("")
    : `<div class="qaItem"><span class="badge badge--ok">OK</span> لا توجد ملاحظات. </div>`;

  const trace = buildTraceRows(calcs);
  renderTable(
    el("auditTable"),
    ["القسم", "البند", "القيمة/التكوين", "المصدر/الدليل"],
    trace.map((r) => [escapeHtml(r.section), escapeHtml(r.item), escapeHtml(r.value), escapeHtml(r.source || "")])
  );
}

// ---------- UI helpers ----------

function el(id) {
  return document.getElementById(id);
}

function money(v) {
  return Number.isFinite(v) ? fmtSAR.format(v) : "—";
}
function percent(v) {
  return Number.isFinite(v) ? fmtPct.format(v) : "—";
}
function num(v) {
  return Number.isFinite(v) ? fmtNum.format(v) : "—";
}

function renderTable(container, headers, rows) {
  const html = `
    <table>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows
          .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>
  `;
  container.innerHTML = html;
}

function renderEditableTable(container, spec) {
  // spec: { columns: [{key,label,type}], rows, onChangeRow, onAdd, onRemove }
  const { columns, rows } = spec;
  const headers = [...columns.map((c) => c.label), "إجراء"];
  const bodyRows = rows.map((row, idx) => {
    const cells = columns.map((c) => {
      const v = row[c.key] ?? "";
      const t = c.type || "text";
      const step = c.step ?? (t === "number" ? "any" : undefined);
      const min = c.min ?? undefined;
      const max = c.max ?? undefined;
      return `
        <input
          class="mini"
          data-idx="${idx}"
          data-key="${c.key}"
          type="${t}"
          value="${String(v).replace(/"/g, "&quot;")}"
          ${step !== undefined ? `step="${step}"` : ""}
          ${min !== undefined ? `min="${min}"` : ""}
          ${max !== undefined ? `max="${max}"` : ""}
        />
      `;
    });
    cells.push(`<button class="btnIcon" data-remove="${idx}" title="حذف">✕</button>`);
    return cells;
  });
  renderTable(container, headers, bodyRows);

  container.querySelectorAll("input[data-idx]").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = Number(e.target.getAttribute("data-idx"));
      const key = e.target.getAttribute("data-key");
      const col = columns.find((x) => x.key === key);
      const val = col?.type === "number" ? toNum(e.target.value) : e.target.value;
      spec.onChangeRow(idx, key, val);
    });
  });
  container.querySelectorAll("button[data-remove]").forEach((b) => {
    b.addEventListener("click", () => spec.onRemove(Number(b.getAttribute("data-remove"))));
  });
}

function renderServicesTable(container) {
  if (!container) return;

  const rows = (model.services || []).map((s, idx) => {
    const safe = (v) => String(v ?? "").replace(/"/g, "&quot;");
    return [
      `<input class="mini" data-svc-idx="${idx}" data-svc-key="category" type="text" value="${safe(s.category)}" />`,
      `<input class="mini" data-svc-idx="${idx}" data-svc-key="name" type="text" value="${safe(s.name)}" />`,
      `<input class="mini" data-svc-idx="${idx}" data-svc-key="unitPrice" type="number" step="1" min="0" value="${safe(s.unitPrice)}" />`,
      `<input class="mini" data-svc-idx="${idx}" data-svc-key="unitVarCost" type="number" step="1" min="0" value="${safe(s.unitVarCost)}" />`,
      `<input class="mini" data-svc-idx="${idx}" data-svc-key="source" type="text" value="${safe(s.source)}" />`,
      `
        <div class="row row--gap" style="justify-content:center">
          <button class="btnIcon" data-svc-addrev="${idx}" title="إضافة إلى تقدير الإيرادات">＋</button>
          <button class="btnIcon" data-svc-remove="${idx}" title="حذف">✕</button>
        </div>
      `,
    ];
  });

  renderTable(container, ["الفئة", "الخدمة", "السعر/وحدة", "تكلفة متغيرة/وحدة", "المصدر", "إجراء"], rows);

  container.querySelectorAll("input[data-svc-idx]").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = Number(e.target.getAttribute("data-svc-idx"));
      const key = e.target.getAttribute("data-svc-key");
      if (!model.services?.[idx]) return;
      const isNum = key === "unitPrice" || key === "unitVarCost";
      model.services[idx][key] = isNum ? toNum(e.target.value) : e.target.value;
      render();
    });
  });

  container.querySelectorAll("button[data-svc-remove]").forEach((b) => {
    b.addEventListener("click", () => {
      const idx = Number(b.getAttribute("data-svc-remove"));
      if (!model.services?.[idx]) return;
      model.services.splice(idx, 1);
      render();
    });
  });

  container.querySelectorAll("button[data-svc-addrev]").forEach((b) => {
    b.addEventListener("click", () => {
      const idx = Number(b.getAttribute("data-svc-addrev"));
      const svc = model.services?.[idx];
      if (!svc) return;
      addServiceToRevenue(svc);
    });
  });
}

function addServiceToRevenue(svc) {
  const name = String(svc.name || "خدمة");
  const unitPrice = toNum(svc.unitPrice);
  const source = String(svc.source || "اسعار الخدمات");

  model.revenue.push({
    name,
    customersPerMonth: 0,
    price: Number.isFinite(unitPrice) ? unitPrice : 0,
    growth: 0.0,
    source,
    serviceId: svc.id,
  });

  render();

  // Switch to revenue estimation tab for convenience
  const btn = document.querySelector('.nav__item[data-tab="sheet-revenue-est"]');
  if (btn) btn.click();
}

// ---------- QA Gate ----------

function runQA(calcs) {
  const items = [];
  const push = (level, title, detail) => items.push({ level, title, detail });

  const years = toNum(model.assumptions.years);
  const discount = toNum(model.assumptions.discount);
  const tax = toNum(model.assumptions.tax);
  const varCostRatio = toNum(model.assumptions.varCostRatio);
  const projectType = String(model.assumptions.projectType || "other");
  const servicesById = new Map((model.services || []).map((x) => [x.id, x]));

  // Structure-ish
  if (!Number.isFinite(years) || years < 1 || years > 20) push("ERROR", "عدد سنوات النموذج غير صالح", "اجعله بين 1 و 20.");
  if (!Number.isFinite(discount) || discount <= 0 || discount >= 1) push("ERROR", "معدل الخصم غير صالح", "يجب أن يكون بين 0 و 1.");
  if (!Number.isFinite(tax) || tax < 0 || tax >= 1) push("ERROR", "معدل الضريبة غير صالح", "يجب أن يكون بين 0 و 1.");
  if (!Number.isFinite(varCostRatio) || varCostRatio < 0 || varCostRatio >= 1) push("WARN", "نسبة التكاليف المتغيرة غير محددة", "سيتم استخدام 35% افتراضياً.");

  // Revenue inputs numeric
  if (!model.revenue.length) push("ERROR", "لا يوجد مصادر إيراد", "أضف على الأقل مصدر واحد.");
  model.revenue.forEach((r, i) => {
    const ok =
      Number.isFinite(toNum(r.customersPerMonth)) &&
      Number.isFinite(toNum(r.price)) &&
      Number.isFinite(toNum(r.growth));
    if (!ok) push("ERROR", `إيراد #${i + 1}: مدخلات غير رقمية`, "تأكد أن العملاء/السعر/النمو أرقام وليست نصوص.");
    if (!r.source || String(r.source).trim().length < 5) push("WARN", `إيراد #${i + 1}: لا يوجد مصدر موثق`, "وثّق مصدر هذا الرقم (سوق/منافس/تقرير/عقد).");
    const g = toNum(r.growth);
    if (Number.isFinite(g) && g > 1) push("ERROR", `إيراد #${i + 1}: نمو ${(g * 100).toFixed(0)}% غير واقعي`, "نمو 100%+ سنوياً يحتاج دليل استثنائي.");
    else if (Number.isFinite(g) && g > 0.5) push("WARN", `إيراد #${i + 1}: نمو ${(g * 100).toFixed(0)}% مرتفع`, "نمو أكثر من 50% سنوياً يحتاج تبرير قوي.");
  });

  // Revenue->Services linkage (if used)
  const brokenSvcRefs = model.revenue.filter((r) => r.serviceId && !servicesById.get(r.serviceId));
  if (brokenSvcRefs.length)
    push(
      "WARN",
      "إيرادات مرتبطة بخدمة غير موجودة",
      brokenSvcRefs.map((r) => r.name).join(" · ")
    );
  const missingUnitVar = model.revenue.filter((r) => {
    if (!r.serviceId) return false;
    const svc = servicesById.get(r.serviceId);
    return !svc || !Number.isFinite(toNum(svc.unitVarCost));
  });
  if (missingUnitVar.length)
    push(
      "WARN",
      "بعض الخدمات بلا تكلفة متغيرة/وحدة",
      "سيتم استخدام (نسبة التكاليف المتغيرة من الإيرادات) كبديل لهذه الخدمات. " + missingUnitVar.map((r) => r.name).join(" · ")
    );

  // Opex numeric
  model.opex.forEach((o, i) => {
    const ok = Number.isFinite(toNum(o.annualYear1));
    if (!ok) push("ERROR", `Opex #${i + 1}: قيمة غير رقمية`, "اجعل السنة 1 رقم.");
    if (!o.source || String(o.source).trim().length < 5) push("WARN", `Opex #${i + 1}: لا يوجد مصدر`, "وثّق مصدر هذه التكلفة (Benchmark/عرض سعر/رواتب سوق).");
  });

  // Capex numeric
  model.capex.forEach((c, i) => {
    const ok = Number.isFinite(toNum(c.cost)) && Number.isFinite(toNum(c.lifeYears)) && Number.isFinite(toNum(c.year));
    if (!ok) push("ERROR", `Capex #${i + 1}: مدخلات غير صالحة`, "تأكد: cost/year/lifeYears أرقام.");
    if (!c.source || String(c.source).trim().length < 5) push("WARN", `Capex #${i + 1}: لا يوجد مصدر`, "وثّق مصدر كل أصل (عرض سعر/فاتورة/مورد).");
  });

  // No NaN in outputs
  const base = calcs.base;
  const k = base.kpis;
  if (!Number.isFinite(k.npv)) push("ERROR", "NPV غير قابل للحساب", "تأكد من مدخلات النموذج.");
  if (!Number.isFinite(k.irr)) push("WARN", "IRR غير واضح", "قد يحدث إذا التدفقات لا تغيّر الإشارة أو لا يوجد حل.");

  // Decision readiness
  if (!Number.isFinite(k.payback) || k.payback === Infinity) push("WARN", "Payback غير محقق ضمن الأفق", "قد يعني عدم استرداد الاستثمار.");

  // Standards (from docx)
  if (discount < 0.08) push("WARN", "معدل الخصم أقل من 8%", "إطار المعايير يعتبره خطر أحمر وقد يعطي NPV مضلل.");
  if (discount <= 0.05) push("WARN", "معدل الخصم 5% أو أقل", "هذا متساهل جداً لمعظم المشاريع غير الحكومية.");

  // Investment-to-revenue ratio (docx معيار 4)
  const ratio = calcs.base.kpis?.investmentRevenueRatio ?? Infinity;

  const ratioRules = {
    saas: { warn: 20, fatal: 50, label: "منصة SaaS/رقمية" },
    ecommerce: { warn: 30, fatal: 60, label: "تجارة إلكترونية" },
    cafe: { warn: 50, fatal: 100, label: "مطعم/مقهى" },
    sports_club: { warn: 100, fatal: 150, label: "نادي رياضي/ترفيهي" },
    factory: { warn: 150, fatal: 250, label: "مصنع/إنتاج" },
    other: { warn: 60, fatal: 120, label: "أخرى" },
  };
  const rr = ratioRules[projectType] || ratioRules.other;
  if (!Number.isFinite(ratio) || ratio === Infinity) {
    push("WARN", "نسبة الاستثمار إلى الإيراد غير قابلة للحساب", "تأكد من وجود إيراد سنة 1 وقيم Capex.");
  } else {
    if (ratio > 100) push("ERROR", "نسبة الاستثمار/الإيرادات كارثية!", `النسبة ${num(ratio)}:1 - تعني استثمار ضخم مقابل إيراد سنوي ضعيف (نمط ماك بلاش).`);
    else if (ratio > rr.fatal) push("ERROR", "نسبة الاستثمار/الإيراد عالية جداً", `${rr.label}: النسبة ${num(ratio)}:1 تتجاوز حد ${rr.fatal}:1.`);
    else if (ratio > rr.warn) push("WARN", "نسبة الاستثمار/الإيراد مرتفعة", `${rr.label}: النسبة ${num(ratio)}:1 تتجاوز تحذير ${rr.warn}:1.`);
  }

  // PI gate
  if (Number.isFinite(k.pi) && k.pi < 1) push("WARN", "مؤشر الربحية أقل من 1", `PI = ${num(k.pi)} - المشروع لا يغطي تكلفة رأس المال.`);

  // Kill risks
  const kill = model.risks.some((r) => r.kill);
  if (!model.risks.length) push("WARN", "لا يوجد سجل مخاطر", "أضف مصفوفة مخاطر على الأقل.");
  if (kill) push("WARN", "يوجد Kill Risk مفعل", "هذا يؤثر مباشرة على القرار.");

  const verdict = items.some((x) => x.level === "ERROR") ? "FAIL" : "PASS";
  return { verdict, items };
}

function computeDecision(calcs) {
  const k = calcs.base.kpis;
  const t = model.thresholds;
  const discount = toNum(model.assumptions.discount);
  const kill = model.risks.some((r) => r.kill);
  const minIrr = Math.max(toNum(t.minIRR), discount + toNum(t.irrPremium));

  const reasons = [];

  // Kill Risk
  if (kill) reasons.push("🔴 يوجد Kill Risk مفعل - يجب معالجته أولاً.");

  // NPV
  if (Number.isFinite(k.npv) && k.npv < toNum(t.minNPV))
    reasons.push(`🔴 NPV (${money(k.npv)}) أقل من الحد الأدنى (${money(toNum(t.minNPV))}).`);

  // IRR
  if (Number.isFinite(k.irr) && k.irr < minIrr) reasons.push(`🔴 IRR (${percent(k.irr)}) أقل من المطلوب (${percent(minIrr)}).`);

  // Payback
  if (Number.isFinite(k.payback) && k.payback > toNum(t.maxPayback))
    reasons.push(`🟡 Payback (${num(k.payback)} سنوات) أعلى من الحد (${toNum(t.maxPayback)} سنوات).`);

  // PI
  if (Number.isFinite(k.pi) && k.pi < 1) reasons.push(`🔴 PI (${num(k.pi)}) أقل من 1 - المشروع لا يغطي رأس المال.`);

  // Investment/Revenue ratio
  if (Number.isFinite(k.investmentRevenueRatio) && k.investmentRevenueRatio > 50)
    reasons.push(`🔴 نسبة استثمار/إيراد (${num(k.investmentRevenueRatio)}:1) كارثية!`);
  else if (Number.isFinite(k.investmentRevenueRatio) && k.investmentRevenueRatio > 20)
    reasons.push(`🟡 نسبة استثمار/إيراد (${num(k.investmentRevenueRatio)}:1) مرتفعة.`);

  // NPV not computable
  if (!Number.isFinite(k.npv)) reasons.push("❓ NPV غير قابل للحساب - راجع المدخلات.");

  if (reasons.length === 0) {
    return {
      decision: "GO ✅",
      reasons: ["✅ جميع المؤشرات ضمن الحدود المقبولة.", "✅ لا يوجد Kill Risks.", "✅ النسب المالية منطقية."],
    };
  }

  const hasError = reasons.some((r) => r.includes("🔴"));
  const computable = Number.isFinite(k.npv) && Number.isFinite(k.payback);

  if (hasError) return { decision: "NO-GO ❌", reasons };
  if (!computable) return { decision: "REVISE ⚠️", reasons };
  return { decision: "CONDITIONAL ⚠️", reasons: [...reasons, "المشروع قد يكون مجدياً مع بعض التعديلات."] };
}

// ---------- Rendering ----------

function render() {
  saveModel();

  const calcs = computeAll();

  // Sidebar KPIs
  el("kpiDecision").textContent = computeDecision(calcs).decision;
  el("kpiNPV").textContent = money(calcs.base.kpis.npv);
  el("kpiIRR").textContent = percent(calcs.base.kpis.irr);
  el("kpiPayback").textContent = calcs.base.kpis.payback === Infinity ? "∞" : `${num(calcs.base.kpis.payback)} سنة`;
  const pi = calcs.base.kpis.pi;
  el("kpiPI").textContent = Number.isFinite(pi) ? num(pi) : "—";
  const ratio = calcs.base.kpis.investmentRevenueRatio;
  el("kpiRatio").textContent = Number.isFinite(ratio) ? `${num(ratio)}:1` : "—";

  // Revenue table
  renderEditableTable(el("revenueTable"), {
    columns: [
      { key: "name", label: "مصدر الإيراد", type: "text" },
      { key: "customersPerMonth", label: "عملاء/شهر", type: "number", step: "1", min: 0 },
      { key: "price", label: "سعر (SAR)", type: "number", step: "1", min: 0 },
      { key: "growth", label: "نمو سنوي", type: "number", step: "0.001", min: -0.5, max: 2 },
      { key: "source", label: "المصدر (دليل/رابط/مرجع)", type: "text" },
    ],
    rows: model.revenue,
    onChangeRow(idx, key, val) {
      model.revenue[idx][key] = val;
      render();
    },
    onRemove(idx) {
      model.revenue.splice(idx, 1);
      render();
    },
  });

  // Services catalog (pricing sheets)
  renderServicesTable(el("servicesTable1"));
  renderServicesTable(el("servicesTable2"));

  // Opex table
  renderEditableTable(el("opexTable"), {
    columns: [
      { key: "name", label: "البند", type: "text" },
      { key: "annualYear1", label: "السنة 1 (SAR)", type: "number", step: "1" },
      { key: "inflation", label: "تضخم خاص (اختياري)", type: "number", step: "0.001", min: 0, max: 1 },
      { key: "source", label: "المصدر (دليل/رابط/مرجع)", type: "text" },
    ],
    rows: model.opex.map((o) => ({ ...o, inflation: o.inflation ?? "" })),
    onChangeRow(idx, key, val) {
      if (key === "inflation") model.opex[idx][key] = Number.isFinite(val) ? val : null;
      else model.opex[idx][key] = val;
      render();
    },
    onRemove(idx) {
      model.opex.splice(idx, 1);
      render();
    },
  });

  // Capex table
  renderEditableTable(el("capexTable"), {
    columns: [
      { key: "name", label: "البند", type: "text" },
      { key: "cost", label: "التكلفة (SAR)", type: "number", step: "1", min: 0 },
      { key: "year", label: "سنة الشراء (0=start)", type: "number", step: "1", min: 0 },
      { key: "lifeYears", label: "العمر (سنوات)", type: "number", step: "1", min: 1 },
      { key: "source", label: "المصدر (دليل/رابط/مرجع)", type: "text" },
    ],
    rows: model.capex,
    onChangeRow(idx, key, val) {
      model.capex[idx][key] = val;
      render();
    },
    onRemove(idx) {
      model.capex.splice(idx, 1);
      render();
    },
  });

  // Income statement preview
  const years = calcs.base.years;
  const yrHdr = Array.from({ length: years }, (_, i) => `السنة ${i + 1}`);
  renderTable(
    el("incomeTable"),
    ["", ...yrHdr],
    [
      ["الإيرادات", ...calcs.base.revenue.map((x) => money(x))],
      ["التكاليف المتغيرة", ...calcs.base.varCosts.map((x) => money(x))],
      ["التكاليف الثابتة (Opex)", ...calcs.base.opex.map((x) => money(x))],
      ["إجمالي التكاليف التشغيلية", ...calcs.base.totalOpex.map((x) => money(x))],
      ["EBITDA", ...calcs.base.ebitda.map((x) => money(x))],
      ["الإهلاك", ...calcs.base.dep.map((x) => money(x))],
      ["EBIT", ...calcs.base.ebit.map((x) => money(x))],
      ["الضريبة", ...calcs.base.taxExpense.map((x) => money(x))],
      ["صافي الربح", ...calcs.base.netIncome.map((x) => money(x))],
    ]
  );

  // Cashflow preview
  renderTable(
    el("cashflowTable"),
    ["t", "0", ...yrHdr],
    [
      ["Capex", ...calcs.base.capexOut.map((x) => money(-x))],
      ["Cashflow", ...calcs.base.cashflows.map((x) => money(x))],
    ]
  );

  // KPI panel
  el("kpisPanel").innerHTML = `
    ${kpiCard("NPV", money(calcs.base.kpis.npv))}
    ${kpiCard("IRR", percent(calcs.base.kpis.irr))}
    ${kpiCard("PI (مؤشر الربحية)", Number.isFinite(calcs.base.kpis.pi) ? num(calcs.base.kpis.pi) : "—")}
    ${kpiCard("Payback", calcs.base.kpis.payback === Infinity ? "∞" : `${num(calcs.base.kpis.payback)} سنة`)}
    ${kpiCard("Discounted Payback", calcs.base.kpis.discountedPayback === Infinity ? "∞" : `${num(calcs.base.kpis.discountedPayback)} سنة`)}
    ${kpiCard("نسبة استثمار/إيراد", Number.isFinite(calcs.base.kpis.investmentRevenueRatio) ? `${num(calcs.base.kpis.investmentRevenueRatio)}:1` : "—")}
    ${kpiCard("إجمالي الاستثمار", money(calcs.base.kpis.totalCapex))}
    ${kpiCard("Breakeven Revenue (Year1)", money(calcs.base.kpis.breakevenRevenue))}
  `;

  // Decision panel
  const dec = computeDecision(calcs);
  const qa = runQA(calcs);
  const decisionColor =
    String(dec.decision).startsWith("GO") ? "badge--ok" : String(dec.decision).startsWith("NO-GO") ? "badge--err" : "badge--warn";
  el("decisionPanel").innerHTML = `
    <div class="row row--between">
      <div class="big">${dec.decision}</div>
      <span class="badge ${decisionColor}">${qa.verdict}</span>
    </div>
    <div class="sub">الأسباب:</div>
    <ul>
      ${dec.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
    </ul>
  `;

  // Scenarios multipliers inputs
  el("scBestRev").value = model.scenarios.best.rev;
  el("scBestOpex").value = model.scenarios.best.opex;
  el("scBestCapex").value = model.scenarios.best.capex;
  el("scWorstRev").value = model.scenarios.worst.rev;
  el("scWorstOpex").value = model.scenarios.worst.opex;
  el("scWorstCapex").value = model.scenarios.worst.capex;

  // Scenario results table
  renderTable(
    el("scenarioTable"),
    ["السيناريو", "NPV", "IRR", "Payback"],
    [
      ["Base", money(calcs.base.kpis.npv), percent(calcs.base.kpis.irr), pbText(calcs.base.kpis.payback)],
      ["Best", money(calcs.best.kpis.npv), percent(calcs.best.kpis.irr), pbText(calcs.best.kpis.payback)],
      ["Worst", money(calcs.worst.kpis.npv), percent(calcs.worst.kpis.irr), pbText(calcs.worst.kpis.payback)],
    ]
  );

  // Sensitivity table (NPV over rev multipliers & price multipliers)
  renderSensitivity(el("sensitivityTable"), calcs);

  // Risks table
  renderEditableTable(el("risksTable"), {
    columns: [
      { key: "name", label: "الخطر", type: "text" },
      { key: "probability", label: "الاحتمال", type: "number", step: "0.01", min: 0, max: 1 },
      { key: "impact", label: "الأثر المالي (SAR)", type: "number", step: "1", min: 0 },
      { key: "kill", label: "Kill?", type: "text" },
      { key: "owner", label: "المالك", type: "text" },
      { key: "mitigation", label: "التخفيف", type: "text" },
    ],
    rows: model.risks.map((r) => ({ ...r, kill: r.kill ? "YES" : "NO" })),
    onChangeRow(idx, key, val) {
      if (key === "kill") {
        const s = String(val || "").trim().toUpperCase();
        model.risks[idx].kill = s === "YES" || s === "Y" || s === "TRUE" || s === "1";
      } else if (key === "probability" || key === "impact") model.risks[idx][key] = val;
      else model.risks[idx][key] = val;
      render();
    },
    onRemove(idx) {
      model.risks.splice(idx, 1);
      render();
    },
  });

  // QA panel
  el("qaVerdict").textContent = qa.verdict;
  el("qaVerdict").style.borderColor =
    qa.verdict === "PASS" ? "rgba(57,217,138,.35)" : "rgba(255,90,106,.35)";
  el("qaVerdict").style.background =
    qa.verdict === "PASS" ? "rgba(57,217,138,.12)" : "rgba(255,90,106,.12)";

  el("qaList").innerHTML = qa.items.length
    ? qa.items.map(renderQaItem).join("")
    : `<div class="qaItem"><span class="badge badge--ok">OK</span> لا توجد ملاحظات. </div>`;

  // Audit tab
  renderAuditTab(calcs);

  // Assumptions inputs
  el("assProjectType").value = model.assumptions.projectType || "other";
  el("assYears").value = model.assumptions.years;
  el("assDiscount").value = model.assumptions.discount;
  el("assTax").value = model.assumptions.tax;
  el("assInflation").value = model.assumptions.inflation;
  el("assVarCostRatio").value = model.assumptions.varCostRatio ?? 0.35;
  el("thMinNPV").value = model.thresholds.minNPV;
  el("thMinIRR").value = model.thresholds.minIRR;
  el("thMaxPayback").value = model.thresholds.maxPayback;
  el("thIrrPremium").value = model.thresholds.irrPremium;
}

function pbText(pb) {
  return pb === Infinity ? "∞" : `${num(pb)} سنة`;
}

function kpiCard(label, value) {
  return `
    <div class="kpiCard">
      <div class="kpiCard__label">${escapeHtml(label)}</div>
      <div class="kpiCard__value">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderQaItem(it) {
  const badge = it.level === "ERROR" ? "badge--err" : "badge--warn";
  return `
    <div class="qaItem">
      <div class="row row--between">
        <strong>${escapeHtml(it.title)}</strong>
        <span class="badge ${badge}">${escapeHtml(it.level)}</span>
      </div>
      <div class="muted" style="margin-top:6px">${escapeHtml(it.detail || "")}</div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSensitivity(container, calcs) {
  const priceMults = [0.8, 0.9, 1.0, 1.1, 1.2];
  const volMults = [0.8, 0.9, 1.0, 1.1, 1.2];

  // We'll approximate price sensitivity by scaling all prices, and volume by scaling customersPerMonth.
  const baseModel = deepClone(model);

  const rows = [];
  for (const vol of volMults) {
    const row = [`حجم ${fmtPct.format(vol - 1)}`];
    for (const pm of priceMults) {
      const m2 = deepClone(baseModel);
      m2.revenue = m2.revenue.map((r) => ({
        ...r,
        customersPerMonth: toNum(r.customersPerMonth) * vol,
        price: toNum(r.price) * pm,
      }));
      const c = computeScenario(m2, { rev: 1, opex: 1, capex: 1 });
      row.push(money(c.kpis.npv));
    }
    rows.push(row);
  }

  renderTable(container, ["", ...priceMults.map((p) => `سعر ×${p}`)], rows);
}

// ---------- Events ----------

function bindNav() {
  document.querySelectorAll(".nav__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav__item").forEach((b) => b.classList.remove("is-active"));
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
      btn.classList.add("is-active");
      el(`tab-${btn.dataset.tab}`).classList.add("is-active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function bindInputs() {
  const bind = (id, getter, setter) => {
    el(id).addEventListener("input", (e) => {
      setter(getter(e.target.value));
      render();
    });
  };

  el("assProjectType").addEventListener("change", (e) => {
    model.assumptions.projectType = String(e.target.value || "other");
    render();
  });

  bind("assYears", (v) => Math.max(1, Math.floor(toNum(v))), (v) => (model.assumptions.years = v));
  bind("assDiscount", toNum, (v) => (model.assumptions.discount = v));
  bind("assTax", toNum, (v) => (model.assumptions.tax = v));
  bind("assInflation", toNum, (v) => (model.assumptions.inflation = v));
  bind("assVarCostRatio", toNum, (v) => (model.assumptions.varCostRatio = v));

  bind("thMinNPV", toNum, (v) => (model.thresholds.minNPV = v));
  bind("thMinIRR", toNum, (v) => (model.thresholds.minIRR = v));
  bind("thMaxPayback", toNum, (v) => (model.thresholds.maxPayback = v));
  bind("thIrrPremium", toNum, (v) => (model.thresholds.irrPremium = v));

  // Scenarios
  const bindSc = (id, path) => {
    el(id).addEventListener("input", (e) => {
      const v = toNum(e.target.value);
      const [a, b] = path;
      model.scenarios[a][b] = v;
      render();
    });
  };
  bindSc("scBestRev", ["best", "rev"]);
  bindSc("scBestOpex", ["best", "opex"]);
  bindSc("scBestCapex", ["best", "capex"]);
  bindSc("scWorstRev", ["worst", "rev"]);
  bindSc("scWorstOpex", ["worst", "opex"]);
  bindSc("scWorstCapex", ["worst", "capex"]);
}

function bindButtons() {
  const svcBtn = el("btnAddService");
  if (svcBtn) {
    svcBtn.addEventListener("click", () => {
      const base = {
        id: `svc_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        category: "أخرى",
        name: "خدمة جديدة",
        unitPrice: 0,
        unitVarCost: 0,
        source: "",
      };
      model.services = Array.isArray(model.services) ? model.services : [];
      model.services.push(base);
      render();
    });
  }

  el("btnAddRevenue").addEventListener("click", () => {
    model.revenue.push({ name: "مصدر جديد", customersPerMonth: 0, price: 0, growth: 0.0, source: "", serviceId: null });
    render();
  });
  el("btnAddOpex").addEventListener("click", () => {
    model.opex.push({ name: "بند جديد", annualYear1: 0, inflation: null, source: "" });
    render();
  });
  el("btnAddCapex").addEventListener("click", () => {
    model.capex.push({ name: "أصل جديد", cost: 0, year: 0, lifeYears: 5, source: "" });
    render();
  });
  el("btnAddRisk").addEventListener("click", () => {
    model.risks.push({ name: "خطر جديد", probability: 0.2, impact: 0, kill: false, owner: "", mitigation: "" });
    render();
  });

  el("btnRunQA").addEventListener("click", () => {
    const qa = runQA(computeAll());
    // Switch to "مؤشرات تقييم المشروع" (contains QA)
    const btn = document.querySelector('.nav__item[data-tab="sheet-kpis-project"]');
    if (btn) btn.click();
    if (qa.verdict === "FAIL") alert("QA: FAIL — أصلح البنود الحرِجة أولاً.");
  });

  el("btnReset").addEventListener("click", () => {
    if (!confirm("متأكد من إعادة الضبط؟ سيتم حذف البيانات الحالية.")) return;
    model = defaultModel();
    saveModel();
    render();
  });

  el("btnExport").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `feasibility_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  el("btnExportAudit").addEventListener("click", async () => {
    const calcs = computeAll();
    const pack = await buildAuditPack(calcs);

    // JSON
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit_pack_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);

    // HTML (printable)
    const html = buildAuditHtml(pack);
    const blob2 = new Blob([html], { type: "text/html;charset=utf-8" });
    const a2 = document.createElement("a");
    a2.href = URL.createObjectURL(blob2);
    a2.download = `audit_pack_${new Date().toISOString().slice(0, 10)}.html`;
    a2.click();
    URL.revokeObjectURL(a2.href);
  });

  el("btnCopyAuditJson").addEventListener("click", async () => {
    const pack = await buildAuditPack(computeAll());
    await navigator.clipboard.writeText(JSON.stringify(pack, null, 2));
    alert("تم نسخ Audit JSON.");
  });

  el("btnPrintAudit").addEventListener("click", async () => {
    const pack = await buildAuditPack(computeAll());
    const html = buildAuditHtml(pack);
    const w = window.open("", "_blank");
    if (!w) {
      alert("تعذر فتح نافذة جديدة للطباعة. اسمح بالنوافذ المنبثقة.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  });

  el("fileImport").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const obj = JSON.parse(txt);
      model = mergeModel(obj);
      saveModel();
      render();
      alert("تم الاستيراد بنجاح.");
    } catch {
      alert("فشل الاستيراد: ملف JSON غير صالح.");
    } finally {
      e.target.value = "";
    }
  });
}

function buildAuditHtml(pack) {
  const esc = escapeHtml;
  const qaList = (pack.qaItems || [])
    .map((x) => `<li><strong>${esc(x.level)}</strong> — ${esc(x.title)} — <span>${esc(x.detail || "")}</span></li>`)
    .join("");
  const traceRows = (pack.traceability || [])
    .map((r) => `<tr><td>${esc(r.section)}</td><td>${esc(r.item)}</td><td>${esc(r.value)}</td><td>${esc(r.source || "")}</td></tr>`)
    .join("");

  return `<!doctype html>
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Audit Pack</title>
      <style>
        body{font-family:system-ui,"Segoe UI",Tahoma,Arial,sans-serif;padding:18px}
        h1{margin:0 0 8px 0}
        .muted{color:#555}
        table{border-collapse:collapse;width:100%;margin-top:12px}
        th,td{border:1px solid #ddd;padding:8px;vertical-align:top;text-align:right}
        th{background:#f3f4f6}
        code{background:#f3f4f6;padding:2px 6px;border-radius:8px}
      </style>
    </head>
    <body>
      <h1>Audit Pack</h1>
      <div class="muted">GeneratedAt: <code>${esc(pack.generatedAt)}</code> · ModelHash: <code>${esc(pack.modelHashSha256 || "")}</code></div>
      <div style="margin-top:10px"><strong>Decision:</strong> ${esc(pack.decision)} · <strong>QA:</strong> ${esc(pack.verdict)}</div>
      <div style="margin-top:6px"><strong>Reasons:</strong> ${esc((pack.decisionReasons || []).join(" | "))}</div>

      <h2 style="margin-top:16px">KPIs</h2>
      <pre>${esc(JSON.stringify(pack.kpis, null, 2))}</pre>

      <h2 style="margin-top:16px">QA Findings</h2>
      <ul>${qaList || "<li>OK</li>"}</ul>

      <h2 style="margin-top:16px">Traceability</h2>
      <table>
        <thead><tr><th>القسم</th><th>البند</th><th>القيمة/التكوين</th><th>المصدر/الدليل</th></tr></thead>
        <tbody>${traceRows}</tbody>
      </table>
    </body>
  </html>`;
}

async function loadStandardsText() {
  const elStd = el("standardsText");
  try {
    const res = await fetch("/templates/standards_from_docx.txt", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const txt = await res.text();
    elStd.textContent = txt;
  } catch {
    elStd.textContent =
      "تعذر تحميل النص من templates/standards_from_docx.txt.\nتأكد أن السيرفر يعمل من جذر المشروع، وأنك فتحت: http://localhost:5173/web/";
  }
}

function init() {
  bindNav();
  bindInputs();
  bindButtons();
  loadStandardsText();
  render();
}

init();
```


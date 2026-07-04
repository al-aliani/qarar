# دليل التنفيذ التقني - ميزات التصدير والتكامل

**الغرض:** دليل تقني مفصل لتنفيذ كل ميزة خطوة بخطوة  
**تاريخ:** يناير 2026

---

## 1. PowerPoint Export (PPTX) - التنفيذ الكامل

### 1.1 التثبيت

```bash
npm install pptxgenjs --save
```

### 1.2 الملف الجديد: `web/export/pptxExporter.js`

```javascript
/**
 * PowerPoint Exporter
 * تصدير دراسة الجدوى كعرض تقديمي احترافي
 */

import pptxgen from 'pptxgenjs';

export class PPTXExporter {
  constructor(studyData) {
    this.study = studyData;
    this.pptx = new pptxgen();
    
    // إعدادات الشركة/العلامة التجارية
    this.colors = {
      primary: '1E40AF',    // أزرق داكن
      secondary: '3B82F6',  // أزرق فاتح
      success: '10B981',    // أخضر
      warning: 'F59E0B',    // برتقالي
      danger: 'EF4444',     // أحمر
      text: '1F2937',       // رمادي داكن
      lightGray: 'F3F4F6'   // رمادي فاتح
    };
  }

  /**
   * تصدير العرض التقديمي كاملاً
   */
  async export() {
    try {
      // إعدادات العرض
      this.pptx.layout = 'LAYOUT_16x9';
      this.pptx.author = 'Feasibility Study Platform';
      this.pptx.company = this.study.projectInfo?.company || 'FeasSimulator';
      this.pptx.title = this.study.projectInfo?.projectName || 'دراسة جدوى';
      this.pptx.rtlMode = true; // دعم العربية

      // بناء الشرائح
      this.addCoverSlide();
      this.addExecutiveSummarySlide();
      this.addMarketOverviewSlide();
      this.addCompetitiveAdvantageSlide();
      this.addRevenueModelSlide();
      this.addOperationalPlanSlide();
      this.addFinancialForecastSlide();
      this.addKPISlide();
      this.addScenariosSlide();
      this.addRisksAndRecommendationSlide();

      // حفظ الملف
      const fileName = `${this.study.projectInfo?.projectName || 'دراسة'}_عرض_تقديمي.pptx`;
      await this.pptx.writeFile({ fileName });
      
      return { success: true, fileName };
    } catch (error) {
      console.error('خطأ في تصدير PowerPoint:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * الشريحة 1: الغلاف
   */
  addCoverSlide() {
    const slide = this.pptx.addSlide();
    
    // خلفية متدرجة
    slide.background = { 
      fill: `${this.colors.primary}`,
      transparency: 10
    };

    // عنوان المشروع
    slide.addText(this.study.projectInfo?.projectName || 'دراسة جدوى', {
      x: 0.5,
      y: 2.5,
      w: '90%',
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      fontFace: 'Calibri',
      rtlMode: true
    });

    // شعار (إن وجد)
    if (this.study.projectInfo?.logo) {
      slide.addImage({
        data: this.study.projectInfo.logo,
        x: 4.5,
        y: 0.5,
        w: 1,
        h: 1
      });
    }

    // التاريخ
    const date = new Date().toLocaleDateString('ar-SA');
    slide.addText(date, {
      x: 0.5,
      y: 5,
      w: '90%',
      fontSize: 16,
      color: 'FFFFFF',
      align: 'center',
      rtlMode: true
    });

    // معلومات الجهة المنفذة
    if (this.study.projectInfo?.company) {
      slide.addText(this.study.projectInfo.company, {
        x: 0.5,
        y: 5.5,
        w: '90%',
        fontSize: 14,
        color: 'FFFFFF',
        align: 'center',
        rtlMode: true
      });
    }
  }

  /**
   * الشريحة 2: الملخص التنفيذي
   */
  addExecutiveSummarySlide() {
    const slide = this.pptx.addSlide();
    slide.background = { fill: 'FFFFFF' };

    // العنوان
    this.addSlideTitle(slide, 'الملخص التنفيذي');

    // المشكلة
    slide.addText('المشكلة', {
      x: 0.5,
      y: 1.2,
      fontSize: 18,
      bold: true,
      color: this.colors.primary,
      rtlMode: true
    });
    
    slide.addText(this.study.executiveSummary?.problem || 'لم يتم تحديد المشكلة', {
      x: 0.5,
      y: 1.7,
      w: 9,
      fontSize: 14,
      color: this.colors.text,
      rtlMode: true
    });

    // الحل
    slide.addText('الحل المقترح', {
      x: 0.5,
      y: 2.5,
      fontSize: 18,
      bold: true,
      color: this.colors.primary,
      rtlMode: true
    });
    
    slide.addText(this.study.executiveSummary?.solution || 'لم يتم تحديد الحل', {
      x: 0.5,
      y: 3,
      w: 9,
      fontSize: 14,
      color: this.colors.text,
      rtlMode: true
    });

    // الفرصة
    slide.addText('الفرصة السوقية', {
      x: 0.5,
      y: 3.8,
      fontSize: 18,
      bold: true,
      color: this.colors.primary,
      rtlMode: true
    });
    
    const marketSize = this.study.marketing?.marketAnalysis?.marketSize || 'غير محدد';
    slide.addText(`حجم السوق: ${marketSize}`, {
      x: 0.5,
      y: 4.3,
      w: 9,
      fontSize: 14,
      color: this.colors.text,
      rtlMode: true
    });
  }

  /**
   * الشريحة 3: نظرة عامة على السوق
   */
  addMarketOverviewSlide() {
    const slide = this.pptx.addSlide();
    this.addSlideTitle(slide, 'السوق المستهدف');

    const market = this.study.marketing?.marketAnalysis || {};

    // معلومات السوق في بطاقات
    const cards = [
      { label: 'حجم السوق', value: market.marketSize || 'N/A', icon: '📊' },
      { label: 'معدل النمو', value: market.growthRate || 'N/A', icon: '📈' },
      { label: 'عدد المنافسين', value: market.competitors?.length || 0, icon: '🏢' }
    ];

    cards.forEach((card, index) => {
      const x = 0.5 + (index * 3.3);
      
      // صندوق البطاقة
      slide.addShape(this.pptx.ShapeType.rect, {
        x,
        y: 1.5,
        w: 3,
        h: 2,
        fill: { color: this.colors.lightGray },
        line: { color: this.colors.primary, width: 2 }
      });

      // الأيقونة
      slide.addText(card.icon, {
        x,
        y: 1.7,
        w: 3,
        h: 0.5,
        fontSize: 32,
        align: 'center'
      });

      // القيمة
      slide.addText(card.value.toString(), {
        x,
        y: 2.3,
        w: 3,
        h: 0.5,
        fontSize: 24,
        bold: true,
        color: this.colors.primary,
        align: 'center',
        rtlMode: true
      });

      // التسمية
      slide.addText(card.label, {
        x,
        y: 2.9,
        w: 3,
        h: 0.4,
        fontSize: 14,
        color: this.colors.text,
        align: 'center',
        rtlMode: true
      });
    });

    // الشرائح المستهدفة
    if (market.targetSegments && market.targetSegments.length > 0) {
      slide.addText('الشرائح المستهدفة:', {
        x: 0.5,
        y: 4,
        fontSize: 16,
        bold: true,
        color: this.colors.primary,
        rtlMode: true
      });

      const segments = market.targetSegments.map(seg => `• ${seg.name}: ${seg.description}`);
      slide.addText(segments.join('\n'), {
        x: 0.5,
        y: 4.5,
        w: 9,
        fontSize: 12,
        color: this.colors.text,
        rtlMode: true
      });
    }
  }

  /**
   * الشريحة 4: الميزة التنافسية (SWOT)
   */
  addCompetitiveAdvantageSlide() {
    const slide = this.pptx.addSlide();
    this.addSlideTitle(slide, 'تحليل SWOT');

    const swot = this.study.marketing?.swotAnalysis || {};
    
    const sections = [
      { 
        title: 'نقاط القوة', 
        data: swot.strengths || [], 
        x: 0.5, 
        y: 1.5, 
        color: this.colors.success 
      },
      { 
        title: 'نقاط الضعف', 
        data: swot.weaknesses || [], 
        x: 5.25, 
        y: 1.5, 
        color: this.colors.warning 
      },
      { 
        title: 'الفرص', 
        data: swot.opportunities || [], 
        x: 0.5, 
        y: 3.75, 
        color: this.colors.primary 
      },
      { 
        title: 'التهديدات', 
        data: swot.threats || [], 
        x: 5.25, 
        y: 3.75, 
        color: this.colors.danger 
      }
    ];

    sections.forEach(section => {
      // صندوق
      slide.addShape(this.pptx.ShapeType.rect, {
        x: section.x,
        y: section.y,
        w: 4.5,
        h: 2,
        fill: { color: 'FFFFFF' },
        line: { color: section.color, width: 3 }
      });

      // العنوان
      slide.addText(section.title, {
        x: section.x,
        y: section.y + 0.1,
        w: 4.5,
        h: 0.4,
        fontSize: 16,
        bold: true,
        color: section.color,
        align: 'center',
        rtlMode: true
      });

      // النقاط
      const points = section.data.slice(0, 3).map(item => `• ${item}`).join('\n');
      slide.addText(points || 'لا توجد بيانات', {
        x: section.x + 0.2,
        y: section.y + 0.6,
        w: 4.1,
        h: 1.3,
        fontSize: 11,
        color: this.colors.text,
        rtlMode: true,
        valign: 'top'
      });
    });
  }

  /**
   * الشريحة 5: نموذج الإيرادات
   */
  addRevenueModelSlide() {
    const slide = this.pptx.addSlide();
    this.addSlideTitle(slide, 'نموذج الإيرادات');

    const revenues = this.study.financial?.revenueStreams || [];

    if (revenues.length === 0) {
      slide.addText('لم يتم تحديد مصادر إيرادات', {
        x: 0.5,
        y: 3,
        w: 9,
        fontSize: 18,
        color: this.colors.warning,
        align: 'center',
        rtlMode: true
      });
      return;
    }

    // جدول مصادر الإيرادات
    const rows = [
      [
        { text: 'المنتج/الخدمة', options: { bold: true, fill: this.colors.primary, color: 'FFFFFF' } },
        { text: 'السعر', options: { bold: true, fill: this.colors.primary, color: 'FFFFFF' } },
        { text: 'الكمية المتوقعة', options: { bold: true, fill: this.colors.primary, color: 'FFFFFF' } },
        { text: 'الإيراد السنوي', options: { bold: true, fill: this.colors.primary, color: 'FFFFFF' } }
      ]
    ];

    revenues.forEach(rev => {
      const annualRevenue = (rev.price || 0) * (rev.quantity || 0) * 12;
      rows.push([
        { text: rev.name || '', options: { rtlMode: true } },
        { text: `${rev.price || 0} ريال`, options: { rtlMode: true } },
        { text: `${rev.quantity || 0}`, options: { align: 'center' } },
        { text: `${annualRevenue.toLocaleString('ar-SA')} ريال`, options: { bold: true, rtlMode: true } }
      ]);
    });

    slide.addTable(rows, {
      x: 0.5,
      y: 1.5,
      w: 9,
      fontSize: 12,
      border: { pt: 1, color: this.colors.primary },
      align: 'center',
      valign: 'middle'
    });

    // إجمالي الإيرادات المتوقعة
    const totalRevenue = revenues.reduce((sum, rev) => 
      sum + ((rev.price || 0) * (rev.quantity || 0) * 12), 0
    );

    slide.addText(`إجمالي الإيرادات المتوقعة: ${totalRevenue.toLocaleString('ar-SA')} ريال/سنة`, {
      x: 0.5,
      y: 5,
      w: 9,
      fontSize: 16,
      bold: true,
      color: this.colors.success,
      align: 'center',
      rtlMode: true
    });
  }

  /**
   * الشريحة 6: الخطة التشغيلية
   */
  addOperationalPlanSlide() {
    const slide = this.pptx.addSlide();
    this.addSlideTitle(slide, 'الخطة التشغيلية');

    const operational = this.study.technical || {};

    // الموقع
    if (operational.location) {
      slide.addText('📍 الموقع', {
        x: 0.5,
        y: 1.5,
        fontSize: 16,
        bold: true,
        color: this.colors.primary,
        rtlMode: true
      });
      
      slide.addText(operational.location.description || 'لم يتم التحديد', {
        x: 0.5,
        y: 2,
        w: 4,
        fontSize: 12,
        color: this.colors.text,
        rtlMode: true
      });
    }

    // المعدات الرئيسية
    if (operational.equipment && operational.equipment.length > 0) {
      slide.addText('🛠️ المعدات الرئيسية', {
        x: 5,
        y: 1.5,
        fontSize: 16,
        bold: true,
        color: this.colors.primary,
        rtlMode: true
      });

      const equipmentList = operational.equipment.slice(0, 5)
        .map(eq => `• ${eq.name}: ${eq.quantity} × ${eq.cost?.toLocaleString('ar-SA')} ريال`)
        .join('\n');

      slide.addText(equipmentList, {
        x: 5,
        y: 2,
        w: 4.5,
        fontSize: 11,
        color: this.colors.text,
        rtlMode: true
      });
    }

    // الفريق
    if (operational.team && operational.team.length > 0) {
      slide.addText('👥 الفريق', {
        x: 0.5,
        y: 3.5,
        fontSize: 16,
        bold: true,
        color: this.colors.primary,
        rtlMode: true
      });

      const teamRows = [
        [
          { text: 'المنصب', options: { bold: true, fill: this.colors.lightGray } },
          { text: 'العدد', options: { bold: true, fill: this.colors.lightGray } },
          { text: 'الراتب الشهري', options: { bold: true, fill: this.colors.lightGray } }
        ]
      ];

      operational.team.slice(0, 5).forEach(member => {
        teamRows.push([
          { text: member.position || '', options: { rtlMode: true } },
          { text: member.count?.toString() || '1', options: { align: 'center' } },
          { text: `${member.salary?.toLocaleString('ar-SA')} ريال`, options: { rtlMode: true } }
        ]);
      });

      slide.addTable(teamRows, {
        x: 0.5,
        y: 4,
        w: 9,
        fontSize: 11,
        border: { pt: 1, color: this.colors.primary }
      });
    }
  }

  /**
   * الشريحة 7: التوقعات المالية (رسم بياني)
   */
  addFinancialForecastSlide() {
    const slide = this.pptx.addSlide();
    this.addSlideTitle(slide, 'التوقعات المالية (5 سنوات)');

    const financial = this.study.financialResults || {};
    const years = ['السنة 1', 'السنة 2', 'السنة 3', 'السنة 4', 'السنة 5'];
    
    // بيانات وهمية إذا لم تتوفر البيانات الحقيقية
    const revenues = financial.revenues || [100000, 150000, 200000, 250000, 300000];
    const profits = financial.netProfits || [20000, 40000, 70000, 100000, 130000];

    // رسم بياني خطي
    const chartData = [
      {
        name: 'الإيرادات',
        labels: years,
        values: revenues
      },
      {
        name: 'صافي الربح',
        labels: years,
        values: profits
      }
    ];

    slide.addChart(this.pptx.ChartType.line, chartData, {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 4,
      showTitle: false,
      showLegend: true,
      legendPos: 'b',
      valAxisMaxVal: Math.max(...revenues) * 1.2,
      catAxisLabelFontSize: 12,
      valAxisLabelFontSize: 12,
      chartColors: [this.colors.secondary, this.colors.success]
    });
  }

  /**
   * الشريحة 8: المؤشرات المالية (KPIs)
   */
  addKPISlide() {
    const slide = this.pptx.addSlide();
    this.addSlideTitle(slide, 'المؤشرات المالية الرئيسية');

    const kpis = this.study.financialResults?.kpis || {};

    const metrics = [
      { 
        label: 'صافي القيمة الحالية',
        value: `${(kpis.npv || 0).toLocaleString('ar-SA')} ريال`,
        status: (kpis.npv || 0) > 0 ? 'positive' : 'negative',
        icon: '💰'
      },
      { 
        label: 'معدل العائد الداخلي',
        value: `${(kpis.irr || 0).toFixed(1)}%`,
        status: (kpis.irr || 0) > 10 ? 'positive' : 'neutral',
        icon: '📊'
      },
      { 
        label: 'فترة الاسترداد',
        value: `${(kpis.paybackPeriod || 0).toFixed(1)} سنة`,
        status: (kpis.paybackPeriod || 0) < 3 ? 'positive' : 'neutral',
        icon: '⏱️'
      },
      { 
        label: 'العائد على الاستثمار',
        value: `${(kpis.roi || 0).toFixed(1)}%`,
        status: (kpis.roi || 0) > 20 ? 'positive' : 'neutral',
        icon: '📈'
      }
    ];

    metrics.forEach((metric, index) => {
      const x = 0.5 + (index % 2) * 5;
      const y = 1.5 + Math.floor(index / 2) * 2.2;

      // لون الحالة
      let statusColor = this.colors.primary;
      if (metric.status === 'positive') statusColor = this.colors.success;
      if (metric.status === 'negative') statusColor = this.colors.danger;

      // صندوق KPI
      slide.addShape(this.pptx.ShapeType.rect, {
        x,
        y,
        w: 4.5,
        h: 2,
        fill: { color: statusColor, transparency: 10 },
        line: { color: statusColor, width: 3 }
      });

      // الأيقونة
      slide.addText(metric.icon, {
        x: x + 0.2,
        y: y + 0.3,
        fontSize: 32
      });

      // القيمة
      slide.addText(metric.value, {
        x: x + 1.5,
        y: y + 0.4,
        w: 2.8,
        fontSize: 22,
        bold: true,
        color: statusColor,
        rtlMode: true
      });

      // التسمية
      slide.addText(metric.label, {
        x: x + 0.2,
        y: y + 1.3,
        w: 4.1,
        fontSize: 14,
        color: this.colors.text,
        rtlMode: true
      });
    });
  }

  /**
   * الشريحة 9: السيناريوهات
   */
  addScenariosSlide() {
    const slide = this.pptx.addSlide();
    this.addSlideTitle(slide, 'تحليل السيناريوهات');

    const scenarios = this.study.financialResults?.scenarios || {};

    const scenarioData = [
      { 
        name: 'السيناريو الأساسي', 
        data: scenarios.base || {},
        color: this.colors.primary 
      },
      { 
        name: 'السيناريو الأفضل', 
        data: scenarios.best || {},
        color: this.colors.success 
      },
      { 
        name: 'السيناريو الأسوأ', 
        data: scenarios.worst || {},
        color: this.colors.danger 
      }
    ];

    // جدول مقارنة
    const rows = [
      [
        { text: 'المؤشر', options: { bold: true, fill: this.colors.lightGray } },
        { text: 'أساسي', options: { bold: true, fill: this.colors.lightGray } },
        { text: 'أفضل', options: { bold: true, fill: this.colors.lightGray } },
        { text: 'أسوأ', options: { bold: true, fill: this.colors.lightGray } }
      ],
      [
        { text: 'NPV (ريال)', options: { rtlMode: true } },
        { text: (scenarios.base?.npv || 0).toLocaleString('ar-SA'), options: { rtlMode: true } },
        { text: (scenarios.best?.npv || 0).toLocaleString('ar-SA'), options: { color: this.colors.success, rtlMode: true } },
        { text: (scenarios.worst?.npv || 0).toLocaleString('ar-SA'), options: { color: this.colors.danger, rtlMode: true } }
      ],
      [
        { text: 'IRR (%)', options: { rtlMode: true } },
        { text: `${(scenarios.base?.irr || 0).toFixed(1)}%`, options: {} },
        { text: `${(scenarios.best?.irr || 0).toFixed(1)}%`, options: { color: this.colors.success } },
        { text: `${(scenarios.worst?.irr || 0).toFixed(1)}%`, options: { color: this.colors.danger } }
      ],
      [
        { text: 'Payback (سنة)', options: { rtlMode: true } },
        { text: `${(scenarios.base?.payback || 0).toFixed(1)}`, options: {} },
        { text: `${(scenarios.best?.payback || 0).toFixed(1)}`, options: { color: this.colors.success } },
        { text: `${(scenarios.worst?.payback || 0).toFixed(1)}`, options: { color: this.colors.danger } }
      ]
    ];

    slide.addTable(rows, {
      x: 1,
      y: 1.5,
      w: 8,
      fontSize: 14,
      border: { pt: 1, color: this.colors.primary },
      align: 'center',
      valign: 'middle'
    });

    // ملاحظة
    slide.addText('ملاحظة: السيناريو الأفضل (+20% إيرادات)، الأسوأ (-20% إيرادات، +10% تكاليف)', {
      x: 0.5,
      y: 5,
      w: 9,
      fontSize: 10,
      color: this.colors.text,
      align: 'center',
      italic: true,
      rtlMode: true
    });
  }

  /**
   * الشريحة 10: المخاطر والتوصية النهائية
   */
  addRisksAndRecommendationSlide() {
    const slide = this.pptx.addSlide();
    this.addSlideTitle(slide, 'المخاطر والتوصية');

    const risks = this.study.riskAnalysis?.risks || [];
    const recommendation = this.study.recommendation || {};

    // أهم 3 مخاطر
    slide.addText('⚠️ أهم المخاطر:', {
      x: 0.5,
      y: 1.5,
      fontSize: 16,
      bold: true,
      color: this.colors.primary,
      rtlMode: true
    });

    const topRisks = risks
      .sort((a, b) => (b.severity || 0) - (a.severity || 0))
      .slice(0, 3);

    if (topRisks.length > 0) {
      const riskList = topRisks.map((risk, idx) => 
        `${idx + 1}. ${risk.description} (احتمالية: ${risk.probability || 'N/A'}، تأثير: ${risk.impact || 'N/A'})`
      ).join('\n');

      slide.addText(riskList, {
        x: 0.5,
        y: 2,
        w: 9,
        fontSize: 12,
        color: this.colors.text,
        rtlMode: true
      });
    } else {
      slide.addText('لم يتم تحديد مخاطر', {
        x: 0.5,
        y: 2,
        w: 9,
        fontSize: 12,
        color: this.colors.warning,
        rtlMode: true
      });
    }

    // التوصية النهائية
    slide.addText('📋 التوصية النهائية:', {
      x: 0.5,
      y: 3.5,
      fontSize: 18,
      bold: true,
      color: this.colors.primary,
      rtlMode: true
    });

    const decision = recommendation.decision || 'غير محدد';
    const decisionColor = decision === 'GO' ? this.colors.success : 
                          decision === 'NO-GO' ? this.colors.danger : 
                          this.colors.warning;

    // صندوق التوصية
    slide.addShape(this.pptx.ShapeType.rect, {
      x: 2,
      y: 4,
      w: 6,
      h: 1.5,
      fill: { color: decisionColor, transparency: 10 },
      line: { color: decisionColor, width: 4 }
    });

    const decisionText = decision === 'GO' ? '✅ تنفيذ المشروع' :
                         decision === 'NO-GO' ? '❌ عدم تنفيذ المشروع' :
                         '⚠️ مراجعة المشروع';

    slide.addText(decisionText, {
      x: 2,
      y: 4.3,
      w: 6,
      h: 0.8,
      fontSize: 24,
      bold: true,
      color: decisionColor,
      align: 'center',
      valign: 'middle',
      rtlMode: true
    });

    // السبب
    if (recommendation.reason) {
      slide.addText(recommendation.reason, {
        x: 0.5,
        y: 5.5,
        w: 9,
        fontSize: 12,
        color: this.colors.text,
        align: 'center',
        rtlMode: true
      });
    }
  }

  /**
   * مساعد: إضافة عنوان للشريحة
   */
  addSlideTitle(slide, title) {
    slide.addText(title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.6,
      fontSize: 28,
      bold: true,
      color: this.colors.primary,
      align: 'center',
      rtlMode: true
    });

    // خط تحت العنوان
    slide.addShape(this.pptx.ShapeType.line, {
      x: 1,
      y: 1.1,
      w: 8,
      h: 0,
      line: { color: this.colors.secondary, width: 2 }
    });
  }
}
```

### 1.3 التكامل مع الواجهة

في `web/js/ui/ExportOptions.js`:

```javascript
import { PPTXExporter } from '../export/pptxExporter.js';

// داخل دالة render() أو handleExport()
async exportPowerPoint() {
  const studyData = Store.getState().study;
  
  // عرض loading
  this.showLoadingSpinner('جاري تصدير العرض التقديمي...');
  
  try {
    const exporter = new PPTXExporter(studyData);
    const result = await exporter.export();
    
    if (result.success) {
      this.showSuccessMessage(`تم التصدير بنجاح: ${result.fileName}`);
    } else {
      this.showErrorMessage(`خطأ: ${result.error}`);
    }
  } catch (error) {
    this.showErrorMessage('فشل التصدير. حاول مرة أخرى.');
  } finally {
    this.hideLoadingSpinner();
  }
}
```

---

## 2. Word Export (DOCX) - التنفيذ الكامل

### 2.1 التثبيت

```bash
npm install docx --save
```

### 2.2 الملف الجديد: `web/export/docxExporter.js`

```javascript
/**
 * Word Exporter
 * تصدير تقرير دراسة الجدوى الكامل بصيغة DOCX
 */

import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle
} from 'docx';

export class DOCXExporter {
  constructor(studyData) {
    this.study = studyData;
  }

  /**
   * تصدير المستند
   */
  async export() {
    try {
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1440,    // 1 inch = 1440 twips
                  right: 1440,
                  bottom: 1440,
                  left: 1440
                }
              }
            },
            children: [
              ...this.createCoverPage(),
              this.createPageBreak(),
              ...this.createTableOfContents(),
              this.createPageBreak(),
              ...this.createExecutiveSummary(),
              this.createPageBreak(),
              ...this.createProjectInfo(),
              this.createPageBreak(),
              ...this.createMarketStudy(),
              this.createPageBreak(),
              ...this.createTechnicalStudy(),
              this.createPageBreak(),
              ...this.createFinancialStudy(),
              this.createPageBreak(),
              ...this.createFinancialAnalysis(),
              this.createPageBreak(),
              ...this.createRiskAnalysis(),
              this.createPageBreak(),
              ...this.createRecommendation(),
              this.createPageBreak(),
              ...this.createAppendices()
            ]
          }
        ]
      });

      // تحويل إلى Blob وتحميل
      const blob = await Packer.toBlob(doc);
      const fileName = `${this.study.projectInfo?.projectName || 'دراسة'}_تقرير.docx`;
      
      this.downloadBlob(blob, fileName);
      
      return { success: true, fileName };
    } catch (error) {
      console.error('خطأ في تصدير Word:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * صفحة الغلاف
   */
  createCoverPage() {
    return [
      new Paragraph({
        text: this.study.projectInfo?.projectName || 'دراسة جدوى',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { before: 3000, after: 1000 }
      }),
      new Paragraph({
        text: 'تقرير دراسة الجدوى الاقتصادية',
        alignment: AlignmentType.CENTER,
        spacing: { after: 500 }
      }),
      new Paragraph({
        text: `التاريخ: ${new Date().toLocaleDateString('ar-SA')}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 500 }
      }),
      ...(this.study.projectInfo?.company ? [
        new Paragraph({
          text: `الجهة المنفذة: ${this.study.projectInfo.company}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 2000 }
        })
      ] : [])
    ];
  }

  /**
   * فهرس المحتويات (مبسط)
   */
  createTableOfContents() {
    return [
      this.createHeading1('فهرس المحتويات'),
      new Paragraph({
        text: '1. الملخص التنفيذي',
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: '2. معلومات المشروع',
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: '3. الدراسة السوقية',
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: '4. الدراسة الفنية والتشغيلية',
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: '5. الدراسة المالية',
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: '6. التحليل المالي',
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: '7. تحليل المخاطر',
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: '8. التوصية النهائية',
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: '9. الملاحق',
        spacing: { after: 200 }
      })
    ];
  }

  /**
   * الملخص التنفيذي
   */
  createExecutiveSummary() {
    const summary = this.study.executiveSummary || {};
    
    return [
      this.createHeading1('1. الملخص التنفيذي'),
      this.createHeading2('المشكلة'),
      new Paragraph(summary.problem || 'لم يتم تحديد المشكلة.'),
      this.createHeading2('الحل المقترح'),
      new Paragraph(summary.solution || 'لم يتم تحديد الحل.'),
      this.createHeading2('الفرصة السوقية'),
      new Paragraph(summary.opportunity || 'لم يتم تحديد الفرصة.')
    ];
  }

  /**
   * معلومات المشروع
   */
  createProjectInfo() {
    const project = this.study.projectInfo || {};
    
    return [
      this.createHeading1('2. معلومات المشروع'),
      this.createHeading2('نظرة عامة'),
      this.createInfoTable([
        ['اسم المشروع', project.projectName || 'غير محدد'],
        ['نوع المشروع', project.projectType || 'غير محدد'],
        ['القطاع', project.sector || 'غير محدد'],
        ['الموقع', project.location || 'غير محدد'],
        ['الجهة المنفذة', project.company || 'غير محدد']
      ])
    ];
  }

  /**
   * الدراسة السوقية
   */
  createMarketStudy() {
    const market = this.study.marketing?.marketAnalysis || {};
    const swot = this.study.marketing?.swotAnalysis || {};
    
    return [
      this.createHeading1('3. الدراسة السوقية'),
      
      this.createHeading2('3.1 تحليل السوق'),
      this.createInfoTable([
        ['حجم السوق', market.marketSize || 'غير محدد'],
        ['معدل النمو', market.growthRate || 'غير محدد'],
        ['عدد المنافسين', market.competitors?.length?.toString() || '0']
      ]),
      
      this.createHeading2('3.2 الشرائح المستهدفة'),
      ...(market.targetSegments || []).map(seg =>
        new Paragraph({
          text: `• ${seg.name}: ${seg.description}`,
          bullet: { level: 0 }
        })
      ),
      
      this.createHeading2('3.3 تحليل SWOT'),
      this.createHeading3('نقاط القوة'),
      ...(swot.strengths || []).map(item =>
        new Paragraph({ text: `• ${item}`, bullet: { level: 0 } })
      ),
      this.createHeading3('نقاط الضعف'),
      ...(swot.weaknesses || []).map(item =>
        new Paragraph({ text: `• ${item}`, bullet: { level: 0 } })
      ),
      this.createHeading3('الفرص'),
      ...(swot.opportunities || []).map(item =>
        new Paragraph({ text: `• ${item}`, bullet: { level: 0 } })
      ),
      this.createHeading3('التهديدات'),
      ...(swot.threats || []).map(item =>
        new Paragraph({ text: `• ${item}`, bullet: { level: 0 } })
      )
    ];
  }

  /**
   * الدراسة الفنية
   */
  createTechnicalStudy() {
    const technical = this.study.technical || {};
    
    return [
      this.createHeading1('4. الدراسة الفنية والتشغيلية'),
      
      this.createHeading2('4.1 الموقع والبنية التحتية'),
      new Paragraph(technical.location?.description || 'لم يتم التحديد.'),
      
      this.createHeading2('4.2 المعدات والآلات'),
      ...(technical.equipment || []).length > 0 ? [
        this.createEquipmentTable(technical.equipment)
      ] : [
        new Paragraph('لم يتم تحديد معدات.')
      ],
      
      this.createHeading2('4.3 العمالة والهيكل التنظيمي'),
      ...(technical.team || []).length > 0 ? [
        this.createTeamTable(technical.team)
      ] : [
        new Paragraph('لم يتم تحديد الفريق.')
      ]
    ];
  }

  /**
   * الدراسة المالية
   */
  createFinancialStudy() {
    const financial = this.study.financial || {};
    
    return [
      this.createHeading1('5. الدراسة المالية'),
      
      this.createHeading2('5.1 هيكل التمويل'),
      this.createInfoTable([
        ['رأس المال المطلوب', `${(financial.totalCapital || 0).toLocaleString('ar-SA')} ريال`],
        ['الاستثمار الذاتي', `${(financial.equity || 0).toLocaleString('ar-SA')} ريال`],
        ['التمويل الخارجي', `${(financial.debt || 0).toLocaleString('ar-SA')} ريال`]
      ]),
      
      this.createHeading2('5.2 التكاليف الرأسمالية'),
      ...(financial.capex || []).length > 0 ? [
        this.createCapexTable(financial.capex)
      ] : [
        new Paragraph('لم يتم تحديد تكاليف رأسمالية.')
      ],
      
      this.createHeading2('5.3 مصادر الإيرادات'),
      ...(financial.revenueStreams || []).length > 0 ? [
        this.createRevenueTable(financial.revenueStreams)
      ] : [
        new Paragraph('لم يتم تحديد مصادر إيرادات.')
      ]
    ];
  }

  /**
   * التحليل المالي
   */
  createFinancialAnalysis() {
    const results = this.study.financialResults || {};
    const kpis = results.kpis || {};
    
    return [
      this.createHeading1('6. التحليل المالي'),
      
      this.createHeading2('6.1 المؤشرات المالية الرئيسية'),
      this.createInfoTable([
        ['صافي القيمة الحالية (NPV)', `${(kpis.npv || 0).toLocaleString('ar-SA')} ريال`],
        ['معدل العائد الداخلي (IRR)', `${(kpis.irr || 0).toFixed(1)}%`],
        ['فترة الاسترداد (Payback)', `${(kpis.paybackPeriod || 0).toFixed(1)} سنة`],
        ['العائد على الاستثمار (ROI)', `${(kpis.roi || 0).toFixed(1)}%`]
      ]),
      
      this.createHeading2('6.2 تحليل السيناريوهات'),
      ...(results.scenarios ? [
        this.createScenariosTable(results.scenarios)
      ] : [
        new Paragraph('لم يتم إجراء تحليل سيناريوهات.')
      ])
    ];
  }

  /**
   * تحليل المخاطر
   */
  createRiskAnalysis() {
    const risks = this.study.riskAnalysis?.risks || [];
    
    return [
      this.createHeading1('7. تحليل المخاطر'),
      this.createHeading2('المخاطر الرئيسية'),
      ...(risks.length > 0 ? [
        this.createRisksTable(risks)
      ] : [
        new Paragraph('لم يتم تحديد مخاطر.')
      ])
    ];
  }

  /**
   * التوصية النهائية
   */
  createRecommendation() {
    const rec = this.study.recommendation || {};
    
    const decisionText = rec.decision === 'GO' ? 'تنفيذ المشروع ✅' :
                         rec.decision === 'NO-GO' ? 'عدم تنفيذ المشروع ❌' :
                         'مراجعة المشروع ⚠️';
    
    return [
      this.createHeading1('8. التوصية النهائية'),
      new Paragraph({
        text: decisionText,
        bold: true,
        size: 28,
        spacing: { after: 400 }
      }),
      this.createHeading2('السبب'),
      new Paragraph(rec.reason || 'لم يتم تحديد السبب.')
    ];
  }

  /**
   * الملاحق
   */
  createAppendices() {
    return [
      this.createHeading1('9. الملاحق'),
      this.createHeading2('9.1 الافتراضات التفصيلية'),
      new Paragraph('سيتم إضافة الافتراضات هنا...'),
      this.createHeading2('9.2 جداول إضافية'),
      new Paragraph('سيتم إضافة الجداول الإضافية هنا...')
    ];
  }

  // ================== مساعدات التنسيق ==================

  createHeading1(text) {
    return new Paragraph({
      text,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    });
  }

  createHeading2(text) {
    return new Paragraph({
      text,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 }
    });
  }

  createHeading3(text) {
    return new Paragraph({
      text,
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 100 }
    });
  }

  createPageBreak() {
    return new Paragraph({
      text: '',
      pageBreakBefore: true
    });
  }

  /**
   * جدول معلومات بسيط (مفتاح: قيمة)
   */
  createInfoTable(data) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 }
      },
      rows: data.map(([key, value]) => new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: key, bold: true })],
            width: { size: 30, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph(value.toString())],
            width: { size: 70, type: WidthType.PERCENTAGE }
          })
        ]
      }))
    });
  }

  /**
   * جدول المعدات
   */
  createEquipmentTable(equipment) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: 'المعدة', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'الكمية', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'التكلفة', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'الإجمالي', bold: true })] })
          ]
        }),
        ...equipment.map(eq => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(eq.name || '')] }),
            new TableCell({ children: [new Paragraph((eq.quantity || 0).toString())] }),
            new TableCell({ children: [new Paragraph(`${(eq.cost || 0).toLocaleString('ar-SA')} ريال`)] }),
            new TableCell({ children: [new Paragraph(`${((eq.cost || 0) * (eq.quantity || 0)).toLocaleString('ar-SA')} ريال`)] })
          ]
        }))
      ]
    });
  }

  /**
   * جدول الفريق
   */
  createTeamTable(team) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: 'المنصب', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'العدد', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'الراتب الشهري', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'الإجمالي الشهري', bold: true })] })
          ]
        }),
        ...team.map(member => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(member.position || '')] }),
            new TableCell({ children: [new Paragraph((member.count || 1).toString())] }),
            new TableCell({ children: [new Paragraph(`${(member.salary || 0).toLocaleString('ar-SA')} ريال`)] }),
            new TableCell({ children: [new Paragraph(`${((member.salary || 0) * (member.count || 1)).toLocaleString('ar-SA')} ريال`)] })
          ]
        }))
      ]
    });
  }

  /**
   * جدول CAPEX
   */
  createCapexTable(capex) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: 'البند', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'المبلغ', bold: true })] })
          ]
        }),
        ...capex.map(item => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(item.name || '')] }),
            new TableCell({ children: [new Paragraph(`${(item.amount || 0).toLocaleString('ar-SA')} ريال`)] })
          ]
        }))
      ]
    });
  }

  /**
   * جدول الإيرادات
   */
  createRevenueTable(revenues) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: 'المنتج/الخدمة', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'السعر', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'الكمية المتوقعة', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'الإيراد السنوي', bold: true })] })
          ]
        }),
        ...revenues.map(rev => {
          const annual = (rev.price || 0) * (rev.quantity || 0) * 12;
          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(rev.name || '')] }),
              new TableCell({ children: [new Paragraph(`${(rev.price || 0).toLocaleString('ar-SA')} ريال`)] }),
              new TableCell({ children: [new Paragraph((rev.quantity || 0).toString())] }),
              new TableCell({ children: [new Paragraph(`${annual.toLocaleString('ar-SA')} ريال`)] })
            ]
          });
        })
      ]
    });
  }

  /**
   * جدول السيناريوهات
   */
  createScenariosTable(scenarios) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: 'المؤشر', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'أساسي', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'أفضل', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'أسوأ', bold: true })] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('NPV (ريال)')] }),
            new TableCell({ children: [new Paragraph((scenarios.base?.npv || 0).toLocaleString('ar-SA'))] }),
            new TableCell({ children: [new Paragraph((scenarios.best?.npv || 0).toLocaleString('ar-SA'))] }),
            new TableCell({ children: [new Paragraph((scenarios.worst?.npv || 0).toLocaleString('ar-SA'))] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('IRR (%)')] }),
            new TableCell({ children: [new Paragraph(`${(scenarios.base?.irr || 0).toFixed(1)}%`)] }),
            new TableCell({ children: [new Paragraph(`${(scenarios.best?.irr || 0).toFixed(1)}%`)] }),
            new TableCell({ children: [new Paragraph(`${(scenarios.worst?.irr || 0).toFixed(1)}%`)] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Payback (سنة)')] }),
            new TableCell({ children: [new Paragraph(`${(scenarios.base?.payback || 0).toFixed(1)}`)] }),
            new TableCell({ children: [new Paragraph(`${(scenarios.best?.payback || 0).toFixed(1)}`)] }),
            new TableCell({ children: [new Paragraph(`${(scenarios.worst?.payback || 0).toFixed(1)}`)] })
          ]
        })
      ]
    });
  }

  /**
   * جدول المخاطر
   */
  createRisksTable(risks) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: 'الخطر', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'الاحتمالية', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'التأثير', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'خطة التخفيف', bold: true })] })
          ]
        }),
        ...risks.map(risk => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(risk.description || '')] }),
            new TableCell({ children: [new Paragraph(risk.probability || 'N/A')] }),
            new TableCell({ children: [new Paragraph(risk.impact || 'N/A')] }),
            new TableCell({ children: [new Paragraph(risk.mitigation || 'N/A')] })
          ]
        }))
      ]
    });
  }

  /**
   * تحميل Blob
   */
  downloadBlob(blob, fileName) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
```

---

## 3. QR Code للمشاركة - التنفيذ الكامل

### 3.1 التثبيت

```bash
npm install qrcode --save
```

### 3.2 الملف الجديد: `web/js/utils/qrGenerator.js`

```javascript
/**
 * QR Code Generator
 * توليد QR code لمشاركة دراسة الجدوى
 */

import QRCode from 'qrcode';

export class QRGenerator {
  /**
   * توليد QR code لدراسة معينة
   * @param {string} studyId - معرّف الدراسة
   * @param {object} options - خيارات إضافية
   * @returns {Promise<string>} - Data URL للصورة
   */
  static async generate(studyId, options = {}) {
    try {
      // بناء رابط المشاركة
      const shareUrl = `${window.location.origin}/share/${studyId}`;
      
      // خيارات QR Code
      const qrOptions = {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: options.color || '#1E40AF',
          light: '#FFFFFF'
        },
        width: options.size || 300
      };

      // توليد QR code كـ Data URL
      const dataUrl = await QRCode.toDataURL(shareUrl, qrOptions);
      
      return { success: true, dataUrl, shareUrl };
    } catch (error) {
      console.error('خطأ في توليد QR Code:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * توليد QR code وإرجاعه كـ Canvas
   */
  static async generateToCanvas(canvas, studyId, options = {}) {
    try {
      const shareUrl = `${window.location.origin}/share/${studyId}`;
      
      await QRCode.toCanvas(canvas, shareUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: options.color || '#1E40AF',
          light: '#FFFFFF'
        },
        width: options.size || 300
      });
      
      return { success: true, shareUrl };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * تحميل QR code كصورة
   */
  static downloadQRCode(dataUrl, fileName = 'qr-code.png') {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
```

### 3.3 UI Modal لعرض QR Code

في `web/js/ui/ShareModal.js`:

```javascript
import { QRGenerator } from '../utils/qrGenerator.js';

export class ShareModal {
  constructor() {
    this.modal = null;
  }

  async show(studyId, studyName) {
    // توليد QR code
    const result = await QRGenerator.generate(studyId);
    
    if (!result.success) {
      alert('فشل توليد رمز QR. حاول مرة أخرى.');
      return;
    }

    // بناء modal
    this.modal = document.createElement('div');
    this.modal.className = 'qr-modal-overlay';
    this.modal.innerHTML = `
      <div class="qr-modal">
        <div class="qr-modal-header">
          <h3>مشاركة الدراسة</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="qr-modal-body">
          <p>امسح رمز QR لعرض الدراسة:</p>
          <img src="${result.dataUrl}" alt="QR Code" class="qr-image">
          <div class="share-url">
            <input type="text" value="${result.shareUrl}" readonly>
            <button class="copy-btn">نسخ</button>
          </div>
          <div class="qr-actions">
            <button class="download-qr-btn">تحميل QR Code</button>
            <button class="close-modal-btn">إغلاق</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindEvents(result.dataUrl, result.shareUrl, studyName);
  }

  bindEvents(dataUrl, shareUrl, studyName) {
    // إغلاق
    this.modal.querySelector('.close-btn').onclick = () => this.close();
    this.modal.querySelector('.close-modal-btn').onclick = () => this.close();
    this.modal.querySelector('.qr-modal-overlay').onclick = (e) => {
      if (e.target.classList.contains('qr-modal-overlay')) this.close();
    };

    // نسخ الرابط
    this.modal.querySelector('.copy-btn').onclick = () => {
      const input = this.modal.querySelector('input');
      input.select();
      document.execCommand('copy');
      alert('تم نسخ الرابط!');
    };

    // تحميل QR Code
    this.modal.querySelector('.download-qr-btn').onclick = () => {
      const fileName = `${studyName}_qr.png`;
      QRGenerator.downloadQRCode(dataUrl, fileName);
    };
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}
```

### 3.4 CSS للـ Modal

في `web/css/share-modal.css`:

```css
.qr-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.qr-modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.qr-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.qr-modal-header h3 {
  margin: 0;
  font-size: 20px;
  color: #1E40AF;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #6B7280;
}

.qr-modal-body {
  text-align: center;
}

.qr-image {
  max-width: 100%;
  height: auto;
  margin: 20px 0;
  border: 2px solid #E5E7EB;
  border-radius: 8px;
}

.share-url {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.share-url input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
  font-size: 14px;
  direction: ltr;
  text-align: left;
}

.share-url button {
  padding: 8px 16px;
  background: #1E40AF;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.share-url button:hover {
  background: #1E3A8A;
}

.qr-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.qr-actions button {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.download-qr-btn {
  background: #10B981;
  color: white;
}

.download-qr-btn:hover {
  background: #059669;
}

.close-modal-btn {
  background: #E5E7EB;
  color: #374151;
}

.close-modal-btn:hover {
  background: #D1D5DB;
}
```

---

## 4. نسخ مشروع (Duplicate) - التنفيذ

### 4.1 تحديث DataService

في `web/js/services/DataService.js`:

```javascript
/**
 * نسخ دراسة موجودة
 * @param {string} studyId - معرّف الدراسة المراد نسخها
 * @param {object} options - خيارات النسخ
 * @returns {Promise<object>} - الدراسة الجديدة
 */
async duplicateStudy(studyId, options = {}) {
  try {
    // جلب الدراسة الأصلية
    const originalStudy = await this.getStudy(studyId);
    
    if (!originalStudy) {
      throw new Error('الدراسة غير موجودة');
    }

    // نسخ البيانات
    const newStudy = JSON.parse(JSON.stringify(originalStudy));
    
    // تعديل البيانات الأساسية
    delete newStudy.id;
    newStudy.projectInfo.projectName = `نسخة من ${originalStudy.projectInfo.projectName}`;
    newStudy.createdAt = new Date().toISOString();
    newStudy.updatedAt = new Date().toISOString();
    newStudy.status = 'draft';
    
    // إذا كان المستخدم يريد نسخ الهيكل فقط (بدون أرقام)
    if (options.structureOnly) {
      newStudy.financial = this.clearFinancialData(newStudy.financial);
      newStudy.financialResults = null;
    }

    // حفظ الدراسة الجديدة
    const savedStudy = await this.saveStudy(newStudy);
    
    return { success: true, study: savedStudy };
  } catch (error) {
    console.error('خطأ في نسخ الدراسة:', error);
    return { success: false, error: error.message };
  }
}

/**
 * مسح البيانات المالية (للنسخ الهيكلي)
 */
clearFinancialData(financial) {
  if (!financial) return null;
  
  const cleared = { ...financial };
  
  // مسح الأرقام من الإيرادات
  if (cleared.revenueStreams) {
    cleared.revenueStreams = cleared.revenueStreams.map(rev => ({
      ...rev,
      price: 0,
      quantity: 0
    }));
  }
  
  // مسح التكاليف
  if (cleared.capex) {
    cleared.capex = cleared.capex.map(item => ({ ...item, amount: 0 }));
  }
  
  // إلخ...
  
  return cleared;
}
```

### 4.2 UI للنسخ

إضافة زر "نسخ" في قائمة المشاريع:

```javascript
// في web/js/ui/ProjectList.js
renderProjectCard(study) {
  return `
    <div class="project-card" data-id="${study.id}">
      <h4>${study.projectInfo.projectName}</h4>
      <p>${study.status}</p>
      <div class="project-actions">
        <button class="open-btn" data-id="${study.id}">فتح</button>
        <button class="duplicate-btn" data-id="${study.id}">نسخ</button>
        <button class="delete-btn" data-id="${study.id}">حذف</button>
      </div>
    </div>
  `;
}

bindEvents() {
  // ... أحداث أخرى
  
  document.querySelectorAll('.duplicate-btn').forEach(btn => {
    btn.onclick = async () => {
      const studyId = btn.dataset.id;
      
      const confirm = await this.showDuplicateModal();
      if (!confirm) return;
      
      const result = await DataService.duplicateStudy(studyId, {
        structureOnly: confirm.structureOnly
      });
      
      if (result.success) {
        alert('تم النسخ بنجاح!');
        this.refresh();
      } else {
        alert(`فشل النسخ: ${result.error}`);
      }
    };
  });
}

showDuplicateModal() {
  return new Promise((resolve) => {
    // عرض modal لتأكيد النسخ واختيار: كامل أم هيكل فقط
    // ...
  });
}
```

---

## 5. سلة المحذوفات - التنفيذ

### 5.1 تحديث جدول Supabase

```sql
ALTER TABLE feasibility_studies 
ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;

CREATE INDEX idx_deleted_at ON feasibility_studies(deleted_at);
```

### 5.2 تحديث DataService

```javascript
/**
 * حذف دراسة (soft delete)
 */
async deleteStudy(studyId) {
  try {
    const { error } = await supabase
      .from('feasibility_studies')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', studyId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * استرجاع دراسة من السلة
 */
async restoreStudy(studyId) {
  try {
    const { error } = await supabase
      .from('feasibility_studies')
      .update({ deleted_at: null })
      .eq('id', studyId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * حذف نهائي
 */
async permanentlyDeleteStudy(studyId) {
  try {
    const { error } = await supabase
      .from('feasibility_studies')
      .delete()
      .eq('id', studyId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * جلب المشاريع المحذوفة
 */
async getDeletedStudies() {
  try {
    const { data, error } = await supabase
      .from('feasibility_studies')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    
    if (error) throw error;
    return { success: true, studies: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 5.3 صفحة سلة المحذوفات

في `web/js/ui/TrashView.js`:

```javascript
export class TrashView {
  constructor() {
    this.container = null;
  }

  async render() {
    const result = await DataService.getDeletedStudies();
    
    if (!result.success) {
      return `<p>خطأ في جلب المحذوفات: ${result.error}</p>`;
    }

    const studies = result.studies || [];

    return `
      <div class="trash-view">
        <h2>🗑️ سلة المحذوفات</h2>
        <p>سيتم حذف المشاريع نهائياً بعد 30 يوماً</p>
        
        ${studies.length === 0 ? 
          '<p>السلة فارغة</p>' :
          studies.map(study => this.renderTrashItem(study)).join('')
        }
      </div>
    `;
  }

  renderTrashItem(study) {
    const deletedDate = new Date(study.deleted_at);
    const daysLeft = 30 - Math.floor((Date.now() - deletedDate) / (1000 * 60 * 60 * 24));

    return `
      <div class="trash-item">
        <div class="trash-info">
          <h4>${study.data.projectInfo.projectName}</h4>
          <p>محذوف منذ: ${deletedDate.toLocaleDateString('ar-SA')}</p>
          <p class="days-left">سيُحذف نهائياً بعد ${daysLeft} يوم</p>
        </div>
        <div class="trash-actions">
          <button class="restore-btn" data-id="${study.id}">استرجاع</button>
          <button class="permanent-delete-btn" data-id="${study.id}">حذف نهائياً</button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    document.querySelectorAll('.restore-btn').forEach(btn => {
      btn.onclick = async () => {
        const studyId = btn.dataset.id;
        const result = await DataService.restoreStudy(studyId);
        
        if (result.success) {
          alert('تم الاسترجاع بنجاح!');
          this.refresh();
        } else {
          alert(`فشل الاسترجاع: ${result.error}`);
        }
      };
    });

    document.querySelectorAll('.permanent-delete-btn').forEach(btn => {
      btn.onclick = async () => {
        const studyId = btn.dataset.id;
        
        if (!confirm('هل أنت متأكد من الحذف النهائي؟ لا يمكن التراجع عن هذا الإجراء.')) {
          return;
        }
        
        const result = await DataService.permanentlyDeleteStudy(studyId);
        
        if (result.success) {
          alert('تم الحذف نهائياً');
          this.refresh();
        } else {
          alert(`فشل الحذف: ${result.error}`);
        }
      };
    });
  }
}
```

---

## 6. ملاحظات التنفيذ النهائية

### 6.1 الأولوية

1. **PowerPoint Export** - ابدأ هنا (أهم ميزة)
2. **QR Code** - سريع التنفيذ (يوم واحد)
3. **نسخ مشروع** - مفيد جداً
4. **Word Export** - قد يستغرق وقتاً أطول
5. **سلة المحذوفات** - أمان مهم

### 6.2 الاختبار

- اختبر كل ميزة مع بيانات حقيقية
- تحقق من الأداء مع دراسات كبيرة
- اختبر على متصفحات مختلفة

### 6.3 التوثيق

- أضف دليل استخدام لكل ميزة
- حدّث CHANGELOG
- أضف أمثلة في README

---

**الخطوة التالية:** ابدأ بتنفيذ PowerPoint Export كنموذج أولي واختبره مع دراسة كاملة.

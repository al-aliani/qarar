export function buildRecommendations({ inputs, outputs, qa, sensitivity }) {
  const actions = [];
  const push = (title, reason, impact, priority) => {
    actions.push({ title, reason, impact, priority });
  };

  const kpis = outputs?.base?.kpis || {};
  const base = outputs?.base || {};
  const costs = inputs?.costs || {}; // Input assumptions
  const labor = inputs?.labor || {};
  const financing = inputs?.financing || {};
  
  // --- 1. Operational Efficiency (Inputs based) ---

  // Food Cost
  const fcPct = costs.foodCostPct || 0;
  if (fcPct > 32) {
    push(
      "تحسين تكلفة المواد الخام (Food Cost)",
      `نسبة تكلفة الطعام الحالية (${fcPct}%) تتجاوز المعدل الصحي للمطاعم (28-32%).`,
      "تحسين هامش الربح الإجمالي بشكل مباشر.",
      "High"
    );
  }

  // Waste
  const wastePct = costs.wastePct || 0;
  if (wastePct > 3) {
    push(
      "ضبط الهدر (Waste)",
      `نسبة الهدر (${wastePct}%) مرتفعة. المعدل المستهدف يجب أن يكون أقل من 2-3%.`,
      "تقليل التكاليف المتغيرة.",
      "Medium"
    );
  }

  // --- 2. Financial Health (Outputs based) ---

  // Labor Cost % of Revenue (Year 1)
  const revY1 = base.revenue?.[0] || 1;
  const laborY1 = base.laborCost?.[0] || 0; // Ensure this field exists in base output
  const laborPct = (laborY1 / revY1) * 100;
  
  if (laborPct > 30) {
    push(
      "مراجعة تكاليف العمالة",
      `تكلفة العمالة تمثل ${laborPct.toFixed(1)}% من الإيراد في السنة الأولى (المستهدف 20-25%).`,
      "تحسين صافي الربح وتقليل المخاطر التشغيلية.",
      "High"
    );
  }

  // Rent % of Revenue (Year 1)
  const rentY1 = (base.opexFixedMonthly || []).find(x => x.name.includes("إيجار") || x.name.includes("Rent"))?.monthly * 12 || 0;
  if (rentY1 > 0) {
    const rentPct = (rentY1 / revY1) * 100;
    if (rentPct > 15) {
      push(
        "تفاوض على الإيجار",
        `الإيجار يمثل ${rentPct.toFixed(1)}% من الإيراد المتوقع (المستهدف < 10-12%).`,
        "تقليل نقطة التعادل وتقليل المخاطر الثابتة.",
        "High"
      );
    }
  }

  // Marketing Spending
  const marketingY1 = (base.opex || []).find(x => x.name.includes("تسويق") || x.name.includes("Market"))?.annual || 0;
  const markPct = (marketingY1 / revY1) * 100;
  if (markPct < 2) {
    push(
      "زيادة ميزانية التسويق",
      `ميزانية التسويق (${markPct.toFixed(1)}%) قد تكون منخفضة جداً للإطلاق (الموصى به 3-5%).`,
      "تسريع الوصول لنقطة التعادل وبناء قاعدة عملاء.",
      "Medium"
    );
  }

  // --- 3. Investment & Returns ---

  // Payback Period
  if (kpis.payback > 4) {
    push(
      "تسريع فترة الاسترداد",
      `فترة الاسترداد المتوقعة (${kpis.payback.toFixed(1)} سنوات) طويلة نسبياً لمطعم.`,
      "تقليل مخاطر الاستثمار وزيادة السيولة.",
      "High"
    );
  }

  // Break-even
  const beOrders = outputs?.breakeven?.ordersPerDay || 0;
  // Heuristic: Check if BE is too high relative to capacity (assuming simple capacity check if data exists)
  // For now, just a generic check if BE is very high
  if (beOrders > 80 && inputs?.channels?.dineIn?.ordersPerDay < 100) {
     push(
      "تحليل نقطة التعادل",
      `المشروع يحتاج ${beOrders.toFixed(0)} طلب يومياً للتعادل، وهو رقم مرتفع مقارنة بالتوقعات.`,
      "مراجعة هيكل التكاليف الثابتة.",
      "High"
    );
  }

  // QA Warnings Integration
  if (qa?.softWarnings?.length > 0) {
    qa.softWarnings.forEach(w => {
      push(
        `معالجة تحذير: ${w.code || "تنبيه عام"}`,
        w.message || "تنبيه من نظام التحقق.",
        "تحسين دقة الدراسة وموثوقيتها.",
        "Medium"
      );
    });
  }

  return actions.sort((a, b) => (a.priority === "High" ? -1 : 1));
}

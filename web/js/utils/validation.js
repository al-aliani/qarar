/**
 * التحقق من صحة بيانات الدراسة (Validation).
 * للاستخدام قبل الحفظ أو في النماذج الحرجة.
 * Schema-based checks for types and ranges to avoid NaN and garbage results in the engine.
 *
 * @example
 * const { valid, errors } = validateStudy(store.getState());
 * if (!valid) console.warn('تحذيرات التحقق:', errors);
 */

const num = (v, def) => (v != null && v !== '' ? Number(v) : def);

/**
 * @param {object} p - projectInfo
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProjectInfo(p) {
  const err = [];
  if (!p || typeof p !== 'object') return { valid: false, errors: ['بيانات المشروع مفقودة'] };
  if (typeof p.name === 'string' && p.name.trim().length === 0 && (p.description || p.concept)) {
    err.push('اسم المشروع فارغ بينما يوجد وصف أو فكرة');
  }
  const area = num(p.areaSize, null);
  if (area != null && (Number.isNaN(area) || area < 0)) {
    err.push('مساحة المشروع يجب أن تكون رقماً موجباً');
  }
  return { valid: err.length === 0, errors: err };
}

/**
 * @param {object} a - assumptions
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAssumptions(a) {
  const err = [];
  if (!a || typeof a !== 'object') return { valid: true, errors: [] };
  const tax = num(a.taxRate, 0.15);
  if (!Number.isNaN(tax) && (tax < 0 || tax > 1)) err.push('نسبة الضريبة يجب أن تكون بين 0 و 100%');
  const disc = num(a.discountRate, null);
  if (disc == null || Number.isNaN(disc)) err.push('معدل الخصم مطلوب حتى تكون مؤشرات NPV وIRR قابلة للاعتماد');
  if (!Number.isNaN(disc) && (disc < 0 || disc > 0.5)) err.push('معدل الخصم يجب أن يكون بين 0 و 50%');
  const inf = num(a.inflationRate, 0.02);
  if (!Number.isNaN(inf) && (inf < 0 || inf > 0.2)) err.push('معدل التضخم يقترح أن يكون بين 0 و 20%');
  const years = num(a.projectionYears, num(a.years, 5));
  if (!Number.isNaN(years) && (years < 1 || years > 30)) err.push('سنوات التخطيط يجب أن تكون بين 1 و 30');
  const wc = num(a.workingCapitalMonths, null);
  if (wc == null || Number.isNaN(wc)) err.push('أشهر رأس المال العامل مطلوبة حتى لا تُخفى مخاطر السيولة');
  if (wc != null && !Number.isNaN(wc) && (wc < 0 || wc > 24)) err.push('أشهر رأس المال العامل يقترح أن تكون بين 0 و 24');
  return { valid: err.length === 0, errors: err };
}

/**
 * @param {Array} streams - revenue.streams or services.items (for revenue use)
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRevenueStreams(streams) {
  const err = [];
  if (!Array.isArray(streams)) return { valid: true, errors: [] };
  streams.forEach((s, i) => {
    const label = s.name || s.service || (i + 1);
    const price = num(s.avgPrice, num(s.price, num(s.pricePerUnit, null)));
    if (price != null && (Number.isNaN(price) || price < 0)) {
      err.push(`مصدر الإيراد "${label}": السعر يجب أن يكون رقماً موجباً`);
    }
    // سعر صفر مع عملاء = إيراد وهمي صفري يمر بصمت
    if (price === 0 && num(s.customersPerMonth, 0) > 0) {
      err.push(`مصدر الإيراد "${label}": السعر صفر رغم وجود عملاء — أدخل السعر الفعلي`);
    }
    const growth = num(s.growthRate, null);
    if (growth != null && !Number.isNaN(growth) && (growth < -0.5 || growth > 1)) {
      err.push(`مصدر الإيراد "${label}": معدل النمو ${Math.round(growth * 100)}% خارج النطاق الواقعي (-50% إلى 100%) — هل قصدت ${Math.round(growth)}%؟ (النسبة تُدخل كنسبة مئوية)`);
    }
    const variableCost = num(s.variableCostPerUnit, null);
    if (variableCost != null && price != null && variableCost > price) {
      err.push(`مصدر الإيراد "${label}": التكلفة المتغيرة للوحدة أعلى من سعر البيع — راجع الهامش.`);
    }
    const vol = num(s.customersPerMonth, num(s.expectedDailySales, null));
    if (vol != null && !Number.isNaN(vol) && vol < 0) {
      err.push(`مصدر الإيراد "${label}": حجم المبيعات لا يمكن أن يكون سالباً`);
    }
    if (vol === 0 && price != null && price > 0) {
      err.push(`مصدر الإيراد "${label}": عدد العملاء صفر رغم وجود سعر — أدخل حجم المبيعات المتوقع`);
    }
  });
  return { valid: err.length === 0, errors: err };
}

/**
 * @param {object} fin - financing
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFinancing(fin) {
  const err = [];
  if (!fin || typeof fin !== 'object') return { valid: true, errors: [] };
  const src = fin.sources || {};
  const eq = num(src.equity?.amount, null);
  if (eq != null && !Number.isNaN(eq) && eq < 0) err.push('مبلغ التمويل الذاتي لا يمكن أن يكون سالباً');
  // تدقيق 2026-07-08 (ملاحظة متوسطة #38): كان التحقق من عدم السلبية يغطي التمويل
  // الذاتي والقرض فقط — حقلا المستثمرون والدعم الحكومي بلا أي تحقق فتمرّ قيمة
  // سالبة بصمت إلى إجمالي التمويل والنسب.
  const investors = num(src.investors?.amount, null);
  if (investors != null && !Number.isNaN(investors) && investors < 0) err.push('مبلغ تمويل المستثمرين لا يمكن أن يكون سالباً');
  const govt = num(src.governmentSupport?.amount, null);
  if (govt != null && !Number.isNaN(govt) && govt < 0) err.push('مبلغ الدعم الحكومي لا يمكن أن يكون سالباً');
  const loan = src.bankLoan;
  if (loan && typeof loan === 'object') {
    const amt = num(loan.amount, null);
    if (amt != null && !Number.isNaN(amt) && amt < 0) err.push('مبلغ القرض لا يمكن أن يكون سالباً');
    const rate = num(loan.interestRate, null);
    if (rate != null && !Number.isNaN(rate) && (rate < 0 || rate > 0.5)) err.push('سعر الفائدة يقترح أن يكون بين 0 و 50%');
    const term = num(loan.termYears, null);
    if (term != null && !Number.isNaN(term) && (term < 1 || term > 30)) err.push('مدة القرض يقترح أن تكون بين 1 و 30 سنة');
    // تدقيق 2026-07-08 (ملاحظة متوسطة #36): فترة سماح ≥ مدة القرض بالأشهر تُنتج
    // في computeLoanSchedule جدول سداد لا يُسدَّد فيه أي أصل إطلاقاً طوال المدة
    // (كل الأشهر تُحتسَب "سماحاً") — رصيد ختامي يبقى كامل مبلغ القرض دون أي تنبيه.
    const grace = num(loan.gracePeriodMonths, null);
    if (grace != null && !Number.isNaN(grace) && term != null && !Number.isNaN(term) && grace >= term * 12) {
      err.push(`فترة السماح (${grace} شهراً) يجب أن تكون أقل من مدة القرض بالأشهر (${term * 12} شهراً)، وإلا لن يُسدَّد أي أصل من القرض`);
    }
  }
  return { valid: err.length === 0, errors: err };
}

/**
 * @param {Array} contracts - keyPeople.partnershipContracts
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePartnershipContracts(contracts) {
  const err = [];
  if (!Array.isArray(contracts) || contracts.length === 0) return { valid: true, errors: [] };
  const total = contracts.reduce((sum, c) => {
    const share = num(c?.sharePercent, 0);
    return sum + (Number.isNaN(share) ? 0 : share);
  }, 0);
  if (total > 100) {
    err.push(`مجموع نسب ملكية الشركاء (${total}%) يتجاوز 100%`);
  }
  return { valid: err.length === 0, errors: err };
}

/**
 * @param {object} section - e.g. technical, hr
 * @param {string} sectionName - for error messages
 * @param {Array<string>} amountKeys - keys that must be non‑negative (e.g. price, quantity, salary, monthly)
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSectionAmounts(section, sectionName, amountKeys) {
  const err = [];
  if (!section || typeof section !== 'object') return { valid: true, errors: [] };
  const checkRow = (row, i) => {
    if (!row || typeof row !== 'object') return;
    amountKeys.forEach(k => {
      const v = num(row[k], null);
      if (v != null && !Number.isNaN(v) && v < 0) {
        err.push(`${sectionName}: بند ${i + 1} - "${k}" لا يمكن أن يكون سالباً`);
      }
    });
  };
  const walk = (obj) => {
    if (Array.isArray(obj)) {
      obj.forEach((row, i) => checkRow(row, i));
      return;
    }
    if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(val => {
        if (Array.isArray(val)) val.forEach((row, i) => checkRow(row, i));
        else if (val && typeof val === 'object') walk(val);
      });
    }
  };
  walk(section);
  return { valid: err.length === 0, errors: err };
}

/**
 * @param {object} state - حالة الدراسة الكاملة
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateStudy(state) {
  const all = [];
  const p = validateProjectInfo(state?.projectInfo);
  const a = validateAssumptions(state?.assumptions || state?.financial?.assumptions);
  const r = validateRevenueStreams(state?.revenue?.streams || state?.financial?.revenue?.streams || []);
  const f = validateFinancing(state?.financing);
  const pc = validatePartnershipContracts(state?.keyPeople?.partnershipContracts || state?.partnershipContracts);

  // If revenue is empty, also validate services.items when used as revenue source
  const streams = state?.revenue?.streams || state?.financial?.revenue?.streams || [];
  if (streams.length === 0 && state?.services?.items?.length > 0) {
    const srv = validateRevenueStreams(state.services.items);
    all.push(...srv.errors);
  }

  all.push(...p.errors, ...a.errors, ...r.errors, ...f.errors, ...pc.errors);

  // Technical: price, quantity, amount
  const tech = validateSectionAmounts(state?.technical, 'الدراسة الفنية', ['price', 'quantity', 'amount']);
  all.push(...tech.errors);

  // HR: salary, count, months
  const hr = validateSectionAmounts(state?.hr, 'الموارد البشرية', ['salary', 'count', 'months']);
  all.push(...hr.errors);

  // Legal: price, quantity
  const legal = validateSectionAmounts(state?.legal, 'الدراسة القانونية', ['price', 'quantity']);
  all.push(...legal.errors);

  // techResources, logistics, administrative: منع التكاليف السالبة
  const techR = validateSectionAmounts(state?.techResources, 'الموارد التقنية', ['price', 'quantity']);
  all.push(...techR.errors);
  const log = validateSectionAmounts(state?.logistics, 'الموارد اللوجستية', ['monthly']);
  all.push(...log.errors);
  const adm = validateSectionAmounts(state?.administrative, 'الموارد الإدارية', ['monthly']);
  all.push(...adm.errors);

  // التسويق: amount, monthly
  const mkt = validateSectionAmounts(state?.marketing, 'الدراسة التسويقية', ['amount', 'monthly']);
  all.push(...mkt.errors);

  return { valid: all.length === 0, errors: all };
}

(function () {
    const digitMap = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
    const parseNum = (raw) => {
        const normalized = String(raw || '')
            .replace(/[٠-٩۰-۹]/g, (character) => digitMap[character] || character)
            .replace(/٫/g, '.')
            .replace(/[,\s ]/g, '')
            .trim();
        return normalized === '' ? NaN : Number(normalized);
    };
    const formatter = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 });
    const formatCurrency = (value) => `${formatter.format(Math.round(value))} ريال`;
    const form = document.getElementById('hbCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('hbCalcResult');
    const mainElement = document.getElementById('hbResultMain');
    const detailElement = document.getElementById('hbResultDetail');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const employeeCost = parseNum(form.employeeCost.value);
        const marginPct = parseNum(form.marginPct.value);

        if (![employeeCost, marginPct].every(Number.isFinite)) {
            showError('عبّئ الحقلين بأرقام صحيحة.');
            return;
        }
        if (employeeCost <= 0) {
            showError('تكلفة الموظف لازم تكون أكبر من صفر.');
            return;
        }
        if (marginPct <= 0 || marginPct >= 100) {
            showError('هامش الربح لازم يكون رقمًا بين 1 و99.');
            return;
        }

        const requiredRevenue = employeeCost / (marginPct / 100);
        mainElement.textContent = formatCurrency(requiredRevenue);
        detailElement.textContent = `بهامش ربح ${formatter.format(marginPct)}%، تحتاج ${formatCurrency(requiredRevenue)} إيراد إضافي شهريًا فقط لتغطية تكلفة الموظف (${formatCurrency(employeeCost)}) — أي إيراد فوق هذا الرقم هو الربح الفعلي من التوظيف.`;

        resultElement.style.display = '';
    });
})();

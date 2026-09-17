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
    const ratioFormatter = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 });
    const formatCurrency = (value) => `${formatter.format(Math.round(value))} ريال`;
    const form = document.getElementById('lcCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('lcCalcResult');
    const ratioElement = document.getElementById('lcResultRatio');
    const detailElement = document.getElementById('lcResultDetail');
    const warningElement = document.getElementById('lcWarning');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const monthlyProfit = parseNum(form.monthlyProfit.value);
        const installment = parseNum(form.installment.value);

        if (![monthlyProfit, installment].every(Number.isFinite)) {
            showError('عبّئ الحقلين بأرقام صحيحة.');
            return;
        }
        if (installment <= 0) {
            showError('القسط الشهري لازم يكون أكبر من صفر.');
            return;
        }

        const ratio = monthlyProfit / installment;
        const remaining = monthlyProfit - installment;

        ratioElement.textContent = `${ratioFormatter.format(ratio)}×`;

        if (ratio >= 1) {
            ratioElement.style.color = 'var(--c-success,#0e5b44)';
            detailElement.textContent = `يعني ربحك الشهري يغطي القسط ${ratioFormatter.format(ratio)} مرة — يتبقى لك ${formatCurrency(remaining)} شهريًا بعد سداد القسط.`;
            warningElement.style.display = 'none';
        } else {
            ratioElement.style.color = 'var(--c-danger,#c0392b)';
            detailElement.textContent = `القسط الشهري (${formatCurrency(installment)}) يفوق ربحك الشهري (${formatCurrency(monthlyProfit)}).`;
            warningElement.textContent = `هذا التمويل غير مستدام بأرقامك الحالية — القسط يتجاوز ربحك بمقدار ${formatCurrency(Math.abs(remaining))} شهريًا.`;
            warningElement.style.color = 'var(--c-danger,#c0392b)';
            warningElement.style.display = '';
        }

        resultElement.style.display = '';
    });
})();

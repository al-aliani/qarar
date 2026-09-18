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
    const form = document.getElementById('scCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('scCalcResult');
    const totalElement = document.getElementById('scResultTotal');
    const breakdownElement = document.getElementById('scResultBreakdown');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const setupCost = parseNum(form.setupCost.value);
        const licenseCost = parseNum(form.licenseCost.value);
        const inventoryCost = parseNum(form.inventoryCost.value);
        const monthlyFixed = parseNum(form.monthlyFixed.value);
        const bufferMonths = parseNum(form.bufferMonths.value);

        if (![setupCost, licenseCost, inventoryCost, monthlyFixed, bufferMonths].every(Number.isFinite)) {
            showError('عبّئ الحقول الخمسة بأرقام صحيحة.');
            return;
        }
        if ([setupCost, licenseCost, inventoryCost, monthlyFixed, bufferMonths].some((value) => value < 0)) {
            showError('كل القيم لازم تكون صفر أو أكبر.');
            return;
        }

        const oneTimeCosts = setupCost + licenseCost + inventoryCost;
        const operatingBuffer = monthlyFixed * bufferMonths;
        const total = oneTimeCosts + operatingBuffer;

        totalElement.textContent = formatCurrency(total);
        breakdownElement.textContent = `${formatCurrency(oneTimeCosts)} تكاليف تأسيس لمرة واحدة + ${formatCurrency(operatingBuffer)} احتياطي تشغيل لـ${formatter.format(bufferMonths)} شهر.`;

        resultElement.style.display = '';
    });
})();

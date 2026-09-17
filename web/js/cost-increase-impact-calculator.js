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
    const formatter = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 });
    const formatCurrency = (value) => `${formatter.format(value)} ريال`;
    const form = document.getElementById('ciCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('ciCalcResult');
    const newCostElement = document.getElementById('ciNewCost');
    const profitDropElement = document.getElementById('ciProfitDrop');
    const lossWarningElement = document.getElementById('ciLossWarning');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const price = parseNum(form.price.value);
        const currentCost = parseNum(form.currentCost.value);
        const increasePct = parseNum(form.increasePct.value);
        const monthlyUnits = parseNum(form.monthlyUnits.value);

        if (![price, currentCost, increasePct, monthlyUnits].every(Number.isFinite)) {
            showError('عبّئ الحقول الأربعة بأرقام صحيحة.');
            return;
        }
        if (price <= 0 || currentCost < 0 || monthlyUnits <= 0) {
            showError('سعر البيع وعدد الوحدات لازم يكونا أكبر من صفر، والتكلفة الحالية صفر أو أكبر.');
            return;
        }
        if (increasePct <= 0) {
            showError('نسبة الارتفاع لازم تكون أكبر من صفر — هذي الأداة مخصصة لسيناريو ارتفاع التكلفة تحديدًا.');
            return;
        }

        const newCost = currentCost * (1 + increasePct / 100);
        const costDelta = newCost - currentCost;
        const monthlyProfitDrop = costDelta * monthlyUnits;

        newCostElement.textContent = `${formatCurrency(newCost)} (بزيادة ${formatCurrency(costDelta)} عن الحالي)`;
        profitDropElement.textContent = `−${formatCurrency(monthlyProfitDrop)} شهريًا`;

        if (newCost >= price) {
            lossWarningElement.textContent = `بهذا الارتفاع، تكلفتك الجديدة (${formatCurrency(newCost)}) تساوي أو تتجاوز سعر بيعك (${formatCurrency(price)}) — ستبيع بخسارة على كل وحدة، لا مجرد ربح أقل.`;
            lossWarningElement.style.display = '';
        } else {
            lossWarningElement.style.display = 'none';
        }

        resultElement.style.display = '';
    });
})();

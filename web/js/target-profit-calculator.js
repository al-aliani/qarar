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
    const form = document.getElementById('tpCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('tpCalcResult');
    const labelElement = document.getElementById('tpResultLabel');
    const unitsElement = document.getElementById('tpResultUnits');
    const revenueElement = document.getElementById('tpResultRevenue');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const fixedCosts = parseNum(form.fixedCosts.value);
        const price = parseNum(form.price.value);
        const variableCost = parseNum(form.variableCost.value);
        const targetProfit = parseNum(form.targetProfit.value);

        if (![fixedCosts, price, variableCost, targetProfit].every(Number.isFinite)) {
            showError('عبّئ الحقول الأربعة بأرقام صحيحة.');
            return;
        }
        if (fixedCosts <= 0 || price <= 0 || variableCost < 0 || targetProfit < 0) {
            showError('التكاليف الثابتة وسعر البيع لازم تكون أكبر من صفر، والتكلفة المتغيرة والربح المستهدف صفر أو أكبر.');
            return;
        }
        const contributionMargin = price - variableCost;
        if (contributionMargin <= 0) {
            showError(`تكلفتك المتغيرة (${formatCurrency(variableCost)}) تساوي أو تفوق سعر البيع (${formatCurrency(price)}) — لن تحقق أي ربح بأي كمية مبيعات. راجع السعر أو التكلفة المتغيرة أولًا.`);
            return;
        }

        const targetUnits = Math.ceil((fixedCosts + targetProfit) / contributionMargin);
        labelElement.textContent = 'تحتاج تبيع شهريًا:';
        unitsElement.textContent = `${formatter.format(targetUnits)} وحدة`;
        revenueElement.textContent = `بإيراد شهري ${formatCurrency(targetUnits * price)} لتغطية تكاليفك وتحقيق ${formatCurrency(targetProfit)} ربحًا صافيًا.`;
        resultElement.style.display = '';
    });
})();

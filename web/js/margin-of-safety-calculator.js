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
    const pctFormatter = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 1 });
    const form = document.getElementById('mosCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('mosCalcResult');
    const breakevenElement = document.getElementById('mosBreakevenUnits');
    const labelElement = document.getElementById('mosResultLabel');
    const mainElement = document.getElementById('mosResultMain');
    const detailElement = document.getElementById('mosResultDetail');

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
        const currentSales = parseNum(form.currentSales.value);

        if (![fixedCosts, price, variableCost, currentSales].every(Number.isFinite)) {
            showError('عبّئ الحقول الأربعة بأرقام صحيحة.');
            return;
        }
        if (fixedCosts <= 0 || price <= 0 || variableCost < 0 || currentSales <= 0) {
            showError('التكاليف الثابتة وسعر البيع ومبيعاتك لازم تكون أكبر من صفر، والتكلفة المتغيرة صفر أو أكبر.');
            return;
        }
        const contributionMargin = price - variableCost;
        if (contributionMargin <= 0) {
            showError(`تكلفتك المتغيرة (${formatter.format(variableCost)} ريال) تساوي أو تفوق سعر البيع (${formatter.format(price)} ريال) — لن تصل لنقطة تعادل بأي كمية مبيعات. راجع السعر أو التكلفة المتغيرة أولًا.`);
            return;
        }

        const breakevenUnits = Math.ceil(fixedCosts / contributionMargin);
        breakevenElement.textContent = `${formatter.format(breakevenUnits)} وحدة شهريًا`;

        const marginUnits = currentSales - breakevenUnits;
        if (marginUnits > 0) {
            const marginPct = (marginUnits / currentSales) * 100;
            labelElement.textContent = 'هامش الأمان:';
            mainElement.textContent = `${pctFormatter.format(marginPct)}%`;
            mainElement.style.color = 'var(--c-success,#0e5b44)';
            detailElement.textContent = `تقدر مبيعاتك تنخفض بمقدار ${formatter.format(marginUnits)} وحدة (${pctFormatter.format(marginPct)}%) قبل ما تدخل منطقة الخسارة.`;
        } else {
            labelElement.textContent = 'هامش الأمان:';
            mainElement.textContent = '0%';
            mainElement.style.color = 'var(--c-danger,#c0392b)';
            detailElement.textContent = `مبيعاتك الحالية (${formatter.format(currentSales)} وحدة) عند أو تحت نقطة التعادل (${formatter.format(breakevenUnits)} وحدة) — ما عندك هامش أمان؛ أي انخفاض إضافي بالمبيعات يعني خسارة مباشرة.`;
        }

        resultElement.style.display = '';
    });
})();

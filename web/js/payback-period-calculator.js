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
    const form = document.getElementById('ppCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('ppCalcResult');
    const mainElement = document.getElementById('ppResultMain');
    const detailElement = document.getElementById('ppResultDetail');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const capital = parseNum(form.capital.value);
        const monthlyProfit = parseNum(form.monthlyProfit.value);

        if (![capital, monthlyProfit].every(Number.isFinite)) {
            showError('عبّئ الحقلين بأرقام صحيحة.');
            return;
        }
        if (capital <= 0) {
            showError('رأس المال المستثمر لازم يكون أكبر من صفر.');
            return;
        }
        if (monthlyProfit <= 0) {
            showError('صافي الربح الشهري لازم يكون أكبر من صفر — بربح صفر أو خسارة لن تسترد رأس مالك أبدًا مهما طال الوقت.');
            return;
        }

        const months = Math.ceil(capital / monthlyProfit);
        if (months <= 12) {
            mainElement.textContent = `${formatter.format(months)} شهرًا`;
        } else {
            const years = Math.floor(months / 12);
            const remainingMonths = months % 12;
            mainElement.textContent = remainingMonths === 0
                ? `${formatter.format(years)} سنة`
                : `${formatter.format(years)} سنة و${formatter.format(remainingMonths)} شهر`;
        }
        detailElement.textContent = `بافتراض ثبات صافي ربحك الشهري عند ${formatCurrency(monthlyProfit)} طوال الفترة.`;

        resultElement.style.display = '';
    });
})();

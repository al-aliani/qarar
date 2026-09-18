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
    const pctFormatter = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 1 });
    const formatCurrency = (value) => `${formatter.format(value)} ريال`;
    const form = document.getElementById('cppCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('cppCalcResult');
    const priceElement = document.getElementById('cppResultPrice');
    const profitElement = document.getElementById('cppResultProfit');
    const markupNoteElement = document.getElementById('cppResultMarkupNote');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const unitCost = parseNum(form.unitCost.value);
        const marginPct = parseNum(form.marginPct.value);

        if (![unitCost, marginPct].every(Number.isFinite)) {
            showError('عبّئ الحقلين بأرقام صحيحة.');
            return;
        }
        if (unitCost <= 0) {
            showError('تكلفة الوحدة لازم تكون أكبر من صفر.');
            return;
        }
        if (marginPct <= 0 || marginPct >= 100) {
            showError('هامش الربح لازم يكون رقمًا بين 1 و99 (لا يمكن أن يصل أو يتجاوز 100% من سعر البيع).');
            return;
        }

        const price = unitCost / (1 - marginPct / 100);
        const profitPerUnit = price - unitCost;
        const markupPct = (profitPerUnit / unitCost) * 100;

        priceElement.textContent = formatCurrency(price);
        profitElement.textContent = `ربح ${formatCurrency(profitPerUnit)} على كل وحدة تبيعها.`;
        markupNoteElement.textContent = `هذا يعادل نسبة زيادة ${pctFormatter.format(markupPct)}% على التكلفة (markup) — تختلف عن هامش الربح ${pctFormatter.format(marginPct)}% لأن الأخير مقاس من سعر البيع لا من التكلفة.`;

        resultElement.style.display = '';
    });
})();

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
    const form = document.getElementById('dcCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('dcCalcResult');
    const dailyElement = document.getElementById('dcResultDaily');
    const monthlyElement = document.getElementById('dcResultMonthly');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const targetRevenue = parseNum(form.targetRevenue.value);
        const avgOrderValue = parseNum(form.avgOrderValue.value);
        const workingDays = parseNum(form.workingDays.value);

        if (![targetRevenue, avgOrderValue, workingDays].every(Number.isFinite)) {
            showError('عبّئ الحقول الثلاثة بأرقام صحيحة.');
            return;
        }
        if (targetRevenue <= 0 || avgOrderValue <= 0) {
            showError('الإيراد المستهدف ومتوسط قيمة الطلب لازم يكونان أكبر من صفر.');
            return;
        }
        if (workingDays <= 0 || workingDays > 31) {
            showError('عدد أيام العمل لازم يكون رقمًا بين 1 و31.');
            return;
        }

        const monthlyOrders = Math.ceil(targetRevenue / avgOrderValue);
        const dailyOrders = Math.ceil(monthlyOrders / workingDays);

        dailyElement.textContent = `${formatter.format(dailyOrders)} عميل/طلب يوميًا`;
        monthlyElement.textContent = `بإجمالي ${formatter.format(monthlyOrders)} عميل/طلب شهريًا على مدى ${formatter.format(workingDays)} يوم عمل، لتحقيق ${formatter.format(targetRevenue)} ريال.`;

        resultElement.style.display = '';
    });
})();

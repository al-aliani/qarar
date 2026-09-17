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
    const form = document.getElementById('crCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('crCalcResult');
    const monthlyElement = document.getElementById('crResultMonthly');
    const dailyElement = document.getElementById('crResultDaily');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const units = parseNum(form.units.value);
        const turnsPerDay = parseNum(form.turnsPerDay.value);
        const avgTicket = parseNum(form.avgTicket.value);
        const workingDays = parseNum(form.workingDays.value);

        if (![units, turnsPerDay, avgTicket, workingDays].every(Number.isFinite)) {
            showError('عبّئ الحقول الأربعة بأرقام صحيحة.');
            return;
        }
        if (units <= 0 || turnsPerDay <= 0 || avgTicket <= 0) {
            showError('الوحدات والدورات ومتوسط الفاتورة لازم تكون أكبر من صفر.');
            return;
        }
        if (workingDays <= 0 || workingDays > 31) {
            showError('عدد أيام العمل لازم يكون رقمًا بين 1 و31.');
            return;
        }

        const dailyRevenue = units * turnsPerDay * avgTicket;
        const monthlyRevenue = dailyRevenue * workingDays;

        monthlyElement.textContent = formatCurrency(monthlyRevenue);
        dailyElement.textContent = `بحد أقصى ${formatCurrency(dailyRevenue)} يوميًا، على مدى ${formatter.format(workingDays)} يوم عمل — بافتراض إشغال كامل 100% بلا انقطاع.`;

        resultElement.style.display = '';
    });
})();

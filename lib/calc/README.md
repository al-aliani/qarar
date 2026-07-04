# Calc Engine (`lib/calc`)

محرك حسابات دراسة جدوى **مطاعم السعودية** مبني على مخرجات القالب المعياري:

- P&L
- Cash Flow
- NPV / IRR / Payback
- Break-even
- Sensitivity / Scenarios

## Restaurant layer (تخصيص المطاعم)
- قنوات الإيراد: صالة / تيك أواي / توصيل
- عمولة التوصيل تُطبق **فقط** على إيراد التوصيل
- Food Cost% + Packaging + Waste
- Labor model: ثابت + متغير (per-order أو % من الإيراد)

## Usage

### In browser
بعد تحميل الملف (أو دمجه) ستجد:

- `window.CalcEngine`

### In Node

```js
const Calc = require("./lib/calc");
const out = Calc.computeRestaurantBase(model);
console.log(out.kpis, out.pnl[0]);
```

## Minimal input model
راجع التعليق أعلى `index.js` لشكل المدخلات المقترح.


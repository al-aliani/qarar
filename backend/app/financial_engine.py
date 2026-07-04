"""
محرك الحسابات المالية — مصدر الحقيقة الوحيد (Single Source of Truth) لـ:
NPV, IRR, Payback, Breakeven, Gross Margin.

- لا يعتمد على np.irr (مُزال من numpy الحديث)؛ IRR محسوب بطريقة نيوتن-رافسون.
- اختبارات golden في backend/tests/test_financial_engine.py لضمان ثبات النتائج (GO/NO-GO).
"""
from typing import List, Optional


def npv(rate: float, cash_flows: List[float]) -> float:
    """
    حساب صافي القيمة الحالية NPV

    :param rate: معدل الخصم السنوي (مثال 0.1 يعني 10%)
    :param cash_flows: قائمة التدفقات النقدية بالترتيب الزمني [CF0, CF1, CF2, ...]
    """
    # نستخدم تعريف NPV الرياضي المباشر بدون أي تعقيد
    return float(sum(cf / ((1 + rate) ** t) for t, cf in enumerate(cash_flows)))


def irr(cash_flows: List[float], guess: float = 0.1) -> Optional[float]:
    """
    حساب معدل العائد الداخلي IRR (طريقة نيوتن-رافسون).
    np.irr مُزال من numpy الحديث؛ نستخدم تكراراً عدديّاً بدلاً منه.
    قد يرجع None إذا لم يمكن إيجاد حل مستقر.
    """
    if not cash_flows or len(cash_flows) < 2:
        return None
    cf = [float(x) for x in cash_flows]
    if cf[0] >= 0:
        return None

    def npv_at(r: float) -> float:
        return sum(x / ((1 + r) ** t) for t, x in enumerate(cf))

    rate = guess
    for _ in range(100):
        val = npv_at(rate)
        if abs(val) < 1e-7:
            if -1 < rate < 10:
                return round(rate, 10)
            return None
        deriv = sum(-t * x / ((1 + rate) ** (t + 1)) for t, x in enumerate(cf))
        if abs(deriv) < 1e-15:
            return None
        rate = rate - val / deriv
        if rate <= -1:
            rate = -0.99
        if rate > 10:
            return None
    return round(rate, 10) if abs(npv_at(rate)) < 1e-5 else None


def payback_period(cash_flows: List[float]) -> Optional[float]:
    """
    حساب فترة الاسترداد (Payback Period) بالتقريب الخطي بين السنوات.
    يفترض أن cash_flows[0] هو الاستثمار الابتدائي (غالباً قيمة سالبة).
    """
    cumulative = 0.0
    for t in range(len(cash_flows)):
        cumulative += cash_flows[t]
        if cumulative >= 0:
            # استرداد الاستثمار بين السنة t-1 و t
            if t == 0:
                return 0.0
            prev_cumulative = cumulative - cash_flows[t]
            remaining = -prev_cumulative
            fraction = remaining / cash_flows[t] if cash_flows[t] != 0 else 0
            return (t - 1) + fraction

    return None


def breakeven_quantity(fixed_costs: float, price_per_unit: float, variable_cost_per_unit: float) -> Optional[float]:
    """
    حساب نقطة التعادل (بالوحدات).
    """
    contribution_margin = price_per_unit - variable_cost_per_unit
    if contribution_margin <= 0:
        return None
    return fixed_costs / contribution_margin


def gross_margin(revenue: float, cost_of_goods_sold: float) -> Optional[float]:
    """
    حساب هامش الربح الإجمالي (Gross Margin).
    """
    if revenue == 0:
        return None
    return (revenue - cost_of_goods_sold) / revenue


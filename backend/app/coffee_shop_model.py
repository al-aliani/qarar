from typing import List, Dict, Any

from .financial_engine import npv, irr, payback_period


def _annuity_payment(principal: float, annual_rate: float, years: int) -> float:
    """
    قسط شهري ثابت لقرض (معادل رياضي بسيط).
    """
    if principal <= 0 or annual_rate <= 0 or years <= 0:
        return 0.0
    monthly_rate = annual_rate / 12.0
    n = years * 12
    if monthly_rate == 0:
        return principal / n
    factor = (1 + monthly_rate) ** n
    return principal * monthly_rate * factor / (factor - 1)


def build_monthly_cash_flows(
    investment_initial: float,
    monthly_rent: float,
    monthly_salaries: float,
    monthly_other_fixed: float,
    avg_ticket: float,
    customers_per_day: int,
    days_per_month: int,
    cost_ratio: float,
    months: int = 60,
    monthly_growth_rate: float = 0.0,
    tax_rate: float = 0.0,
    loan_amount: float = 0.0,
    loan_annual_rate: float = 0.0,
    loan_years: int = 0,
    seasonality: Dict[int, float] | None = None,
) -> List[float]:
    """
    يبني قائمة التدفقات النقدية لمشروع كوفي شوب لمدة عدد أشهر محدد (افتراضياً 5 سنوات).

    - الاستثمار الابتدائي (سلبي في الشهر 0).
    - يأخذ في الاعتبار:
      - نمو شهري في المبيعات.
      - معامل موسمية لكل شهر (اختياري).
      - ضرائب على الربح.
      - قسط قرض شهري (إن وجد).
    """
    cash_flows: List[float] = []

    # الشهر 0: استثمار ابتدائي (قيمة سالبة) ناقص القرض (إن وجد)
    net_initial = -abs(investment_initial) + max(loan_amount, 0.0)
    cash_flows.append(net_initial)

    base_monthly_revenue = avg_ticket * customers_per_day * days_per_month
    fixed_costs = monthly_rent + monthly_salaries + monthly_other_fixed

    monthly_loan_payment = _annuity_payment(loan_amount, loan_annual_rate, loan_years) if loan_amount > 0 else 0.0

    for month in range(1, months + 1):
        # نمو مركب بسيط
        growth_multiplier = (1 + monthly_growth_rate) ** (month - 1)

        # موسمية حسب رقم الشهر (1..12) إن وُجدت
        if seasonality and ((month - 1) % 12 + 1) in seasonality:
            season_mult = seasonality[(month - 1) % 12 + 1]
        else:
            season_mult = 1.0

        monthly_revenue = base_monthly_revenue * growth_multiplier * season_mult
        cogs = monthly_revenue * cost_ratio

        profit_before_tax_and_debt = monthly_revenue - cogs - fixed_costs
        tax = max(profit_before_tax_and_debt, 0.0) * tax_rate

        profit_after_tax = profit_before_tax_and_debt - tax - monthly_loan_payment
        cash_flows.append(profit_after_tax)

    return cash_flows


def coffee_shop_feasibility_summary(
    discount_rate: float,
    investment_initial: float,
    monthly_rent: float,
    monthly_salaries: float,
    monthly_other_fixed: float,
    avg_ticket: float,
    customers_per_day: int,
    days_per_month: int,
    cost_ratio: float,
    months: int = 60,
    monthly_growth_rate: float = 0.0,
    tax_rate: float = 0.0,
    loan_amount: float = 0.0,
    loan_annual_rate: float = 0.0,
    loan_years: int = 0,
    seasonality: Dict[int, float] | None = None,
) -> Dict[str, Any]:
    """
    يلخّص نتائج دراسة جدوى لمشروع كوفي شوب مع:
    - نمو المبيعات.
    - موسمية اختيارية.
    - ضرائب.
    - قرض تمويلي.
    """
    cash_flows = build_monthly_cash_flows(
        investment_initial=investment_initial,
        monthly_rent=monthly_rent,
        monthly_salaries=monthly_salaries,
        monthly_other_fixed=monthly_other_fixed,
        avg_ticket=avg_ticket,
        customers_per_day=customers_per_day,
        days_per_month=days_per_month,
        cost_ratio=cost_ratio,
        months=months,
        monthly_growth_rate=monthly_growth_rate,
        tax_rate=tax_rate,
        loan_amount=loan_amount,
        loan_annual_rate=loan_annual_rate,
        loan_years=loan_years,
        seasonality=seasonality,
    )

    project_npv = npv(discount_rate, cash_flows)
    project_irr = irr(cash_flows)
    project_payback = payback_period(cash_flows)

    # نستخدم الشهر الأول بعد الاستثمار كنقطة مرجعية للإيراد/الربح الشهري
    base_monthly_revenue = avg_ticket * customers_per_day * days_per_month
    monthly_revenue = base_monthly_revenue
    monthly_profit = cash_flows[1] if len(cash_flows) > 1 else None

    return {
        "cash_flows": cash_flows,
        "npv": project_npv,
        "irr": project_irr,
        "payback_period": project_payback,
        "monthly_revenue": monthly_revenue,
        "monthly_profit": monthly_profit,
    }


def coffee_shop_scenarios(
    discount_rate: float,
    investment_initial: float,
    monthly_rent: float,
    monthly_salaries: float,
    monthly_other_fixed: float,
    avg_ticket: float,
    customers_per_day: int,
    days_per_month: int,
    cost_ratio: float,
    demand_best_multiplier: float = 1.2,
    demand_worst_multiplier: float = 0.8,
    cost_best_multiplier: float = 0.95,
    cost_worst_multiplier: float = 1.1,
    months: int = 60,
) -> Dict[str, Any]:
    """
    يبني ثلاثة سيناريوهات لدراسة الجدوى (Base / Best / Worst)
    عبر تغيير الطلب والتكاليف.
    """
    base = coffee_shop_feasibility_summary(
        discount_rate=discount_rate,
        investment_initial=investment_initial,
        monthly_rent=monthly_rent,
        monthly_salaries=monthly_salaries,
        monthly_other_fixed=monthly_other_fixed,
        avg_ticket=avg_ticket,
        customers_per_day=customers_per_day,
        days_per_month=days_per_month,
        cost_ratio=cost_ratio,
        months=months,
    )

    best = coffee_shop_feasibility_summary(
        discount_rate=discount_rate,
        investment_initial=investment_initial,
        monthly_rent=monthly_rent,
        monthly_salaries=monthly_salaries,
        monthly_other_fixed=monthly_other_fixed,
        avg_ticket=avg_ticket,
        customers_per_day=int(customers_per_day * demand_best_multiplier),
        days_per_month=days_per_month,
        cost_ratio=cost_ratio * cost_best_multiplier,
        months=months,
    )

    worst = coffee_shop_feasibility_summary(
        discount_rate=discount_rate,
        investment_initial=investment_initial,
        monthly_rent=monthly_rent,
        monthly_salaries=monthly_salaries,
        monthly_other_fixed=monthly_other_fixed,
        avg_ticket=avg_ticket,
        customers_per_day=int(customers_per_day * demand_worst_multiplier),
        days_per_month=days_per_month,
        cost_ratio=cost_ratio * cost_worst_multiplier,
        months=months,
    )

    return {
        "base": base,
        "best": best,
        "worst": worst,
    }


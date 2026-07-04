from typing import List, Optional
import json

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from .coffee_shop_model import coffee_shop_feasibility_summary, coffee_shop_scenarios
from .restaurant_model import restaurant_feasibility_summary
from .laundry_model import laundry_feasibility_summary
from .financial_engine import (
    breakeven_quantity,
    gross_margin,
    irr,
    npv,
    payback_period,
)
from .database import SessionLocal, engine, Base
from .models import ProjectFeasibility, OperationalSnapshot


app = FastAPI(
    title="Feasibility AI Core",
    description="نواة العقل الداخلي لدراسات الجدوى (NPV, IRR, Payback, Breakeven, Margins)",
    version="0.1.0",
)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CashFlowRequest(BaseModel):
    rate: float = Field(..., description="معدل الخصم السنوي (0.1 يعني 10%)")
    cash_flows: List[float] = Field(..., description="التدفقات النقدية [CF0, CF1, CF2, ...]")


class CashFlowResponse(BaseModel):
    npv: float
    irr: Optional[float]
    payback_period: Optional[float]


class BreakevenRequest(BaseModel):
    fixed_costs: float
    price_per_unit: float
    variable_cost_per_unit: float


class BreakevenResponse(BaseModel):
    quantity: Optional[float]


class MarginRequest(BaseModel):
    revenue: float
    cost_of_goods_sold: float


class MarginResponse(BaseModel):
    gross_margin: Optional[float]


class CoffeeShopFeasibilityRequest(BaseModel):
    discount_rate: float = Field(..., description="معدل الخصم السنوي (مثال 0.1 يعني 10%)")
    investment_initial: float = Field(..., description="إجمالي الاستثمار الابتدائي (تجهيزات + ديكور + معدات)")
    monthly_rent: float = Field(..., description="الإيجار الشهري")
    monthly_salaries: float = Field(..., description="إجمالي رواتب الموظفين شهرياً")
    monthly_other_fixed: float = Field(..., description="مصروفات ثابتة أخرى شهرياً (كهرباء، إنترنت، تراخيص موزعة...)")
    avg_ticket: float = Field(..., description="متوسط فاتورة الزبون الواحد")
    customers_per_day: int = Field(..., description="متوسط عدد العملاء في اليوم")
    days_per_month: int = Field(..., description="عدد أيام التشغيل في الشهر")
    cost_ratio: float = Field(..., description="نسبة تكلفة المواد من المبيعات (مثال 0.35 يعني 35%)")
    months: int = Field(60, description="مدة الدراسة بالأشهر (افتراضياً 60 شهراً = 5 سنوات)")
    monthly_growth_rate: float = Field(0.0, description="معدل نمو شهري في المبيعات (0.02 يعني 2% شهرياً)")
    tax_rate: float = Field(0.0, description="نسبة الضريبة على الأرباح (مثال 0.15 يعني 15%)")
    loan_amount: float = Field(0.0, description="قيمة القرض التمويلي إن وُجد")
    loan_annual_rate: float = Field(0.0, description="معدل الفائدة السنوي على القرض")
    loan_years: int = Field(0, description="مدة القرض بالسنوات")


class CoffeeShopFeasibilityResponse(BaseModel):
    npv: float
    irr: Optional[float]
    payback_period: Optional[float]
    monthly_revenue: float
    monthly_profit: Optional[float]
    cash_flows: List[float]


class CoffeeShopProjectCreate(CoffeeShopFeasibilityRequest):
    name: Optional[str] = Field(None, description="اسم المشروع أو الكوفي شوب")
    city: Optional[str] = Field(None, description="المدينة")


class CoffeeShopProjectResponse(CoffeeShopFeasibilityResponse):
    id: int
    project_type: str
    name: Optional[str]
    city: Optional[str]


class SnapshotCreate(BaseModel):
    project_id: int = Field(..., description="معرّف المشروع في Experience Brain")
    period_index: int = Field(..., description="رقم الشهر منذ بداية تشغيل المشروع (1، 2، ...)")
    actual_revenue: float
    actual_cogs: float
    actual_fixed_costs: float
    notes: Optional[str] = None


class SnapshotComparisonResponse(BaseModel):
    project_id: int
    period_index: int
    planned_cash_flow: Optional[float]
    actual_cash_flow: float
    variance: Optional[float]
    variance_ratio: Optional[float]


class CoffeeShopScenarioRequest(CoffeeShopFeasibilityRequest):
    demand_best_multiplier: float = Field(1.2, description="معامل زيادة الطلب في سيناريو Best")
    demand_worst_multiplier: float = Field(0.8, description="معامل خفض الطلب في سيناريو Worst")
    cost_best_multiplier: float = Field(0.95, description="معامل خفض نسبة التكلفة في سيناريو Best")
    cost_worst_multiplier: float = Field(1.1, description="معامل زيادة نسبة التكلفة في سيناريو Worst")


class ScenarioSummary(BaseModel):
    npv: float
    irr: Optional[float]
    payback_period: Optional[float]
    monthly_revenue: float
    monthly_profit: Optional[float]


class CoffeeShopScenarioResponse(BaseModel):
    base: ScenarioSummary
    best: ScenarioSummary
    worst: ScenarioSummary


@app.get("/")
def root():
    return {
        "message": "Feasibility AI Core is running",
        "components": ["financial_engine", "field_analyst", "experience_brain_v1", "digital_twin_stub", "ecosystem_stubs"],
    }


@app.post("/financial/summary", response_model=CashFlowResponse)
def calculate_financial_summary(payload: CashFlowRequest):
    return CashFlowResponse(
        npv=npv(payload.rate, payload.cash_flows),
        irr=irr(payload.cash_flows),
        payback_period=payback_period(payload.cash_flows),
    )


@app.post("/financial/breakeven", response_model=BreakevenResponse)
def calculate_breakeven(payload: BreakevenRequest):
    quantity = breakeven_quantity(
        fixed_costs=payload.fixed_costs,
        price_per_unit=payload.price_per_unit,
        variable_cost_per_unit=payload.variable_cost_per_unit,
    )
    return BreakevenResponse(quantity=quantity)


@app.post("/financial/margin", response_model=MarginResponse)
def calculate_margin(payload: MarginRequest):
    margin = gross_margin(payload.revenue, payload.cost_of_goods_sold)
    return MarginResponse(gross_margin=margin)


class FieldAnalystRequest(BaseModel):
    latitude: float
    longitude: float
    business_type: str = Field(..., description="نوع النشاط مثل 'coffee_shop', 'restaurant', ...")


class FieldAnalystResponse(BaseModel):
    competitors_count: int
    traffic_level: str
    saturation_index: float
    note: str


@app.post("/field-analyst/analyze", response_model=FieldAnalystResponse)
def field_analyst_stub(payload: FieldAnalystRequest):
    """
    نسخة مبدئية (Stub) للمحلل الميداني.
    لاحقاً سيتم ربطها فعلياً بواجهات خرائط وبيانات حقيقية.
    """
    # من أجل التنفيذ السريع الآن، نعيد قيم افتراضية بسيطة
    # حسب نوع النشاط، حتى نستطيع ربط الواجهة ثم نبدل المنطق لاحقاً.
    default_competitors = {
        "coffee_shop": 12,
        "restaurant": 20,
        "laundry": 5,
    }
    competitors = default_competitors.get(payload.business_type.lower(), 8)

    saturation_index = competitors / 10.0
    traffic_level = "medium"

    if saturation_index > 1.2:
        note = "المنطقة مشبعة فوق المتوسط لهذا النشاط، يُنصح بالحذر أو اختيار موقع بديل."
    elif saturation_index < 0.8:
        note = "المنطقة تبدو أقل من مستوى التشبع، قد تكون هناك فرصة جيدة."
    else:
        note = "مستوى المنافسة متوسط، القرار يعتمد على تميّز المشروع وتنفيذه."

    return FieldAnalystResponse(
        competitors_count=competitors,
        traffic_level=traffic_level,
        saturation_index=saturation_index,
        note=note,
    )


@app.post("/feasibility/coffee-shop", response_model=CoffeeShopFeasibilityResponse)
def coffee_shop_feasibility(payload: CoffeeShopFeasibilityRequest):
    """
    نموذج مبسّط لدراسة جدوى كوفي شوب:
    يحسب NPV و IRR و Payback + ربحية شهرية وتدفقات نقدية شهرية.
    """
    summary = coffee_shop_feasibility_summary(
        discount_rate=payload.discount_rate,
        investment_initial=payload.investment_initial,
        monthly_rent=payload.monthly_rent,
        monthly_salaries=payload.monthly_salaries,
        monthly_other_fixed=payload.monthly_other_fixed,
        avg_ticket=payload.avg_ticket,
        customers_per_day=payload.customers_per_day,
        days_per_month=payload.days_per_month,
        cost_ratio=payload.cost_ratio,
        months=payload.months,
        monthly_growth_rate=payload.monthly_growth_rate,
        tax_rate=payload.tax_rate,
        loan_amount=payload.loan_amount,
        loan_annual_rate=payload.loan_annual_rate,
        loan_years=payload.loan_years,
    )

    return CoffeeShopFeasibilityResponse(
        npv=summary["npv"],
        irr=summary["irr"],
        payback_period=summary["payback_period"],
        monthly_revenue=summary["monthly_revenue"],
        monthly_profit=summary["monthly_profit"],
        cash_flows=summary["cash_flows"],
    )


@app.post("/feasibility/coffee-shop/scenarios", response_model=CoffeeShopScenarioResponse)
def coffee_shop_feasibility_scenarios(payload: CoffeeShopScenarioRequest):
    """
    يحسب ثلاثة سيناريوهات لدراسة جدوى الكوفي شوب:
    Base / Best / Worst وفق معاملات الطلب والتكلفة.
    """
    result = coffee_shop_scenarios(
        discount_rate=payload.discount_rate,
        investment_initial=payload.investment_initial,
        monthly_rent=payload.monthly_rent,
        monthly_salaries=payload.monthly_salaries,
        monthly_other_fixed=payload.monthly_other_fixed,
        avg_ticket=payload.avg_ticket,
        customers_per_day=payload.customers_per_day,
        days_per_month=payload.days_per_month,
        cost_ratio=payload.cost_ratio,
        months=payload.months,
        demand_best_multiplier=payload.demand_best_multiplier,
        demand_worst_multiplier=payload.demand_worst_multiplier,
        cost_best_multiplier=payload.cost_best_multiplier,
        cost_worst_multiplier=payload.cost_worst_multiplier,
        monthly_growth_rate=payload.monthly_growth_rate,
        tax_rate=payload.tax_rate,
        loan_amount=payload.loan_amount,
        loan_annual_rate=payload.loan_annual_rate,
        loan_years=payload.loan_years,
    )

    def to_summary(data: dict) -> ScenarioSummary:
        return ScenarioSummary(
            npv=data["npv"],
            irr=data["irr"],
            payback_period=data["payback_period"],
            monthly_revenue=data["monthly_revenue"],
            monthly_profit=data["monthly_profit"],
        )

    return CoffeeShopScenarioResponse(
        base=to_summary(result["base"]),
        best=to_summary(result["best"]),
        worst=to_summary(result["worst"]),
    )


@app.post("/experience-brain/coffee-shop", response_model=CoffeeShopProjectResponse)
def create_coffee_shop_project(payload: CoffeeShopProjectCreate, db: Session = Depends(get_db)):
    """
    إنشاء مشروع كوفي شوب جديد + حساب مؤشرات الجدوى وتخزينها في Experience Brain v1.
    """
    summary = coffee_shop_feasibility_summary(
        discount_rate=payload.discount_rate,
        investment_initial=payload.investment_initial,
        monthly_rent=payload.monthly_rent,
        monthly_salaries=payload.monthly_salaries,
        monthly_other_fixed=payload.monthly_other_fixed,
        avg_ticket=payload.avg_ticket,
        customers_per_day=payload.customers_per_day,
        days_per_month=payload.days_per_month,
        cost_ratio=payload.cost_ratio,
        months=payload.months,
        monthly_growth_rate=payload.monthly_growth_rate,
        tax_rate=payload.tax_rate,
        loan_amount=payload.loan_amount,
        loan_annual_rate=payload.loan_annual_rate,
        loan_years=payload.loan_years,
    )

    project = ProjectFeasibility(
        project_type="coffee_shop",
        name=payload.name,
        city=payload.city,
        investment_initial=payload.investment_initial,
        monthly_rent=payload.monthly_rent,
        monthly_salaries=payload.monthly_salaries,
        monthly_other_fixed=payload.monthly_other_fixed,
        avg_ticket=payload.avg_ticket,
        customers_per_day=payload.customers_per_day,
        days_per_month=payload.days_per_month,
        cost_ratio=payload.cost_ratio,
        discount_rate=payload.discount_rate,
        months=payload.months,
        npv=summary["npv"],
        irr=summary["irr"],
        payback_period=summary["payback_period"],
        monthly_revenue=summary["monthly_revenue"],
        monthly_profit=summary["monthly_profit"],
        cash_flows_json=json.dumps(summary["cash_flows"]),
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return CoffeeShopProjectResponse(
        id=project.id,
        project_type=project.project_type,
        name=project.name,
        city=project.city,
        npv=project.npv,
        irr=project.irr,
        payback_period=project.payback_period,
        monthly_revenue=project.monthly_revenue,
        monthly_profit=project.monthly_profit,
        cash_flows=json.loads(project.cash_flows_json),
    )


@app.post("/digital-twin/coffee-shop/snapshot", response_model=SnapshotComparisonResponse)
def create_operational_snapshot(payload: SnapshotCreate, db: Session = Depends(get_db)):
    """
    Digital Twin مبسط:
    - تخزين لقطة تشغيلية شهرية (إيراد/تكلفة/تكاليف ثابتة).
    - مقارنة الواقع مع التدفق النقدي المخطط لنفس الشهر من دراسة الجدوى.
    """
    project = db.query(ProjectFeasibility).filter(ProjectFeasibility.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="لم يتم العثور على المشروع")

    cash_flows = json.loads(project.cash_flows_json)
    planned_cf = None
    if 0 <= payload.period_index < len(cash_flows):
        planned_cf = cash_flows[payload.period_index]

    actual_cf = payload.actual_revenue - payload.actual_cogs - payload.actual_fixed_costs
    variance = None
    variance_ratio = None
    if planned_cf is not None:
        variance = actual_cf - planned_cf
        if planned_cf != 0:
            variance_ratio = variance / abs(planned_cf)

    snapshot = OperationalSnapshot(
        project_id=payload.project_id,
        period_index=payload.period_index,
        actual_revenue=payload.actual_revenue,
        actual_cogs=payload.actual_cogs,
        actual_fixed_costs=payload.actual_fixed_costs,
        notes=payload.notes,
    )

    db.add(snapshot)
    db.commit()

    return SnapshotComparisonResponse(
        project_id=payload.project_id,
        period_index=payload.period_index,
        planned_cash_flow=planned_cf,
        actual_cash_flow=actual_cf,
        variance=variance,
        variance_ratio=variance_ratio,
    )


class FundingScoreRequest(BaseModel):
    project_id: int


class FundingScoreResponse(BaseModel):
    project_id: int
    score: float
    risk_level: str
    note: str


class JobMatchRequest(BaseModel):
    role: str = Field(..., description="مثل: barista, cashier, manager")
    city: Optional[str] = Field(None, description="مدينة الوظيفة")


class JobMatchResponse(BaseModel):
    suggestions: List[str]
    note: str


class ProjectSummary(BaseModel):
    id: int
    project_type: str
    name: Optional[str]
    city: Optional[str]
    npv: float
    irr: Optional[float]
    created_at: str


class ProjectListResponse(BaseModel):
    projects: List[ProjectSummary]
    count: int


@app.post("/ecosystem/jobs/match", response_model=JobMatchResponse)
def job_market_stub(payload: JobMatchRequest):
    """
    Stub لسوق العمل الذكي:
    - حالياً يعيد مقترحات نصية بسيطة.
    - لاحقاً سيتم ربطه ببيانات حقيقية عن المشاريع والموظفين.
    """
    suggestions = [
        f"اقتراح: البحث عن {payload.role} بخبرة 2-3 سنوات في {payload.city or 'مدينتك'}",
        "ربط لاحقاً مع منصات التوظيف + مشاريع أخرى في النظام.",
    ]
    note = "هذه نسخة أولية توضيحية فقط، ستتحول لاحقاً إلى محرك توصية حقيقي."
    return JobMatchResponse(suggestions=suggestions, note=note)


@app.get("/experience-brain/projects", response_model=ProjectListResponse)
def list_projects(db: Session = Depends(get_db)):
    """
    إرجاع قائمة مختصرة بالمشاريع المخزنة في Experience Brain
    لاستخدامها في التحليلات والمحافظ الاستثمارية.
    """
    projects = db.query(ProjectFeasibility).order_by(ProjectFeasibility.created_at.desc()).all()

    items = [
        ProjectSummary(
            id=p.id,
            project_type=p.project_type,
            name=p.name,
            city=p.city,
            npv=p.npv,
            irr=p.irr,
            created_at=p.created_at.isoformat(),
        )
        for p in projects
    ]

    return ProjectListResponse(projects=items, count=len(items))


@app.post("/feasibility/restaurant", response_model=CoffeeShopFeasibilityResponse)
def restaurant_feasibility(payload: CoffeeShopFeasibilityRequest):
    """
    نموذج دراسة جدوى مطعم.
    """
    summary = restaurant_feasibility_summary(
        discount_rate=payload.discount_rate,
        investment_initial=payload.investment_initial,
        monthly_rent=payload.monthly_rent,
        monthly_salaries=payload.monthly_salaries,
        monthly_other_fixed=payload.monthly_other_fixed,
        avg_ticket=payload.avg_ticket,
        customers_per_day=payload.customers_per_day,
        days_per_month=payload.days_per_month,
        cost_ratio=payload.cost_ratio,
        months=payload.months,
        monthly_growth_rate=payload.monthly_growth_rate,
        tax_rate=payload.tax_rate,
        loan_amount=payload.loan_amount,
        loan_annual_rate=payload.loan_annual_rate,
        loan_years=payload.loan_years,
    )

    return CoffeeShopFeasibilityResponse(
        npv=summary["npv"],
        irr=summary["irr"],
        payback_period=summary["payback_period"],
        monthly_revenue=summary["monthly_revenue"],
        monthly_profit=summary["monthly_profit"],
        cash_flows=summary["cash_flows"],
    )


@app.post("/feasibility/laundry", response_model=CoffeeShopFeasibilityResponse)
def laundry_feasibility(payload: CoffeeShopFeasibilityRequest):
    """
    نموذج دراسة جدوى مغسلة ملابس.
    """
    summary = laundry_feasibility_summary(
        discount_rate=payload.discount_rate,
        investment_initial=payload.investment_initial,
        monthly_rent=payload.monthly_rent,
        monthly_salaries=payload.monthly_salaries,
        monthly_other_fixed=payload.monthly_other_fixed,
        avg_ticket=payload.avg_ticket,
        customers_per_day=payload.customers_per_day,
        days_per_month=payload.days_per_month,
        cost_ratio=payload.cost_ratio,
        months=payload.months,
        monthly_growth_rate=payload.monthly_growth_rate,
        tax_rate=payload.tax_rate,
        loan_amount=payload.loan_amount,
        loan_annual_rate=payload.loan_annual_rate,
        loan_years=payload.loan_years,
    )

    return CoffeeShopFeasibilityResponse(
        npv=summary["npv"],
        irr=summary["irr"],
        payback_period=summary["payback_period"],
        monthly_revenue=summary["monthly_revenue"],
        monthly_profit=summary["monthly_profit"],
        cash_flows=summary["cash_flows"],
    )


@app.post("/experience-brain/restaurant", response_model=CoffeeShopProjectResponse)
def create_restaurant_project(payload: CoffeeShopProjectCreate, db: Session = Depends(get_db)):
    """
    إنشاء مشروع مطعم جديد + حساب مؤشرات الجدوى وتخزينها في Experience Brain v1.
    """
    summary = restaurant_feasibility_summary(
        discount_rate=payload.discount_rate,
        investment_initial=payload.investment_initial,
        monthly_rent=payload.monthly_rent,
        monthly_salaries=payload.monthly_salaries,
        monthly_other_fixed=payload.monthly_other_fixed,
        avg_ticket=payload.avg_ticket,
        customers_per_day=payload.customers_per_day,
        days_per_month=payload.days_per_month,
        cost_ratio=payload.cost_ratio,
        months=payload.months,
        monthly_growth_rate=payload.monthly_growth_rate,
        tax_rate=payload.tax_rate,
        loan_amount=payload.loan_amount,
        loan_annual_rate=payload.loan_annual_rate,
        loan_years=payload.loan_years,
    )

    project = ProjectFeasibility(
        project_type="restaurant",
        name=payload.name,
        city=payload.city,
        investment_initial=payload.investment_initial,
        monthly_rent=payload.monthly_rent,
        monthly_salaries=payload.monthly_salaries,
        monthly_other_fixed=payload.monthly_other_fixed,
        avg_ticket=payload.avg_ticket,
        customers_per_day=payload.customers_per_day,
        days_per_month=payload.days_per_month,
        cost_ratio=payload.cost_ratio,
        discount_rate=payload.discount_rate,
        months=payload.months,
        npv=summary["npv"],
        irr=summary["irr"],
        payback_period=summary["payback_period"],
        monthly_revenue=summary["monthly_revenue"],
        monthly_profit=summary["monthly_profit"],
        cash_flows_json=json.dumps(summary["cash_flows"]),
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return CoffeeShopProjectResponse(
        id=project.id,
        project_type=project.project_type,
        name=project.name,
        city=project.city,
        npv=project.npv,
        irr=project.irr,
        payback_period=project.payback_period,
        monthly_revenue=project.monthly_revenue,
        monthly_profit=project.monthly_profit,
        cash_flows=json.loads(project.cash_flows_json),
    )


@app.post("/experience-brain/laundry", response_model=CoffeeShopProjectResponse)
def create_laundry_project(payload: CoffeeShopProjectCreate, db: Session = Depends(get_db)):
    """
    إنشاء مشروع مغسلة ملابس جديد + حساب مؤشرات الجدوى وتخزينها في Experience Brain v1.
    """
    summary = laundry_feasibility_summary(
        discount_rate=payload.discount_rate,
        investment_initial=payload.investment_initial,
        monthly_rent=payload.monthly_rent,
        monthly_salaries=payload.monthly_salaries,
        monthly_other_fixed=payload.monthly_other_fixed,
        avg_ticket=payload.avg_ticket,
        customers_per_day=payload.customers_per_day,
        days_per_month=payload.days_per_month,
        cost_ratio=payload.cost_ratio,
        months=payload.months,
        monthly_growth_rate=payload.monthly_growth_rate,
        tax_rate=payload.tax_rate,
        loan_amount=payload.loan_amount,
        loan_annual_rate=payload.loan_annual_rate,
        loan_years=payload.loan_years,
    )

    project = ProjectFeasibility(
        project_type="laundry",
        name=payload.name,
        city=payload.city,
        investment_initial=payload.investment_initial,
        monthly_rent=payload.monthly_rent,
        monthly_salaries=payload.monthly_salaries,
        monthly_other_fixed=payload.monthly_other_fixed,
        avg_ticket=payload.avg_ticket,
        customers_per_day=payload.customers_per_day,
        days_per_month=payload.days_per_month,
        cost_ratio=payload.cost_ratio,
        discount_rate=payload.discount_rate,
        months=payload.months,
        npv=summary["npv"],
        irr=summary["irr"],
        payback_period=summary["payback_period"],
        monthly_revenue=summary["monthly_revenue"],
        monthly_profit=summary["monthly_profit"],
        cash_flows_json=json.dumps(summary["cash_flows"]),
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return CoffeeShopProjectResponse(
        id=project.id,
        project_type=project.project_type,
        name=project.name,
        city=project.city,
        npv=project.npv,
        irr=project.irr,
        payback_period=project.payback_period,
        monthly_revenue=project.monthly_revenue,
        monthly_profit=project.monthly_profit,
        cash_flows=json.loads(project.cash_flows_json),
    )


class TrendAnalysisRequest(BaseModel):
    project_id: int


class TrendAnalysisResponse(BaseModel):
    project_id: int
    snapshots_count: int
    avg_variance_ratio: Optional[float]
    trend: str
    forecast_next_month: Optional[float]
    note: str


@app.get("/digital-twin/trend/{project_id}", response_model=TrendAnalysisResponse)
def digital_twin_trend(project_id: int, db: Session = Depends(get_db)):
    """
    تحليل Trend مبسط للأداء الفعلي لمشروع بناءً على Snapshots المحفوظة.
    """
    project = db.query(ProjectFeasibility).filter(ProjectFeasibility.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="لم يتم العثور على المشروع")

    snapshots = (
        db.query(OperationalSnapshot)
        .filter(OperationalSnapshot.project_id == project_id)
        .order_by(OperationalSnapshot.period_index.asc())
        .all()
    )

    if not snapshots:
        return TrendAnalysisResponse(
            project_id=project_id,
            snapshots_count=0,
            avg_variance_ratio=None,
            trend="no_data",
            forecast_next_month=None,
            note="لا توجد بيانات تشغيلية محفوظة بعد.",
        )

    cash_flows = json.loads(project.cash_flows_json)
    variances = []
    actual_cfs = []

    for snap in snapshots:
        if 0 <= snap.period_index < len(cash_flows):
            planned_cf = cash_flows[snap.period_index]
            actual_cf = snap.actual_revenue - snap.actual_cogs - snap.actual_fixed_costs
            actual_cfs.append(actual_cf)
            if planned_cf != 0:
                variances.append((actual_cf - planned_cf) / abs(planned_cf))

    avg_var = sum(variances) / len(variances) if variances else None

    trend = "stable"
    if len(actual_cfs) >= 2:
        recent = actual_cfs[-3:] if len(actual_cfs) >= 3 else actual_cfs
        if recent[-1] > recent[0] * 1.1:
            trend = "improving"
        elif recent[-1] < recent[0] * 0.9:
            trend = "declining"

    forecast = None
    if len(actual_cfs) >= 2:
        forecast = actual_cfs[-1] + (actual_cfs[-1] - actual_cfs[-2]) if len(actual_cfs) >= 2 else actual_cfs[-1]

    note = f"تم تحليل {len(snapshots)} لقطة. الاتجاه: {'تحسن' if trend == 'improving' else 'تراجع' if trend == 'declining' else 'مستقر'}."

    return TrendAnalysisResponse(
        project_id=project_id,
        snapshots_count=len(snapshots),
        avg_variance_ratio=avg_var,
        trend=trend,
        forecast_next_month=forecast,
        note=note,
    )


class SaturationAnalysisRequest(BaseModel):
    business_type: str = Field(..., description="نوع النشاط: coffee_shop, restaurant, laundry")
    city: Optional[str] = Field(None, description="المدينة (اختياري)")


class SaturationAnalysisResponse(BaseModel):
    business_type: str
    city: Optional[str]
    total_projects: int
    avg_npv: Optional[float]
    avg_irr: Optional[float]
    saturation_level: str
    recommendation: str


@app.post("/ecosystem/saturation", response_model=SaturationAnalysisResponse)
def saturation_analysis(payload: SaturationAnalysisRequest, db: Session = Depends(get_db)):
    """
    تحليل تشبّع بسيط لنوع نشاط في مدينة (بناءً على المشاريع المخزنة في Experience Brain).
    """
    query = db.query(ProjectFeasibility).filter(ProjectFeasibility.project_type == payload.business_type)
    if payload.city:
        query = query.filter(ProjectFeasibility.city == payload.city)

    projects = query.all()

    if not projects:
        return SaturationAnalysisResponse(
            business_type=payload.business_type,
            city=payload.city,
            total_projects=0,
            avg_npv=None,
            avg_irr=None,
            saturation_level="unknown",
            recommendation="لا توجد بيانات كافية في Experience Brain لهذا النشاط/المدينة.",
        )

    avg_npv = sum(p.npv for p in projects) / len(projects)
    irrs = [p.irr for p in projects if p.irr is not None]
    avg_irr = sum(irrs) / len(irrs) if irrs else None

    # منطق بسيط: إذا كان عدد المشاريع كبير نسبياً ومتوسط NPV منخفض → مشبّع
    saturation = "low"
    if len(projects) >= 10 and avg_npv < 0:
        saturation = "high"
    elif len(projects) >= 5:
        saturation = "medium"

    if saturation == "high":
        rec = f"المنطقة تبدو مشبعة ({len(projects)} مشروع). يُنصح بالحذر أو اختيار موقع/نشاط بديل."
    elif saturation == "medium":
        rec = f"مستوى تشبّع متوسط ({len(projects)} مشروع). القرار يعتمد على تميّز المشروع."
    else:
        rec = f"فرصة جيدة ({len(projects)} مشروع). المنطقة تبدو أقل من مستوى التشبّع."

    return SaturationAnalysisResponse(
        business_type=payload.business_type,
        city=payload.city,
        total_projects=len(projects),
        avg_npv=avg_npv,
        avg_irr=avg_irr,
        saturation_level=saturation,
        recommendation=rec,
    )


@app.post("/funding/score", response_model=FundingScoreResponse)
def funding_score_stub(payload: FundingScoreRequest, db: Session = Depends(get_db)):
    """
    Stub مبسّط لـ Auto-Funding:
    - يحسب درجة تمويل افتراضية بناءً على NPV و IRR الحالية.
    - لاحقاً سيتم ربطه بنماذج مخاطر حقيقية وبيانات تاريخية.
    """
    project = db.query(ProjectFeasibility).filter(ProjectFeasibility.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="لم يتم العثور على المشروع")

    score = 50.0
    if project.npv > 0:
        score += 20
    if project.irr is not None and project.irr > 0.15:
        score += 20

    # تأثير مبسط لانحراف الأداء الفعلي عن المخطط (باستخدام آخر Snapshot إن وجد)
    snapshot = (
        db.query(OperationalSnapshot)
        .filter(OperationalSnapshot.project_id == project.id)
        .order_by(OperationalSnapshot.period_index.desc())
        .first()
    )
    if snapshot:
        cash_flows = json.loads(project.cash_flows_json)
        if 0 <= snapshot.period_index < len(cash_flows):
            planned_cf = cash_flows[snapshot.period_index]
            actual_cf = snapshot.actual_revenue - snapshot.actual_cogs - snapshot.actual_fixed_costs
            if planned_cf != 0:
                variance_ratio = (actual_cf - planned_cf) / abs(planned_cf)
                if variance_ratio > 0.2:
                    score += 5
                elif variance_ratio < -0.2:
                    score -= 10

    if score >= 80:
        risk = "low"
        note = "مشروع قوي نظرياً، مناسب للتمويل بشروط ميسرة (افتراضياً)."
    elif score >= 60:
        risk = "medium"
        note = "مشروع مقبول، يحتاج دراسة إضافية أو ضمانات."
    else:
        risk = "high"
        note = "المخاطر مرتفعة وفق المؤشرات الحالية، غير مفضل للتمويل."

    return FundingScoreResponse(
        project_id=project.id,
        score=score,
        risk_level=risk,
        note=note,
    )



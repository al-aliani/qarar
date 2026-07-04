from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from .database import Base


class ProjectFeasibility(Base):
    __tablename__ = "projects_feasibility"

    id = Column(Integer, primary_key=True, index=True)
    project_type = Column(String(50), index=True)  # مثال: coffee_shop, restaurant, laundry
    name = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)

    # مدخلات رئيسية مختصرة (يمكن توسيعها لاحقاً)
    investment_initial = Column(Float, nullable=False)
    monthly_rent = Column(Float, nullable=False)
    monthly_salaries = Column(Float, nullable=False)
    monthly_other_fixed = Column(Float, nullable=False)
    avg_ticket = Column(Float, nullable=False)
    customers_per_day = Column(Integer, nullable=False)
    days_per_month = Column(Integer, nullable=False)
    cost_ratio = Column(Float, nullable=False)
    discount_rate = Column(Float, nullable=False)
    months = Column(Integer, nullable=False)

    # مخرجات رئيسية
    npv = Column(Float, nullable=False)
    irr = Column(Float, nullable=True)
    payback_period = Column(Float, nullable=True)
    monthly_revenue = Column(Float, nullable=False)
    monthly_profit = Column(Float, nullable=True)

    # التدفقات النقدية تُخزن كنص JSON مبسّط
    cash_flows_json = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    snapshots = relationship("OperationalSnapshot", back_populates="project")


class OperationalSnapshot(Base):
    """
    Digital Twin مبسط: لقطة تشغيلية شهرية لمشروع حقيقي
    تُستخدم لمقارنة الواقع مع الجدوى + بناء تنبؤات لاحقاً.
    """

    __tablename__ = "operational_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects_feasibility.id"), nullable=False, index=True)

    period_index = Column(Integer, nullable=False)  # رقم الشهر منذ بداية المشروع (1، 2، ...)

    actual_revenue = Column(Float, nullable=False)
    actual_cogs = Column(Float, nullable=False)
    actual_fixed_costs = Column(Float, nullable=False)

    # يمكن ربط الكاش المتوفر أو الرصيد البنكي لاحقاً
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("ProjectFeasibility", back_populates="snapshots")


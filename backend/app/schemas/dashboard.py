from decimal import Decimal

from pydantic import BaseModel

from app.core.config import settings


class ProductStock(BaseModel):
    product_id: int
    product_name: str
    sku_code: str
    quantity: int


class TodayProduction(BaseModel):
    product_id: int
    product_name: str
    total_quantity: int
    batch_count: int


class OrderStats(BaseModel):
    draft: int
    completed: int
    cancelled: int


class PayrollStats(BaseModel):
    draft: int
    approved: int
    paid: int


class WorkforceStats(BaseModel):
    salary_employees: int
    commission_employees: int
    subdivision_count: int


class DashboardResponse(BaseModel):
    currency: str = settings.currency
    stock_levels: list[ProductStock]
    today_production: list[TodayProduction]
    order_stats: OrderStats
    revenue_this_month: Decimal
    payroll_stats: PayrollStats
    workforce: WorkforceStats

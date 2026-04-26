from datetime import date
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


class TodaySale(BaseModel):
    product_id: int
    product_name: str
    total_quantity: int
    order_count: int


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
    today_sales: list[TodaySale]
    order_stats: OrderStats
    revenue_this_month: Decimal
    payroll_stats: PayrollStats
    workforce: WorkforceStats


class SalesProductSeries(BaseModel):
    product_id: int
    product_name: str
    sku_code: str
    quantity: list[int]
    revenue: list[Decimal]


class ProductionProductSeries(BaseModel):
    product_id: int
    product_name: str
    sku_code: str
    quantity: list[int]


class TimeseriesResponse(BaseModel):
    range_days: int
    start_date: date
    end_date: date
    currency: str = settings.currency
    dates: list[date]
    sales: list[SalesProductSeries]
    production: list[ProductionProductSeries]

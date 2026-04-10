import math
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.core.config import settings
from app.models.enums import PayrollStatus


class PayrollGenerate(BaseModel):
    period_start: date
    period_end: date = Field()

    def model_post_init(self, __context):
        if self.period_end < self.period_start:
            raise ValueError("period_end must be on or after period_start")


class CommissionLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: int
    subdivision_id: int
    product_id: int
    batch_quantity: int
    present_count: int
    quantity_share: Decimal
    rate_per_unit: Decimal
    amount: Decimal


class PayslipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    payroll_id: int
    employee_id: int
    base_salary: Decimal
    commission_amount: Decimal
    total_amount: Decimal
    currency: str = settings.currency
    commission_lines: list[CommissionLineResponse]


class PayslipSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    base_salary: Decimal
    commission_amount: Decimal
    total_amount: Decimal
    currency: str = settings.currency


class PayrollResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period_start: date
    period_end: date
    status: PayrollStatus
    generated_by_id: int
    approved_by_id: int | None
    created_at: datetime
    updated_at: datetime
    payslips: list[PayslipSummary]

    @computed_field
    def total_amount(self) -> Decimal:
        return sum((p.total_amount for p in self.payslips), Decimal("0"))

    @computed_field
    def payslip_count(self) -> int:
        return len(self.payslips)


class PayrollList(BaseModel):
    items: list[PayrollResponse]
    total: int
    page: int
    size: int

    @computed_field
    def pages(self) -> int:
        return math.ceil(self.total / self.size) if self.size else 0

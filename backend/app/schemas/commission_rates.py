from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.config import settings


class CommissionRateCreate(BaseModel):
    rate_per_unit: Decimal = Field(gt=0, decimal_places=4)
    effective_from: date
    effective_to: date | None = None


class CommissionRateUpdate(BaseModel):
    rate_per_unit: Decimal | None = Field(None, gt=0, decimal_places=4)
    effective_from: date | None = None
    effective_to: date | None = None


class CommissionRate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    rate_per_unit: Decimal
    currency: str = settings.currency
    effective_from: date
    effective_to: date | None
    created_at: datetime

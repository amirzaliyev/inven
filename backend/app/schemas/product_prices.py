from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductPrice(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    price: Decimal
    effective_from: date
    effective_to: date | None = None
    created_at: datetime


class ProductPriceCreate(BaseModel):
    product_id: int
    price: Decimal = Field(ge="0.01")
    effective_from: date
    effective_to: date | None = None

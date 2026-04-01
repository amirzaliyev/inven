import math
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field


class Batch(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_date: date
    product_id: int
    quantity: int
    created_by_id: int | None = None
    updated_by_id: int | None = None
    created_at: datetime
    update_at: datetime


class BatchList(BaseModel):
    items: list[Batch]
    total: int
    page: int
    size: int

    @computed_field
    def pages(self) -> int:
        return math.ceil(self.total / self.size)


class BatchCreate(BaseModel):
    batch_date: date = Field(ge=date(1970, 1, 1))
    product_id: int
    quantity: int = Field(ge=1)


class BatchUpdate(BaseModel):
    batch_date: date | None = Field(None, ge=date(1970, 1, 1))
    product_id: int | None = None
    quantity: int | None = Field(None, ge=1)

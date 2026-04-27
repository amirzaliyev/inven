import math
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.models.enums import SourceType, TransactionType


class InventoryTransactionLine(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    product_name: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _extract_product_name(cls, value: Any) -> Any:
        if isinstance(value, dict) or value is None:
            return value
        product = getattr(value, "product", None)
        return {
            "id": getattr(value, "id", None),
            "product_id": getattr(value, "product_id", None),
            "quantity": getattr(value, "quantity", None),
            "product_name": getattr(product, "name", None) if product is not None else None,
        }


class InventoryTransaction(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_date: date
    transaction_type: TransactionType
    source_type: SourceType
    source_id: int
    note: str | None = None
    lines: list[InventoryTransactionLine] = []
    created_by_id: int | None = None
    updated_by_id: int | None = None
    created_at: datetime
    updated_at: datetime

    @computed_field
    def total_quantity(self) -> int:
        return sum(int(getattr(ln, "quantity", 0) or 0) for ln in self.lines)


class InventoryTransactionList(BaseModel):
    items: list[InventoryTransaction]
    total: int
    page: int
    size: int

    @computed_field
    def pages(self) -> int:
        return math.ceil(self.total / self.size)


class ITransactionLineCreate(BaseModel):
    product_id: int
    quantity: int


class InventoryTransactionCreate(BaseModel):
    transaction_date: date
    transaction_type: TransactionType
    source_type: SourceType
    source_id: int
    note: str | None = None
    lines: list[ITransactionLineCreate]


class DefectLineCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class DefectReportCreate(BaseModel):
    note: str | None = Field(None, max_length=500)
    lines: list[DefectLineCreate] = Field(min_length=1)

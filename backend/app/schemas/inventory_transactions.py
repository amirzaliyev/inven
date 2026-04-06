import math
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, computed_field

from app.models.enums import SourceType, TransactionType


class InventoryTransaction(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_date: date
    transaction_type: TransactionType
    source_type: SourceType
    source_id: int
    created_by_id: int | None = None
    updated_by_id: int | None = None
    created_at: datetime
    updated_at: datetime


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
    lines: list[ITransactionLineCreate]

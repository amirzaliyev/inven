from datetime import date, datetime

from pydantic import BaseModel

from app.models.enums import SourceType, TransactionType


class InventoryTransaction(BaseModel):
    id: int
    transaction_date: date
    transaction_type: TransactionType
    source_type: SourceType
    source_id: int
    created_by_id: int | None = None
    updated_by_id: int | None = None
    created_at: datetime
    updated_at: datetime


class ITransactionLineCreate(BaseModel):
    product_id: int
    quantity: int


class InventoryTransactionCreate(BaseModel):
    transaction_date: date
    transaction_type: TransactionType
    source_type: SourceType
    source_id: int
    lines: list[ITransactionLineCreate]

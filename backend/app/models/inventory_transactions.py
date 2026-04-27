from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel
from .enums import SourceType, TransactionType

if TYPE_CHECKING:
    from .products import Product


class InventoryTransaction(BaseModel):
    __tablename__ = "inventory_transactions"

    transaction_date: Mapped[date] = mapped_column(
        Date, default=date.today, server_default=func.current_date()
    )
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType), nullable=False
    )
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType), nullable=False)
    source_id: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    lines: Mapped[list["InventoryTransactionLine"]] = relationship(
        "InventoryTransactionLine", back_populates="transaction"
    )


class InventoryTransactionLine(BaseModel):
    __tablename__ = "inventory_transaction_lines"

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_transactions.id", ondelete="CASCADE"), nullable=False
    )

    transaction: Mapped["InventoryTransaction"] = relationship(
        "InventoryTransaction", back_populates="lines"
    )
    product: Mapped["Product"] = relationship("Product", lazy="joined")

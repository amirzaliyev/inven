from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, Date, ForeignKey, Numeric, func
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class ProductCommissionRate(BaseModel):
    __tablename__ = "product_commission_rates"
    __table_args__ = (
        CheckConstraint("rate_per_unit > 0", name="ck_positive_commission_rate"),
        ExcludeConstraint(
            ("product_id", "="),
            (
                func.daterange(Column("effective_from"), Column("effective_to"), "[]"),
                "&&",
            ),
            name="ck_no_overlapping_commission_rates",
        ),
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rate_per_unit: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)

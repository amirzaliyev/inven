from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, Date, ForeignKey, Numeric, func
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ProductPrice(BaseModel):
    __tablename__ = "product_prices"
    __table_args__ = (
        CheckConstraint("price>=0.01", "ck_positive_product_price"),
        ExcludeConstraint(
            ("product_id", "="),
            (
                func.daterange(Column("effective_from"), Column("effective_to"), "[]"),
                "&&",
            ),
            name="ck_no_overlapping_product_prices",
        ),
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    price: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)

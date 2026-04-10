from datetime import date

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel


class Batch(BaseModel):
    __tablename__ = "batches"
    __table_args__ = (CheckConstraint("quantity>=0", "ck_batches_positive_quantity"),)

    batch_date: Mapped[date] = mapped_column(
        Date, default=date.today, server_default=func.current_date(), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    is_confirmed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("'FALSE'")
    )

    subdivision_id: Mapped[int | None] = mapped_column(
        ForeignKey("subdivisions.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    subdivision: Mapped["SubDivision | None"] = relationship("SubDivision", lazy="selectin")


from .subdivisions import SubDivision  # noqa: E402

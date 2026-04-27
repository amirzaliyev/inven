from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.enums import OrderStatus

from .base import BaseModel

if TYPE_CHECKING:
    from .customers import Customer
    from .products import Product


class Order(BaseModel):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("total_amount>=0", name="ck_orders_positive_total_amount"),
    )

    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus),
        nullable=False,
        default=OrderStatus.DRAFT,
        server_default=text("'DRAFT'"),
    )

    order_date: Mapped[date] = mapped_column(
        Date, default=date.today, nullable=False, server_default=func.current_date()
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    customer: Mapped["Customer"] = relationship("Customer", lazy="selectin")
    items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="order")


class OrderItem(BaseModel):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("price>=0", name="ck_order_items_positive_price"),
        CheckConstraint("quantity>=1", name="ck_order_items_positive_quantity"),
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )

    order: Mapped["Order"] = relationship("Order", back_populates="items")
    product: Mapped["Product"] = relationship("Product", foreign_keys=[product_id])

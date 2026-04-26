import math
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.core.config import settings
from app.models.enums import OrderStatus


class Product(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku_code: str


class OrderItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product: Product
    quantity: int
    price: Decimal


class OrderCustomer(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    phone_number: str | None = None


class Order(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: OrderStatus
    order_date: date
    total_amount: Decimal
    currency: str = settings.currency
    customer_id: int
    customer: OrderCustomer | None = None
    items: list[OrderItem]


class OrderList(BaseModel):
    items: list[Order]
    total: int
    page: int
    size: int

    @computed_field
    def pages(self) -> int:
        return math.ceil(self.total / self.size)


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(ge=1)
    price: Decimal = Field(gt=0)


class OrderCreate(BaseModel):
    order_date: date
    customer_id: int
    items: list[OrderItemCreate]


class OrderUpdate(BaseModel):
    order_date: date | None = None
    customer_id: int | None = None
    items: list[OrderItemCreate] | None = None

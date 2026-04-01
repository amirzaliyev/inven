import math
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field


class Product(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku_code: str

    created_at: datetime
    update_at: datetime


class ProductList(BaseModel):
    items: list[Product]
    total: int
    page: int
    size: int

    @computed_field
    def pages(self) -> int:
        return math.ceil(self.total / self.size)


class ProductCreate(BaseModel):
    name: str = Field(max_length=255)
    sku_code: str = Field(max_length=100)


class ProductUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    sku_code: str | None = Field(None, max_length=100)

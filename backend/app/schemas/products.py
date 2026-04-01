from datetime import datetime

from pydantic import BaseModel, Field


class Product(BaseModel):
    id: int
    name: str
    sku_code: str

    created_at: datetime
    update_at: datetime


class ProductCreate(BaseModel):
    name: str = Field(max_length=255)
    sku_code: str = Field(max_length=100)


class ProductUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    sku_code: str | None = Field(None, max_length=100)

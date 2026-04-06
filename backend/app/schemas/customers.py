import math
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, computed_field

from app.schemas.validators import validate_phone_number


class Customer(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    phone_number: str | None = None
    comment: str | None = None


class CustomerList(BaseModel):
    items: list[Customer]
    total: int
    page: int
    size: int

    @computed_field
    def pages(self) -> int:
        return math.ceil(self.total / self.size)


class CustomerCreate(BaseModel):
    full_name: str = Field(max_length=255)
    phone_number: Annotated[str | None, BeforeValidator(validate_phone_number)] = Field(
        None, max_length=25
    )
    comment: str | None = Field(None, max_length=300)


class CustomerUpdate(BaseModel):
    full_name: str | None = Field(None, max_length=255)
    phone_number: Annotated[str | None, BeforeValidator(validate_phone_number)] = Field(
        None, max_length=25
    )
    comment: str | None = Field(None, max_length=300)

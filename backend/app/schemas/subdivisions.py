import math
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field


class SubDivisionCreate(BaseModel):
    name: str = Field(max_length=255)
    description: str | None = Field(None, max_length=500)


class SubDivisionUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = Field(None, max_length=500)


class SubDivisionMemberAdd(BaseModel):
    employee_id: int


class SubDivisionMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subdivision_id: int
    employee_id: int
    employee_name: str | None = None
    created_at: datetime


class SubDivisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    members: list[SubDivisionMemberResponse]


class SubDivisionList(BaseModel):
    items: list[SubDivisionResponse]
    total: int
    page: int
    size: int

    @computed_field
    def pages(self) -> int:
        return math.ceil(self.total / self.size) if self.size else 0

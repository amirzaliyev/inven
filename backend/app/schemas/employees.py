from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.core.config import settings
from app.models.enums import EmploymentType
from app.models.users import UserRole


class UserProfileCreate(BaseModel):
    username: str = Field(max_length=255)
    password: str
    role: str = UserRole.EMPLOYEE
    email: str | None = None
    phone_number: str | None = None


class EmployeeCreate(BaseModel):
    employee_number: str = Field(max_length=50)
    full_name: str = Field(max_length=255)
    position: str = Field(max_length=255)
    department: str | None = Field(None, max_length=255)
    phone_number: str | None = Field(None, max_length=50)
    employment_type: EmploymentType = EmploymentType.SALARY
    base_salary: Decimal | None = Field(None, gt=0)
    hired_at: date
    user_id: int | None = None
    user_profile: UserProfileCreate | None = None

    @model_validator(mode="after")
    def check_salary_required(self):
        if self.employment_type == EmploymentType.SALARY and self.base_salary is None:
            raise ValueError("base_salary is required for SALARY employees")
        return self


class EmployeeUpdate(BaseModel):
    full_name: str | None = Field(None, max_length=255)
    position: str | None = Field(None, max_length=255)
    department: str | None = Field(None, max_length=255)
    phone_number: str | None = Field(None, max_length=50)
    base_salary: Decimal | None = Field(None, gt=0)
    terminated_at: date | None = None
    user_id: int | None = None


class Employee(BaseModel):
    id: int
    employee_number: str
    full_name: str
    position: str
    department: str | None
    phone_number: str | None
    employment_type: EmploymentType
    base_salary: Decimal | None
    currency: str = settings.currency
    hired_at: date
    terminated_at: date | None
    user_id: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmployeeList(BaseModel):
    items: list[Employee]
    total: int
    page: int
    size: int

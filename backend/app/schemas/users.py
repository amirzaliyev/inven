from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.users import UserRole


class UserCreate(BaseModel):
    display_name: str = Field(max_length=255)
    username: str = Field(max_length=255)
    password: str
    role: str = UserRole.EMPLOYEE
    email: str | None = None
    phone_number: str | None = None
    permissions: list[str] | None = None


class UserUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=255)
    role: str | None = None
    email: str | None = None
    phone_number: str | None = None
    permissions: list[str] | None = None


class AdminPasswordReset(BaseModel):
    new_password: str = Field(min_length=8)


class PermissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    permission: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    username: str
    role: str
    email: str | None
    phone_number: str | None
    must_change_password: bool
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime
    custom_permissions: list[PermissionResponse] = []


class UserList(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    size: int

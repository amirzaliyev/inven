from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel


class UserRole(StrEnum):
    MASTER_ADMIN = "master_admin"
    ADMIN = "admin"
    EMPLOYEE = "employee"


class User(BaseModel):
    __tablename__ = "users"

    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    phone_number: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )
    role: Mapped[str] = mapped_column(String(length=20), default="employee")
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)

    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("FALSE"), nullable=False
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    custom_permissions: Mapped[list["UserPermission"]] = relationship(
        "UserPermission", lazy="selectin", cascade="all, delete-orphan",
        primaryjoin="and_(User.id == UserPermission.user_id, UserPermission.is_active == True)",
    )


from .user_permissions import UserPermission  # noqa: E402

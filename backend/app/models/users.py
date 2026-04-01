from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class UserRole(StrEnum):
    pass


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

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

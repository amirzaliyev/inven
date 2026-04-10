from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel


class SubDivision(BaseModel):
    __tablename__ = "subdivisions"

    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    members: Mapped[list["SubDivisionMember"]] = relationship(
        "SubDivisionMember",
        back_populates="subdivision",
        primaryjoin="and_(SubDivisionMember.subdivision_id == SubDivision.id, SubDivisionMember.is_active == True)",
    )


class SubDivisionMember(BaseModel):
    __tablename__ = "subdivision_members"
    __table_args__ = (
        UniqueConstraint("subdivision_id", "employee_id", name="uq_subdivision_member"),
    )

    subdivision_id: Mapped[int] = mapped_column(
        ForeignKey("subdivisions.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    subdivision: Mapped["SubDivision"] = relationship(
        "SubDivision", back_populates="members"
    )

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel
from .enums import PayrollStatus


class Payroll(BaseModel):
    __tablename__ = "payrolls"

    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[PayrollStatus] = mapped_column(
        Enum(PayrollStatus),
        nullable=False,
        default=PayrollStatus.DRAFT,
        server_default=text("'DRAFT'"),
    )
    generated_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    approved_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    payslips: Mapped[list["Payslip"]] = relationship("Payslip", back_populates="payroll")


class Payslip(BaseModel):
    __tablename__ = "payslips"

    payroll_id: Mapped[int] = mapped_column(
        ForeignKey("payrolls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    base_salary: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    commission_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0, server_default=text("0")
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

    payroll: Mapped["Payroll"] = relationship("Payroll", back_populates="payslips")
    employee: Mapped["Employee"] = relationship("Employee", lazy="selectin")

    @property
    def employee_name(self) -> str | None:
        return self.employee.full_name if self.employee else None

    commission_lines: Mapped[list["PayslipCommissionLine"]] = relationship(
        "PayslipCommissionLine", back_populates="payslip"
    )


class PayslipCommissionLine(BaseModel):
    __tablename__ = "payslip_commission_lines"

    payslip_id: Mapped[int] = mapped_column(
        ForeignKey("payslips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    batch_id: Mapped[int] = mapped_column(
        ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False
    )
    subdivision_id: Mapped[int] = mapped_column(
        ForeignKey("subdivisions.id", ondelete="RESTRICT"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    batch_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    present_count: Mapped[int] = mapped_column(Integer, nullable=False)
    # per-worker share = batch_quantity / present_count (may be fractional)
    quantity_share: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    rate_per_unit: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

    payslip: Mapped["Payslip"] = relationship("Payslip", back_populates="commission_lines")


from .employees import Employee  # noqa: E402

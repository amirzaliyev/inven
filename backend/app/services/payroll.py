from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.batch_workers import BatchWorker
from app.models.batches import Batch
from app.models.commission_rates import ProductCommissionRate
from app.models.employees import Employee
from app.models.enums import EmploymentType, PayrollStatus
from app.models.payroll import Payroll, Payslip, PayslipCommissionLine
from app.schemas.auth import UserContext
from app.schemas.payroll import PayrollGenerate
from app.services.exceptions import Conflict, ResourceNotFound

from .base import BaseModelService


class PayrollService(BaseModelService[Payroll]):
    model = Payroll

    def __init__(self, session: AsyncSession):
        super().__init__(session=session, auto_commit=False)

    async def generate(self, data: PayrollGenerate, user: UserContext) -> Payroll:
        payroll = Payroll(
            period_start=data.period_start,
            period_end=data.period_end,
            status=PayrollStatus.DRAFT,
            generated_by_id=user.id,
        )
        self._session.add(payroll)
        await self._session.flush()

        # All active, non-terminated employees
        employees = (
            await self._session.scalars(
                select(Employee).where(
                    Employee.is_active == True,  # noqa: E712
                    or_(
                        Employee.terminated_at.is_(None),
                        Employee.terminated_at > data.period_start,
                    ),
                )
            )
        ).all()

        # Subquery: how many workers were actually present per batch
        present_count_sq = (
            select(
                BatchWorker.batch_id,
                func.count().label("present_count"),
            )
            .where(BatchWorker.is_active == True)  # noqa: E712
            .group_by(BatchWorker.batch_id)
            .subquery()
        )

        # One query: attendance rows for confirmed batches in the period
        # joined with present count and commission rate
        commission_rows = (
            await self._session.execute(
                select(
                    BatchWorker.employee_id,
                    Batch.id.label("batch_id"),
                    Batch.subdivision_id,
                    Batch.product_id,
                    Batch.batch_date,
                    Batch.quantity.label("batch_quantity"),
                    present_count_sq.c.present_count,
                    ProductCommissionRate.rate_per_unit,
                )
                .join(Batch, BatchWorker.batch_id == Batch.id)
                .join(
                    present_count_sq,
                    present_count_sq.c.batch_id == Batch.id,
                )
                .join(
                    ProductCommissionRate,
                    (ProductCommissionRate.product_id == Batch.product_id)
                    & (ProductCommissionRate.effective_from <= Batch.batch_date)
                    & (
                        or_(
                            ProductCommissionRate.effective_to.is_(None),
                            ProductCommissionRate.effective_to >= Batch.batch_date,
                        )
                    )
                    & (ProductCommissionRate.is_active == True),  # noqa: E712
                )
                .where(
                    BatchWorker.is_active == True,  # noqa: E712
                    Batch.is_confirmed == True,  # noqa: E712
                    Batch.is_active == True,  # noqa: E712
                    Batch.batch_date.between(data.period_start, data.period_end),
                )
            )
        ).all()

        # Index by employee_id
        work_by_employee: dict[int, list] = {}
        for row in commission_rows:
            work_by_employee.setdefault(row.employee_id, []).append(row)

        for employee in employees:
            if employee.employment_type == EmploymentType.SALARY:
                await self._create_salary_payslip(payroll.id, employee)
            else:
                await self._create_commission_payslip(
                    payroll.id, employee, work_by_employee.get(employee.id, [])
                )

        await self._session.commit()
        await self._session.refresh(payroll)
        return payroll

    async def _create_salary_payslip(
        self, payroll_id: int, employee: Employee
    ) -> None:
        payslip = Payslip(
            payroll_id=payroll_id,
            employee_id=employee.id,
            base_salary=employee.base_salary or Decimal("0"),
            commission_amount=Decimal("0"),
            total_amount=employee.base_salary or Decimal("0"),
        )
        self._session.add(payslip)

    async def _create_commission_payslip(
        self, payroll_id: int, employee: Employee, rows: list
    ) -> None:
        commission_amount = Decimal("0")
        line_data = []

        for row in rows:
            quantity_share = (
                Decimal(row.batch_quantity) / Decimal(row.present_count)
            ).quantize(Decimal("0.0001"))
            amount = (quantity_share * row.rate_per_unit).quantize(Decimal("0.01"))
            commission_amount += amount
            line_data.append(
                {
                    "batch_id": row.batch_id,
                    "subdivision_id": row.subdivision_id,
                    "product_id": row.product_id,
                    "batch_quantity": row.batch_quantity,
                    "present_count": row.present_count,
                    "quantity_share": quantity_share,
                    "rate_per_unit": row.rate_per_unit,
                    "amount": amount,
                }
            )

        payslip = Payslip(
            payroll_id=payroll_id,
            employee_id=employee.id,
            base_salary=Decimal("0"),
            commission_amount=commission_amount.quantize(Decimal("0.01")),
            total_amount=commission_amount.quantize(Decimal("0.01")),
        )
        self._session.add(payslip)
        await self._session.flush()

        for ld in line_data:
            self._session.add(PayslipCommissionLine(**ld, payslip_id=payslip.id))

    async def approve(self, payroll_id: int, user: UserContext) -> Payroll:
        payroll = await self.get(id=payroll_id)
        if payroll.status != PayrollStatus.DRAFT:
            raise Conflict(
                code="payroll_not_approvable",
                message="Only DRAFT payrolls can be approved.",
            )
        payroll.status = PayrollStatus.APPROVED
        payroll.approved_by_id = user.id
        await self._session.commit()
        await self._session.refresh(payroll, ["payslips"])
        return payroll

    async def mark_paid(self, payroll_id: int, user: UserContext) -> Payroll:
        payroll = await self.get(id=payroll_id)
        if payroll.status != PayrollStatus.APPROVED:
            raise Conflict(
                code="payroll_not_payable",
                message="Only APPROVED payrolls can be marked as paid.",
            )
        payroll.status = PayrollStatus.PAID
        await self._session.commit()
        await self._session.refresh(payroll, ["payslips"])
        return payroll

    async def get_with_payslips(self, payroll_id: int) -> Payroll:
        stmt = (
            select(Payroll)
            .where(Payroll.id == payroll_id, Payroll.is_active == True)  # noqa: E712
            .options(selectinload(Payroll.payslips))
        )
        payroll = await self._session.scalar(stmt)
        if not payroll:
            raise ResourceNotFound(code="payroll_not_found", message="Payroll not found.")
        return payroll

    async def get_payslip(self, payslip_id: int) -> Payslip:
        stmt = (
            select(Payslip)
            .where(Payslip.id == payslip_id, Payslip.is_active == True)  # noqa: E712
            .options(selectinload(Payslip.commission_lines))
        )
        payslip = await self._session.scalar(stmt)
        if not payslip:
            raise ResourceNotFound(code="payslip_not_found", message="Payslip not found.")
        return payslip

    async def list(
        self,
        page: int,
        size: int,
        status: PayrollStatus | None = None,
    ) -> tuple[Sequence[Payroll], int]:
        conditions = [self.model.is_active == True]  # noqa: E712
        if status:
            conditions.append(self.model.status == status)

        stmt = (
            select(self.model)
            .where(*conditions)
            .options(selectinload(self.model.payslips))
            .order_by(self.model.period_start.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        total_stmt = select(func.count()).select_from(self.model).where(*conditions)

        payrolls = (await self._session.scalars(stmt)).all()
        total = await self._session.scalar(total_stmt) or 0
        return payrolls, total

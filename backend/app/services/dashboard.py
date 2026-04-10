from datetime import date
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.batches import Batch
from app.models.employees import Employee
from app.models.enums import (
    EmploymentType,
    OrderStatus,
    PayrollStatus,
    TransactionType,
)
from app.models.inventory_transactions import (
    InventoryTransaction,
    InventoryTransactionLine,
)
from app.models.orders import Order
from app.models.payroll import Payroll
from app.models.products import Product
from app.models.subdivisions import SubDivision
from app.schemas.dashboard import (
    DashboardResponse,
    OrderStats,
    PayrollStats,
    ProductStock,
    TodayProduction,
    WorkforceStats,
)


class DashboardService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_dashboard(self) -> DashboardResponse:
        return DashboardResponse(
            stock_levels=await self._stock_levels(),
            today_production=await self._today_production(),
            order_stats=await self._order_stats(),
            revenue_this_month=await self._revenue_this_month(),
            payroll_stats=await self._payroll_stats(),
            workforce=await self._workforce_stats(),
        )

    async def _stock_levels(self) -> list[ProductStock]:
        # Net stock = SUM(CREDIT quantities) - SUM(DEBIT quantities) per product
        stmt = (
            select(
                Product.id,
                Product.name,
                Product.sku_code,
                func.coalesce(
                    func.sum(
                        case(
                            (
                                InventoryTransaction.transaction_type
                                == TransactionType.CREDIT,
                                InventoryTransactionLine.quantity,
                            ),
                            else_=-InventoryTransactionLine.quantity,
                        )
                    ),
                    0,
                ).label("quantity"),
            )
            .outerjoin(
                InventoryTransactionLine,
                InventoryTransactionLine.product_id == Product.id,
            )
            .outerjoin(
                InventoryTransaction,
                (InventoryTransactionLine.transaction_id == InventoryTransaction.id)
                & (InventoryTransaction.is_active == True),  # noqa: E712
            )
            .where(Product.is_active == True)  # noqa: E712
            .group_by(Product.id, Product.name, Product.sku_code)
            .order_by(Product.name)
        )
        rows = (await self._session.execute(stmt)).all()
        return [
            ProductStock(
                product_id=r.id,
                product_name=r.name,
                sku_code=r.sku_code,
                quantity=r.quantity,
            )
            for r in rows
        ]

    async def _today_production(self) -> list[TodayProduction]:
        today = date.today()
        stmt = (
            select(
                Product.id,
                Product.name,
                func.sum(Batch.quantity).label("total_quantity"),
                func.count(Batch.id).label("batch_count"),
            )
            .join(Product, Batch.product_id == Product.id)
            .where(
                Batch.is_active == True,  # noqa: E712
                Batch.is_confirmed == True,  # noqa: E712
                Batch.batch_date == today,
            )
            .group_by(Product.id, Product.name)
            .order_by(Product.name)
        )
        rows = (await self._session.execute(stmt)).all()
        return [
            TodayProduction(
                product_id=r.id,
                product_name=r.name,
                total_quantity=r.total_quantity,
                batch_count=r.batch_count,
            )
            for r in rows
        ]

    async def _order_stats(self) -> OrderStats:
        stmt = select(
            func.count().filter(Order.status == OrderStatus.DRAFT).label("draft"),
            func.count().filter(Order.status == OrderStatus.COMPLETED).label("completed"),
            func.count().filter(Order.status == OrderStatus.CANCELLED).label("cancelled"),
        ).where(Order.is_active == True)  # noqa: E712
        row = (await self._session.execute(stmt)).one()
        return OrderStats(draft=row.draft, completed=row.completed, cancelled=row.cancelled)

    async def _revenue_this_month(self) -> Decimal:
        today = date.today()
        first_of_month = today.replace(day=1)
        stmt = (
            select(func.coalesce(func.sum(Order.total_amount), 0))
            .where(
                Order.is_active == True,  # noqa: E712
                Order.status == OrderStatus.COMPLETED,
                Order.order_date >= first_of_month,
                Order.order_date <= today,
            )
        )
        return await self._session.scalar(stmt) or Decimal("0")

    async def _payroll_stats(self) -> PayrollStats:
        stmt = select(
            func.count().filter(Payroll.status == PayrollStatus.DRAFT).label("draft"),
            func.count().filter(Payroll.status == PayrollStatus.APPROVED).label("approved"),
            func.count().filter(Payroll.status == PayrollStatus.PAID).label("paid"),
        ).where(Payroll.is_active == True)  # noqa: E712
        row = (await self._session.execute(stmt)).one()
        return PayrollStats(draft=row.draft, approved=row.approved, paid=row.paid)

    async def _workforce_stats(self) -> WorkforceStats:
        emp_stmt = select(
            func.count().filter(Employee.employment_type == EmploymentType.SALARY).label("salary"),
            func.count().filter(Employee.employment_type == EmploymentType.COMMISSION).label("commission"),
        ).where(
            Employee.is_active == True,  # noqa: E712
            Employee.terminated_at.is_(None),
        )
        emp_row = (await self._session.execute(emp_stmt)).one()

        sub_count = await self._session.scalar(
            select(func.count()).select_from(SubDivision).where(SubDivision.is_active == True)  # noqa: E712
        ) or 0

        return WorkforceStats(
            salary_employees=emp_row.salary,
            commission_employees=emp_row.commission,
            subdivision_count=sub_count,
        )

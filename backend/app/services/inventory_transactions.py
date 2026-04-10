from collections.abc import Sequence
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SourceType, TransactionType
from app.models.inventory_transactions import (
    InventoryTransaction,
    InventoryTransactionLine,
)
from app.schemas.auth import UserContext
from app.schemas.inventory_transactions import (
    DefectReportCreate,
    InventoryTransactionCreate,
    ITransactionLineCreate,
)

from .base import BaseModelService


class InventoryTransactionService(BaseModelService[InventoryTransaction]):
    model = InventoryTransaction

    def __init__(self, session: AsyncSession):
        super().__init__(session=session, auto_commit=False)

    async def create(
        self, data: InventoryTransactionCreate, user: UserContext
    ) -> InventoryTransaction:
        txn_data = data.model_dump(exclude={"lines"})

        txn_data.update(created_by_id=user.id)

        # flush transaction to database
        txn = await self._create(obj_data=txn_data)
        await self._session.refresh(txn, ["lines"])

        for line in data.lines:
            ln = InventoryTransactionLine(**line.model_dump())

            txn.lines.append(ln)

        # flush successful transaction to database
        await self._commit_or_flush()

        return txn

    async def report_defect(
        self, data: DefectReportCreate, user: UserContext
    ) -> InventoryTransaction:
        return await self.create(
            data=InventoryTransactionCreate(
                transaction_date=date.today(),
                transaction_type=TransactionType.DEBIT,
                source_type=SourceType.DEFECT,
                source_id=0,
                note=data.note,
                lines=[
                    ITransactionLineCreate(
                        product_id=line.product_id, quantity=line.quantity
                    )
                    for line in data.lines
                ],
            ),
            user=user,
        )

    async def list(
        self,
        page: int,
        size: int,
        transaction_type: TransactionType | None = None,
        source_type: SourceType | None = None,
    ) -> tuple[Sequence[InventoryTransaction], int]:
        conditions = [self.model.is_active == True]  # noqa: E712

        if transaction_type:
            conditions.append(self.model.transaction_type == transaction_type)

        if source_type:
            conditions.append(self.model.source_type == source_type)

        offset = (page - 1) * size
        stmt = select(self.model).where(*conditions).offset(offset).limit(size)
        total_cnt = select(func.count()).select_from(self.model).where(*conditions)

        txns = (await self._session.scalars(stmt)).all()
        total = await self._session.scalar(total_cnt) or 0

        return txns, total

    async def delete(self, **kwargs) -> None:
        await super().delete(**kwargs)
        await self._commit_or_flush()

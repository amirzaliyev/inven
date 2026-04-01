from collections.abc import Sequence
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.batches import Batch
from app.models.enums import SourceType, TransactionType
from app.schemas.auth import UserContext
from app.schemas.batches import BatchCreate, BatchUpdate
from app.schemas.inventory_transactions import (
    InventoryTransactionCreate,
    ITransactionLineCreate,
)
from app.services.exceptions import Conflict

from .base import BaseModelService
from .inventory_transactions import InventoryTransactionService


class BatchService(BaseModelService[Batch]):
    model = Batch

    def __init__(
        self, session: AsyncSession, inventory_transactions: InventoryTransactionService
    ):
        super().__init__(session=session, auto_commit=False)
        self._inv_transactions = inventory_transactions

    async def create(self, data: BatchCreate, user: UserContext) -> Batch:
        batch_data = data.model_dump()

        batch_data.update(created_by_id=user.id)
        new_batch = await self._create(batch_data)
        await self._session.commit()

        return new_batch

    async def update(self, id: int, data: BatchUpdate, user: UserContext) -> Batch:
        """"""
        batch = await self.get(id=id)

        if batch.is_confirmed:
            raise Conflict(
                code="update_not_allowed",
                message="The batch is already confirmed and cannot be modified",
            )

        batch_data = data.model_dump(exclude_unset=True)

        batch = await self._update(batch, modified_data=batch_data)
        await self._session.commit()
        return batch

    async def list(self, page: int = 1, size: int = 45) -> tuple[Sequence[Batch], int]:
        conditions = []

        stmt = (
            select(self.model)
            .where(*conditions)
            .offset((page - 1) * size)
            .limit(size)
            .order_by(self.model.batch_date)
        )
        total_cnt = select(func.count()).select_from(self.model)

        batches = (await self._session.scalars(stmt)).all()
        total = await self._session.scalar(total_cnt) or 0

        return batches, total

    async def confirm(self, batch_id: int, user: UserContext) -> Batch:
        batch = await self.get(id=batch_id)

        if batch.is_confirmed:
            raise Conflict(
                code="already_confirmed", message="The batch is already confirmed"
            )

        batch.is_confirmed = True
        await self._session.flush()

        txn_data = InventoryTransactionCreate(
            transaction_date=date.today(),
            transaction_type=TransactionType.CREDIT,
            source_type=SourceType.BATCH,
            source_id=batch.id,
            lines=[
                ITransactionLineCreate(
                    product_id=batch.product_id, quantity=batch.quantity
                )
            ],
        )

        await self._inv_transactions.create(data=txn_data, user=user)

        await self._session.commit()
        await self._session.refresh(batch)

        return batch

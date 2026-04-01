from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SourceType, TransactionType
from app.models.inventory_transactions import (
    InventoryTransaction,
    InventoryTransactionLine,
)
from app.schemas.auth import UserContext
from app.schemas.inventory_transactions import InventoryTransactionCreate

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

        # commit successful transaction to database
        await self._session.commit()

        return txn

    async def update(self):
        pass

    async def list(
        self,
        page: int,
        size: int,
        transaction_type: TransactionType | None = None,
        source_type: SourceType | None = None,
    ):
        pass

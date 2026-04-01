from collections.abc import Sequence

from sqlalchemy import func, select

from app.models.batches import Batch
from app.schemas.auth import UserContext
from app.schemas.batches import BatchCreate, BatchUpdate

from .base import BaseModelService


class BatchService(BaseModelService[Batch]):
    model = Batch

    async def create(self, data: BatchCreate, user: UserContext):
        batch_data = data.model_dump()

        batch_data.update(created_by_id=user.id)

        return await self._create(batch_data)

    async def update(self, id: int, data: BatchUpdate, user: UserContext):
        batch = await self.get(id=id)

        batch_data = data.model_dump(exclude_unset=True)

        return await self._update(batch, modified_data=batch_data)

    async def list(self, page: int = 1, size: int = 45) -> tuple[Sequence[Batch], int]:
        conditions = []

        stmt = (
            select(self.model).where(*conditions).offset((page - 1) * size).limit(size)
        )
        total_cnt = select(func.count()).select_from(self.model)

        batches = (await self._session.scalars(stmt)).all()
        total = await self._session.scalar(total_cnt) or 0

        return batches, total

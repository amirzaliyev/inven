from collections.abc import Sequence

from sqlalchemy import func, or_, select

from app.models.customers import Customer
from app.schemas.auth import UserContext
from app.schemas.customers import CustomerCreate, CustomerUpdate
from app.services.base import BaseModelService


class CustomerService(BaseModelService[Customer]):
    model = Customer

    async def create(self, data: CustomerCreate, user: UserContext):
        customer_data = data.model_dump()

        customer_data.update(created_by_id=user.id)

        return await self._create(customer_data)

    async def update(self, customer_id: int, data: CustomerUpdate, user: UserContext):
        customer = await self.get(id=customer_id)
        customer_data = data.model_dump(exclude_unset=True)

        return await self._update(customer, modified_data=customer_data)

    async def list(
        self, page: int, size: int, search: str | None = None
    ) -> tuple[Sequence[Customer], int]:
        conditions = []

        if search:
            pattern = f"%{search}%"
            conditions.append(
                or_(
                    self.model.full_name.ilike(pattern),
                    self.model.phone_number.ilike(pattern),
                )
            )

        stmt = (
            select(self.model).where(*conditions).offset((page - 1) * size).limit(size)
        )
        total_cnt = select(func.count()).select_from(self.model).where(*conditions)

        customers = (await self._session.scalars(stmt)).all()
        total = await self._session.scalar(total_cnt) or 0

        return customers, total

from collections.abc import Sequence
from datetime import date

from sqlalchemy import or_, select

from app.models.commission_rates import ProductCommissionRate
from app.schemas.commission_rates import CommissionRateCreate, CommissionRateUpdate

from .base import BaseModelService


class CommissionRateService(BaseModelService[ProductCommissionRate]):
    model = ProductCommissionRate

    async def create(self, product_id: int, data: CommissionRateCreate) -> ProductCommissionRate:
        return await self._create({**data.model_dump(), "product_id": product_id})

    async def update(self, rate_id: int, data: CommissionRateUpdate) -> ProductCommissionRate:
        rate = await self.get(id=rate_id)
        return await self._update(rate, modified_data=data.model_dump(exclude_unset=True))

    async def list_for_product(
        self, product_id: int
    ) -> Sequence[ProductCommissionRate]:
        stmt = (
            select(self.model)
            .where(
                self.model.product_id == product_id,
                self.model.is_active == True,  # noqa: E712
            )
            .order_by(self.model.effective_from.desc())
        )
        return (await self._session.scalars(stmt)).all()

    async def get_rate_on_date(
        self, product_id: int, on_date: date
    ) -> ProductCommissionRate | None:
        stmt = select(self.model).where(
            self.model.product_id == product_id,
            self.model.is_active == True,  # noqa: E712
            self.model.effective_from <= on_date,
            or_(
                self.model.effective_to.is_(None),
                self.model.effective_to >= on_date,
            ),
        )
        return await self._session.scalar(stmt)

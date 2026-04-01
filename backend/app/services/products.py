from collections.abc import Sequence

from sqlalchemy import func, or_, select

from app.models.products import Product
from app.schemas.auth import UserContext
from app.schemas.products import ProductCreate, ProductUpdate

from .base import BaseModelService


class ProductService(BaseModelService[Product]):
    model = Product

    async def create(self, data: ProductCreate, user: UserContext):
        product_data = data.model_dump()

        product_data.update(created_by_id=user.id)

        return await self._create(product_data)

    async def update(self, id: int, data: ProductUpdate, user: UserContext):
        product = await self.get(id=id)
        product_data = data.model_dump(exclude_unset=True)

        return await self._update(product, modified_data=product_data)

    async def list(
        self, page: int, size: int, search: str | None = None
    ) -> tuple[Sequence[Product], int]:
        conditions = []
        if search:
            pattern = f"%{search}%"
            conditions.append(
                or_(
                    self.model.name.ilike(pattern),
                    self.model.sku_code.ilike(pattern),
                )
            )

        stmt = (
            select(self.model)
            .where(*conditions)
            .offset((page - 1) * size)
            .limit(size)
            .order_by(self.model.name)
        )
        total_cnt = select(func.count()).select_from(self.model).where(*conditions)

        products = (await self._session.scalars(stmt)).all()
        total = await self._session.scalar(total_cnt) or 0

        return products, total

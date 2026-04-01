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

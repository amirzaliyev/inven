from app.models.product_prices import ProductPrice
from app.schemas.auth import UserContext
from app.schemas.product_prices import ProductPriceCreate
from app.services.base import BaseModelService


class ProductPriceService(BaseModelService[ProductPrice]):
    model = ProductPrice

    async def create(self, data: ProductPriceCreate, user: UserContext):
        price_data = data.model_dump()

        price_data.update(created_by_id=user.id)

        return await self._create(price_data)

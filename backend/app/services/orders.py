from collections.abc import Sequence
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select

from app.models.enums import OrderStatus
from app.models.orders import Order, OrderItem
from app.schemas.auth import UserContext
from app.schemas.orders import OrderCreate, OrderUpdate
from app.services.exceptions import Conflict

from .base import BaseModelService


class OrderService(BaseModelService[Order]):
    model = Order

    async def create(self, data: OrderCreate, user: UserContext) -> Order:
        total_amount = sum(item.price * item.quantity for item in data.items)

        order_data = {
            "order_date": data.order_date,
            "customer_id": data.customer_id,
            "created_by_id": user.id,
            "total_amount": total_amount,
        }

        # _create commits (auto_commit is always True in base service)
        new_order = await self._create(order_data)

        for item_data in data.items:
            item = OrderItem(**item_data.model_dump(), order_id=new_order.id)
            self._session.add(item)

        await self._session.commit()

        await self._session.refresh(new_order, ["items"])
        return new_order

    async def update(
        self, order_id: int, data: OrderUpdate, user: UserContext
    ) -> Order:
        order = await self.get(id=order_id)

        if order.status != OrderStatus.DRAFT:
            raise Conflict(
                code="order_not_editable",
                message="Only DRAFT orders can be updated. Reset the order first.",
            )

        update_fields = data.model_dump(exclude_unset=True, exclude={"items"})
        for field, value in update_fields.items():
            setattr(order, field, value)

        if data.items is not None:
            await self._session.refresh(order, ["items"])
            for existing_item in order.items:
                await self._session.delete(existing_item)
            await self._session.flush()

            for item_data in data.items:
                new_item = OrderItem(**item_data.model_dump(), order_id=order.id)
                self._session.add(new_item)

            order.total_amount = sum(d.price * d.quantity for d in data.items)

        await self._session.commit()
        await self._session.refresh(order, ["items"])
        return order

    async def list(
        self,
        page: int,
        size: int,
        date_from: date | None = None,
        date_to: date | None = None,
        price_from: Decimal | None = None,
        price_to: Decimal | None = None,
        customer_id: int | None = None,
    ) -> tuple[Sequence[Order], int]:
        conditions = []

        if date_from:
            conditions.append(self.model.order_date >= date_from)

        if date_to:
            conditions.append(self.model.order_date <= date_to)

        if price_from:
            conditions.append(self.model.total_amount >= price_from)

        if price_to:
            conditions.append(self.model.total_amount <= price_to)

        if customer_id:
            conditions.append(self.model.customer_id == customer_id)

        stmt = (
            select(self.model)
            .where(*conditions)
            .offset((page - 1) * size)
            .limit(size)
            .order_by(self.model.order_date.desc())
        )
        total_cnt = select(func.count()).select_from(self.model).where(*conditions)

        orders = (await self._session.scalars(stmt)).all()
        total = await self._session.scalar(total_cnt) or 0

        return orders, total

    async def complete_order(self, order_id: int) -> Order:
        order = await self.get(id=order_id)

        if order.status != OrderStatus.DRAFT:
            raise Conflict(
                code="order_not_completable",
                message="Only DRAFT orders can be completed.",
            )

        order.status = OrderStatus.COMPLETED
        await self._session.commit()
        await self._session.refresh(order, ["items"])
        return order

    async def reset_order(self, order_id: int) -> Order:
        order = await self.get(id=order_id)

        if order.status == OrderStatus.DRAFT:
            raise Conflict(
                code="order_already_draft",
                message="Order is already in DRAFT status.",
            )

        order.status = OrderStatus.DRAFT
        await self._session.commit()
        await self._session.refresh(order, ["items"])
        return order

    async def cancel_order(self, order_id: int) -> Order:
        order = await self.get(id=order_id)

        if order.status != OrderStatus.DRAFT:
            raise Conflict(
                code="order_not_cancellable",
                message="Only DRAFT orders can be cancelled.",
            )

        order.status = OrderStatus.CANCELLED
        await self._session.commit()
        await self._session.refresh(order, ["items"])
        return order

from collections.abc import Sequence
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import OrderStatus, SourceType, TransactionType
from app.models.orders import Order, OrderItem
from app.schemas.auth import UserContext
from app.schemas.inventory_transactions import (
    InventoryTransactionCreate,
    ITransactionLineCreate,
)
from app.schemas.orders import OrderCreate, OrderUpdate
from app.services.exceptions import Conflict, ResourceNotFound

from .base import BaseModelService
from .inventory_transactions import InventoryTransactionService


class OrderService(BaseModelService[Order]):
    model = Order

    def __init__(
        self, session: AsyncSession, inventory_transactions: InventoryTransactionService
    ):
        super().__init__(session=session, auto_commit=False)
        self._inv_transactions = inventory_transactions

    async def get_order_with_details(self, order_id: int, user: UserContext) -> Order:
        stmt = (
            select(self.model)
            .options(
                selectinload(self.model.items).selectinload(OrderItem.product),
                selectinload(self.model.customer),
            )
            .where(self.model.id == order_id)
        )

        order = (await self._session.scalars(stmt)).one_or_none()

        if not order:
            raise ResourceNotFound(
                code="order_not_found", message=f"Order not found with id {order_id}"
            )

        return order

    async def create(self, data: OrderCreate, user: UserContext) -> Order:
        total_amount = sum(item.price * item.quantity for item in data.items)

        order_data = {
            "order_date": data.order_date,
            "customer_id": data.customer_id,
            "created_by_id": user.id,
            "total_amount": total_amount,
        }

        new_order = await self._create(order_data)

        for item_data in data.items:
            item = OrderItem(**item_data.model_dump(), order_id=new_order.id)
            self._session.add(item)

        await self._session.commit()

        return await self.get_order_with_details(order_id=new_order.id, user=user)

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
        return await self.get_order_with_details(order_id=order.id, user=user)

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
        conditions = [self.model.is_active == True]  # noqa: E712

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
            .options(selectinload(self.model.items).selectinload(OrderItem.product))
            .offset((page - 1) * size)
            .limit(size)
            .order_by(self.model.order_date.desc())
        )
        total_cnt = select(func.count()).select_from(self.model).where(*conditions)

        orders = (await self._session.scalars(stmt)).all()
        total = await self._session.scalar(total_cnt) or 0

        return orders, total

    async def complete_order(self, order_id: int, user: UserContext) -> Order:
        order = await self.get(id=order_id)

        if order.status != OrderStatus.DRAFT:
            raise Conflict(
                code="order_not_completable",
                message="Only DRAFT orders can be completed.",
            )

        await self._session.refresh(order, ["items"])

        order.status = OrderStatus.COMPLETED
        await self._session.flush()

        await self._inv_transactions.create(
            data=InventoryTransactionCreate(
                transaction_date=date.today(),
                transaction_type=TransactionType.DEBIT,
                source_type=SourceType.SALES,
                source_id=order.id,
                lines=[
                    ITransactionLineCreate(
                        product_id=item.product_id, quantity=item.quantity
                    )
                    for item in order.items
                ],
            ),
            user=user,
        )

        await self._session.commit()
        return await self.get_order_with_details(order_id=order.id, user=user)

    async def reset_order(self, order_id: int, user: UserContext) -> Order:
        order = await self.get(id=order_id)

        if order.status == OrderStatus.DRAFT:
            raise Conflict(
                code="order_already_draft",
                message="Order is already in DRAFT status.",
            )

        if order.status == OrderStatus.CANCELLED:
            raise Conflict(
                code="order_cancelled",
                message="Cancelled orders cannot be set to DRAFT",
            )

        was_completed = order.status == OrderStatus.COMPLETED
        order.status = OrderStatus.DRAFT
        await self._session.flush()

        if was_completed:
            await self._session.refresh(order, ["items"])
            await self._inv_transactions.create(
                data=InventoryTransactionCreate(
                    transaction_date=date.today(),
                    transaction_type=TransactionType.CREDIT,
                    source_type=SourceType.SALES,
                    source_id=order.id,
                    lines=[
                        ITransactionLineCreate(
                            product_id=item.product_id, quantity=item.quantity
                        )
                        for item in order.items
                    ],
                ),
                user=user,
            )

        await self._session.commit()
        return await self.get_order_with_details(order_id=order.id, user=user)

    async def cancel_order(self, order_id: int, user: UserContext) -> Order:
        order = await self.get(id=order_id)

        if order.status != OrderStatus.DRAFT:
            raise Conflict(
                code="order_not_cancellable",
                message="Only DRAFT orders can be cancelled.",
            )

        order.status = OrderStatus.CANCELLED
        await self._session.commit()
        return await self.get_order_with_details(order_id=order.id, user=user)

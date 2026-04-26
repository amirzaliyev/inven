"""Tests for the order workflow: service-level and API-level."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    OrderStatus,
    SourceType,
    TransactionType,
)
from app.models.inventory_transactions import InventoryTransaction
from app.schemas.orders import OrderCreate, OrderItemCreate, OrderUpdate
from app.services.exceptions import Conflict
from app.services.inventory_transactions import InventoryTransactionService
from app.services.orders import OrderService
from tests.conftest import Factory, make_user_context

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_order_service(session: AsyncSession) -> OrderService:
    inv_svc = InventoryTransactionService(session=session)
    return OrderService(session=session, inventory_transactions=inv_svc)


# ===========================================================================
# Service-level tests
# ===========================================================================


class TestOrderServiceCreate:
    async def test_create_order_calculates_total_amount(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product_a = await factory.create_product()
        product_b = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product_a.id, quantity=5, price=Decimal("200.00")
                    ),
                    OrderItemCreate(
                        product_id=product_b.id, quantity=3, price=Decimal("150.00")
                    ),
                ],
            ),
            user=ctx,
        )

        # 5*200 + 3*150 = 1450
        assert order.total_amount == Decimal("1450.00")

    async def test_create_order_items_linked(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=10, price=Decimal("50.00")
                    ),
                ],
            ),
            user=ctx,
        )

        assert len(order.items) == 1
        item = order.items[0]
        assert item.product_id == product.id
        assert item.quantity == 10
        assert item.price == Decimal("50.00")
        assert item.order_id == order.id


class TestOrderServiceUpdate:
    async def test_update_draft_order_recalculates_total(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=2, price=Decimal("100.00")
                    ),
                ],
            ),
            user=ctx,
        )
        assert order.total_amount == Decimal("200.00")

        updated = await svc.update(
            order_id=order.id,
            data=OrderUpdate(
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=5, price=Decimal("300.00")
                    ),
                ],
            ),
            user=ctx,
        )

        assert updated.total_amount == Decimal("1500.00")
        assert len(updated.items) == 1
        assert updated.items[0].quantity == 5

    async def test_update_completed_order_raises_conflict(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=1, price=Decimal("10.00")
                    ),
                ],
            ),
            user=ctx,
        )
        await svc.complete_order(order.id, ctx)

        with pytest.raises(Conflict) as exc_info:
            await svc.update(
                order_id=order.id,
                data=OrderUpdate(order_date=date.today()),
                user=ctx,
            )
        assert exc_info.value.code == "order_not_editable"

    async def test_update_cancelled_order_raises_conflict(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=1, price=Decimal("10.00")
                    ),
                ],
            ),
            user=ctx,
        )
        await svc.cancel_order(order.id, user=ctx)

        with pytest.raises(Conflict) as exc_info:
            await svc.update(
                order_id=order.id,
                data=OrderUpdate(order_date=date.today()),
                user=ctx,
            )
        assert exc_info.value.code == "order_not_editable"


class TestOrderServiceComplete:
    async def test_complete_draft_order_sets_completed_and_creates_debit_txn(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product_a = await factory.create_product()
        product_b = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product_a.id, quantity=3, price=Decimal("100.00")
                    ),
                    OrderItemCreate(
                        product_id=product_b.id, quantity=7, price=Decimal("50.00")
                    ),
                ],
            ),
            user=ctx,
        )

        completed = await svc.complete_order(order.id, ctx)
        assert completed.status == OrderStatus.COMPLETED

        # Verify DEBIT inventory transaction was created
        txns = (
            await session.scalars(
                select(InventoryTransaction).where(
                    InventoryTransaction.source_type == SourceType.SALES,
                    InventoryTransaction.source_id == order.id,
                    InventoryTransaction.transaction_type == TransactionType.DEBIT,
                )
            )
        ).all()
        assert len(txns) == 1

        txn = txns[0]
        await session.refresh(txn, ["lines"])
        lines_by_product = {ln.product_id: ln.quantity for ln in txn.lines}
        assert lines_by_product[product_a.id] == 3
        assert lines_by_product[product_b.id] == 7

    async def test_complete_already_completed_order_raises_conflict(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=1, price=Decimal("10.00")
                    ),
                ],
            ),
            user=ctx,
        )
        await svc.complete_order(order.id, ctx)

        with pytest.raises(Conflict) as exc_info:
            await svc.complete_order(order.id, ctx)
        assert exc_info.value.code == "order_not_completable"


class TestOrderServiceReset:
    async def test_reset_completed_order_creates_credit_txn(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=4, price=Decimal("25.00")
                    ),
                ],
            ),
            user=ctx,
        )
        await svc.complete_order(order.id, ctx)

        reset = await svc.reset_order(order.id, ctx)
        assert reset.status == OrderStatus.DRAFT

        credit_txns = (
            await session.scalars(
                select(InventoryTransaction).where(
                    InventoryTransaction.source_type == SourceType.SALES,
                    InventoryTransaction.source_id == order.id,
                    InventoryTransaction.transaction_type == TransactionType.CREDIT,
                )
            )
        ).all()
        assert len(credit_txns) == 1
        await session.refresh(credit_txns[0], ["lines"])
        assert credit_txns[0].lines[0].product_id == product.id
        assert credit_txns[0].lines[0].quantity == 4

    async def test_reset_cancelled_order_no_credit_txn(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=1, price=Decimal("10.00")
                    ),
                ],
            ),
            user=ctx,
        )
        await svc.cancel_order(order.id, user=ctx)

        reset = await svc.reset_order(order.id, ctx)
        assert reset.status == OrderStatus.DRAFT

        # No CREDIT transaction should have been created
        credit_txns = (
            await session.scalars(
                select(InventoryTransaction).where(
                    InventoryTransaction.source_type == SourceType.SALES,
                    InventoryTransaction.source_id == order.id,
                    InventoryTransaction.transaction_type == TransactionType.CREDIT,
                )
            )
        ).all()
        assert len(credit_txns) == 0

    async def test_reset_draft_order_raises_conflict(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=1, price=Decimal("10.00")
                    ),
                ],
            ),
            user=ctx,
        )

        with pytest.raises(Conflict) as exc_info:
            await svc.reset_order(order.id, ctx)
        assert exc_info.value.code == "order_already_draft"


class TestOrderServiceCancel:
    async def test_cancel_draft_order(self, session: AsyncSession, factory: Factory):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=1, price=Decimal("10.00")
                    ),
                ],
            ),
            user=ctx,
        )

        cancelled = await svc.cancel_order(order.id, user=ctx)
        assert cancelled.status == OrderStatus.CANCELLED

    async def test_cancel_completed_order_raises_conflict(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=1, price=Decimal("10.00")
                    ),
                ],
            ),
            user=ctx,
        )
        await svc.complete_order(order.id, ctx)

        with pytest.raises(Conflict) as exc_info:
            await svc.cancel_order(order.id, user=ctx)
        assert exc_info.value.code == "order_not_cancellable"

    async def test_cancel_cancelled_order_raises_conflict(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user()
        customer = await factory.create_customer()
        product = await factory.create_product()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        order = await svc.create(
            data=OrderCreate(
                order_date=date.today(),
                customer_id=customer.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=1, price=Decimal("10.00")
                    ),
                ],
            ),
            user=ctx,
        )
        await svc.cancel_order(order.id, user=ctx)

        with pytest.raises(Conflict) as exc_info:
            await svc.cancel_order(order.id, user=ctx)
        assert exc_info.value.code == "order_not_cancellable"


class TestOrderServiceList:
    async def _seed_orders(self, session, factory):
        """Create several orders with varied dates, prices, and customers."""
        user = await factory.create_user()
        ctx = make_user_context(user)
        svc = _make_order_service(session)

        customer_a = await factory.create_customer(full_name="Customer A")
        customer_b = await factory.create_customer(full_name="Customer B")
        product = await factory.create_product()

        today = date.today()

        order1 = await svc.create(
            data=OrderCreate(
                order_date=today - timedelta(days=5),
                customer_id=customer_a.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=1, price=Decimal("100.00")
                    )
                ],
            ),
            user=ctx,
        )
        order2 = await svc.create(
            data=OrderCreate(
                order_date=today - timedelta(days=3),
                customer_id=customer_b.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=2, price=Decimal("500.00")
                    )
                ],
            ),
            user=ctx,
        )
        order3 = await svc.create(
            data=OrderCreate(
                order_date=today,
                customer_id=customer_a.id,
                items=[
                    OrderItemCreate(
                        product_id=product.id, quantity=1, price=Decimal("300.00")
                    )
                ],
            ),
            user=ctx,
        )

        return svc, customer_a, customer_b, order1, order2, order3, today

    async def test_list_filter_date_range(
        self, session: AsyncSession, factory: Factory
    ):
        svc, cust_a, cust_b, o1, o2, o3, today = await self._seed_orders(
            session, factory
        )

        orders, total = await svc.list(
            page=1,
            size=10,
            date_from=today - timedelta(days=4),
            date_to=today - timedelta(days=1),
        )
        order_ids = {o.id for o in orders}
        assert o2.id in order_ids
        assert o1.id not in order_ids  # 5 days ago, outside range
        assert o3.id not in order_ids  # today, outside range

    async def test_list_filter_price_range(
        self, session: AsyncSession, factory: Factory
    ):
        svc, cust_a, cust_b, o1, o2, o3, today = await self._seed_orders(
            session, factory
        )

        # o1 total=100, o2 total=1000, o3 total=300
        orders, total = await svc.list(
            page=1,
            size=10,
            price_from=Decimal("200.00"),
            price_to=Decimal("1000.00"),
        )
        order_ids = {o.id for o in orders}
        assert o2.id in order_ids  # total=1000
        assert o3.id in order_ids  # total=300
        assert o1.id not in order_ids  # total=100, below 200

    async def test_list_filter_customer_id(
        self, session: AsyncSession, factory: Factory
    ):
        svc, cust_a, cust_b, o1, o2, o3, today = await self._seed_orders(
            session, factory
        )

        orders, total = await svc.list(page=1, size=10, customer_id=cust_a.id)
        order_ids = {o.id for o in orders}
        assert o1.id in order_ids
        assert o3.id in order_ids
        assert o2.id not in order_ids

    async def test_list_pagination(self, session: AsyncSession, factory: Factory):
        svc, *_, today = await self._seed_orders(session, factory)

        page1, total = await svc.list(page=1, size=2)
        assert len(page1) == 2
        assert total == 3

        page2, _ = await svc.list(page=2, size=2)
        assert len(page2) == 1


# ===========================================================================
# API-level tests
# ===========================================================================


class TestOrderAPI:
    async def _setup_order_payload(self, factory: Factory) -> dict:
        customer = await factory.create_customer()
        product = await factory.create_product()
        return {
            "order_date": str(date.today()),
            "customer_id": customer.id,
            "items": [
                {"product_id": product.id, "quantity": 3, "price": "120.00"},
            ],
        }

    async def test_create_order_returns_201(self, admin_client, factory: Factory):
        payload = await self._setup_order_payload(factory)

        resp = await admin_client.post("/v1/orders", json=payload)
        assert resp.status_code == 201
        body = resp.json()
        assert body["status"] == "DRAFT"
        assert Decimal(body["total_amount"]) == Decimal("360.00")
        assert len(body["items"]) == 1
        assert body["customer_id"] == payload["customer_id"]

    async def test_list_orders_returns_200_with_pagination(
        self, admin_client, factory: Factory
    ):
        payload = await self._setup_order_payload(factory)
        await admin_client.post("/v1/orders", json=payload)

        resp = await admin_client.get("/v1/orders")
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total" in body
        assert "page" in body
        assert "size" in body
        assert "pages" in body
        assert body["total"] >= 1

    async def test_update_draft_order_returns_200(self, admin_client, factory: Factory):
        payload = await self._setup_order_payload(factory)
        create_resp = await admin_client.post("/v1/orders", json=payload)
        order_id = create_resp.json()["id"]
        product_id = payload["items"][0]["product_id"]

        update_payload = {
            "items": [
                {"product_id": product_id, "quantity": 10, "price": "50.00"},
            ],
        }
        resp = await admin_client.put(f"/v1/orders/{order_id}", json=update_payload)
        assert resp.status_code == 200
        assert Decimal(resp.json()["total_amount"]) == Decimal("500.00")

    async def test_complete_order_returns_200_completed(
        self, admin_client, factory: Factory
    ):
        payload = await self._setup_order_payload(factory)
        create_resp = await admin_client.post("/v1/orders", json=payload)
        order_id = create_resp.json()["id"]

        resp = await admin_client.post(f"/v1/orders/{order_id}/complete")
        assert resp.status_code == 200
        assert resp.json()["status"] == "COMPLETED"

    async def test_reset_completed_order_returns_200_draft(
        self, admin_client, factory: Factory
    ):
        payload = await self._setup_order_payload(factory)
        create_resp = await admin_client.post("/v1/orders", json=payload)
        order_id = create_resp.json()["id"]

        await admin_client.post(f"/v1/orders/{order_id}/complete")
        resp = await admin_client.post(f"/v1/orders/{order_id}/reset")
        assert resp.status_code == 200
        assert resp.json()["status"] == "DRAFT"

    async def test_cancel_draft_order_returns_200_cancelled(
        self, admin_client, factory: Factory
    ):
        payload = await self._setup_order_payload(factory)
        create_resp = await admin_client.post("/v1/orders", json=payload)
        order_id = create_resp.json()["id"]

        resp = await admin_client.post(f"/v1/orders/{order_id}/cancel")
        assert resp.status_code == 200
        assert resp.json()["status"] == "CANCELLED"

    async def test_employee_cannot_create_order_returns_403(
        self, employee_client, factory: Factory
    ):
        payload = await self._setup_order_payload(factory)
        resp = await employee_client.post("/v1/orders", json=payload)
        assert resp.status_code == 403

    async def test_employee_can_list_orders_returns_200(self, employee_client):
        resp = await employee_client.get("/v1/orders")
        assert resp.status_code == 200

    async def test_nonexistent_order_returns_404(self, admin_client):
        resp = await admin_client.put(
            "/v1/orders/999999", json={"order_date": str(date.today())}
        )
        assert resp.status_code == 404

from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.models.enums import OrderStatus
from tests.conftest import Factory


@pytest.mark.asyncio
class TestDashboardTimeseries:
    async def test_default_returns_30_days_dense_arrays(
        self, admin_client: AsyncClient
    ):
        resp = await admin_client.get("/v1/dashboard/timeseries")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["range_days"] == 30
        assert len(body["dates"]) == 30
        assert body["end_date"] == date.today().isoformat()
        assert body["start_date"] == (date.today() - timedelta(days=29)).isoformat()
        assert body["sales"] == []
        assert body["production"] == []

    async def test_invalid_days_rejected(self, admin_client: AsyncClient):
        resp = await admin_client.get("/v1/dashboard/timeseries?days=15")
        assert resp.status_code == 422

    async def test_per_product_split_with_zero_filled_gaps(
        self, admin_client: AsyncClient, factory: Factory
    ):
        today = date.today()
        five_days_ago = today - timedelta(days=5)

        prod_a = await factory.create_product(name="A-brick", sku_code="A-001")
        prod_b = await factory.create_product(name="B-brick", sku_code="B-001")

        # Sales: A sold today + 5 days ago, B sold today only
        await factory.create_order(
            status=OrderStatus.COMPLETED,
            order_date=today,
            items=[
                {"product_id": prod_a.id, "quantity": 10, "price": Decimal("100.00")},
                {"product_id": prod_b.id, "quantity": 5, "price": Decimal("200.00")},
            ],
        )
        await factory.create_order(
            status=OrderStatus.COMPLETED,
            order_date=five_days_ago,
            items=[
                {"product_id": prod_a.id, "quantity": 7, "price": Decimal("100.00")}
            ],
        )

        # Production: A confirmed today, B confirmed 5 days ago,
        # plus an unconfirmed batch that must NOT show up.
        await factory.create_batch(
            product=prod_a, quantity=50, batch_date=today, is_confirmed=True
        )
        await factory.create_batch(
            product=prod_b, quantity=80, batch_date=five_days_ago, is_confirmed=True
        )
        await factory.create_batch(
            product=prod_a, quantity=999, batch_date=today, is_confirmed=False
        )

        resp = await admin_client.get("/v1/dashboard/timeseries?days=7")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["range_days"] == 7
        assert len(body["dates"]) == 7
        assert body["dates"][-1] == today.isoformat()
        assert body["dates"][0] == (today - timedelta(days=6)).isoformat()

        # Two distinct sales series, sorted by name (A before B)
        assert len(body["sales"]) == 2
        sales_a, sales_b = body["sales"]
        assert sales_a["product_id"] == prod_a.id
        assert sales_a["sku_code"] == "A-001"
        assert sales_a["quantity"][1] == 7  # five days ago = index 1 in 7-day window
        assert sales_a["quantity"][-1] == 10  # today = last index
        assert sales_a["quantity"][2] == 0  # gap-filled
        assert sales_a["revenue"][-1] == "1000.00"
        assert sales_a["revenue"][1] == "700.00"
        assert sales_b["quantity"][-1] == 5
        assert sales_b["revenue"][-1] == "1000.00"

        # Production: confirmed only, unconfirmed batch excluded
        assert len(body["production"]) == 2
        prod_series_a, prod_series_b = body["production"]
        assert prod_series_a["quantity"][-1] == 50  # NOT 50+999 — unconfirmed excluded
        assert prod_series_b["quantity"][1] == 80
        assert prod_series_b["quantity"][-1] == 0  # gap-filled

    async def test_excludes_cancelled_and_draft_orders(
        self, admin_client: AsyncClient, factory: Factory
    ):
        prod = await factory.create_product()
        await factory.create_order(
            status=OrderStatus.CANCELLED,
            order_date=date.today(),
            items=[{"product_id": prod.id, "quantity": 99, "price": Decimal("10")}],
        )
        await factory.create_order(
            status=OrderStatus.DRAFT,
            order_date=date.today(),
            items=[{"product_id": prod.id, "quantity": 99, "price": Decimal("10")}],
        )

        resp = await admin_client.get("/v1/dashboard/timeseries?days=7")
        body = resp.json()
        assert body["sales"] == []

    async def test_ranges_7_30_90_all_accepted(self, admin_client: AsyncClient):
        for days in (7, 30, 90):
            resp = await admin_client.get(f"/v1/dashboard/timeseries?days={days}")
            assert resp.status_code == 200, resp.text
            assert resp.json()["range_days"] == days
            assert len(resp.json()["dates"]) == days

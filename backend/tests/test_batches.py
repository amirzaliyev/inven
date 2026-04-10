"""
Tests for batch and subdivision services and API endpoints.
"""

from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.batch_workers import BatchWorker
from app.models.enums import SourceType, TransactionType
from app.models.inventory_transactions import (
    InventoryTransaction,
    InventoryTransactionLine,
)
from app.schemas.batches import BatchCreate, BatchUpdate
from app.schemas.subdivisions import SubDivisionCreate, SubDivisionMemberAdd
from app.services.batches import BatchService
from app.services.exceptions import Conflict, ResourceNotFound
from app.services.inventory_transactions import InventoryTransactionService
from app.services.subdivisions import SubDivisionService

from .conftest import Factory, make_user_context

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _batch_svc(session: AsyncSession) -> BatchService:
    inv_svc = InventoryTransactionService(session=session)
    return BatchService(session=session, inventory_transactions=inv_svc)


def _subdiv_svc(session: AsyncSession) -> SubDivisionService:
    return SubDivisionService(session=session)


# ===========================================================================
# Batch service tests
# ===========================================================================


class TestBatchServiceCreate:
    async def test_create_batch_without_subdivision(self, session, factory: Factory):
        """Batch created with no subdivision should have no workers."""
        user = await factory.create_user()
        product = await factory.create_product()
        svc = _batch_svc(session)
        ctx = make_user_context(user)

        batch = await svc.create(
            data=BatchCreate(
                batch_date=date(2026, 4, 1),
                product_id=product.id,
                quantity=50,
            ),
            user=ctx,
        )

        assert batch.id is not None
        assert batch.product_id == product.id
        assert batch.quantity == 50
        assert batch.is_confirmed is False
        assert batch.subdivision_id is None

        workers = (
            await session.scalars(
                select(BatchWorker).where(BatchWorker.batch_id == batch.id)
            )
        ).all()
        assert len(workers) == 0

    async def test_create_batch_with_subdivision_populates_attendance(
        self, session, factory: Factory
    ):
        """All active subdivision members should be added as batch workers."""
        user = await factory.create_user()
        product = await factory.create_product()
        subdivision = await factory.create_subdivision()
        emp1 = await factory.create_employee()
        emp2 = await factory.create_employee()
        await factory.add_subdivision_member(subdivision, emp1)
        await factory.add_subdivision_member(subdivision, emp2)

        svc = _batch_svc(session)
        ctx = make_user_context(user)

        batch = await svc.create(
            data=BatchCreate(
                batch_date=date(2026, 4, 1),
                product_id=product.id,
                quantity=100,
                subdivision_id=subdivision.id,
            ),
            user=ctx,
        )

        assert batch.subdivision_id == subdivision.id

        workers = (
            await session.scalars(
                select(BatchWorker).where(BatchWorker.batch_id == batch.id)
            )
        ).all()
        worker_emp_ids = {w.employee_id for w in workers}
        assert worker_emp_ids == {emp1.id, emp2.id}

    async def test_create_batch_with_absent_employees_excluded(
        self, session, factory: Factory
    ):
        """Absent employee IDs should be excluded from batch workers."""
        user = await factory.create_user()
        product = await factory.create_product()
        subdivision = await factory.create_subdivision()
        emp1 = await factory.create_employee()
        emp2 = await factory.create_employee()
        emp3 = await factory.create_employee()
        await factory.add_subdivision_member(subdivision, emp1)
        await factory.add_subdivision_member(subdivision, emp2)
        await factory.add_subdivision_member(subdivision, emp3)

        svc = _batch_svc(session)
        ctx = make_user_context(user)

        batch = await svc.create(
            data=BatchCreate(
                batch_date=date(2026, 4, 1),
                product_id=product.id,
                quantity=75,
                subdivision_id=subdivision.id,
                absent_employee_ids=[emp2.id],
            ),
            user=ctx,
        )

        workers = (
            await session.scalars(
                select(BatchWorker).where(BatchWorker.batch_id == batch.id)
            )
        ).all()
        worker_emp_ids = {w.employee_id for w in workers}
        assert emp2.id not in worker_emp_ids
        assert worker_emp_ids == {emp1.id, emp3.id}

    async def test_create_batch_all_members_absent_no_workers(
        self, session, factory: Factory
    ):
        """When all subdivision members are absent, no workers should be added."""
        user = await factory.create_user()
        product = await factory.create_product()
        subdivision = await factory.create_subdivision()
        emp1 = await factory.create_employee()
        emp2 = await factory.create_employee()
        await factory.add_subdivision_member(subdivision, emp1)
        await factory.add_subdivision_member(subdivision, emp2)

        svc = _batch_svc(session)
        ctx = make_user_context(user)

        batch = await svc.create(
            data=BatchCreate(
                batch_date=date(2026, 4, 1),
                product_id=product.id,
                quantity=60,
                subdivision_id=subdivision.id,
                absent_employee_ids=[emp1.id, emp2.id],
            ),
            user=ctx,
        )

        workers = (
            await session.scalars(
                select(BatchWorker).where(BatchWorker.batch_id == batch.id)
            )
        ).all()
        assert len(workers) == 0


class TestBatchServiceUpdate:
    async def test_update_unconfirmed_batch_succeeds(self, session, factory: Factory):
        """Updating an unconfirmed batch should apply the changes."""
        user = await factory.create_user()
        product = await factory.create_product()
        batch = await factory.create_batch(product=product, created_by=user)
        svc = _batch_svc(session)
        ctx = make_user_context(user)

        updated = await svc.update(
            id=batch.id,
            data=BatchUpdate(quantity=200),
            user=ctx,
        )

        assert updated.quantity == 200

    async def test_update_confirmed_batch_raises_conflict(
        self, session, factory: Factory
    ):
        """Updating a confirmed batch should raise Conflict with code update_not_allowed."""
        user = await factory.create_user()
        product = await factory.create_product()
        batch = await factory.create_batch(
            product=product, created_by=user, is_confirmed=True
        )
        svc = _batch_svc(session)
        ctx = make_user_context(user)

        with pytest.raises(Conflict) as exc_info:
            await svc.update(
                id=batch.id,
                data=BatchUpdate(quantity=999),
                user=ctx,
            )

        assert exc_info.value.code == "update_not_allowed"


class TestBatchServiceConfirm:
    async def test_confirm_batch_sets_confirmed_and_creates_transaction(
        self, session, factory: Factory
    ):
        """Confirming a batch should set is_confirmed=True and create a CREDIT inventory transaction."""
        user = await factory.create_user()
        product = await factory.create_product()
        batch = await factory.create_batch(
            product=product, created_by=user, quantity=150
        )
        svc = _batch_svc(session)
        ctx = make_user_context(user)

        confirmed = await svc.confirm(batch_id=batch.id, user=ctx)

        assert confirmed.is_confirmed is True

        # Verify inventory transaction was created
        txn = (
            await session.scalars(
                select(InventoryTransaction).where(
                    InventoryTransaction.source_type == SourceType.BATCH,
                    InventoryTransaction.source_id == batch.id,
                )
            )
        ).one()
        assert txn.transaction_type == TransactionType.CREDIT

        lines = (
            await session.scalars(
                select(InventoryTransactionLine).where(
                    InventoryTransactionLine.transaction_id == txn.id,
                )
            )
        ).all()
        assert len(lines) == 1
        assert lines[0].product_id == product.id
        assert lines[0].quantity == 150

    async def test_confirm_already_confirmed_batch_raises_conflict(
        self, session, factory: Factory
    ):
        """Confirming an already-confirmed batch should raise Conflict with code already_confirmed."""
        user = await factory.create_user()
        product = await factory.create_product()
        batch = await factory.create_batch(
            product=product, created_by=user, is_confirmed=True
        )
        svc = _batch_svc(session)
        ctx = make_user_context(user)

        with pytest.raises(Conflict) as exc_info:
            await svc.confirm(batch_id=batch.id, user=ctx)

        assert exc_info.value.code == "already_confirmed"


class TestBatchServiceList:
    async def test_list_batches_ordered_unconfirmed_first_then_by_date_desc(
        self, session, factory: Factory
    ):
        """Unconfirmed batches should appear first, then sorted by batch_date descending."""
        user = await factory.create_user()
        product = await factory.create_product()

        b_confirmed_old = await factory.create_batch(
            product=product,
            created_by=user,
            batch_date=date(2026, 3, 1),
            is_confirmed=True,
        )
        b_confirmed_new = await factory.create_batch(
            product=product,
            created_by=user,
            batch_date=date(2026, 4, 1),
            is_confirmed=True,
        )
        b_unconfirmed_old = await factory.create_batch(
            product=product,
            created_by=user,
            batch_date=date(2026, 3, 15),
            is_confirmed=False,
        )
        b_unconfirmed_new = await factory.create_batch(
            product=product,
            created_by=user,
            batch_date=date(2026, 4, 5),
            is_confirmed=False,
        )

        svc = _batch_svc(session)
        batches, total = await svc.list(page=1, size=10)

        assert total == 4
        ids = [b.id for b in batches]

        # Unconfirmed first (is_confirmed=False sorts before True)
        # Within each group, sorted by batch_date DESC
        assert ids.index(b_unconfirmed_new.id) < ids.index(b_confirmed_old.id)
        assert ids.index(b_unconfirmed_new.id) < ids.index(b_confirmed_new.id)
        assert ids.index(b_unconfirmed_old.id) < ids.index(b_confirmed_old.id)
        # Within unconfirmed: newer date first
        assert ids.index(b_unconfirmed_new.id) < ids.index(b_unconfirmed_old.id)
        # Within confirmed: newer date first
        assert ids.index(b_confirmed_new.id) < ids.index(b_confirmed_old.id)


class TestBatchServiceDelete:
    async def test_delete_batch_soft_deletes(self, session, factory: Factory):
        """Deleting a batch should set is_active=False (soft delete)."""
        user = await factory.create_user()
        product = await factory.create_product()
        batch = await factory.create_batch(product=product, created_by=user)
        svc = _batch_svc(session)

        await svc.delete(id=batch.id)

        await session.refresh(batch)
        assert batch.is_active is False
        assert batch.deleted_at is not None


# ===========================================================================
# SubDivision service tests
# ===========================================================================


class TestSubDivisionServiceCreate:
    async def test_create_subdivision_succeeds(self, session, factory: Factory):
        """Creating a subdivision should return a valid object."""
        svc = _subdiv_svc(session)

        subdiv = await svc.create(
            data=SubDivisionCreate(name="Line A", description="First production line")
        )

        assert subdiv.id is not None
        assert subdiv.name == "Line A"
        assert subdiv.description == "First production line"

    async def test_create_duplicate_name_raises_conflict(
        self, session, factory: Factory
    ):
        """Creating a subdivision with a duplicate name should raise Conflict."""
        svc = _subdiv_svc(session)

        await svc.create(data=SubDivisionCreate(name="Unique Line"))

        with pytest.raises(Conflict):
            await svc.create(data=SubDivisionCreate(name="Unique Line"))


class TestSubDivisionServiceMembers:
    async def test_add_member_succeeds(self, session, factory: Factory):
        """Adding an employee to a subdivision should create a member record."""
        svc = _subdiv_svc(session)
        subdivision = await factory.create_subdivision()
        employee = await factory.create_employee()

        member = await svc.add_member(
            subdivision_id=subdivision.id,
            data=SubDivisionMemberAdd(employee_id=employee.id),
        )

        assert member.subdivision_id == subdivision.id
        assert member.employee_id == employee.id

    async def test_add_same_employee_again_raises_conflict(
        self, session, factory: Factory
    ):
        """Adding the same employee twice should raise Conflict with code member_already_in_subdivision."""
        svc = _subdiv_svc(session)
        subdivision = await factory.create_subdivision()
        employee = await factory.create_employee()

        await svc.add_member(
            subdivision_id=subdivision.id,
            data=SubDivisionMemberAdd(employee_id=employee.id),
        )

        with pytest.raises(Conflict) as exc_info:
            await svc.add_member(
                subdivision_id=subdivision.id,
                data=SubDivisionMemberAdd(employee_id=employee.id),
            )

        assert exc_info.value.code == "member_already_in_subdivision"

    async def test_remove_member_soft_deletes(self, session, factory: Factory):
        """Removing a member should set is_active=False."""
        svc = _subdiv_svc(session)
        subdivision = await factory.create_subdivision()
        employee = await factory.create_employee()
        member = await factory.add_subdivision_member(subdivision, employee)

        await svc.remove_member(subdivision_id=subdivision.id, member_id=member.id)

        await session.refresh(member)
        assert member.is_active is False
        assert member.deleted_at is not None

    async def test_remove_nonexistent_member_raises_not_found(
        self, session, factory: Factory
    ):
        """Removing a member that does not exist should raise ResourceNotFound."""
        svc = _subdiv_svc(session)
        subdivision = await factory.create_subdivision()

        with pytest.raises(ResourceNotFound) as exc_info:
            await svc.remove_member(subdivision_id=subdivision.id, member_id=99999)

        assert exc_info.value.code == "member_not_found"


class TestSubDivisionServiceQuery:
    async def test_get_with_members_returns_subdivision_with_members(
        self, session, factory: Factory
    ):
        """get_with_members should return the subdivision along with its active members."""
        svc = _subdiv_svc(session)
        subdivision = await factory.create_subdivision(name="Line B")
        emp1 = await factory.create_employee()
        emp2 = await factory.create_employee()
        await factory.add_subdivision_member(subdivision, emp1)
        await factory.add_subdivision_member(subdivision, emp2)

        result = await svc.get_with_members(subdivision_id=subdivision.id)

        assert result.id == subdivision.id
        assert result.name == "Line B"
        assert len(result.members) == 2
        member_emp_ids = {m.employee_id for m in result.members}
        assert member_emp_ids == {emp1.id, emp2.id}

    async def test_list_with_search_filter(self, session, factory: Factory):
        """Searching subdivisions should filter by name (case-insensitive)."""
        svc = _subdiv_svc(session)
        await factory.create_subdivision(name="Alpha Line")
        await factory.create_subdivision(name="Beta Line")
        await factory.create_subdivision(name="Gamma Unit")

        results, total = await svc.list(page=1, size=10, search="line")

        assert total == 2
        names = {s.name for s in results}
        assert names == {"Alpha Line", "Beta Line"}


# ===========================================================================
# API-level tests
# ===========================================================================


class TestBatchAPI:
    async def test_post_create_batch(self, admin_client, admin_user, factory: Factory):
        """POST /v1/batches should create a batch and return it."""
        product = await factory.create_product(created_by=admin_user)

        resp = await admin_client.post(
            "/v1/batches",
            json={
                "batch_date": "2026-04-10",
                "product_id": product.id,
                "quantity": 100,
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["product_id"] == product.id
        assert body["quantity"] == 100
        assert body["is_confirmed"] is False

    async def test_get_list_batches_paginated(
        self, admin_client, admin_user, factory: Factory
    ):
        """GET /v1/batches should return a paginated list."""
        product = await factory.create_product(created_by=admin_user)
        await factory.create_batch(product=product, created_by=admin_user)
        await factory.create_batch(product=product, created_by=admin_user)

        resp = await admin_client.get("/v1/batches", params={"page": 1, "size": 10})

        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total" in body
        assert body["total"] >= 2

    async def test_put_update_batch(self, admin_client, admin_user, factory: Factory):
        """PUT /v1/batches/{id} should update an unconfirmed batch."""
        product = await factory.create_product(created_by=admin_user)
        batch = await factory.create_batch(product=product, created_by=admin_user)

        resp = await admin_client.put(
            f"/v1/batches/{batch.id}",
            json={"quantity": 250},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["quantity"] == 250

    async def test_patch_confirm_batch(
        self, admin_client, admin_user, factory: Factory
    ):
        """PATCH /v1/batches/{id} should confirm the batch."""
        product = await factory.create_product(created_by=admin_user)
        batch = await factory.create_batch(product=product, created_by=admin_user)

        resp = await admin_client.patch(f"/v1/batches/{batch.id}")

        assert resp.status_code == 200
        body = resp.json()
        assert body["is_confirmed"] is True

    async def test_employee_can_read_batches_but_not_write(
        self, employee_client, admin_user, factory: Factory
    ):
        """Employee role should GET 200 on batches but POST 403."""
        product = await factory.create_product(created_by=admin_user)
        await factory.create_batch(product=product, created_by=admin_user)

        read_resp = await employee_client.get(
            "/v1/batches", params={"page": 1, "size": 10}
        )
        assert read_resp.status_code == 200

        write_resp = await employee_client.post(
            "/v1/batches",
            json={
                "batch_date": "2026-04-10",
                "product_id": product.id,
                "quantity": 50,
            },
        )
        assert write_resp.status_code == 403


class TestSubDivisionAPI:
    async def test_post_create_subdivision(self, admin_client):
        """POST /v1/subdivisions should create a subdivision and return 201."""
        resp = await admin_client.post(
            "/v1/subdivisions",
            json={"name": "API Test Line", "description": "Created via API"},
        )

        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "API Test Line"
        assert "members" in body

    async def test_post_add_member(self, admin_client, admin_user, factory: Factory):
        """POST /v1/subdivisions/{id}/members should add a member and return 201."""
        subdivision = await factory.create_subdivision()
        employee = await factory.create_employee()

        resp = await admin_client.post(
            f"/v1/subdivisions/{subdivision.id}/members",
            json={"employee_id": employee.id},
        )

        assert resp.status_code == 201
        body = resp.json()
        assert body["employee_id"] == employee.id
        assert body["subdivision_id"] == subdivision.id

    async def test_delete_remove_member(
        self, admin_client, admin_user, factory: Factory
    ):
        """DELETE /v1/subdivisions/{id}/members/{member_id} should return 204."""
        subdivision = await factory.create_subdivision()
        employee = await factory.create_employee()
        member = await factory.add_subdivision_member(subdivision, employee)

        resp = await admin_client.delete(
            f"/v1/subdivisions/{subdivision.id}/members/{member.id}",
        )

        assert resp.status_code == 204

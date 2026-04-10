"""
Tests for payroll generation and management.

Covers:
- Service-level: generation for SALARY/COMMISSION employees, status transitions,
  commission calculations, edge cases (terminated, unconfirmed, absent).
- API-level: endpoints, permissions, pagination.
- Full pipeline end-to-end test.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.models.enums import EmploymentType, PayrollStatus
from app.models.users import UserRole
from app.schemas.payroll import PayrollGenerate
from app.services.exceptions import Conflict
from app.services.payroll import PayrollService

from .conftest import make_user_context

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PERIOD_START = date(2026, 4, 1)
PERIOD_END = date(2026, 4, 30)


def _gen_data(start: date = PERIOD_START, end: date = PERIOD_END) -> PayrollGenerate:
    return PayrollGenerate(period_start=start, period_end=end)


# ===========================================================================
# Service-level tests
# ===========================================================================


class TestPayrollGenerateSalary:
    """Test 1: SALARY employee payslip generation."""

    async def test_salary_employee_payslip(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        emp = await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("5000000.00"),
            created_by=admin,
        )

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))

        payroll = await svc.get_with_payslips(payroll.id)
        assert len(payroll.payslips) == 1

        slip = payroll.payslips[0]
        assert slip.employee_id == emp.id
        assert slip.base_salary == Decimal("5000000.00")
        assert slip.commission_amount == Decimal("0")
        assert slip.total_amount == Decimal("5000000.00")


class TestPayrollGenerateCommissionSingleWorker:
    """Test 2: COMMISSION employee, 1 batch, 1 worker."""

    async def test_single_worker_commission(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        product = await factory.create_product(created_by=admin)
        subdivision = await factory.create_subdivision()
        rate = await factory.create_commission_rate(
            product=product, rate_per_unit=Decimal("50.0000")
        )

        emp = await factory.create_employee(
            employment_type=EmploymentType.COMMISSION, created_by=admin
        )
        await factory.add_subdivision_member(subdivision, emp)

        batch = await factory.create_batch(
            product=product,
            subdivision=subdivision,
            quantity=100,
            batch_date=date(2026, 4, 15),
            is_confirmed=True,
            created_by=admin,
        )
        await factory.add_batch_worker(batch, emp)

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        payroll = await svc.get_with_payslips(payroll.id)

        assert len(payroll.payslips) == 1
        slip = payroll.payslips[0]
        # quantity_share = 100 / 1 = 100.0000; amount = 100.0000 * 50.0000 = 5000.00
        assert slip.commission_amount == Decimal("5000.00")
        assert slip.total_amount == Decimal("5000.00")
        assert slip.base_salary == Decimal("0")


class TestPayrollGenerateCommissionMultipleWorkers:
    """Test 3: COMMISSION employee, 1 batch, 3 workers."""

    async def test_three_workers_share_batch(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        product = await factory.create_product(created_by=admin)
        subdivision = await factory.create_subdivision()
        await factory.create_commission_rate(
            product=product, rate_per_unit=Decimal("60.0000")
        )

        workers = []
        for _ in range(3):
            emp = await factory.create_employee(
                employment_type=EmploymentType.COMMISSION, created_by=admin
            )
            await factory.add_subdivision_member(subdivision, emp)
            workers.append(emp)

        batch = await factory.create_batch(
            product=product,
            subdivision=subdivision,
            quantity=100,
            batch_date=date(2026, 4, 10),
            is_confirmed=True,
            created_by=admin,
        )
        for w in workers:
            await factory.add_batch_worker(batch, w)

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        payroll = await svc.get_with_payslips(payroll.id)

        assert len(payroll.payslips) == 3
        # quantity_share = 100 / 3 = 33.3333; amount = 33.3333 * 60.0000 = 2000.00 (rounded)
        expected_share = (Decimal("100") / Decimal("3")).quantize(Decimal("0.0001"))
        expected_amount = (expected_share * Decimal("60.0000")).quantize(
            Decimal("0.01")
        )

        for slip in payroll.payslips:
            assert slip.commission_amount == expected_amount
            assert slip.total_amount == expected_amount


class TestPayrollCommissionMultipleBatches:
    """Test 4: COMMISSION employee with multiple batches."""

    async def test_commissions_summed_across_batches(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        product = await factory.create_product(created_by=admin)
        subdivision = await factory.create_subdivision()
        await factory.create_commission_rate(
            product=product, rate_per_unit=Decimal("10.0000")
        )

        emp = await factory.create_employee(
            employment_type=EmploymentType.COMMISSION, created_by=admin
        )
        await factory.add_subdivision_member(subdivision, emp)

        # Two batches, each with 200 units
        for day in (5, 20):
            batch = await factory.create_batch(
                product=product,
                subdivision=subdivision,
                quantity=200,
                batch_date=date(2026, 4, day),
                is_confirmed=True,
                created_by=admin,
            )
            await factory.add_batch_worker(batch, emp)

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        payroll = await svc.get_with_payslips(payroll.id)

        slip = payroll.payslips[0]
        # Each batch: 200 / 1 * 10 = 2000.00; total = 4000.00
        assert slip.commission_amount == Decimal("4000.00")
        assert slip.total_amount == Decimal("4000.00")


class TestPayrollCommissionAbsentFromBatch:
    """Test 5: COMMISSION employee absent from a batch gets no commission for it."""

    async def test_absent_worker_no_commission_for_batch(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        product = await factory.create_product(created_by=admin)
        subdivision = await factory.create_subdivision()
        await factory.create_commission_rate(
            product=product, rate_per_unit=Decimal("10.0000")
        )

        emp_present = await factory.create_employee(
            employment_type=EmploymentType.COMMISSION, created_by=admin
        )
        emp_absent = await factory.create_employee(
            employment_type=EmploymentType.COMMISSION, created_by=admin
        )
        await factory.add_subdivision_member(subdivision, emp_present)
        await factory.add_subdivision_member(subdivision, emp_absent)

        batch = await factory.create_batch(
            product=product,
            subdivision=subdivision,
            quantity=100,
            batch_date=date(2026, 4, 10),
            is_confirmed=True,
            created_by=admin,
        )
        # Only emp_present is added as a worker
        await factory.add_batch_worker(batch, emp_present)

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        payroll = await svc.get_with_payslips(payroll.id)

        slips_by_emp = {s.employee_id: s for s in payroll.payslips}
        assert slips_by_emp[emp_present.id].commission_amount == Decimal("1000.00")
        assert slips_by_emp[emp_absent.id].commission_amount == Decimal("0")


class TestPayrollTerminatedEmployee:
    """Tests 6 & 7: terminated employees."""

    async def test_terminated_before_period_excluded(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        emp = await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("1000.00"),
            created_by=admin,
        )
        emp.terminated_at = date(2026, 3, 15)  # Before period_start (April 1)
        await session.flush()

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        payroll = await svc.get_with_payslips(payroll.id)

        assert len(payroll.payslips) == 0

    async def test_terminated_during_period_included(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        emp = await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("2000.00"),
            created_by=admin,
        )
        emp.terminated_at = date(2026, 4, 15)  # After period_start
        await session.flush()

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        payroll = await svc.get_with_payslips(payroll.id)

        assert len(payroll.payslips) == 1
        assert payroll.payslips[0].employee_id == emp.id


class TestPayrollNoConfirmedBatches:
    """Test 8: COMMISSION employee with no confirmed batches in period."""

    async def test_commission_employee_zero_commission(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        await factory.create_employee(
            employment_type=EmploymentType.COMMISSION, created_by=admin
        )

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        payroll = await svc.get_with_payslips(payroll.id)

        assert len(payroll.payslips) == 1
        slip = payroll.payslips[0]
        assert slip.commission_amount == Decimal("0")
        assert slip.total_amount == Decimal("0")


class TestPayrollUnconfirmedBatchExcluded:
    """Test 9: Unconfirmed batch excluded from commission calculation."""

    async def test_unconfirmed_batch_not_counted(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        product = await factory.create_product(created_by=admin)
        subdivision = await factory.create_subdivision()
        await factory.create_commission_rate(
            product=product, rate_per_unit=Decimal("100.0000")
        )

        emp = await factory.create_employee(
            employment_type=EmploymentType.COMMISSION, created_by=admin
        )
        await factory.add_subdivision_member(subdivision, emp)

        batch = await factory.create_batch(
            product=product,
            subdivision=subdivision,
            quantity=50,
            batch_date=date(2026, 4, 10),
            is_confirmed=False,  # NOT confirmed
            created_by=admin,
        )
        await factory.add_batch_worker(batch, emp)

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        payroll = await svc.get_with_payslips(payroll.id)

        slip = payroll.payslips[0]
        assert slip.commission_amount == Decimal("0")


class TestCommissionPrecision:
    """Test 10: quantity_share quantized to 4 decimals, amount to 2 decimals."""

    async def test_precision_quantization(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        product = await factory.create_product(created_by=admin)
        subdivision = await factory.create_subdivision()
        await factory.create_commission_rate(
            product=product, rate_per_unit=Decimal("33.3333")
        )

        workers = []
        for _ in range(7):
            emp = await factory.create_employee(
                employment_type=EmploymentType.COMMISSION, created_by=admin
            )
            await factory.add_subdivision_member(subdivision, emp)
            workers.append(emp)

        batch = await factory.create_batch(
            product=product,
            subdivision=subdivision,
            quantity=1000,
            batch_date=date(2026, 4, 15),
            is_confirmed=True,
            created_by=admin,
        )
        for w in workers:
            await factory.add_batch_worker(batch, w)

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))

        # Eagerly load payslips first
        payroll = await svc.get_with_payslips(payroll.id)
        any_slip = payroll.payslips[0]
        payslip_detail = await svc.get_payslip(any_slip.id)

        line = payslip_detail.commission_lines[0]
        expected_share = (Decimal("1000") / Decimal("7")).quantize(Decimal("0.0001"))
        expected_amount = (expected_share * Decimal("33.3333")).quantize(
            Decimal("0.01")
        )

        assert line.quantity_share == expected_share
        assert line.amount == expected_amount
        assert line.present_count == 7


# ===========================================================================
# Status transition tests
# ===========================================================================


class TestPayrollApprove:
    """Tests 11-13: approve transitions."""

    async def test_approve_draft_payroll(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("1000.00"),
            created_by=admin,
        )

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))

        result = await svc.approve(payroll.id, user=make_user_context(admin))
        assert result.status == PayrollStatus.APPROVED
        assert result.approved_by_id == admin.id

    async def test_approve_already_approved_raises_conflict(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("1000.00"),
            created_by=admin,
        )

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        await svc.approve(payroll.id, user=make_user_context(admin))

        with pytest.raises(Conflict):
            await svc.approve(payroll.id, user=make_user_context(admin))

    async def test_approve_paid_payroll_raises_conflict(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("1000.00"),
            created_by=admin,
        )

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        await svc.approve(payroll.id, user=make_user_context(admin))
        await svc.mark_paid(payroll.id, user=make_user_context(admin))

        with pytest.raises(Conflict):
            await svc.approve(payroll.id, user=make_user_context(admin))


class TestPayrollMarkPaid:
    """Tests 14-16: mark paid transitions."""

    async def test_mark_paid_approved_payroll(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("1000.00"),
            created_by=admin,
        )

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        await svc.approve(payroll.id, user=make_user_context(admin))

        result = await svc.mark_paid(payroll.id, user=make_user_context(admin))
        assert result.status == PayrollStatus.PAID

    async def test_mark_paid_draft_raises_conflict(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("1000.00"),
            created_by=admin,
        )

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))

        with pytest.raises(Conflict):
            await svc.mark_paid(payroll.id, user=make_user_context(admin))

    async def test_mark_paid_already_paid_raises_conflict(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("1000.00"),
            created_by=admin,
        )

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        await svc.approve(payroll.id, user=make_user_context(admin))
        await svc.mark_paid(payroll.id, user=make_user_context(admin))

        with pytest.raises(Conflict):
            await svc.mark_paid(payroll.id, user=make_user_context(admin))


# ===========================================================================
# Query / retrieval tests
# ===========================================================================


class TestPayrollRetrieval:
    """Tests 17-19: get_with_payslips, get_payslip, list with filter."""

    async def test_get_with_payslips(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("3000.00"),
            created_by=admin,
        )

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))

        result = await svc.get_with_payslips(payroll.id)
        assert result.id == payroll.id
        assert len(result.payslips) == 1
        assert result.payslips[0].base_salary == Decimal("3000.00")

    async def test_get_payslip_with_commission_lines(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        product = await factory.create_product(created_by=admin)
        subdivision = await factory.create_subdivision()
        await factory.create_commission_rate(
            product=product, rate_per_unit=Decimal("25.0000")
        )

        emp = await factory.create_employee(
            employment_type=EmploymentType.COMMISSION, created_by=admin
        )
        await factory.add_subdivision_member(subdivision, emp)

        batch = await factory.create_batch(
            product=product,
            subdivision=subdivision,
            quantity=40,
            batch_date=date(2026, 4, 12),
            is_confirmed=True,
            created_by=admin,
        )
        await factory.add_batch_worker(batch, emp)

        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=make_user_context(admin))
        payroll = await svc.get_with_payslips(payroll.id)

        payslip = await svc.get_payslip(payroll.payslips[0].id)
        assert len(payslip.commission_lines) == 1

        line = payslip.commission_lines[0]
        assert line.batch_id == batch.id
        assert line.product_id == product.id
        assert line.batch_quantity == 40
        assert line.present_count == 1
        assert line.quantity_share == Decimal("40.0000")
        assert line.rate_per_unit == Decimal("25.0000")
        assert line.amount == Decimal("1000.00")

    async def test_list_payrolls_with_status_filter(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("1000.00"),
            created_by=admin,
        )
        ctx = make_user_context(admin)

        svc = PayrollService(session=session)
        # Create two payrolls: one DRAFT, one APPROVED
        p1 = await svc.generate(
            data=PayrollGenerate(
                period_start=date(2026, 3, 1), period_end=date(2026, 3, 31)
            ),
            user=ctx,
        )
        p2 = await svc.generate(
            data=PayrollGenerate(
                period_start=date(2026, 4, 1), period_end=date(2026, 4, 30)
            ),
            user=ctx,
        )
        await svc.approve(p2.id, user=ctx)

        # Filter DRAFT only
        drafts, total_d = await svc.list(page=1, size=10, status=PayrollStatus.DRAFT)
        assert total_d == 1
        assert drafts[0].id == p1.id

        # Filter APPROVED only
        approved, total_a = await svc.list(
            page=1, size=10, status=PayrollStatus.APPROVED
        )
        assert total_a == 1
        assert approved[0].id == p2.id

        # No filter
        all_payrolls, total_all = await svc.list(page=1, size=10, status=None)
        assert total_all == 2


# ===========================================================================
# API-level tests
# ===========================================================================


class TestPayrollAPI:
    """Tests 20-25: HTTP endpoint tests."""

    async def test_post_generate_payroll_201(self, admin_client, factory, admin_user):
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("5000.00"),
            created_by=admin_user,
        )

        resp = await admin_client.post(
            "/v1/payroll",
            json={"period_start": "2026-04-01", "period_end": "2026-04-30"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "DRAFT"
        assert len(data["payslips"]) == 1
        assert data["payslip_count"] == 1

    async def test_post_approve_200(self, admin_client, factory, admin_user):
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("5000.00"),
            created_by=admin_user,
        )

        gen_resp = await admin_client.post(
            "/v1/payroll",
            json={"period_start": "2026-04-01", "period_end": "2026-04-30"},
        )
        payroll_id = gen_resp.json()["id"]

        resp = await admin_client.post(f"/v1/payroll/{payroll_id}/approve")
        assert resp.status_code == 200
        assert resp.json()["status"] == "APPROVED"

    async def test_post_mark_paid_200(self, admin_client, factory, admin_user):
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("5000.00"),
            created_by=admin_user,
        )

        gen_resp = await admin_client.post(
            "/v1/payroll",
            json={"period_start": "2026-04-01", "period_end": "2026-04-30"},
        )
        payroll_id = gen_resp.json()["id"]
        await admin_client.post(f"/v1/payroll/{payroll_id}/approve")

        resp = await admin_client.post(f"/v1/payroll/{payroll_id}/mark-paid")
        assert resp.status_code == 200
        assert resp.json()["status"] == "PAID"

    async def test_get_list_payrolls_pagination(
        self, admin_client, factory, admin_user
    ):
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("1000.00"),
            created_by=admin_user,
        )

        # Generate 3 payrolls
        for month in (1, 2, 3):
            await admin_client.post(
                "/v1/payroll",
                json={
                    "period_start": f"2026-0{month}-01",
                    "period_end": f"2026-0{month}-28",
                },
            )

        resp = await admin_client.get("/v1/payroll", params={"page": 1, "size": 2})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 2
        assert data["pages"] == 2

    async def test_employee_cannot_generate_payroll_403(
        self, employee_client, factory, employee_user
    ):
        resp = await employee_client.post(
            "/v1/payroll",
            json={"period_start": "2026-04-01", "period_end": "2026-04-30"},
        )
        assert resp.status_code == 403

    async def test_admin_can_generate_and_approve(
        self, admin_client, factory, admin_user
    ):
        await factory.create_employee(
            employment_type=EmploymentType.SALARY,
            base_salary=Decimal("4000.00"),
            created_by=admin_user,
        )

        gen_resp = await admin_client.post(
            "/v1/payroll",
            json={"period_start": "2026-04-01", "period_end": "2026-04-30"},
        )
        assert gen_resp.status_code == 201

        payroll_id = gen_resp.json()["id"]
        approve_resp = await admin_client.post(f"/v1/payroll/{payroll_id}/approve")
        assert approve_resp.status_code == 200
        assert approve_resp.json()["status"] == "APPROVED"


# ===========================================================================
# Full pipeline end-to-end test
# ===========================================================================


class TestPayrollFullPipeline:
    """Test 26: end-to-end pipeline with exact commission verification."""

    async def test_full_pipeline_exact_commission(self, session, factory):
        admin = await factory.create_user(role=UserRole.ADMIN)
        ctx = make_user_context(admin)

        # Create product with commission rate
        product = await factory.create_product(name="Red Brick", created_by=admin)
        rate = await factory.create_commission_rate(
            product=product,
            rate_per_unit=Decimal("75.5000"),
            effective_from=date(2026, 1, 1),
        )

        # Create subdivision with 2 commission employees
        subdivision = await factory.create_subdivision(name="Line A")

        emp_a = await factory.create_employee(
            full_name="Worker A",
            employment_type=EmploymentType.COMMISSION,
            created_by=admin,
        )
        emp_b = await factory.create_employee(
            full_name="Worker B",
            employment_type=EmploymentType.COMMISSION,
            created_by=admin,
        )
        await factory.add_subdivision_member(subdivision, emp_a)
        await factory.add_subdivision_member(subdivision, emp_b)

        # Create a confirmed batch with both workers
        batch = await factory.create_batch(
            product=product,
            subdivision=subdivision,
            quantity=500,
            batch_date=date(2026, 4, 10),
            is_confirmed=True,
            created_by=admin,
        )
        await factory.add_batch_worker(batch, emp_a)
        await factory.add_batch_worker(batch, emp_b)

        # Generate payroll
        svc = PayrollService(session=session)
        payroll = await svc.generate(data=_gen_data(), user=ctx)

        assert payroll.status == PayrollStatus.DRAFT

        # Verify exact commission amounts
        payroll = await svc.get_with_payslips(payroll.id)
        assert len(payroll.payslips) == 2

        # quantity_share = 500 / 2 = 250.0000
        # amount = 250.0000 * 75.5000 = 18875.00
        expected_share = Decimal("250.0000")
        expected_amount = Decimal("18875.00")

        for slip in payroll.payslips:
            assert slip.commission_amount == expected_amount
            assert slip.total_amount == expected_amount
            assert slip.base_salary == Decimal("0")

            # Verify commission line details
            payslip_detail = await svc.get_payslip(slip.id)
            assert len(payslip_detail.commission_lines) == 1

            line = payslip_detail.commission_lines[0]
            assert line.batch_id == batch.id
            assert line.subdivision_id == subdivision.id
            assert line.product_id == product.id
            assert line.batch_quantity == 500
            assert line.present_count == 2
            assert line.quantity_share == expected_share
            assert line.rate_per_unit == Decimal("75.5000")
            assert line.amount == expected_amount

        # Approve
        payroll = await svc.approve(payroll.id, user=ctx)
        assert payroll.status == PayrollStatus.APPROVED
        assert payroll.approved_by_id == admin.id

        # Mark paid
        payroll = await svc.mark_paid(payroll.id, user=ctx)
        assert payroll.status == PayrollStatus.PAID

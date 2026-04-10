"""
Test infrastructure: async DB session, authenticated HTTP clients, data factories.

Every test runs inside a DB transaction that rolls back at the end,
so tests are fully isolated without needing to recreate tables each time.
"""

from datetime import date
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.auth.jwt import create_access_token
from app.auth.passwords import hash_password
from app.auth.permissions import get_permissions_for_role
from app.models.base import BaseModel
from app.models.batch_workers import BatchWorker
from app.models.batches import Batch
from app.models.commission_rates import ProductCommissionRate
from app.models.customers import Customer
from app.models.employees import Employee
from app.models.enums import EmploymentType, OrderStatus
from app.models.orders import Order, OrderItem
from app.models.products import Product
from app.models.subdivisions import SubDivision, SubDivisionMember
from app.models.users import User, UserRole
from app.schemas.auth import UserContext

TEST_DATABASE_URL = "postgresql+asyncpg://miles:me@localhost:5432/inven_test"

engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession, autoflush=False
)


@pytest.fixture(scope="session", autouse=True)
async def _setup_db():
    """Create all tables once per test session, drop at the end."""
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def session():
    """
    Yield an async session wrapped in a transaction + SAVEPOINT.
    Service code may call session.commit(); the event listener below
    re-opens a nested savepoint so the outer transaction is never
    actually committed.  On teardown the outer transaction rolls back,
    leaving the DB clean.
    """
    async with engine.connect() as conn:
        txn = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, autoflush=False)

        # Start a SAVEPOINT; when service code calls commit() on the
        # session, SQLAlchemy will release this savepoint instead of
        # committing the real transaction.
        nested = await conn.begin_nested()

        # After each commit (savepoint release), automatically open a
        # new nested savepoint so subsequent operations still work.
        @event.listens_for(session.sync_session, "after_transaction_end")
        def _restart_savepoint(db_session, transaction):
            if transaction.nested and not transaction._parent.nested:
                db_session.begin_nested()

        try:
            yield session
        finally:
            await session.close()
            await txn.rollback()


# ---------------------------------------------------------------------------
# FastAPI app with overridden DB session
# ---------------------------------------------------------------------------


@pytest.fixture
async def app(session: AsyncSession):
    """Return a FastAPI app whose DB dependency points at the test session."""
    from app.core.db import get_async_session
    from app.main import app as _app

    async def _override():
        yield session

    _app.dependency_overrides[get_async_session] = _override
    yield _app
    _app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Data factories
# ---------------------------------------------------------------------------


class Factory:
    """Helper to insert test data into the session."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self._user_seq = 0
        self._product_seq = 0
        self._employee_seq = 0
        self._customer_seq = 0
        self._subdivision_seq = 0

    async def create_user(
        self,
        *,
        username: str | None = None,
        display_name: str | None = None,
        password: str = "testpass123",
        role: str = UserRole.ADMIN,
        email: str | None = None,
        phone_number: str | None = None,
        must_change_password: bool = False,
    ) -> User:
        self._user_seq += 1
        username = username or f"testuser_{self._user_seq}"
        display_name = display_name or f"Test User {self._user_seq}"
        user = User(
            username=username,
            display_name=display_name,
            password_hash=hash_password(password),
            role=role,
            email=email,
            phone_number=phone_number,
            must_change_password=must_change_password,
        )
        self.session.add(user)
        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def create_product(
        self,
        *,
        name: str | None = None,
        sku_code: str | None = None,
        created_by: User | None = None,
    ) -> Product:
        self._product_seq += 1
        product = Product(
            name=name or f"Product {self._product_seq}",
            sku_code=sku_code or f"SKU-{self._product_seq:04d}",
            created_by_id=created_by.id if created_by else None,
        )
        self.session.add(product)
        await self.session.flush()
        await self.session.refresh(product)
        return product

    async def create_customer(
        self,
        *,
        full_name: str | None = None,
        phone_number: str | None = None,
        created_by: User | None = None,
    ) -> Customer:
        self._customer_seq += 1
        customer = Customer(
            full_name=full_name or f"Customer {self._customer_seq}",
            phone_number=phone_number,
            created_by_id=created_by.id if created_by else None,
        )
        self.session.add(customer)
        await self.session.flush()
        await self.session.refresh(customer)
        return customer

    async def create_employee(
        self,
        *,
        full_name: str | None = None,
        employee_number: str | None = None,
        position: str = "Worker",
        department: str | None = None,
        employment_type: EmploymentType = EmploymentType.COMMISSION,
        base_salary: Decimal | None = None,
        hired_at: date | None = None,
        created_by: User | None = None,
        user: User | None = None,
    ) -> Employee:
        self._employee_seq += 1
        if not created_by:
            created_by = await self.create_user()
        employee = Employee(
            employee_number=employee_number or f"EMP-{self._employee_seq:04d}",
            full_name=full_name or f"Employee {self._employee_seq}",
            position=position,
            department=department,
            employment_type=employment_type,
            base_salary=base_salary,
            hired_at=hired_at or date(2025, 1, 1),
            created_by_id=created_by.id,
            user_id=user.id if user else None,
        )
        self.session.add(employee)
        await self.session.flush()
        await self.session.refresh(employee)
        return employee

    async def create_subdivision(
        self,
        *,
        name: str | None = None,
        description: str | None = None,
    ) -> SubDivision:
        self._subdivision_seq += 1
        sd = SubDivision(
            name=name or f"SubDiv {self._subdivision_seq}",
            description=description,
        )
        self.session.add(sd)
        await self.session.flush()
        await self.session.refresh(sd)
        return sd

    async def add_subdivision_member(
        self, subdivision: SubDivision, employee: Employee
    ) -> SubDivisionMember:
        member = SubDivisionMember(
            subdivision_id=subdivision.id,
            employee_id=employee.id,
        )
        self.session.add(member)
        await self.session.flush()
        await self.session.refresh(member)
        return member

    async def create_order(
        self,
        *,
        customer: Customer | None = None,
        created_by: User | None = None,
        items: list[dict] | None = None,
        status: OrderStatus = OrderStatus.DRAFT,
        order_date: date | None = None,
    ) -> Order:
        if not customer:
            customer = await self.create_customer()
        if not created_by:
            created_by = await self.create_user()
        if items is None:
            product = await self.create_product()
            items = [
                {"product_id": product.id, "quantity": 10, "price": Decimal("100.00")}
            ]

        total = sum(Decimal(str(i["price"])) * i["quantity"] for i in items)
        order = Order(
            order_date=order_date or date.today(),
            customer_id=customer.id,
            created_by_id=created_by.id,
            total_amount=total,
            status=status,
        )
        self.session.add(order)
        await self.session.flush()

        for item_data in items:
            oi = OrderItem(order_id=order.id, **item_data)
            self.session.add(oi)

        await self.session.flush()
        await self.session.refresh(order, ["items"])
        return order

    async def create_batch(
        self,
        *,
        product: Product | None = None,
        subdivision: SubDivision | None = None,
        quantity: int = 100,
        batch_date: date | None = None,
        is_confirmed: bool = False,
        created_by: User | None = None,
    ) -> Batch:
        if not product:
            product = await self.create_product()
        if not created_by:
            created_by = await self.create_user()
        batch = Batch(
            batch_date=batch_date or date.today(),
            product_id=product.id,
            quantity=quantity,
            is_confirmed=is_confirmed,
            subdivision_id=subdivision.id if subdivision else None,
            created_by_id=created_by.id,
        )
        self.session.add(batch)
        await self.session.flush()
        await self.session.refresh(batch)
        return batch

    async def add_batch_worker(self, batch: Batch, employee: Employee) -> BatchWorker:
        bw = BatchWorker(batch_id=batch.id, employee_id=employee.id)
        self.session.add(bw)
        await self.session.flush()
        await self.session.refresh(bw)
        return bw

    async def create_commission_rate(
        self,
        *,
        product: Product,
        rate_per_unit: Decimal = Decimal("50.0000"),
        effective_from: date | None = None,
        effective_to: date | None = None,
    ) -> ProductCommissionRate:
        rate = ProductCommissionRate(
            product_id=product.id,
            rate_per_unit=rate_per_unit,
            effective_from=effective_from or date(2025, 1, 1),
            effective_to=effective_to,
        )
        self.session.add(rate)
        await self.session.flush()
        await self.session.refresh(rate)
        return rate


@pytest.fixture
def factory(session: AsyncSession) -> Factory:
    return Factory(session)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


def make_user_context(
    user: User | None = None,
    *,
    user_id: int = 1,
    role: str = UserRole.ADMIN,
    username: str = "testadmin",
    display_name: str = "Test Admin",
) -> UserContext:
    if user:
        return UserContext(
            id=user.id,
            display_name=user.display_name,
            username=user.username,
            permissions=get_permissions_for_role(user.role),
            must_change_password=user.must_change_password,
        )
    return UserContext(
        id=user_id,
        display_name=display_name,
        username=username,
        permissions=get_permissions_for_role(role),
    )


def make_token(user: User | None = None, *, role: str = UserRole.ADMIN) -> str:
    ctx = make_user_context(user, role=role)
    return create_access_token(user=ctx)


def auth_header(user: User | None = None, *, role: str = UserRole.ADMIN) -> dict:
    return {"Authorization": f"Bearer {make_token(user, role=role)}"}


@pytest.fixture
async def admin_user(factory: Factory) -> User:
    return await factory.create_user(role=UserRole.ADMIN)


@pytest.fixture
async def employee_user(factory: Factory) -> User:
    return await factory.create_user(role=UserRole.EMPLOYEE, username="emp_user")


# ---------------------------------------------------------------------------
# HTTP clients
# ---------------------------------------------------------------------------


@pytest.fixture
async def client(app) -> AsyncClient:
    """Unauthenticated async HTTP client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
async def admin_client(app, admin_user: User) -> AsyncClient:
    """HTTP client authenticated as admin."""
    transport = ASGITransport(app=app)
    headers = auth_header(admin_user)
    async with AsyncClient(
        transport=transport, base_url="http://test", headers=headers
    ) as c:
        yield c


@pytest.fixture
async def employee_client(app, employee_user: User) -> AsyncClient:
    """HTTP client authenticated as employee (limited permissions)."""
    transport = ASGITransport(app=app)
    headers = auth_header(employee_user)
    async with AsyncClient(
        transport=transport, base_url="http://test", headers=headers
    ) as c:
        yield c

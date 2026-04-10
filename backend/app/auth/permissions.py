from enum import StrEnum

from fastapi import Depends

from app.schemas.auth import UserContext
from app.services.exceptions import Forbidden

from .dependencies import get_current_user


class Permission(StrEnum):
    # Employees
    EMPLOYEES_READ = "employees:read"
    EMPLOYEES_WRITE = "employees:write"
    EMPLOYEES_DELETE = "employees:delete"

    # Payroll
    PAYROLL_READ = "payroll:read"
    PAYROLL_GENERATE = "payroll:generate"
    PAYROLL_APPROVE = "payroll:approve"

    # Orders
    ORDERS_READ = "orders:read"
    ORDERS_WRITE = "orders:write"
    ORDERS_COMPLETE = "orders:complete"

    # Batches
    BATCHES_READ = "batches:read"
    BATCHES_WRITE = "batches:write"

    # Inventory
    INVENTORY_READ = "inventory:read"
    INVENTORY_WRITE = "inventory:write"

    # Products
    PRODUCTS_READ = "products:read"
    PRODUCTS_WRITE = "products:write"

    # Customers
    CUSTOMERS_READ = "customers:read"
    CUSTOMERS_WRITE = "customers:write"

    # Users
    USERS_READ = "users:read"
    USERS_WRITE = "users:write"

    # Dashboard
    DASHBOARD_VIEW = "dashboard:view"


_ALL = set(Permission)

ROLE_PERMISSIONS: dict[str, set[Permission]] = {
    "master_admin": _ALL,
    "admin": _ALL,
    "employee": {
        Permission.ORDERS_READ,
        Permission.BATCHES_READ,
        Permission.INVENTORY_READ,
        Permission.PRODUCTS_READ,
        Permission.CUSTOMERS_READ,
    },
}


def get_permissions_for_role(role: str) -> list[str]:
    return [p.value for p in ROLE_PERMISSIONS.get(role, set())]


def require_permission(permission: Permission):
    async def check(user: UserContext = Depends(get_current_user)) -> UserContext:
        if permission.value not in user.permissions:
            raise Forbidden(
                code="insufficient_permissions",
                message=f"Permission '{permission.value}' is required.",
            )
        return user

    return Depends(check)

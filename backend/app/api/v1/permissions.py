from fastapi import Depends
from fastapi.routing import APIRouter
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.auth.permissions import Permission
from app.schemas.auth import UserContext

router = APIRouter()

PERMISSION_DESCRIPTIONS: dict[Permission, str] = {
    Permission.EMPLOYEES_READ: "View employee records",
    Permission.EMPLOYEES_WRITE: "Create and update employee records",
    Permission.EMPLOYEES_DELETE: "Delete employee records",
    Permission.PAYROLL_READ: "View payroll and payslip data",
    Permission.PAYROLL_GENERATE: "Generate payroll for a period",
    Permission.PAYROLL_APPROVE: "Approve or mark payroll as paid",
    Permission.ORDERS_READ: "View customer orders",
    Permission.ORDERS_WRITE: "Create and update orders",
    Permission.ORDERS_COMPLETE: "Mark orders as completed",
    Permission.BATCHES_READ: "View production batches",
    Permission.BATCHES_WRITE: "Create, update, and confirm batches",
    Permission.INVENTORY_READ: "View inventory transactions",
    Permission.INVENTORY_WRITE: "Create inventory transactions",
    Permission.PRODUCTS_READ: "View products and pricing",
    Permission.PRODUCTS_WRITE: "Create and update products",
    Permission.CUSTOMERS_READ: "View customer records",
    Permission.CUSTOMERS_WRITE: "Create and update customer records",
    Permission.USERS_READ: "View user accounts",
    Permission.USERS_WRITE: "Create and update user accounts",
    Permission.DASHBOARD_VIEW: "View the dashboard",
}


class PermissionItem(BaseModel):
    permission: str
    description: str


@router.get("", response_model=list[PermissionItem])
async def list_permissions(
    _: UserContext = Depends(get_current_user),
):
    return [
        PermissionItem(
            permission=p.value,
            description=PERMISSION_DESCRIPTIONS.get(p, p.value),
        )
        for p in Permission
    ]

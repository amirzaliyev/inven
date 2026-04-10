from fastapi import APIRouter

from app.api.v1 import (
    auth,
    batches,
    customers,
    dashboard,
    employees,
    inventory_transactions,
    orders,
    payroll,
    permissions,
    products,
    subdivisions,
    users,
)

v1_routers = APIRouter()


v1_routers.include_router(auth.router, prefix="/auth", tags=["auth"])
v1_routers.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
v1_routers.include_router(batches.router, prefix="/batches", tags=["batches"])
v1_routers.include_router(customers.router, prefix="/customers", tags=["customers"])
v1_routers.include_router(employees.router, prefix="/employees", tags=["employees"])
v1_routers.include_router(orders.router, prefix="/orders", tags=["orders"])
v1_routers.include_router(products.router, prefix="/products", tags=["products"])
v1_routers.include_router(payroll.router, prefix="/payroll", tags=["payroll"])
v1_routers.include_router(subdivisions.router, prefix="/subdivisions", tags=["subdivisions"])
v1_routers.include_router(users.router, prefix="/users", tags=["users"])
v1_routers.include_router(permissions.router, prefix="/permissions", tags=["permissions"])
v1_routers.include_router(
    inventory_transactions.router,
    prefix="/inventory-transactions",
    tags=["inventory-transactions"],
)

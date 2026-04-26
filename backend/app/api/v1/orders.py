from datetime import date
from decimal import Decimal

from fastapi import Depends, Query, status
from fastapi.routing import APIRouter

from app.auth.permissions import Permission, require_permission
from app.schemas.auth import UserContext
from app.schemas.orders import Order, OrderCreate, OrderList, OrderUpdate
from app.services.orders import OrderService
from app.svc_dependencies import get_order_service

router = APIRouter()


@router.post("", response_model=Order, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    user: UserContext = require_permission(Permission.ORDERS_WRITE),
    service: OrderService = Depends(get_order_service),
):
    return await service.create(data=data, user=user)


@router.get("", response_model=OrderList)
async def list_orders(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    customer_id: int | None = None,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    price_from: Decimal | None = Query(None),
    price_to: Decimal | None = Query(None),
    _: UserContext = require_permission(Permission.ORDERS_READ),
    service: OrderService = Depends(get_order_service),
):
    orders, total = await service.list(
        page=page,
        size=size,
        date_from=date_from,
        date_to=date_to,
        price_from=price_from,
        price_to=price_to,
        customer_id=customer_id,
    )
    return OrderList(items=orders, total=total, page=page, size=size)


@router.put("/{order_id}", response_model=Order)
async def update_order(
    order_id: int,
    data: OrderUpdate,
    user: UserContext = require_permission(Permission.ORDERS_WRITE),
    service: OrderService = Depends(get_order_service),
):
    return await service.update(order_id=order_id, data=data, user=user)


@router.post("/{order_id}/complete", response_model=Order)
async def complete_order(
    order_id: int,
    user: UserContext = require_permission(Permission.ORDERS_COMPLETE),
    service: OrderService = Depends(get_order_service),
):
    return await service.complete_order(order_id=order_id, user=user)


@router.post("/{order_id}/reset", response_model=Order)
async def reset_order(
    order_id: int,
    user: UserContext = require_permission(Permission.ORDERS_WRITE),
    service: OrderService = Depends(get_order_service),
):
    return await service.reset_order(order_id=order_id, user=user)


@router.post("/{order_id}/cancel", response_model=Order)
async def cancel_order(
    order_id: int,
    user: UserContext = require_permission(Permission.ORDERS_WRITE),
    service: OrderService = Depends(get_order_service),
):
    return await service.cancel_order(order_id=order_id, user=user)

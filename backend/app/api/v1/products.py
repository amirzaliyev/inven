from fastapi import Depends, Query, status
from fastapi.routing import APIRouter

from app.auth.permissions import Permission, require_permission
from app.schemas.auth import UserContext
from app.schemas.commission_rates import (
    CommissionRate,
    CommissionRateCreate,
    CommissionRateUpdate,
)
from app.schemas.products import Product, ProductCreate, ProductList, ProductUpdate
from app.services.commission_rates import CommissionRateService
from app.services.products import ProductService
from app.svc_dependencies import get_commission_rate_service, get_product_service

router = APIRouter()


@router.post("", response_model=Product)
async def create_product(
    data: ProductCreate,
    current_user: UserContext = require_permission(Permission.PRODUCTS_WRITE),
    service: ProductService = Depends(get_product_service),
):
    return await service.create(data=data, user=current_user)


@router.get("", response_model=ProductList)
async def list_products(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: str | None = None,
    _: UserContext = require_permission(Permission.PRODUCTS_READ),
    service: ProductService = Depends(get_product_service),
):
    products, total = await service.list(page=page, size=size, search=search)
    return ProductList(
        items=products,  # pyright: ignore[reportArgumentType]
        total=total,
        page=page,
        size=size,
    )


@router.put("/{product_id}", response_model=Product)
async def update_product(
    product_id: int,
    data: ProductUpdate,
    current_user: UserContext = require_permission(Permission.PRODUCTS_WRITE),
    service: ProductService = Depends(get_product_service),
):
    return await service.update(id=product_id, data=data, user=current_user)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    _: UserContext = require_permission(Permission.PRODUCTS_WRITE),
    service: ProductService = Depends(get_product_service),
):
    return await service.delete(id=product_id)


# --- Commission rates ---


@router.get("/{product_id}/commission-rates", response_model=list[CommissionRate])
async def list_commission_rates(
    product_id: int,
    _: UserContext = require_permission(Permission.PRODUCTS_READ),
    service: CommissionRateService = Depends(get_commission_rate_service),
):
    return await service.list_for_product(product_id=product_id)


@router.post(
    "/{product_id}/commission-rates",
    response_model=CommissionRate,
    status_code=status.HTTP_201_CREATED,
)
async def create_commission_rate(
    product_id: int,
    data: CommissionRateCreate,
    _: UserContext = require_permission(Permission.PRODUCTS_WRITE),
    service: CommissionRateService = Depends(get_commission_rate_service),
):
    return await service.create(product_id=product_id, data=data)


@router.put("/{product_id}/commission-rates/{rate_id}", response_model=CommissionRate)
async def update_commission_rate(
    product_id: int,
    rate_id: int,
    data: CommissionRateUpdate,
    _: UserContext = require_permission(Permission.PRODUCTS_WRITE),
    service: CommissionRateService = Depends(get_commission_rate_service),
):
    return await service.update(rate_id=rate_id, data=data)


@router.delete(
    "/{product_id}/commission-rates/{rate_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_commission_rate(
    product_id: int,
    rate_id: int,
    _: UserContext = require_permission(Permission.PRODUCTS_WRITE),
    service: CommissionRateService = Depends(get_commission_rate_service),
):
    await service.delete(id=rate_id)

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.schemas.auth import UserContext
from app.schemas.products import Product, ProductCreate, ProductUpdate
from app.services.products import ProductService
from app.svc_dependencies import get_product_service

router = APIRouter()


@router.post("", response_model=Product)
async def create_product(
    data: ProductCreate,
    current_user: UserContext = Depends(get_current_user),
    service: ProductService = Depends(get_product_service),
):
    return await service.create(data=data, user=current_user)


@router.put("/{product_id}", response_model=Product)
async def update_product(
    product_id: int,
    data: ProductUpdate,
    current_user: UserContext = Depends(get_current_user),
    service: ProductService = Depends(get_product_service),
):
    return await service.update(id=product_id, data=data, user=current_user)

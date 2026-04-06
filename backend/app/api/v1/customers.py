from fastapi import APIRouter, Depends, Query, status

from app.auth.dependencies import get_current_user
from app.schemas.auth import UserContext
from app.schemas.customers import Customer, CustomerCreate, CustomerList, CustomerUpdate
from app.services.customers import CustomerService
from app.svc_dependencies import get_customer_service

router = APIRouter()


@router.post("", response_model=Customer, status_code=status.HTTP_201_CREATED)
async def add_customer(
    data: CustomerCreate,
    current_user: UserContext = Depends(get_current_user),
    service: CustomerService = Depends(get_customer_service),
):
    return await service.create(data=data, user=current_user)


@router.get("", response_model=CustomerList)
async def list_customers(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: str | None = None,
    current_user: UserContext = Depends(get_current_user),
    service: CustomerService = Depends(get_customer_service),
):
    customers, total = await service.list(page=page, size=size, search=search)
    return CustomerList(items=customers, total=total, page=page, size=size)


@router.get("/{customer_id}", response_model=Customer)
async def get_customer(
    customer_id: int,
    current_user: UserContext = Depends(get_current_user),
    service: CustomerService = Depends(get_customer_service),
):
    return await service.get(id=customer_id)


@router.put("/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    current_user: UserContext = Depends(get_current_user),
    service: CustomerService = Depends(get_customer_service),
):
    return await service.update(customer_id=customer_id, data=data, user=current_user)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: int,
    current_user: UserContext = Depends(get_current_user),
    service: CustomerService = Depends(get_customer_service),
):
    await service.delete(id=customer_id)

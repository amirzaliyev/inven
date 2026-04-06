from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user
from app.models.enums import SourceType, TransactionType
from app.schemas.auth import UserContext
from app.schemas.inventory_transactions import InventoryTransactionList
from app.services.inventory_transactions import InventoryTransactionService
from app.svc_dependencies import get_inv_transaction_svc

router = APIRouter()


# @router.post("")
# async def create_inventory_transaction(
#     data: InventoryTransactionCreate,
#     current_user: UserContext = Depends(get_current_user),
#     service: InventoryTransactionService = Depends(get_inv_transaction_svc),
# ):
#     return await service.create(data=data, user=current_user)


@router.get("", response_model=InventoryTransactionList)
async def list_inventory_transactions(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    transaction_type: TransactionType | None = None,
    source_type: SourceType | None = None,
    current_user: UserContext = Depends(get_current_user),
    service: InventoryTransactionService = Depends(get_inv_transaction_svc),
):
    txns, total = await service.list(
        page=page, size=size, transaction_type=transaction_type, source_type=source_type
    )

    return InventoryTransactionList(
        items=txns,
        total=total,
        size=size,
        page=page,
    )

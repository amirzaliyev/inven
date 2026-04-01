from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.schemas.auth import UserContext
from app.schemas.inventory_transactions import InventoryTransactionCreate
from app.services.inventory_transactions import InventoryTransactionService
from app.svc_dependencies import get_inv_transaction_svc

router = APIRouter()


@router.post("")
async def create_inventory_transaction(
    data: InventoryTransactionCreate,
    current_user: UserContext = Depends(get_current_user),
    service: InventoryTransactionService = Depends(get_inv_transaction_svc),
):
    return await service.create(data=data, user=current_user)

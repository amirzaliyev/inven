from fastapi import Depends, Query, status
from fastapi.routing import APIRouter

from app.auth.permissions import Permission, require_permission
from app.models.enums import SourceType, TransactionType
from app.schemas.auth import UserContext
from app.schemas.inventory_transactions import (
    DefectReportCreate,
    InventoryTransaction,
    InventoryTransactionList,
)
from app.services.inventory_transactions import InventoryTransactionService
from app.svc_dependencies import get_inv_transaction_svc

router = APIRouter()


@router.get("", response_model=InventoryTransactionList)
async def list_inventory_transactions(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    transaction_type: TransactionType | None = None,
    source_type: SourceType | None = None,
    _: UserContext = require_permission(Permission.INVENTORY_READ),
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


@router.post(
    "/defects",
    response_model=InventoryTransaction,
    status_code=status.HTTP_201_CREATED,
)
async def report_defect(
    data: DefectReportCreate,
    current_user: UserContext = require_permission(Permission.INVENTORY_WRITE),
    service: InventoryTransactionService = Depends(get_inv_transaction_svc),
):
    return await service.report_defect(data=data, user=current_user)

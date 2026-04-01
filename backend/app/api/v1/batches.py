from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user
from app.schemas.auth import UserContext
from app.schemas.batches import Batch, BatchCreate, BatchList, BatchUpdate
from app.services.batches import BatchService
from app.svc_dependencies import get_batch_service

router = APIRouter()


@router.post("", response_model=Batch)
async def report_batch(
    data: BatchCreate,
    current_user: UserContext = Depends(get_current_user),
    service: BatchService = Depends(get_batch_service),
):
    return await service.create(data=data, user=current_user)


@router.get("", response_model=BatchList)
async def list_batches(
    page: int = Query(1, ge=1),
    size: int = Query(10, le=100, ge=1),
    current_user: UserContext = Depends(get_current_user),
    service: BatchService = Depends(get_batch_service),
):
    batches, total = await service.list(page=page, size=size)
    return BatchList(
        items=batches,  # pyright: ignore[reportArgumentType]
        total=total,
        page=page,
        size=size,
    )


@router.put("/{batch_id}", response_model=Batch)
async def update_batch(
    batch_id: int,
    data: BatchUpdate,
    current_user: UserContext = Depends(get_current_user),
    service: BatchService = Depends(get_batch_service),
):
    return await service.update(id=batch_id, data=data, user=current_user)


@router.patch("/{batch_id}", response_model=Batch)
async def confirm_batch(
    batch_id: int,
    current_user: UserContext = Depends(get_current_user),
    service: BatchService = Depends(get_batch_service),
):
    return await service.confirm(batch_id=batch_id, user=current_user)

from fastapi import Depends, Query, status
from fastapi.routing import APIRouter

from app.auth.permissions import Permission, require_permission
from app.schemas.auth import UserContext
from app.schemas.subdivisions import (
    SubDivisionCreate,
    SubDivisionList,
    SubDivisionMemberAdd,
    SubDivisionMemberResponse,
    SubDivisionResponse,
    SubDivisionUpdate,
)
from app.services.subdivisions import SubDivisionService
from app.svc_dependencies import get_subdivision_service

router = APIRouter()


@router.get("", response_model=SubDivisionList)
async def list_subdivisions(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None),
    _: UserContext = require_permission(Permission.EMPLOYEES_READ),
    service: SubDivisionService = Depends(get_subdivision_service),
):
    subdivisions, total = await service.list(page=page, size=size, search=search)
    return SubDivisionList(items=subdivisions, total=total, page=page, size=size)


@router.post("", response_model=SubDivisionResponse, status_code=status.HTTP_201_CREATED)
async def create_subdivision(
    data: SubDivisionCreate,
    _: UserContext = require_permission(Permission.EMPLOYEES_WRITE),
    service: SubDivisionService = Depends(get_subdivision_service),
):
    subdivision = await service.create(data=data)
    return await service.get_with_members(subdivision_id=subdivision.id)


@router.get("/{subdivision_id}", response_model=SubDivisionResponse)
async def get_subdivision(
    subdivision_id: int,
    _: UserContext = require_permission(Permission.EMPLOYEES_READ),
    service: SubDivisionService = Depends(get_subdivision_service),
):
    return await service.get_with_members(subdivision_id=subdivision_id)


@router.put("/{subdivision_id}", response_model=SubDivisionResponse)
async def update_subdivision(
    subdivision_id: int,
    data: SubDivisionUpdate,
    _: UserContext = require_permission(Permission.EMPLOYEES_WRITE),
    service: SubDivisionService = Depends(get_subdivision_service),
):
    await service.update(subdivision_id=subdivision_id, data=data)
    return await service.get_with_members(subdivision_id=subdivision_id)


@router.delete("/{subdivision_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subdivision(
    subdivision_id: int,
    _: UserContext = require_permission(Permission.EMPLOYEES_WRITE),
    service: SubDivisionService = Depends(get_subdivision_service),
):
    await service.delete(id=subdivision_id)


@router.post(
    "/{subdivision_id}/members",
    response_model=SubDivisionMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    subdivision_id: int,
    data: SubDivisionMemberAdd,
    _: UserContext = require_permission(Permission.EMPLOYEES_WRITE),
    service: SubDivisionService = Depends(get_subdivision_service),
):
    return await service.add_member(subdivision_id=subdivision_id, data=data)


@router.delete(
    "/{subdivision_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_member(
    subdivision_id: int,
    member_id: int,
    _: UserContext = require_permission(Permission.EMPLOYEES_WRITE),
    service: SubDivisionService = Depends(get_subdivision_service),
):
    await service.remove_member(subdivision_id=subdivision_id, member_id=member_id)

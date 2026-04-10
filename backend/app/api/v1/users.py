from fastapi import Depends, Query, status
from fastapi.routing import APIRouter

from app.auth.permissions import Permission, require_permission
from app.schemas.auth import UserContext
from app.schemas.users import (
    AdminPasswordReset,
    UserCreate,
    UserList,
    UserResponse,
    UserUpdate,
)
from app.services.users import UserService
from app.svc_dependencies import get_user_service

router = APIRouter()


@router.get("", response_model=UserList)
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None),
    role: str | None = Query(None),
    _: UserContext = require_permission(Permission.USERS_READ),
    service: UserService = Depends(get_user_service),
):
    users, total = await service.list(page=page, size=size, search=search, role=role)
    return UserList(items=users, total=total, page=page, size=size)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    _: UserContext = require_permission(Permission.USERS_WRITE),
    service: UserService = Depends(get_user_service),
):
    return await service.create_user(data=data)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    _: UserContext = require_permission(Permission.USERS_READ),
    service: UserService = Depends(get_user_service),
):
    return await service.get(id=user_id)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    _: UserContext = require_permission(Permission.USERS_WRITE),
    service: UserService = Depends(get_user_service),
):
    return await service.update_user(user_id=user_id, data=data)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: int,
    _: UserContext = require_permission(Permission.USERS_WRITE),
    service: UserService = Depends(get_user_service),
):
    await service.delete(id=user_id)


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_user_password(
    user_id: int,
    data: AdminPasswordReset,
    _: UserContext = require_permission(Permission.USERS_WRITE),
    service: UserService = Depends(get_user_service),
):
    await service.reset_password(user_id=user_id, new_password=data.new_password)

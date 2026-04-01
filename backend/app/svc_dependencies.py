from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_async_session
from app.services.auth import AuthService
from app.services.batches import BatchService
from app.services.products import ProductService
from app.services.users import UserService


def get_user_service(session: AsyncSession = Depends(get_async_session)) -> UserService:
    return UserService(session=session)


def get_auth_service(session: AsyncSession = Depends(get_async_session)) -> AuthService:
    user_service = get_user_service(session=session)
    return AuthService(user_service=user_service)


def get_batch_service(
    session: AsyncSession = Depends(get_async_session),
) -> BatchService:
    return BatchService(session=session)


def get_product_service(
    session: AsyncSession = Depends(get_async_session),
) -> ProductService:
    return ProductService(session=session)

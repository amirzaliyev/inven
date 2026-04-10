from fastapi import APIRouter, Depends, Response, status

from app.auth.dependencies import get_current_user, get_refresh_token_claims
from app.auth.jwt import create_access_token, create_refresh_token
from app.core.config import settings
from app.schemas.auth import (
    ChangePasswordRequest,
    RefreshTokenClaims,
    TokenResponse,
    UserContext,
    UserCredentials,
)
from app.services.auth import AuthService, _user_context
from app.services.users import UserService
from app.svc_dependencies import get_auth_service, get_user_service

router = APIRouter()


@router.post("/token", response_model=TokenResponse)
async def get_access_token(
    response: Response,
    credentials: UserCredentials,
    service: AuthService = Depends(get_auth_service),
):
    user = await service.authenticate(
        username=credentials.username, password=credentials.password
    )

    access_token = create_access_token(user=user)
    refresh_token = create_refresh_token(user=user)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="none",
        secure=True,
    )

    return TokenResponse(
        access_token=access_token,
        access_token_expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    claims: RefreshTokenClaims = Depends(get_refresh_token_claims),
    service: AuthService = Depends(get_auth_service),
):
    tokens = await service.refresh_token(claims=claims)
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response, current_user: UserContext = Depends(get_current_user)
):
    response.delete_cookie(key="refresh_token", httponly=True)


@router.post("/change-password", response_model=TokenResponse)
async def change_password(
    data: ChangePasswordRequest,
    current_user: UserContext = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    user = await user_service.change_password(
        user_id=current_user.id,
        current_password=data.current_password,
        new_password=data.new_password,
    )
    updated_context = _user_context(user)
    return TokenResponse(
        access_token=create_access_token(user=updated_context),
        access_token_expires_in=settings.jwt_access_token_expire_minutes * 60,
    )

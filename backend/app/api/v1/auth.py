from fastapi import APIRouter, Depends, Response, status

from app.auth.dependencies import get_current_user, get_refresh_token_claims
from app.auth.jwt import create_access_token, create_refresh_token
from app.core.config import settings
from app.schemas.auth import (
    RefreshTokenClaims,
    TokenResponse,
    UserContext,
    UserCredentials,
)
from app.services.auth import AuthService
from app.svc_dependencies import get_auth_service

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

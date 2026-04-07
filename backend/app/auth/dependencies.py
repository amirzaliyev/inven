from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt import verify_access_token, verify_refresh_token
from app.schemas.auth import RefreshTokenClaims, TokenClaims, UserContext
from app.services.exceptions import UnAuthorized
from app.services.users import UserService
from app.svc_dependencies import get_user_service

security = HTTPBearer()

__all__ = ["get_token_claims", "get_current_user"]


def get_token_claims(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenClaims:
    return verify_access_token(credentials.credentials)


def get_refresh_token_claims(request: Request) -> RefreshTokenClaims:
    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise UnAuthorized(
            code="refresh_token_not_found", message="Refresh token not found in cookies"
        )

    return verify_refresh_token(token=refresh_token)


async def get_current_user(
    claims: TokenClaims = Depends(get_token_claims),
    user_service: UserService = Depends(get_user_service),
) -> UserContext:
    user = await user_service.get(id=claims.sub)
    return UserContext(
        id=user.id,
        display_name=user.display_name,
        username=user.username,
        email=user.email,
        phone_number=user.phone_number,
        permissions=[],
    )

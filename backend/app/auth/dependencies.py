from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt import verify_access_token, verify_refresh_token
from app.schemas.auth import RefreshTokenClaims, TokenClaims, UserContext
from app.services.exceptions import UnAuthorized

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


def get_current_user(
    claims: TokenClaims = Depends(get_token_claims),
) -> UserContext:
    return UserContext(
        id=claims.sub,
        display_name=claims.display_name,
        username=claims.username,
        role=claims.role,
        permissions=claims.permissions,
        must_change_password=claims.must_change_password,
    )

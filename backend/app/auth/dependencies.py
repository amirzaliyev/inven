from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt import verify_access_token
from app.schemas.auth import TokenClaims, UserContext
from app.services.users import UserService
from app.svc_dependencies import get_user_service

security = HTTPBearer()

__all__ = ["get_token_claims", "get_current_user"]


def get_token_claims(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenClaims:
    claims = verify_access_token(credentials.credentials)
    return TokenClaims.model_validate(claims)


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

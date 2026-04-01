from app.auth.jwt import create_access_token
from app.auth.passwords import verify_hash
from app.core.config import settings
from app.schemas.auth import RefreshTokenClaims, TokenResponse, UserContext

from .exceptions import ResourceNotFound, UnAuthorized
from .users import UserService


class AuthService:
    def __init__(self, user_service: UserService):
        self._user_service = user_service

    async def authenticate(self, username: str, password: str) -> UserContext:
        try:
            user = await self._user_service.get(username=username)

        except ResourceNotFound:
            raise UnAuthorized(
                code="invalid_credentials", message="Invalid username or password."
            )

        if not verify_hash(password=password, hash=user.password_hash):
            raise UnAuthorized(
                code="invalid_credentials", message="Invalid username or password."
            )

        if not user.is_active:
            raise UnAuthorized(code="inactive_user", message="User is not active.")

        return UserContext(
            id=user.id,
            display_name=user.display_name,
            username=user.username,
            email=user.email,
            phone_number=user.phone_number,
            permissions=[],
        )

    async def refresh_token(self, claims: RefreshTokenClaims) -> TokenResponse:
        user = await self._user_service.get(id=claims.sub)

        access_token = create_access_token(
            user=UserContext(
                id=user.id,
                display_name=user.display_name,
                username=user.username,
                email=user.email,
                phone_number=user.phone_number,
                permissions=[],
            )
        )
        return TokenResponse(
            access_token=access_token,
            access_token_expires_in=settings.jwt_access_token_expire_minutes * 60,
        )

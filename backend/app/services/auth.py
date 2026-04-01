from app.auth.jwt import create_access_token, create_refresh_token
from app.auth.passwords import verify_hash
from app.core.config import settings
from app.schemas.auth import TokenResponse, UserContext

from .exceptions import UnAuthorized
from .users import UserService


class AuthService:
    def __init__(self, user_service: UserService):
        self._user_service = user_service

    async def authenticate(self, username: str, password: str) -> UserContext:
        user = await self._user_service.get(username=username)

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

    async def create_tokens(self, user: UserContext):
        access_token = create_access_token(user=user)
        refresh_token = create_refresh_token(user=user)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            access_token_expires_in=settings.jwt_access_token_expire_minutes * 60,
        )

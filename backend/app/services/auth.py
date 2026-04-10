from datetime import datetime, timezone

from app.auth.passwords import verify_hash
from app.auth.permissions import get_permissions_for_role
from app.schemas.auth import RefreshTokenClaims, UserContext

from .exceptions import ResourceNotFound, UnAuthorized
from .users import UserService


def _user_context(user) -> UserContext:
    if user.custom_permissions:
        permissions = [p.permission for p in user.custom_permissions]
    else:
        permissions = get_permissions_for_role(user.role)

    return UserContext(
        id=user.id,
        display_name=user.display_name,
        username=user.username,
        role=user.role,
        email=user.email,
        phone_number=user.phone_number,
        permissions=permissions,
        must_change_password=user.must_change_password,
    )


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

        await self._user_service._update(
            user, modified_data={"last_login_at": datetime.now(timezone.utc)}
        )

        return _user_context(user)

    async def refresh_token(self, claims: RefreshTokenClaims) -> UserContext:
        user = await self._user_service.get(id=claims.sub)
        return _user_context(user)

from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings
from app.schemas.auth import RefreshTokenClaims, TokenClaims, UserContext
from app.services.exceptions import DomainError, UnAuthorized


def create_access_token(user: UserContext):
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {
        "sub": str(user.id),
        "display_name": user.display_name,
        "username": user.username,
        "role": user.role,
        "permissions": user.permissions,
        "must_change_password": user.must_change_password,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "token_kind": "access",
    }

    if settings.jwt_issuer:
        payload["iss"] = settings.jwt_issuer

    if settings.jwt_audience:
        payload["aud"] = settings.jwt_audience

    return jwt.encode(
        payload=payload,
        key=settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(user: UserContext):
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.jwt_refresh_token_expire_days)

    payload = {
        "sub": str(user.id),
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "token_kind": "refresh",
    }

    return jwt.encode(
        payload=payload,
        key=settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def verify_access_token(token: str) -> TokenClaims:
    try:
        payload = jwt.decode(
            token, key=settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        token_kind = payload.get("token_kind")
        if token_kind != "access":
            raise UnAuthorized(
                code="invalid_token_kind", message="Access token required"
            )
        return TokenClaims.model_validate(payload)

    except jwt.InvalidAlgorithmError as e:
        raise DomainError(code="invalid_jwt_algorithm", message=str(e))

    except jwt.InvalidTokenError as e:
        raise UnAuthorized(code="token_verification_failed", message=str(e))


def verify_refresh_token(token: str) -> RefreshTokenClaims:
    try:
        payload = jwt.decode(
            token, key=settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        token_kind = payload.get("token_kind")
        if token_kind != "refresh":
            raise UnAuthorized(
                code="invalid_token_kind", message="Refresh token required"
            )

        return RefreshTokenClaims.model_validate(payload)

    except jwt.InvalidTokenError as e:
        raise UnAuthorized(code="token_verification_failed", message=str(e))

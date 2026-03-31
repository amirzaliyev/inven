import jwt

from app.core.config import settings
from app.schemas.auth import TokenClaims
from app.services.exceptions import InvalidCredentials


def create_access_token() -> str:
    payload = {
        "sub": 1,
        "email": "",
    }

    return jwt.encode(
        payload=payload, key=settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def verify_access_token(token: str) -> TokenClaims:
    try:
        payload = jwt.decode(
            token, key=settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        return TokenClaims.model_validate(payload)

    except jwt.InvalidTokenError as e:
        raise InvalidCredentials(code="token_verification_failed", message=str(e))

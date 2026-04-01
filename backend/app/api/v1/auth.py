from fastapi import APIRouter, Depends

from app.schemas.auth import TokenResponse, UserCredentials
from app.services.auth import AuthService
from app.svc_dependencies import get_auth_service

router = APIRouter()


@router.post("/token", response_model=TokenResponse)
async def get_access_token(
    credentials: UserCredentials, service: AuthService = Depends(get_auth_service)
):
    user = await service.authenticate(
        username=credentials.username, password=credentials.password
    )
    tokens = await service.create_tokens(user)

    return tokens

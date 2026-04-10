from pydantic import BaseModel


class TokenClaims(BaseModel):
    sub: int
    display_name: str
    username: str
    permissions: list[str]
    must_change_password: bool = False


class RefreshTokenClaims(BaseModel):
    sub: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    access_token_expires_in: int


class UserCredentials(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserContext(BaseModel):
    id: int
    display_name: str
    username: str
    email: str | None = None
    phone_number: str | None = None
    permissions: list[str]
    must_change_password: bool = False

from pydantic import BaseModel, Field


class TokenClaims(BaseModel):
    sub: int
    display_name: str
    username: str
    role: str = "employee"
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
    new_password: str = Field(min_length=8)


class UserContext(BaseModel):
    id: int
    display_name: str
    username: str
    role: str = "employee"
    email: str | None = None
    phone_number: str | None = None
    permissions: list[str]
    must_change_password: bool = False

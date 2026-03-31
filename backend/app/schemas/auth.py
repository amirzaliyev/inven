from datetime import datetime
from pydantic import BaseModel, EmailStr


class TokenClaims(BaseModel):
    sub: int
    email: EmailStr

    expires_at: datetime

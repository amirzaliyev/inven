from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.services.exceptions import DomainError, InvalidCredentials


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    lifespan=lifespan,
    docs_url=None if settings.debug else "/docs",
    redoc_url=None,
    title="Inven",
)


@app.exception_handler(InvalidCredentials)
async def handle_invalid_credentials_exc(exc: InvalidCredentials):
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"code": exc.code, "message": exc.message},
    )


@app.exception_handler(DomainError)
async def handle_domain_errors(exc: DomainError):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"code": exc.code, "message": exc.message},
    )

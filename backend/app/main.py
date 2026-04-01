import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import v1_routers
from app.core.config import settings
from app.core.db import async_session_maker
from app.services.exceptions import (
    Conflict,
    DomainError,
    Forbidden,
    ResourceNotFound,
    UnAuthorized,
)
from app.setup import setup_master_admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session_maker() as session:
        await setup_master_admin(session=session)

    yield


logging.basicConfig(
    level=logging.INFO,
    stream=sys.stdout,
    format="%(levelname)s:     %(message)s - %(name)s - %(asctime)s",
)
app = FastAPI(
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    title="Inven",
    swagger_ui_parameters={
        "persistAuthorization": settings.debug,
        "docExpansion": "none",
    },
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(v1_routers, prefix="/v1")


@app.exception_handler(ResourceNotFound)
async def handle_resource_not_found(request: Request, exc: ResourceNotFound):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"code": exc.code, "message": exc.message},
    )


@app.exception_handler(UnAuthorized)
async def handle_unauthorized(request: Request, exc: UnAuthorized):
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"code": exc.code, "message": exc.message},
    )


@app.exception_handler(Conflict)
async def handle_conflict(request: Request, exc: Conflict):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"code": exc.code, "message": exc.message},
    )


@app.exception_handler(Forbidden)
async def handle_forbidden_exc(request: Request, exc: Forbidden):
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"code": exc.code, "message": exc.message},
    )


@app.exception_handler(DomainError)
async def handle_domain_errors(request: Request, exc: DomainError):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"code": "internal_server_error", "message": "Internal server error."},
    )

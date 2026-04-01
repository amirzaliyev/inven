from fastapi import APIRouter

from app.api.v1 import auth, batches, products

v1_routers = APIRouter()


v1_routers.include_router(auth.router, prefix="/auth", tags=["auth"])
v1_routers.include_router(batches.router, prefix="/batches", tags=["batches"])
v1_routers.include_router(products.router, prefix="/products", tags=["products"])

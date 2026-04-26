from fastapi import Depends, HTTPException, Query
from fastapi.routing import APIRouter

from app.auth.permissions import Permission, require_permission
from app.schemas.auth import UserContext
from app.schemas.dashboard import DashboardResponse, TimeseriesResponse
from app.services.dashboard import ALLOWED_TIMESERIES_DAYS, DashboardService
from app.svc_dependencies import get_dashboard_service

router = APIRouter()


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    _: UserContext = require_permission(Permission.DASHBOARD_VIEW),
    service: DashboardService = Depends(get_dashboard_service),
):
    return await service.get_dashboard()


@router.get("/timeseries", response_model=TimeseriesResponse)
async def get_dashboard_timeseries(
    days: int = Query(default=30),
    _: UserContext = require_permission(Permission.DASHBOARD_VIEW),
    service: DashboardService = Depends(get_dashboard_service),
):
    if days not in ALLOWED_TIMESERIES_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"days must be one of {ALLOWED_TIMESERIES_DAYS}",
        )
    return await service.get_timeseries(days)

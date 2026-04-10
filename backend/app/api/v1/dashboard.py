from fastapi import Depends
from fastapi.routing import APIRouter

from app.auth.permissions import Permission, require_permission
from app.schemas.auth import UserContext
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard import DashboardService
from app.svc_dependencies import get_dashboard_service

router = APIRouter()


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    _: UserContext = require_permission(Permission.DASHBOARD_VIEW),
    service: DashboardService = Depends(get_dashboard_service),
):
    return await service.get_dashboard()

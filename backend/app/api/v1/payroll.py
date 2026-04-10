from fastapi import Depends, Query, status
from fastapi.routing import APIRouter

from app.auth.permissions import Permission, require_permission
from app.models.enums import PayrollStatus
from app.schemas.auth import UserContext
from app.schemas.payroll import (
    PayrollGenerate,
    PayrollList,
    PayrollResponse,
    PayslipResponse,
)
from app.services.payroll import PayrollService
from app.svc_dependencies import get_payroll_service

router = APIRouter()


@router.post("", response_model=PayrollResponse, status_code=status.HTTP_201_CREATED)
async def generate_payroll(
    data: PayrollGenerate,
    current_user: UserContext = require_permission(Permission.PAYROLL_GENERATE),
    service: PayrollService = Depends(get_payroll_service),
):
    payroll = await service.generate(data=data, user=current_user)
    return await service.get_with_payslips(payroll_id=payroll.id)


@router.get("", response_model=PayrollList)
async def list_payrolls(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    status: PayrollStatus | None = Query(None),
    _: UserContext = require_permission(Permission.PAYROLL_READ),
    service: PayrollService = Depends(get_payroll_service),
):
    payrolls, total = await service.list(page=page, size=size, status=status)
    return PayrollList(items=payrolls, total=total, page=page, size=size)


@router.get("/{payroll_id}", response_model=PayrollResponse)
async def get_payroll(
    payroll_id: int,
    _: UserContext = require_permission(Permission.PAYROLL_READ),
    service: PayrollService = Depends(get_payroll_service),
):
    return await service.get_with_payslips(payroll_id=payroll_id)


@router.post("/{payroll_id}/approve", response_model=PayrollResponse)
async def approve_payroll(
    payroll_id: int,
    current_user: UserContext = require_permission(Permission.PAYROLL_APPROVE),
    service: PayrollService = Depends(get_payroll_service),
):
    return await service.approve(payroll_id=payroll_id, user=current_user)


@router.post("/{payroll_id}/mark-paid", response_model=PayrollResponse)
async def mark_payroll_paid(
    payroll_id: int,
    current_user: UserContext = require_permission(Permission.PAYROLL_APPROVE),
    service: PayrollService = Depends(get_payroll_service),
):
    return await service.mark_paid(payroll_id=payroll_id, user=current_user)


@router.get("/payslips/{payslip_id}", response_model=PayslipResponse)
async def get_payslip(
    payslip_id: int,
    _: UserContext = require_permission(Permission.PAYROLL_READ),
    service: PayrollService = Depends(get_payroll_service),
):
    return await service.get_payslip(payslip_id=payslip_id)

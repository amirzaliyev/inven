from fastapi import Depends, Query, status
from fastapi.routing import APIRouter

from app.auth.permissions import Permission, require_permission
from app.schemas.auth import UserContext
from app.schemas.employees import (
    Employee,
    EmployeeCreate,
    EmployeeList,
    EmployeeUpdate,
    UserProfileCreate,
)
from app.services.employees import EmployeeService
from app.svc_dependencies import get_employee_service

router = APIRouter()


@router.get("", response_model=EmployeeList)
async def list_employees(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None),
    department: str | None = Query(None),
    _: UserContext = require_permission(Permission.EMPLOYEES_READ),
    service: EmployeeService = Depends(get_employee_service),
):
    employees, total = await service.list(
        page=page, size=size, search=search, department=department
    )
    return EmployeeList(items=employees, total=total, page=page, size=size)


@router.post("", response_model=Employee, status_code=status.HTTP_201_CREATED)
async def create_employee(
    data: EmployeeCreate,
    current_user: UserContext = require_permission(Permission.EMPLOYEES_WRITE),
    service: EmployeeService = Depends(get_employee_service),
):
    return await service.create(data=data, user=current_user)


@router.get("/{employee_id}", response_model=Employee)
async def get_employee(
    employee_id: int,
    _: UserContext = require_permission(Permission.EMPLOYEES_READ),
    service: EmployeeService = Depends(get_employee_service),
):
    return await service.get(id=employee_id)


@router.put("/{employee_id}", response_model=Employee)
async def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    _: UserContext = require_permission(Permission.EMPLOYEES_WRITE),
    service: EmployeeService = Depends(get_employee_service),
):
    return await service.update(employee_id=employee_id, data=data)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: int,
    _: UserContext = require_permission(Permission.EMPLOYEES_DELETE),
    service: EmployeeService = Depends(get_employee_service),
):
    await service.delete(id=employee_id)


@router.post("/{employee_id}/user", response_model=Employee, status_code=status.HTTP_201_CREATED)
async def attach_user_to_employee(
    employee_id: int,
    data: UserProfileCreate,
    requesting_user: UserContext = require_permission(Permission.EMPLOYEES_WRITE),
    service: EmployeeService = Depends(get_employee_service),
):
    return await service.attach_user(
        employee_id=employee_id, profile=data, requesting_user=requesting_user
    )

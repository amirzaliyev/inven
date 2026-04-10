from collections.abc import Sequence

from sqlalchemy import func, or_, select

from app.auth.passwords import hash_password
from app.models.employees import Employee
from app.models.users import User
from app.schemas.auth import UserContext
from app.schemas.employees import EmployeeCreate, EmployeeUpdate, UserProfileCreate
from app.services.base import BaseModelService
from app.services.exceptions import Conflict


class EmployeeService(BaseModelService[Employee]):
    model = Employee

    async def create(self, data: EmployeeCreate, user: UserContext) -> Employee:
        employee_data = data.model_dump(exclude={"user_profile"})
        employee_data["created_by_id"] = user.id

        if data.user_profile:
            new_user = await self._create_user_account(
                profile=data.user_profile, display_name=data.full_name
            )
            employee_data["user_id"] = new_user.id

        return await self._create(employee_data)

    async def attach_user(
        self,
        employee_id: int,
        profile: UserProfileCreate,
        requesting_user: UserContext,
    ) -> Employee:
        employee = await self.get(id=employee_id)

        if employee.user_id is not None:
            raise Conflict(
                code="employee_has_user",
                message="This employee already has a user account linked.",
            )

        new_user = await self._create_user_account(
            profile=profile, display_name=employee.full_name
        )
        return await self._update(employee, modified_data={"user_id": new_user.id})

    async def _create_user_account(
        self, profile: UserProfileCreate, display_name: str
    ) -> User:
        new_user = User(
            display_name=display_name,
            username=profile.username,
            password_hash=hash_password(profile.password),
            role=profile.role,
            email=profile.email,
            phone_number=profile.phone_number,
            must_change_password=True,
        )
        self._session.add(new_user)
        await self._session.flush()
        return new_user

    async def update(self, employee_id: int, data: EmployeeUpdate) -> Employee:
        employee = await self.get(id=employee_id)
        return await self._update(
            employee, modified_data=data.model_dump(exclude_unset=True)
        )

    async def list(
        self,
        page: int,
        size: int,
        search: str | None = None,
        department: str | None = None,
    ) -> tuple[Sequence[Employee], int]:
        conditions = [self.model.is_active == True]  # noqa: E712

        if search:
            pattern = f"%{search}%"
            conditions.append(
                or_(
                    self.model.full_name.ilike(pattern),
                    self.model.employee_number.ilike(pattern),
                    self.model.position.ilike(pattern),
                )
            )

        if department:
            conditions.append(self.model.department == department)

        stmt = (
            select(self.model).where(*conditions).offset((page - 1) * size).limit(size)
        )
        total_stmt = select(func.count()).select_from(self.model).where(*conditions)

        employees = (await self._session.scalars(stmt)).all()
        total = await self._session.scalar(total_stmt) or 0

        return employees, total

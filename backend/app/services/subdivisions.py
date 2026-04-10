from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.subdivisions import SubDivision, SubDivisionMember
from app.schemas.subdivisions import (
    SubDivisionCreate,
    SubDivisionMemberAdd,
    SubDivisionUpdate,
)
from app.services.exceptions import Conflict, ResourceNotFound

from .base import BaseModelService


class SubDivisionService(BaseModelService[SubDivision]):
    model = SubDivision

    async def create(self, data: SubDivisionCreate) -> SubDivision:
        return await self._create(data.model_dump())

    async def update(self, subdivision_id: int, data: SubDivisionUpdate) -> SubDivision:
        subdivision = await self.get(id=subdivision_id)
        return await self._update(subdivision, modified_data=data.model_dump(exclude_unset=True))

    async def get_with_members(self, subdivision_id: int) -> SubDivision:
        stmt = (
            select(SubDivision)
            .where(SubDivision.id == subdivision_id, SubDivision.is_active == True)  # noqa: E712
            .options(selectinload(SubDivision.members))
        )
        subdivision = await self._session.scalar(stmt)
        if not subdivision:
            raise ResourceNotFound(
                code="subdivision_not_found", message="SubDivision not found."
            )
        return subdivision

    async def add_member(
        self, subdivision_id: int, data: SubDivisionMemberAdd
    ) -> SubDivisionMember:
        # Verify subdivision exists
        await self.get(id=subdivision_id)

        existing = await self._session.scalar(
            select(SubDivisionMember).where(
                SubDivisionMember.subdivision_id == subdivision_id,
                SubDivisionMember.employee_id == data.employee_id,
                SubDivisionMember.is_active == True,  # noqa: E712
            )
        )
        if existing:
            raise Conflict(
                code="member_already_in_subdivision",
                message="This employee is already a member of this subdivision.",
            )

        member = SubDivisionMember(
            subdivision_id=subdivision_id, employee_id=data.employee_id
        )
        self._session.add(member)
        await self._session.flush()
        await self._session.commit()
        await self._session.refresh(member)
        return member

    async def remove_member(self, subdivision_id: int, member_id: int) -> None:
        member = await self._session.scalar(
            select(SubDivisionMember).where(
                SubDivisionMember.id == member_id,
                SubDivisionMember.subdivision_id == subdivision_id,
                SubDivisionMember.is_active == True,  # noqa: E712
            )
        )
        if not member:
            raise ResourceNotFound(
                code="member_not_found",
                message="Member not found in this subdivision.",
            )
        from datetime import datetime, timezone

        member.is_active = False
        member.deleted_at = datetime.now(timezone.utc)
        await self._session.commit()

    async def list(
        self, page: int, size: int, search: str | None = None
    ) -> tuple[Sequence[SubDivision], int]:
        conditions = [self.model.is_active == True]  # noqa: E712

        if search:
            conditions.append(self.model.name.ilike(f"%{search}%"))

        stmt = (
            select(self.model)
            .where(*conditions)
            .options(selectinload(self.model.members))
            .order_by(self.model.name)
            .offset((page - 1) * size)
            .limit(size)
        )
        total_stmt = select(func.count()).select_from(self.model).where(*conditions)

        subdivisions = (await self._session.scalars(stmt)).all()
        total = await self._session.scalar(total_stmt) or 0
        return subdivisions, total

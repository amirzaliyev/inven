from collections.abc import Sequence

from sqlalchemy import delete, func, or_, select

from app.auth.passwords import hash_password, verify_hash
from app.models.user_permissions import UserPermission
from app.models.users import User
from app.schemas.users import UserCreate, UserUpdate

from .base import BaseModelService
from .exceptions import UnAuthorized


class UserService(BaseModelService[User]):
    model = User

    async def create_user(self, data: UserCreate) -> User:
        permissions = data.permissions
        user_data = data.model_dump(exclude={"password", "permissions"})
        user_data["password_hash"] = hash_password(data.password)
        user_data["must_change_password"] = True
        user = await self._create(user_data)

        if permissions:
            await self._set_permissions(user.id, permissions)
            await self._session.refresh(user)

        return user

    async def update_user(self, user_id: int, data: UserUpdate) -> User:
        user = await self.get(id=user_id)
        update_data = data.model_dump(exclude_unset=True, exclude={"permissions"})

        if update_data:
            user = await self._update(user, modified_data=update_data)

        if data.permissions is not None:
            await self._set_permissions(user.id, data.permissions)
            await self._session.refresh(user)

        return user

    async def _set_permissions(self, user_id: int, permissions: list[str]) -> None:
        await self._session.execute(
            delete(UserPermission).where(UserPermission.user_id == user_id)
        )
        for perm in permissions:
            self._session.add(UserPermission(user_id=user_id, permission=perm))
        await self._commit_or_flush()

    async def reset_password(self, user_id: int, new_password: str) -> User:
        user = await self.get(id=user_id)
        return await self._update(
            user,
            modified_data={
                "password_hash": hash_password(new_password),
                "must_change_password": True,
            },
        )

    async def change_password(
        self, user_id: int, current_password: str, new_password: str
    ) -> User:
        user = await self.get(id=user_id)
        if not verify_hash(password=current_password, hash=user.password_hash):
            raise UnAuthorized(
                code="invalid_password", message="Current password is incorrect."
            )
        return await self._update(
            user,
            modified_data={
                "password_hash": hash_password(new_password),
                "must_change_password": False,
            },
        )

    async def list(
        self,
        page: int,
        size: int,
        search: str | None = None,
        role: str | None = None,
    ) -> tuple[Sequence[User], int]:
        conditions = [self.model.is_active == True]  # noqa: E712

        if search:
            pattern = f"%{search}%"
            conditions.append(
                or_(
                    self.model.display_name.ilike(pattern),
                    self.model.username.ilike(pattern),
                )
            )

        if role:
            conditions.append(self.model.role == role)

        stmt = (
            select(self.model)
            .where(*conditions)
            .offset((page - 1) * size)
            .limit(size)
            .order_by(self.model.display_name)
        )
        total_stmt = select(func.count()).select_from(self.model).where(*conditions)

        users = (await self._session.scalars(stmt)).all()
        total = await self._session.scalar(total_stmt) or 0

        return users, total

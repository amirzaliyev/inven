import logging
import re
from typing import Any, Generic, TypeVar

from sqlalchemy import Column, FromClause, delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import BaseModel

from .exceptions import Conflict, DomainError, ResourceNotFound

__all__ = ["BaseModelService"]
logger = logging.getLogger(__name__)

ModelT = TypeVar("ModelT", bound=BaseModel)


def _extract_uniqueviolation_err(err_msg: str) -> dict[str, Any]:
    """
    Extracts meaningful data from `UniqueViolation` exception
    """
    msg_pattern = r"Key \((\w+), (\w+)\)"
    field_match = re.search(pattern=msg_pattern, string=err_msg)
    if not field_match:
        # for only one field UniqueViolation error
        msg_pattern = r"Key \((\w+)\)"
        field_match = re.search(pattern=msg_pattern, string=err_msg)
        if not field_match:
            logger.error(err_msg)
            raise DomainError(
                code="unhandled_error", message="Unhandled unique field error"
            )
        return {"primary_column": field_match.group(1)}

    return {
        "primary_column": field_match.group(1),
        "secondary_column": field_match.group(2) if field_match.group(2) else None,
    }


def _extract_foreignkey_err_msg(err_msg: str) -> tuple[str, str, int]:
    """
    Extracts meaningful data from `ForeignKeyViolation` exception
    """

    pattern = r'Key \((\w+)\)=\((\d+)\)[\w ]+table "(\w+)"'
    field_match = re.search(pattern=pattern, string=err_msg)

    if not field_match:
        return "", "", -1

    return field_match.group(3), field_match.group(1), int(field_match.group(2))


class BaseModelService(Generic[ModelT]):
    __dependency_graph: dict[FromClause, set] = {}

    model: type[ModelT]

    def __init__(self, session: AsyncSession, auto_commit: bool = True):
        self._session = session
        self._auto_commit = True

    async def get(self, **kwargs) -> ModelT:
        conditions = self._build_filters(**kwargs)
        conditions.append(self.model.is_active == True)  # noqa: E712
        stmt = select(self.model).where(*conditions)

        obj = (await self._session.scalars(stmt)).one_or_none()

        if not obj:
            model_name = self.model.__name__
            raise ResourceNotFound(
                code=f"{model_name}_not_found", message=f"{model_name} not found"
            )

        return obj

    async def _create(self, obj_data: dict[str, Any]) -> ModelT:
        try:
            obj = self.model(**obj_data)

            self._session.add(obj)

            await self._commit_or_flush()

            await self._session.refresh(obj)

            return obj

        except TypeError as e:
            raise DomainError(code="invalid_model_field", message=str(e))

        except IntegrityError as e:
            err_msg = str(e)

            if "UniqueViolationError" in err_msg:
                fields = _extract_uniqueviolation_err(err_msg=err_msg)
                primary_column = fields.get("primary_column", "")
                raise Conflict(
                    code=f"{primary_column.replace('_id', '')}_exists",
                    message=f"{primary_column} must be unique",
                ) from e

            if "ForeignKeyViolationError" in err_msg:
                table, column, pk = _extract_foreignkey_err_msg(err_msg=err_msg)

                if not table:
                    raise

                field_name = column.replace("_id", "")

                raise ResourceNotFound(
                    code=f"{field_name}_not_found",
                    message=f"{field_name} not found with pk {pk}",
                )

            raise

    async def _update(self, obj: ModelT, modified_data: dict[str, Any]) -> ModelT:
        try:
            for key, value in modified_data.items():
                setattr(obj, key, value)

            await self._commit_or_flush()
            await self._session.refresh(obj)

            return obj

        except TypeError as e:
            raise DomainError(code="invalid_model_field", message=str(e))

        except IntegrityError as e:
            err_msg = str(e)

            if "UniqueViolationError" in err_msg:
                fields = _extract_uniqueviolation_err(err_msg=err_msg)
                primary_column = fields.get("primary_column", "")
                raise Conflict(
                    code=f"{primary_column.replace('_id', '')}_exists",
                    message=f"{primary_column} must be unique",
                ) from e

            if "ForeignKeyViolationError" in err_msg:
                table, column, pk = _extract_foreignkey_err_msg(err_msg=err_msg)

                if table:
                    field_name = column.replace("_id", "")

                    raise ResourceNotFound(
                        code=f"{field_name}_not_found",
                        message=f"{field_name} not found with pk {pk}",
                    )

            raise

    async def _commit_or_flush(self):
        if self._auto_commit:
            await self._session.commit()

        else:
            await self._session.flush()

    async def delete(self, **kwargs) -> None:
        obj = await self.get(**kwargs)
        await self._session.execute(delete(self.model).where(self.model.id == obj.id))
        await self._commit_or_flush()

    async def soft_delete(self, **kwargs) -> None:
        raise NotImplementedError

    def _build_filters(self, **kwargs):
        if not kwargs:
            raise ValueError("Conditions are not specified")

        conditions = []
        for key, value in kwargs.items():
            column = getattr(self.model, key)

            if not column:
                raise AttributeError(
                    f"{self.model.__name__} does not have {key} field."
                )

            conditions.append(column == value)

        return conditions

    def _get_dependants(self, obj: ModelT) -> set[Column]:
        obj_table = obj.__table__
        _dependants = self.__dependency_graph.get(obj_table, set())

        if not _dependants:
            tables = BaseModel.metadata.tables.values()
            for table in tables:
                for fk in table.foreign_keys:
                    if fk.ondelete != "RESTRICT":
                        continue

                    if obj_table == fk.column.table:
                        set_ = self.__dependency_graph.get(obj_table, set())
                        set_.add(fk.parent)
                        self.__dependency_graph[obj_table] = set_

        _dependants = self.__dependency_graph.get(obj_table, set())

        return _dependants

    async def _has_dependent_rows(
        self, obj: ModelT, /, raise_exception: bool = True
    ) -> bool:
        dependants = self._get_dependants(obj)

        entities: set[str] = set()
        for dep in dependants:
            result = await self._session.scalar(select(dep.table).where(dep == obj.id))

            if result:
                entities.add(dep.table.name)

        if entities:
            if raise_exception:
                obj_name = self.model.__name__.lower()
                raise Conflict(
                    code=f"{obj_name}_referenced",
                    message=f"{obj_name} is referenced by {', '.join(entities)}",
                )
            return True

        return False

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class BatchWorker(BaseModel):
    """Records which employees were present for a given batch (attendance)."""

    __tablename__ = "batch_workers"
    __table_args__ = (
        UniqueConstraint("batch_id", "employee_id", name="uq_batch_worker"),
    )

    batch_id: Mapped[int] = mapped_column(
        ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True
    )

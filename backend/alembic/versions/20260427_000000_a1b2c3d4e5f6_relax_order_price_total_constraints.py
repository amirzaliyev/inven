"""relax order price and total constraints to allow zero

Revision ID: a1b2c3d4e5f6
Revises: 48cb1df6ba59
Create Date: 2026-04-27 00:00:00

"""
from typing import Sequence, Union

from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "48cb1df6ba59"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_orders_positive_total_amount", "orders", type_="check")
    op.create_check_constraint(
        "ck_orders_positive_total_amount", "orders", "total_amount>=0"
    )

    op.drop_constraint(
        "ck_order_items_positive_price", "order_items", type_="check"
    )
    op.create_check_constraint(
        "ck_order_items_positive_price", "order_items", "price>=0"
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_order_items_positive_price", "order_items", type_="check"
    )
    op.create_check_constraint(
        "ck_order_items_positive_price", "order_items", "price>0"
    )

    op.drop_constraint("ck_orders_positive_total_amount", "orders", type_="check")
    op.create_check_constraint(
        "ck_orders_positive_total_amount", "orders", "total_amount>0"
    )

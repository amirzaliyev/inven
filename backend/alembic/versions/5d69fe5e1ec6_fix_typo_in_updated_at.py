"""fix typo in updated_at

Revision ID: 5d69fe5e1ec6
Revises: b26764097954
Create Date: 2026-04-02 09:34:22.529578

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5d69fe5e1ec6'
down_revision: Union[str, Sequence[str], None] = 'b26764097954'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ###
    op.alter_column('users', 'update_at', new_column_name='updated_at')
    op.alter_column('products', 'update_at', new_column_name='updated_at')
    op.alter_column('inventory_transactions', 'update_at', new_column_name='updated_at')
    op.alter_column('inventory_transaction_lines', 'update_at', new_column_name='updated_at')
    op.alter_column('batches', 'update_at', new_column_name='updated_at')
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ###
    op.alter_column('users', 'updated_at', new_column_name='update_at')
    op.alter_column('products', 'updated_at', new_column_name='update_at')
    op.alter_column('inventory_transactions', 'updated_at', new_column_name='update_at')
    op.alter_column('inventory_transaction_lines', 'updated_at', new_column_name='update_at')
    op.alter_column('batches', 'updated_at', new_column_name='update_at')
    # ### end Alembic commands ###

"""Add department_id to bank_statements and income_reports

Revision ID: 004
Revises: 003
Create Date: 2025-02-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bank_statements", sa.Column("department_id", sa.String(36)))
    op.add_column("income_reports", sa.Column("department_id", sa.String(36)))


def downgrade() -> None:
    op.drop_column("bank_statements", "department_id")
    op.drop_column("income_reports", "department_id")

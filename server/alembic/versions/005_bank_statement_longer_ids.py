"""Widen bank_statements.id and bank_statement_lines id/statement_id to 64 chars

Revision ID: 005
Revises: 004
Create Date: 2025-03-01

Frontend sends ids like txn-dep-1772347380433-2026-02-27-282444 (38 chars);
VARCHAR(36) caused StringDataRightTruncationError.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "bank_statements",
        "id",
        existing_type=sa.String(36),
        type_=sa.String(64),
    )
    op.alter_column(
        "bank_statement_lines",
        "id",
        existing_type=sa.String(36),
        type_=sa.String(64),
    )
    op.alter_column(
        "bank_statement_lines",
        "statement_id",
        existing_type=sa.String(36),
        type_=sa.String(64),
    )


def downgrade() -> None:
    op.alter_column(
        "bank_statement_lines",
        "statement_id",
        existing_type=sa.String(64),
        type_=sa.String(36),
    )
    op.alter_column(
        "bank_statement_lines",
        "id",
        existing_type=sa.String(64),
        type_=sa.String(36),
    )
    op.alter_column(
        "bank_statements",
        "id",
        existing_type=sa.String(64),
        type_=sa.String(36),
    )

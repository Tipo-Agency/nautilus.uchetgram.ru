"""Bank statements, income reports

Revision ID: 003
Revises: 002
Create Date: 2025-02-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bank_statements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("bank_name", sa.String(255)),
        sa.Column("account_number", sa.String(100)),
        sa.Column("period_from", sa.String(10), nullable=False),
        sa.Column("period_to", sa.String(10), nullable=False),
        sa.Column("uploaded_at", sa.String(30), nullable=False),
        sa.Column("uploaded_by_user_id", sa.String(36), nullable=False),
        sa.Column("total_income", sa.String(50), server_default="0"),
        sa.Column("total_outcome", sa.String(50)),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )
    op.create_table(
        "bank_statement_lines",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("statement_id", sa.String(36), nullable=False),
        sa.Column("date", sa.String(10), nullable=False),
        sa.Column("amount", sa.String(50), nullable=False),
        sa.Column("description", sa.String(1000)),
        sa.Column("counterparty", sa.String(500)),
        sa.Column("document_number", sa.String(100)),
        sa.Column("type", sa.String(20), nullable=False),
    )
    op.create_table(
        "income_from_1c",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("period_from", sa.String(10), nullable=False),
        sa.Column("period_to", sa.String(10), nullable=False),
        sa.Column("date", sa.String(10), nullable=False),
        sa.Column("amount", sa.String(50), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("document_ref", sa.String(255)),
        sa.Column("department_id", sa.String(36)),
        sa.Column("synced_at", sa.String(30), nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )
    op.create_table(
        "income_reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("period", sa.String(20), nullable=False),
        sa.Column("period_from", sa.String(10), nullable=False),
        sa.Column("period_to", sa.String(10), nullable=False),
        sa.Column("amount", sa.String(50), nullable=False),
        sa.Column("source", sa.String(30), nullable=False),
        sa.Column("statement_ids", postgresql.JSONB(), server_default="[]"),
        sa.Column("manual_amount", sa.String(50)),
        sa.Column("note", sa.String(500)),
        sa.Column("created_at", sa.String(30), nullable=False),
        sa.Column("created_by_user_id", sa.String(36), nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )


def downgrade() -> None:
    op.drop_table("income_reports")
    op.drop_table("income_from_1c")
    op.drop_table("bank_statement_lines")
    op.drop_table("bank_statements")

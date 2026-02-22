"""create user_settings table

Revision ID: 003
Revises: 002
Create Date: 2026-02-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.Text(), primary_key=True),
        sa.Column("dietary_restrictions", sa.Text(), nullable=True),
        sa.Column("spice_tolerance", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("custom_rules", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("user_settings")

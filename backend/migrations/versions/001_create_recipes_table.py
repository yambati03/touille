"""create recipes table

Revision ID: 001
Revises:
Create Date: 2026-02-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recipes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column(
            "user_id",
            sa.String(255),
            nullable=False,
            server_default="__anonymous__",
        ),
        sa.Column("transcript", sa.Text(), nullable=False),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("recipe", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("url", "user_id", name="uq_recipes_url_user_id"),
    )
    op.create_index("ix_recipes_user_id", "recipes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_recipes_user_id", table_name="recipes")
    op.drop_table("recipes")

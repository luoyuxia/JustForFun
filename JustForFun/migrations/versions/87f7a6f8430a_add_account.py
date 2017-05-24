"""add account

Revision ID: 87f7a6f8430a
Revises: 14e8bf2f7ae6
Create Date: 2017-05-13 14:37:00.984954

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '87f7a6f8430a'
down_revision = '14e8bf2f7ae6'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('user', sa.Column('account', sa.String(length=64), nullable=True))
    op.add_column('user', sa.Column('personal_image', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_user_account'), 'user', ['account'], unique=True)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_user_account'), table_name='user')
    op.drop_column('user', 'personal_image')
    op.drop_column('user', 'account')
    # ### end Alembic commands ###
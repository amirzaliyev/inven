import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.passwords import hash_password
from app.core.config import settings
from app.models.users import User

logger = logging.getLogger(__name__)


async def setup_master_admin(session: AsyncSession):
    logger.info("Creating master admin")
    existing = (
        await session.scalars(
            select(User).where(User.username == settings.master_admin_username)
        )
    ).first()

    if existing:
        logger.info("Master admin exists. Exiting")
        return

    user = User(
        display_name="Master Admin",
        role="master_admin",
        username=settings.master_admin_username,
        password_hash=hash_password(settings.master_admin_password),
    )

    session.add(user)
    await session.commit()
    logger.info("Master admin created successfully")

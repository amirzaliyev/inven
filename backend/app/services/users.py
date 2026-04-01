from app.models.users import User
from app.services.base import BaseModelService


class UserService(BaseModelService[User]):
    model = User

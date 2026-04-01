class DomainError(Exception):
    """Base Exception for app layer."""

    def __init__(self, code: str, message: str) -> None:
        """
        Args:
            code: error code.
            message: Detailed information about the error.
        """
        self.code = code
        self.message = message


class UnAuthorized(DomainError):
    """When user is unauthorized"""


class Forbidden(DomainError):
    """When user does not have sufficient permissions."""


class ResourceNotFound(DomainError):
    """When resource not found."""


class Conflict(DomainError):
    """When conflict happens"""

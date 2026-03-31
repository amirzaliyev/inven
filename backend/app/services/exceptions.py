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


class InvalidCredentials(DomainError):
    """When user provides invalid credentials."""


class PermissionDenied(DomainError):
    """When user does not have sufficient permissions."""

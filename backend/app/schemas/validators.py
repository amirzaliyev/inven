import re


def validate_phone_number(phone_number: str | None) -> str | None:
    if phone_number is None:
        return None

    match = re.match(pattern=r"^\+998\d{9}$", string=phone_number)

    if not match:
        raise ValueError(
            "Invalid phone number. Expected format: +998XXXXXXXXX"
        )

    return phone_number

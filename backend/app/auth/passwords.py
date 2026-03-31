from pwdlib import PasswordHash

_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _hasher.hash(password=password)


def verify_hash(password: str, hash: str) -> bool:
    return _hasher.verify(password=password, hash=hash)

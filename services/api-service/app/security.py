from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Header, HTTPException, status

from .config import jwt_secret


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def make_token(user_id: str, workspace_id: str = "", role: str = "") -> str:
    expires_at = datetime.now(UTC) + timedelta(hours=8)
    payload = {"sub": user_id, "workspace_id": workspace_id, "role": role, "exp": expires_at}
    return jwt.encode(payload, jwt_secret, algorithm="HS256")


def read_token(authorization: str | None = Header(default=None)) -> dict[str, str]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in required")
    try:
        return jwt.decode(authorization.removeprefix("Bearer "), jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is invalid") from error

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from .errors import ApiError

from .config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verificar_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def crear_token(usuario_id: str, rol: str) -> str:
    payload = {
        "sub": usuario_id,
        "rol": rol,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRA_MIN),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decodificar_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise ApiError(status_code=401, detail="Token invalido o expirado")

"""
Protección contra fuerza bruta en el login.

- Limita intentos fallidos por email (y opcionalmente por IP).
- Aplica bloqueo temporal tras superar el umbral.
- Registra intentos fallidos para auditoría (sin guardar contraseñas).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from .config import settings
from .database import get_local_db
from .errors import ApiError

logger = logging.getLogger("inguard.security")


def _col():
    return get_local_db()["login_attempts"]


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    """Normaliza datetimes naive (mongomock) a aware UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def registrar_intento_fallido(email: str, ip: str | None = None) -> None:
    """Incrementa el contador de intentos fallidos y registra el evento."""
    email = email.lower().strip()
    ahora = _ahora()

    doc = _col().find_one({"email": email})
    if doc is None:
        _col().insert_one(
            {
                "email": email,
                "intentos": 1,
                "primer_intento": ahora,
                "ultimo_intento": ahora,
                "bloqueado_hasta": None,
                "ips": [ip] if ip else [],
            }
        )
    else:
        bloqueado_hasta = _aware(doc.get("bloqueado_hasta"))
        if bloqueado_hasta and bloqueado_hasta <= ahora:
            _col().update_one(
                {"email": email},
                {
                    "$set": {
                        "intentos": 1,
                        "primer_intento": ahora,
                        "ultimo_intento": ahora,
                        "bloqueado_hasta": None,
                    },
                    **({"$addToSet": {"ips": ip}} if ip else {}),
                },
            )
        else:
            update: dict = {
                "$inc": {"intentos": 1},
                "$set": {"ultimo_intento": ahora},
            }
            if ip:
                update["$addToSet"] = {"ips": ip}
            _col().update_one({"email": email}, update)

    logger.warning(
        "Intento de login fallido email=%s ip=%s",
        email,
        ip or "desconocida",
    )


def limpiar_intentos(email: str) -> None:
    """Tras un login exitoso se resetea el contador."""
    _col().delete_one({"email": email.lower().strip()})


def verificar_no_bloqueado(email: str) -> None:
    """
    Lanza ApiError 429 si el email está temporalmente bloqueado
    o si superó el máximo de intentos en la ventana de tiempo.
    """
    email = email.lower().strip()
    doc = _col().find_one({"email": email})
    if not doc:
        return

    ahora = _ahora()
    bloqueado_hasta = _aware(doc.get("bloqueado_hasta"))

    if bloqueado_hasta and bloqueado_hasta > ahora:
        minutos = max(1, int((bloqueado_hasta - ahora).total_seconds() // 60) + 1)
        raise ApiError(
            429,
            f"Demasiados intentos fallidos. Intente de nuevo en {minutos} minuto(s).",
        )

    primer = _aware(doc.get("primer_intento")) or ahora
    ventana = timedelta(minutes=settings.LOGIN_VENTANA_MIN)
    if doc.get("intentos", 0) >= settings.LOGIN_MAX_INTENTOS and (ahora - primer) <= ventana:
        nuevo_bloqueo = ahora + timedelta(minutes=settings.LOGIN_BLOQUEO_MIN)
        _col().update_one(
            {"email": email},
            {"$set": {"bloqueado_hasta": nuevo_bloqueo}},
        )
        logger.warning(
            "Cuenta bloqueada temporalmente email=%s hasta=%s",
            email,
            nuevo_bloqueo.isoformat(),
        )
        raise ApiError(
            429,
            f"Demasiados intentos fallidos. Intente de nuevo en {settings.LOGIN_BLOQUEO_MIN} minuto(s).",
        )

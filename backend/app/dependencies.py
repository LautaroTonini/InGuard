from functools import wraps

from flask import g, request

from .errors import ApiError
from .models.solicitud import Solicitud
from .models.usuario import Usuario
from .security import decodificar_token


def login_requerido(f):
    """Valida el header 'Authorization: Bearer <token>' y deja el usuario en g.usuario."""

    @wraps(f)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise ApiError(401, "Falta el token (Authorization: Bearer <token>)")
        payload = decodificar_token(header[7:])
        usuario = Usuario.get(payload["sub"])
        if usuario is None:
            raise ApiError(401, "Usuario no encontrado")
        g.usuario = usuario
        return f(*args, **kwargs)

    return wrapper


def cuidador_requerido(f):
    @wraps(f)
    @login_requerido
    def wrapper(*args, **kwargs):
        if g.usuario["rol"] != "cuidador":
            raise ApiError(403, "Solo para cuidadores")
        return f(*args, **kwargs)

    return wrapper


def acceso_requerido(f):
    """
    Cuidador (token de usuario) o dispositivo de paciente (token de una solicitud de acceso).
    Deja g.usuario o g.dispositivo (el otro queda en None).
    """

    @wraps(f)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise ApiError(401, "Falta el token (Authorization: Bearer <token>)")
        payload = decodificar_token(header[7:])
        g.usuario = g.dispositivo = None
        if payload.get("rol") == "dispositivo":
            g.dispositivo = Solicitud.get(payload["sub"])
            if g.dispositivo is None:
                raise ApiError(401, "Este dispositivo fue desvinculado")
        else:
            g.usuario = Usuario.get(payload["sub"])
            if g.usuario is None:
                raise ApiError(401, "Usuario no encontrado")
        return f(*args, **kwargs)

    return wrapper

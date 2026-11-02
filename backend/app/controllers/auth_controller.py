import secrets
import string

from flask import request

from ..errors import ApiError
from ..models.usuario import Usuario
from ..rate_limit import limpiar_intentos, registrar_intento_fallido, verificar_no_bloqueado
from ..schemas import LoginIn, RegistroIn
from ..security import crear_token, hash_password, verificar_password
from ..views import serializar_usuario


def registrar(data: RegistroIn) -> dict:
    email = data.email.lower()
    if Usuario.buscar_por_email(email):
        raise ApiError(409, "El email ya esta registrado")
    if Usuario.buscar_por_dni(data.dni):
        raise ApiError(409, "El DNI ya esta registrado")

    doc = {
        "nombre": data.nombre,
        "apellido": data.apellido,
        "dni": data.dni,
        "email": email,
        "telefono": data.telefono,
        "password_hash": hash_password(data.password),
        "rol": data.rol,
    }
    if data.rol == "paciente":
        doc["codigo_vinculacion"] = "".join(secrets.choice(string.digits) for _ in range(6))
        doc["ficha_medica"] = {
            "enfermedades": [],
            "alergias": [],
            "diagnosticos": [],
            "grupo_sanguineo": None,
            "obra_social": None,
            "numero_afiliado": None,
            "notas": None,
        }
    else:
        doc["pacientes_ids"] = []
    return Usuario.create(doc)


def login(data: LoginIn) -> dict:
    email = data.email.lower()
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)

    # Protección contra fuerza bruta
    verificar_no_bloqueado(email)

    usuario = Usuario.buscar_por_email(email)
    if not usuario or not verificar_password(data.password, usuario["password_hash"]):
        registrar_intento_fallido(email, ip)
        raise ApiError(401, "Credenciales invalidas")

    # Login exitoso → limpiar contador
    limpiar_intentos(email)

    return {
        "access_token": crear_token(usuario["_id"], usuario["rol"]),
        "token_type": "bearer",
        "usuario": serializar_usuario(usuario, incluir_codigo=True),
    }

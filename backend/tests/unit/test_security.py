"""Pruebas unitarias de seguridad: hash de contraseñas y tokens JWT."""

from app.security import crear_token, decodificar_token, hash_password, verificar_password
from app.errors import ApiError
import pytest


def test_hash_y_verificacion_password():
    """Las contraseñas se almacenan con bcrypt y se verifican correctamente."""
    plain = "MiClaveSegura123"
    hashed = hash_password(plain)

    assert hashed != plain
    assert hashed.startswith("$2")  # bcrypt
    assert verificar_password(plain, hashed) is True
    assert verificar_password("otra-clave", hashed) is False


def test_token_jwt_valido():
    """crear_token genera un JWT que decodificar_token acepta."""
    token = crear_token("user-id-123", "cuidador")
    payload = decodificar_token(token)

    assert payload["sub"] == "user-id-123"
    assert payload["rol"] == "cuidador"
    assert "exp" in payload


def test_token_invalido_lanza_error():
    """Un token manipulado o expirado debe rechazarse."""
    with pytest.raises(ApiError) as exc:
        decodificar_token("token.inventado.invalido")
    assert exc.value.status_code == 401

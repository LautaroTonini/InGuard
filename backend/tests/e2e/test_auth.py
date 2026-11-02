"""
Pruebas end-to-end de autenticación:
- Registro
- Login exitoso
- Rechazo de email duplicado
- Protección contra fuerza bruta (límite de intentos)
"""

import pytest


def _registro(client, email="test@example.com", rol="paciente", dni="12345678"):
    return client.post(
        "/auth/registro",
        json={
            "nombre": "Ana",
            "apellido": "Pérez",
            "dni": dni,
            "email": email,
            "telefono": "+5491112345678",
            "password": "clave123",
            "rol": rol,
        },
    )


def test_registro_y_login_ok(client):
    r = _registro(client)
    assert r.status_code == 201
    body = r.get_json()
    assert body["email"] == "test@example.com"
    assert "password_hash" not in body
    assert body["rol"] == "paciente"

    r2 = client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "clave123"},
    )
    assert r2.status_code == 200
    data = r2.get_json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["usuario"]["email"] == "test@example.com"


def test_registro_email_duplicado(client):
    assert _registro(client).status_code == 201
    r = _registro(client, dni="87654321")  # mismo email, otro dni
    assert r.status_code == 409
    assert "email" in r.get_json()["detail"].lower()


def test_login_credenciales_invalidas(client):
    _registro(client)
    r = client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "incorrecta"},
    )
    assert r.status_code == 401


def test_fuerza_bruta_bloquea_tras_varios_intentos(client):
    """Tras LOGIN_MAX_INTENTOS fallidos debe responder 429."""
    _registro(client, email="brute@example.com", dni="11223344")

    for _ in range(5):
        r = client.post(
            "/auth/login",
            json={"email": "brute@example.com", "password": "mala"},
        )
        assert r.status_code == 401

    r = client.post(
        "/auth/login",
        json={"email": "brute@example.com", "password": "mala"},
    )
    assert r.status_code == 429
    assert "intentos" in r.get_json()["detail"].lower() or "minuto" in r.get_json()["detail"].lower()

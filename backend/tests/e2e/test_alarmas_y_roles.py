"""
Pruebas end-to-end de permisos por rol y flujo de alarmas.
"""

import pytest


def _registrar_y_loguear(client, email, rol, dni):
    client.post(
        "/auth/registro",
        json={
            "nombre": "Test",
            "apellido": "User",
            "dni": dni,
            "email": email,
            "telefono": "+5491100000000",
            "password": "clave123",
            "rol": rol,
        },
    )
    r = client.post("/auth/login", json={"email": email, "password": "clave123"})
    assert r.status_code == 200
    data = r.get_json()
    return data["access_token"], data["usuario"]


def test_paciente_no_accede_a_otro_paciente(client):
    token_a, user_a = _registrar_y_loguear(client, "pacA@test.com", "paciente", "11111111")
    token_b, user_b = _registrar_y_loguear(client, "pacB@test.com", "paciente", "22222222")

    # A intenta ver datos de B
    r = client.get(
        f"/pacientes/{user_b['id']}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert r.status_code == 403


def test_flujo_cuidador_vincular_y_crear_medicamento_alarma(client):
    token_pac, user_pac = _registrar_y_loguear(
        client, "paciente@test.com", "paciente", "33333333"
    )
    token_cuid, user_cuid = _registrar_y_loguear(
        client, "cuidador@test.com", "cuidador", "44444444"
    )

    # Obtener código de vinculación del paciente
    r_me = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token_pac}"},
    )
    assert r_me.status_code == 200
    codigo = r_me.get_json().get("codigo_vinculacion")
    assert codigo

    # Vincular
    r_vinc = client.post(
        "/cuidador/pacientes/vincular",
        headers={"Authorization": f"Bearer {token_cuid}"},
        json={"paciente_id": user_pac["id"], "codigo_vinculacion": codigo},
    )
    assert r_vinc.status_code in (200, 201)

    # Crear medicamento
    r_med = client.post(
        f"/pacientes/{user_pac['id']}/medicamentos",
        headers={"Authorization": f"Bearer {token_cuid}"},
        json={
            "nombre": "Paracetamol",
            "dosis": "500 mg",
            "frecuencia_horas": 8,
            "activo": True,
        },
    )
    assert r_med.status_code == 201
    med_id = r_med.get_json()["id"]

    # Crear alarma (dispara Observer)
    r_al = client.post(
        f"/medicamentos/{med_id}/alarmas",
        headers={"Authorization": f"Bearer {token_cuid}"},
        json={"hora": "08:00", "dias_semana": [0, 1, 2, 3, 4], "activa": True},
    )
    assert r_al.status_code == 201
    assert r_al.get_json()["hora"] == "08:00"

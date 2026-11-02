"""Pruebas unitarias de autorización por rol / paciente."""

import pytest
from app.errors import ApiError
from app.permisos import verificar_acceso_paciente


def test_paciente_solo_accede_a_si_mismo():
    usuario = {"_id": "pac-1", "rol": "paciente", "pacientes_ids": []}
    verificar_acceso_paciente(usuario, "pac-1")  # no lanza

    with pytest.raises(ApiError) as exc:
        verificar_acceso_paciente(usuario, "pac-otro")
    assert exc.value.status_code == 403


def test_cuidador_solo_accede_a_pacientes_vinculados():
    usuario = {
        "_id": "cuid-1",
        "rol": "cuidador",
        "pacientes_ids": ["pac-a", "pac-b"],
    }
    verificar_acceso_paciente(usuario, "pac-a")  # permitido

    with pytest.raises(ApiError) as exc:
        verificar_acceso_paciente(usuario, "pac-x")
    assert exc.value.status_code == 403

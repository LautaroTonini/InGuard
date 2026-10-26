from .errors import ApiError


def verificar_acceso_paciente(usuario: dict, paciente_id: str) -> None:
    """
    - paciente : solo accede a sus propios datos.
    - cuidador : solo a los pacientes de su lista `pacientes_ids`.
    """
    if usuario["rol"] == "paciente":
        permitido = usuario["_id"] == paciente_id
    else:
        permitido = paciente_id in usuario.get("pacientes_ids", [])
    if not permitido:
        raise ApiError(status_code=403, detail="No tenes acceso a este paciente")

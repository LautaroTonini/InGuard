from ..errors import ApiError

from ..models.usuario import Usuario
from ..permisos import verificar_acceso_paciente
from ..schemas import PacienteUpdateIn, VincularIn
from ..views import serializar_usuario


def _paciente_o_404(paciente_id: str, usar_nube: bool = True) -> dict:
    paciente = Usuario.obtener(paciente_id, usar_nube=usar_nube)
    if not paciente or paciente["rol"] != "paciente":
        raise ApiError(404, "Paciente no encontrado (si estas sin internet, puede no estar en este dispositivo)")
    return paciente


# ---- Cuidador <-> pacientes ----
def vincular_paciente(cuidador: dict, data: VincularIn) -> dict:
    paciente = _paciente_o_404(data.paciente_id)
    if paciente["codigo_vinculacion"] != data.codigo_vinculacion:
        raise ApiError(403, "Codigo de vinculacion incorrecto")
    Usuario.vincular_paciente(cuidador["_id"], paciente["_id"])
    return serializar_usuario(paciente)


def listar_pacientes(cuidador: dict) -> list[dict]:
    pacientes = (Usuario.obtener(pid, usar_nube=False) for pid in cuidador.get("pacientes_ids", []))
    return [serializar_usuario(p) for p in pacientes if p]


def desvincular_paciente(cuidador: dict, paciente_id: str) -> None:
    verificar_acceso_paciente(cuidador, paciente_id)
    Usuario.desvincular_paciente(cuidador["_id"], paciente_id)


# ---- Informacion del paciente (SCRUM-46) ----
def obtener_paciente(usuario: dict, paciente_id: str) -> dict:
    verificar_acceso_paciente(usuario, paciente_id)
    paciente = _paciente_o_404(paciente_id, usar_nube=False)
    return serializar_usuario(paciente, incluir_codigo=usuario["rol"] == "paciente")


def editar_paciente(usuario: dict, paciente_id: str, data: PacienteUpdateIn) -> dict:
    verificar_acceso_paciente(usuario, paciente_id)
    _paciente_o_404(paciente_id, usar_nube=False)

    cambios = data.model_dump(exclude_unset=True, exclude={"ficha_medica"})
    if data.ficha_medica:
        for campo, valor in data.ficha_medica.model_dump(exclude_unset=True).items():
            cambios[f"ficha_medica.{campo}"] = valor
    if not cambios:
        raise ApiError(400, "No se enviaron cambios")

    actualizado = Usuario.update(paciente_id, cambios)
    return serializar_usuario(actualizado, incluir_codigo=usuario["rol"] == "paciente")

from ..errors import ApiError

from ..models.alarma import Alarma
from ..models.medicamento import Medicamento
from ..permisos import verificar_acceso_paciente
from ..schemas import AlarmaIn, AlarmaUpdateIn
from ..views import serializar, serializar_lista


def _alarma_con_acceso(usuario: dict, alarma_id: str) -> dict:
    alarma = Alarma.get(alarma_id)
    if not alarma:
        raise ApiError(404, "Alarma no encontrada")
    verificar_acceso_paciente(usuario, alarma["paciente_id"])
    return alarma


def crear(usuario: dict, medicamento_id: str, data: AlarmaIn) -> dict:
    med = Medicamento.get(medicamento_id)
    if not med:
        raise ApiError(404, "Medicamento no encontrado")
    verificar_acceso_paciente(usuario, med["paciente_id"])
    alarma = Alarma.create(
        {
            **data.model_dump(),
            "dias_semana": sorted(set(data.dias_semana)),
            "paciente_id": med["paciente_id"],
            "medicamento_id": medicamento_id,
            "creado_por": usuario["_id"],
        }
    )
    return serializar(alarma)


def listar(usuario: dict, paciente_id: str) -> list[dict]:
    verificar_acceso_paciente(usuario, paciente_id)
    return serializar_lista(Alarma.listar_por_paciente(paciente_id))


def actualizar(usuario: dict, alarma_id: str, data: AlarmaUpdateIn) -> dict:
    _alarma_con_acceso(usuario, alarma_id)
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise ApiError(400, "No se enviaron cambios")
    if "dias_semana" in cambios:
        cambios["dias_semana"] = sorted(set(cambios["dias_semana"]))
    return serializar(Alarma.update(alarma_id, cambios))


def eliminar(usuario: dict, alarma_id: str) -> None:
    _alarma_con_acceso(usuario, alarma_id)
    Alarma.delete(alarma_id)

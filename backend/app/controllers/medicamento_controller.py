from ..errors import ApiError

from ..models.alarma import Alarma
from ..models.medicamento import Medicamento
from ..permisos import verificar_acceso_paciente
from ..schemas import MedicamentoIn, MedicamentoUpdateIn
from ..views import serializar, serializar_lista


def _med_con_acceso(usuario: dict, med_id: str) -> dict:
    med = Medicamento.get(med_id)
    if not med:
        raise ApiError(404, "Medicamento no encontrado")
    verificar_acceso_paciente(usuario, med["paciente_id"])
    return med


def crear(usuario: dict, paciente_id: str, data: MedicamentoIn) -> dict:
    verificar_acceso_paciente(usuario, paciente_id)
    med = Medicamento.create(
        {**data.model_dump(), "paciente_id": paciente_id, "creado_por": usuario["_id"]}
    )
    return serializar(med)


def listar(usuario: dict, paciente_id: str, solo_activos: bool) -> list[dict]:
    verificar_acceso_paciente(usuario, paciente_id)
    return serializar_lista(Medicamento.listar_por_paciente(paciente_id, solo_activos))


def obtener(usuario: dict, med_id: str) -> dict:
    return serializar(_med_con_acceso(usuario, med_id))


def actualizar(usuario: dict, med_id: str, data: MedicamentoUpdateIn) -> dict:
    _med_con_acceso(usuario, med_id)
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise ApiError(400, "No se enviaron cambios")
    return serializar(Medicamento.update(med_id, cambios))


def eliminar(usuario: dict, med_id: str) -> None:
    _med_con_acceso(usuario, med_id)
    Medicamento.delete(med_id)
    Alarma.eliminar_por_medicamento(med_id)  # las alarmas dependen del medicamento

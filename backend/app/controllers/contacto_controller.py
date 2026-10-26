from ..errors import ApiError

from ..models.contacto import ContactoEmergencia
from ..permisos import verificar_acceso_paciente
from ..schemas import ContactoIn, ContactoUpdateIn
from ..utils import tel_uri
from ..views import serializar


def _con_tel(contacto: dict) -> dict:
    out = serializar(contacto)
    out["tel_uri"] = tel_uri(contacto["telefono"])
    return out


def _contacto_con_acceso(usuario: dict, contacto_id: str) -> dict:
    contacto = ContactoEmergencia.get(contacto_id)
    if not contacto:
        raise ApiError(404, "Contacto no encontrado")
    verificar_acceso_paciente(usuario, contacto["paciente_id"])
    return contacto


def crear(usuario: dict, paciente_id: str, data: ContactoIn) -> dict:
    verificar_acceso_paciente(usuario, paciente_id)
    contacto = ContactoEmergencia.create({**data.model_dump(), "paciente_id": paciente_id})
    if data.es_principal:
        ContactoEmergencia.quitar_principal(paciente_id, excepto_id=contacto["_id"])
    return _con_tel(contacto)


def listar(usuario: dict, paciente_id: str) -> list[dict]:
    verificar_acceso_paciente(usuario, paciente_id)
    return [_con_tel(c) for c in ContactoEmergencia.listar_por_paciente(paciente_id)]


def actualizar(usuario: dict, contacto_id: str, data: ContactoUpdateIn) -> dict:
    contacto = _contacto_con_acceso(usuario, contacto_id)
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise ApiError(400, "No se enviaron cambios")
    if cambios.get("es_principal"):
        ContactoEmergencia.quitar_principal(contacto["paciente_id"], excepto_id=contacto_id)
    return _con_tel(ContactoEmergencia.update(contacto_id, cambios))


def eliminar(usuario: dict, contacto_id: str) -> None:
    _contacto_con_acceso(usuario, contacto_id)
    ContactoEmergencia.delete(contacto_id)


def llamar(usuario: dict, contacto_id: str) -> dict:
    """Devuelve el link tel: para que el cliente (app movil) inicie la llamada."""
    contacto = _contacto_con_acceso(usuario, contacto_id)
    return {"nombre": contacto["nombre"], "telefono": contacto["telefono"], "tel_uri": tel_uri(contacto["telefono"])}

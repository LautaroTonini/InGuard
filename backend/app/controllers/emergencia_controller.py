from ..errors import ApiError

from ..config import settings
from ..models.contacto import ContactoEmergencia
from ..models.medicamento import Medicamento
from ..models.usuario import Usuario
from ..utils import tel_uri


def datos_importantes(paciente_id: str) -> dict:
    """
    SCRUM-39 - Pantalla de bloqueo. Lo consulta un transeunte, por eso no requiere login.
    Solo expone lo necesario para asistir: nada de DNI, email ni credenciales.
    """
    paciente = Usuario.obtener(paciente_id, usar_nube=False)
    if not paciente or paciente["rol"] != "paciente":
        raise ApiError(404, "Paciente no encontrado")

    ficha = paciente.get("ficha_medica", {})
    return {
        "paciente": {"nombre": paciente["nombre"], "apellido": paciente["apellido"]},
        "enfermedades": ficha.get("enfermedades", []),
        "alergias": ficha.get("alergias", []),
        "diagnosticos": ficha.get("diagnosticos", []),
        "grupo_sanguineo": ficha.get("grupo_sanguineo"),
        "obra_social": ficha.get("obra_social"),
        "numero_afiliado": ficha.get("numero_afiliado"),
        "notas": ficha.get("notas"),
        "medicamentos_activos": [
            {"nombre": m["nombre"], "dosis": m["dosis"], "frecuencia_horas": m["frecuencia_horas"]}
            for m in Medicamento.listar_por_paciente(paciente_id, solo_activos=True)
        ],
        "contactos_emergencia": [
            {
                "nombre": c["nombre"],
                "parentesco": c.get("parentesco"),
                "telefono": c["telefono"],
                "es_principal": c.get("es_principal", False),
                "tel_uri": tel_uri(c["telefono"]),
            }
            for c in ContactoEmergencia.listar_por_paciente(paciente_id)
        ],
        "llamar_emergencias": {
            "numero": settings.NUMERO_EMERGENCIAS,
            "tel_uri": tel_uri(settings.NUMERO_EMERGENCIAS),
        },
    }

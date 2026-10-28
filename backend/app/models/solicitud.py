from .base import ModeloBase


class Solicitud(ModeloBase):
    """Dispositivo de un paciente que pidio acceso con el codigo. {paciente_id, nombre_dispositivo, estado}
    estado: pending | accepted | rejected"""

    collection_name = "solicitudes"

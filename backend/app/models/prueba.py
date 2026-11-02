from .base import ModeloBase


class PruebaAlarma(ModeloBase):
    """Alarma de prueba que dispara el cuidador. {paciente_id, ts (ms epoch), hecha}"""

    collection_name = "pruebas_alarma"

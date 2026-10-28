from .base import ModeloBase


class Toma(ModeloBase):
    """Toma de un medicamento marcada como realizada. {paciente_id, clave 'AAAA-MM-DD|med_id|HH:MM', tomada_en}"""

    collection_name = "tomas"

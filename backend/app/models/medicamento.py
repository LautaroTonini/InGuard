from .base import ModeloBase


class Medicamento(ModeloBase):
    """{paciente_id, nombre, dosis, frecuencia_horas, indicaciones, activo, creado_por}"""

    collection_name = "medicamentos"

    @classmethod
    def listar_por_paciente(cls, paciente_id: str, solo_activos: bool = False) -> list[dict]:
        filtro = {"paciente_id": paciente_id}
        if solo_activos:
            filtro["activo"] = True
        return cls.listar(filtro, orden=[("nombre", 1)])

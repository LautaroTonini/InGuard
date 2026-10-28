from .base import ModeloBase, ahora


class Alarma(ModeloBase):
    """{paciente_id, medicamento_id, hora 'HH:MM', dias_semana [0-6], activa, mensaje}"""

    collection_name = "alarmas"

    @classmethod
    def listar_por_paciente(cls, paciente_id: str) -> list[dict]:
        return cls.listar({"paciente_id": paciente_id}, orden=[("hora", 1)])

    @classmethod
    def eliminar_por_medicamento(cls, medicamento_id: str) -> None:
        cls.col().update_many(
            {"medicamento_id": medicamento_id, "eliminado": False},
            {"$set": {"eliminado": True, "actualizado_en": ahora(), "sync_pendiente": True}},
        )

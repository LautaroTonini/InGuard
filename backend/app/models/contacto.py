from .base import ModeloBase, ahora


class ContactoEmergencia(ModeloBase):
    """{paciente_id, nombre, parentesco, telefono, es_principal}"""

    collection_name = "contactos_emergencia"

    @classmethod
    def listar_por_paciente(cls, paciente_id: str) -> list[dict]:
        return cls.listar(
            {"paciente_id": paciente_id}, orden=[("es_principal", -1), ("nombre", 1)]
        )

    @classmethod
    def quitar_principal(cls, paciente_id: str, excepto_id: str | None = None) -> None:
        """Deja un unico contacto principal por paciente."""
        filtro = {"paciente_id": paciente_id, "es_principal": True, "eliminado": False}
        if excepto_id:
            filtro["_id"] = {"$ne": excepto_id}
        cls.col().update_many(
            filtro,
            {"$set": {"es_principal": False, "actualizado_en": ahora(), "sync_pendiente": True}},
        )

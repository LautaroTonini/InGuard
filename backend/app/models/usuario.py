from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from ..database import get_cloud_db
from .base import ModeloBase, ahora


class Usuario(ModeloBase):
    """
    Un unico documento por usuario con rol 'cuidador' o 'paciente'.

    paciente: + codigo_vinculacion, + ficha_medica {...}
    cuidador: + pacientes_ids [id_paciente, ...]   (un cuidador, varios pacientes)
    """

    collection_name = "usuarios"

    # --- Si el usuario no esta en el dispositivo, lo trae de la nube (login en equipo nuevo) ---
    @classmethod
    def _traer_de_nube(cls, filtro: dict) -> dict | None:
        nube = get_cloud_db()
        if nube is None:
            return None
        doc = nube[cls.collection_name].find_one({**filtro, "eliminado": False})
        if doc:
            doc["sync_pendiente"] = False
            try:
                cls.col().replace_one({"_id": doc["_id"]}, doc, upsert=True)
            except DuplicateKeyError:
                return None
        return doc

    @classmethod
    def obtener(cls, usuario_id: str, usar_nube: bool = True) -> dict | None:
        return cls.get(usuario_id) or (
            cls._traer_de_nube({"_id": usuario_id}) if usar_nube else None
        )

    @classmethod
    def buscar_por_email(cls, email: str, usar_nube: bool = True) -> dict | None:
        filtro = {"email": email}
        return cls.col().find_one({**filtro, "eliminado": False}) or (
            cls._traer_de_nube(filtro) if usar_nube else None
        )

    @classmethod
    def buscar_por_dni(cls, dni: str, usar_nube: bool = True) -> dict | None:
        filtro = {"dni": dni}
        return cls.col().find_one({**filtro, "eliminado": False}) or (
            cls._traer_de_nube(filtro) if usar_nube else None
        )

    # --- Relacion cuidador <-> pacientes ---
    @classmethod
    def vincular_paciente(cls, cuidador_id: str, paciente_id: str) -> dict | None:
        return cls.col().find_one_and_update(
            {"_id": cuidador_id, "eliminado": False},
            {
                "$addToSet": {"pacientes_ids": paciente_id},
                "$set": {"actualizado_en": ahora(), "sync_pendiente": True},
            },
            return_document=ReturnDocument.AFTER,
        )

    @classmethod
    def desvincular_paciente(cls, cuidador_id: str, paciente_id: str) -> dict | None:
        return cls.col().find_one_and_update(
            {"_id": cuidador_id, "eliminado": False},
            {
                "$pull": {"pacientes_ids": paciente_id},
                "$set": {"actualizado_en": ahora(), "sync_pendiente": True},
            },
            return_document=ReturnDocument.AFTER,
        )

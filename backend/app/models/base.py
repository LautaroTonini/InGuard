from datetime import datetime, timezone
from uuid import uuid4

from pymongo import ReturnDocument

from ..database import get_local_db


def ahora() -> datetime:
    return datetime.now(timezone.utc)


class ModeloBase:
    """
    Acceso a datos sobre la BD LOCAL. Todo cambio:
      - actualiza `actualizado_en`  (para resolver conflictos: gana el mas reciente)
      - marca `sync_pendiente=True` (para que el servicio de sync lo suba a la nube)
      - los borrados son logicos (`eliminado=True`) para poder sincronizarlos
    Los _id son UUID (str) para que no colisionen entre dispositivos.
    """

    collection_name: str = ""

    @classmethod
    def col(cls):
        return get_local_db()[cls.collection_name]

    @classmethod
    def create(cls, data: dict, doc_id: str | None = None) -> dict:
        ts = ahora()
        doc = {
            "_id": doc_id or str(uuid4()),
            **data,
            "creado_en": ts,
            "actualizado_en": ts,
            "eliminado": False,
            "sync_pendiente": True,
        }
        cls.col().insert_one(doc)
        return doc

    @classmethod
    def get(cls, doc_id: str) -> dict | None:
        return cls.col().find_one({"_id": doc_id, "eliminado": False})

    @classmethod
    def listar(cls, filtro: dict | None = None, orden: list | None = None) -> list[dict]:
        cursor = cls.col().find({**(filtro or {}), "eliminado": False})
        if orden:
            cursor = cursor.sort(orden)
        return list(cursor)

    @classmethod
    def update(cls, doc_id: str, cambios: dict) -> dict | None:
        return cls.col().find_one_and_update(
            {"_id": doc_id, "eliminado": False},
            {"$set": {**cambios, "actualizado_en": ahora(), "sync_pendiente": True}},
            return_document=ReturnDocument.AFTER,
        )

    @classmethod
    def delete(cls, doc_id: str) -> bool:
        return cls.update(doc_id, {"eliminado": True}) is not None

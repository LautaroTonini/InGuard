"""
Sincronizacion LOCAL <-> NUBE (offline-first).

 1. SUBIR : todo documento local con sync_pendiente=True se sube a la nube
            (solo si la nube no tiene una version mas nueva).
 2. BAJAR : documentos de la nube relacionados con los usuarios de este dispositivo
            que sean mas nuevos que los locales se copian al local.
 Conflictos: gana el cambio con `actualizado_en` mas reciente (last-write-wins).
 Sin internet no pasa nada: se acumulan cambios pendientes y se suben cuando vuelve.
"""
import logging
import threading
from datetime import datetime, timezone

from pymongo.errors import DuplicateKeyError, PyMongoError

from ..database import get_cloud_db, get_local_db

logger = logging.getLogger("inguard.sync")

COLECCIONES = ["usuarios", "medicamentos", "alarmas", "contactos_emergencia", "solicitudes", "tomas", "pruebas_alarma"]

_lock = threading.Lock()
_estado = {"ultima_sync": None, "ultimo_resultado": None}


def _alcance_ids(local) -> list[str]:
    """Ids de usuarios del dispositivo + los pacientes de sus cuidadores."""
    ids: set[str] = set()
    for u in local["usuarios"].find({}, {"pacientes_ids": 1}):
        ids.add(u["_id"])
        ids.update(u.get("pacientes_ids", []))
    return list(ids)


def _subir(local, nube) -> int:
    subidos = 0
    for nombre in COLECCIONES:
        for doc in local[nombre].find({"sync_pendiente": True}):
            remoto = nube[nombre].find_one({"_id": doc["_id"]}, {"actualizado_en": 1})
            if remoto is None or remoto["actualizado_en"] <= doc["actualizado_en"]:
                payload = {k: v for k, v in doc.items() if k != "sync_pendiente"}
                nube[nombre].replace_one({"_id": doc["_id"]}, payload, upsert=True)
                # solo limpia el flag si nadie lo modifico mientras tanto
                local[nombre].update_one(
                    {"_id": doc["_id"], "actualizado_en": doc["actualizado_en"]},
                    {"$set": {"sync_pendiente": False}},
                )
                subidos += 1
    return subidos


def _bajar(local, nube) -> tuple[int, int]:
    bajados = conflictos = 0
    ids = _alcance_ids(local)
    if not ids:
        return 0, 0
    for nombre in COLECCIONES:
        campo = "_id" if nombre == "usuarios" else "paciente_id"
        for doc in nube[nombre].find({campo: {"$in": ids}}):
            actual = local[nombre].find_one({"_id": doc["_id"]}, {"actualizado_en": 1})
            if actual is None or doc["actualizado_en"] > actual["actualizado_en"]:
                doc["sync_pendiente"] = False
                try:
                    local[nombre].replace_one({"_id": doc["_id"]}, doc, upsert=True)
                    bajados += 1
                except DuplicateKeyError:  # ej: mismo email creado offline en 2 equipos
                    conflictos += 1
                    logger.warning("Conflicto de unicidad en %s/%s", nombre, doc["_id"])
    return bajados, conflictos


def sincronizar() -> dict:
    if not _lock.acquire(blocking=False):
        return {"online": None, "mensaje": "Ya hay una sincronizacion en curso"}
    try:
        nube = get_cloud_db()
        if nube is None:
            resultado = {"online": False, "mensaje": "Sin conexion a la nube; los cambios quedan pendientes"}
        else:
            local = get_local_db()
            subidos = _subir(local, nube)
            bajados, conflictos = _bajar(local, nube)
            resultado = {"online": True, "subidos": subidos, "bajados": bajados, "conflictos": conflictos}
            _estado["ultima_sync"] = datetime.now(timezone.utc)
        _estado["ultimo_resultado"] = resultado
        return resultado
    except PyMongoError as e:
        logger.exception("Error sincronizando")
        return {"online": False, "mensaje": f"Error de base de datos: {e.__class__.__name__}"}
    finally:
        _lock.release()


def estado() -> dict:
    local = get_local_db()
    pendientes = sum(local[c].count_documents({"sync_pendiente": True}) for c in COLECCIONES)
    return {"pendientes": pendientes, **_estado}

"""
Dos bases MongoDB:
  - LOCAL : fuente principal de lectura/escritura (MONGO_LOCAL_URI). Puede apuntar a MongoDB Atlas: ahi vive la "BD principal".
  - NUBE  : respaldo y punto de sincronizacion. Puede no estar disponible (offline).
"""
import logging
from pymongo import MongoClient, ASCENDING
from pymongo.errors import OperationFailure, PyMongoError

from .config import settings

logger = logging.getLogger("inguard.db")

def _cliente(uri: str, timeout_ms: int) -> MongoClient:
    """Cliente Mongo. Para Atlas (mongodb+srv / mongodb.net) usa los certificados de certifi (evita errores de SSL)."""
    extra = {}
    if uri.startswith("mongodb+srv://") or "mongodb.net" in uri:
        import certifi

        extra["tlsCAFile"] = certifi.where()
    return MongoClient(uri, tz_aware=True, serverSelectionTimeoutMS=timeout_ms, connectTimeoutMS=timeout_ms, **extra)


_local_client = None
_cloud_client = None


def get_local_db():
    global _local_client
    if _local_client is None:
        _local_client = _cliente(settings.MONGO_LOCAL_URI, settings.MONGO_TIMEOUT_MS)
    return _local_client[settings.MONGO_LOCAL_DB]


def get_cloud_db():
    """Devuelve la BD en la nube, o None si no esta configurada / no hay internet."""
    global _cloud_client
    if not settings.MONGO_CLOUD_URI:
        return None
    try:
        if _cloud_client is None:
            _cloud_client = _cliente(settings.MONGO_CLOUD_URI, 2000)
        _cloud_client.admin.command("ping")
        return _cloud_client[settings.MONGO_CLOUD_DB]
    except PyMongoError:
        logger.info("Nube no disponible: se trabaja solo en local")
        return None


def _unico_parcial(col, campo):
    """Unico solo cuando el campo existe (los pacientes cargados por un cuidador no tienen email ni DNI)."""
    try:
        col.drop_index(f"{campo}_1")  # indice viejo sin filtro: bloquearia a los pacientes sin cuenta
    except OperationFailure:
        pass
    col.create_index(
        [(campo, ASCENDING)], name=f"{campo}_unico", unique=True,
        partialFilterExpression={campo: {"$type": "string"}},
    )


def crear_indices():
    db = get_local_db()
    _unico_parcial(db["usuarios"], "email")
    _unico_parcial(db["usuarios"], "dni")
    db["usuarios"].create_index([("codigo_vinculacion", ASCENDING)])
    db["tomas"].create_index([("paciente_id", ASCENDING), ("clave", ASCENDING)], unique=True)
    for col in ("medicamentos", "alarmas", "contactos_emergencia", "solicitudes", "tomas", "pruebas_alarma"):
        db[col].create_index([("paciente_id", ASCENDING)])
    for col in ("usuarios", "medicamentos", "alarmas", "contactos_emergencia", "solicitudes", "tomas", "pruebas_alarma"):
        db[col].create_index([("sync_pendiente", ASCENDING)])

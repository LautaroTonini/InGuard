"""Verifica la conexion a MongoDB Atlas y crea los indices:  python check_db.py"""
from app.database import get_local_db, crear_indices
from app.config import settings

db = get_local_db()
print("Conectando a:", settings.MONGO_LOCAL_URI.split("@")[-1].split("/")[0], "| base:", settings.MONGO_LOCAL_DB)
db.client.admin.command("ping")
print("Conexion OK")
crear_indices()
print("Indices OK. Colecciones:", db.list_collection_names())

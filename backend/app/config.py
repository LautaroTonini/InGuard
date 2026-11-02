import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    MONGO_LOCAL_URI = os.getenv("MONGO_LOCAL_URI", "mongodb://localhost:27017")
    MONGO_LOCAL_DB = os.getenv("MONGO_LOCAL_DB", "inguard_local")
    MONGO_TIMEOUT_MS = int(os.getenv("MONGO_TIMEOUT_MS", "8000"))  # Atlas tarda mas que un Mongo local
    MONGO_CLOUD_URI = os.getenv("MONGO_CLOUD_URI", "")
    MONGO_CLOUD_DB = os.getenv("MONGO_CLOUD_DB", "inguard_cloud")

    JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-cambiar-en-produccion")
    JWT_EXPIRA_MIN = int(os.getenv("JWT_EXPIRA_MIN", "1440"))

    NUMERO_EMERGENCIAS = os.getenv("NUMERO_EMERGENCIAS", "107")

    # Sin servidor de correo: el codigo de recuperacion vuelve en la respuesta (solo demo).
    RESET_DEMO = os.getenv("RESET_DEMO", "true").lower() == "true"

    SYNC_AUTOMATICA = os.getenv("SYNC_AUTOMATICA", "true").lower() == "true"
    SYNC_INTERVALO_SEG = int(os.getenv("SYNC_INTERVALO_SEG", "30"))
    # CORS restrictivo por defecto (solo frontend local). En produccion usar dominios reales.
    CORS_ORIGINS = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if o.strip()
    ]

    # Protección contra fuerza bruta en login
    LOGIN_MAX_INTENTOS = int(os.getenv("LOGIN_MAX_INTENTOS", "5"))
    LOGIN_VENTANA_MIN = int(os.getenv("LOGIN_VENTANA_MIN", "15"))   # ventana de conteo
    LOGIN_BLOQUEO_MIN = int(os.getenv("LOGIN_BLOQUEO_MIN", "15"))   # duración del bloqueo

settings = Settings()

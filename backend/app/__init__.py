import logging
import os
import threading
import time
from datetime import datetime

from flask import Flask, jsonify
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from pymongo.errors import PyMongoError

from .config import settings
from .database import crear_indices
from .errors import ApiError
from .routes import (
    alarma_routes,
    app_routes,
    auth_routes,
    contacto_routes,
    cuidador_routes,
    emergencia_routes,
    medicamento_routes,
    paciente_routes,
    sync_routes,
)
from .services.sync_service import sincronizar

logger = logging.getLogger("inguard")


class JSONProviderISO(DefaultJSONProvider):
    """Las fechas se devuelven en ISO 8601 (ej: 2026-10-21T18:55:00+00:00)."""

    @staticmethod
    def default(o):
        if isinstance(o, datetime):
            return o.isoformat()
        return DefaultJSONProvider.default(o)


def _iniciar_sync_automatica():
    def bucle():
        while True:
            try:
                sincronizar()
            except Exception:
                logger.exception("Fallo en la sincronizacion automatica")
            time.sleep(settings.SYNC_INTERVALO_SEG)

    threading.Thread(target=bucle, daemon=True, name="inguard-sync").start()


def create_app() -> Flask:
    app = Flask(__name__)
    app.json = JSONProviderISO(app)
    CORS(app, origins=settings.CORS_ORIGINS)

    for modulo in (
        app_routes,
        auth_routes,
        cuidador_routes,
        paciente_routes,
        medicamento_routes,
        alarma_routes,
        contacto_routes,
        emergencia_routes,
        sync_routes,
    ):
        app.register_blueprint(modulo.bp)

    # ---- manejo de errores: siempre JSON ----
    @app.errorhandler(ApiError)
    def _api_error(e):
        return jsonify({"detail": e.detail}), e.status_code

    @app.errorhandler(PyMongoError)
    def _mongo_error(e):
        logger.exception("Error de MongoDB")
        return jsonify({"detail": "Base de datos no disponible"}), 503

    @app.errorhandler(404)
    def _404(e):
        return jsonify({"detail": "Ruta no encontrada"}), 404

    @app.errorhandler(405)
    def _405(e):
        return jsonify({"detail": "Metodo no permitido"}), 405

    @app.get("/")
    def health():
        return jsonify({"app": "InGuard", "estado": "ok"})

    # ---- arranque ----
    try:
        crear_indices()
    except Exception:
        logger.warning("No se pudieron crear los indices (revisar MONGO_LOCAL_URI / acceso a Atlas)")

    # con el reloader de debug Flask arranca 2 procesos: solo uno debe sincronizar
    es_proceso_principal = (not app.debug) or os.environ.get("WERKZEUG_RUN_MAIN") == "true"
    if settings.SYNC_AUTOMATICA and es_proceso_principal:
        _iniciar_sync_automatica()

    return app

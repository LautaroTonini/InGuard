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


def _configurar_logging():
    """Logging básico: no registra contraseñas, tokens ni datos clínicos innecesarios."""
    if not logging.getLogger().handlers:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        )


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
    
    _configurar_logging()

    app = Flask(__name__)
    app.json = JSONProviderISO(app)
    CORS(app, origins=settings.CORS_ORIGINS, supports_credentials=True)

    # ---- Swagger / OpenAPI (Flasgger) ----
    try:
        from flasgger import Swagger

        swagger_config = {
            "headers": [],
            "specs": [
                {
                    "endpoint": "apispec",
                    "route": "/apispec.json",
                    "rule_filter": lambda rule: True,
                    "model_filter": lambda tag: True,
                }
            ],
            "static_url_path": "/flasgger_static",
            "swagger_ui": True,
            "specs_route": "/docs",
        }
        swagger_template = {
            "info": {
                "title": "InGuard API",
                "description": (
                    "API de gestión de cuidados (pacientes, cuidadores, "
                    "medicamentos, alarmas y contactos de emergencia). "
                    "Autenticación JWT Bearer."
                ),
                "version": "1.0.0",
            },
            "securityDefinitions": {
                "Bearer": {
                    "type": "apiKey",
                    "name": "Authorization",
                    "in": "header",
                    "description": "JWT: Bearer <token>",
                }
            },
        }
        Swagger(app, config=swagger_config, template=swagger_template)
    except ImportError:
        logger.warning("flasgger no instalado: /docs no estará disponible (pip install flasgger)")


    for modulo in (
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
        logger.warning(
            "No se pudieron crear los indices (revisar MONGO_LOCAL_URI / acceso a Atlas)"
        )
    # con el reloader de debug Flask arranca 2 procesos: solo uno debe sincronizar
    es_proceso_principal = (not app.debug) or os.environ.get("WERKZEUG_RUN_MAIN") == "true"
    if settings.SYNC_AUTOMATICA and es_proceso_principal:
        _iniciar_sync_automatica()

    return app

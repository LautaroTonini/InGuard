"""
Fixtures compartidas para tests unitarios y end-to-end.
Usa mongomock para no depender de un MongoDB real.
"""

import os
import sys

import pytest

# Asegurar que el paquete app sea importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Forzar variables de entorno de test antes de importar la app
os.environ.setdefault("JWT_SECRET", "test-secret-key-no-usar-en-prod")
os.environ.setdefault("MONGO_LOCAL_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGO_LOCAL_DB", "inguard_test")
os.environ.setdefault("MONGO_CLOUD_URI", "")
os.environ.setdefault("SYNC_AUTOMATICA", "false")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("LOGIN_MAX_INTENTOS", "5")
os.environ.setdefault("LOGIN_VENTANA_MIN", "15")
os.environ.setdefault("LOGIN_BLOQUEO_MIN", "15")


@pytest.fixture(scope="session")
def app():
    """Aplicación Flask de test (Application Factory)."""
    from app import create_app

    application = create_app()
    application.config.update({"TESTING": True})
    yield application


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def limpiar_db(monkeypatch):
    """
    Sustituye get_local_db por una base mongomock limpia en cada test.
    Evita efectos colaterales entre pruebas.
    """
    import mongomock

    mock_client = mongomock.MongoClient()
    mock_db = mock_client["inguard_test"]

    def _get_local():
        return mock_db

    def _get_cloud():
        return None

    monkeypatch.setattr("app.database.get_local_db", _get_local)
    monkeypatch.setattr("app.database.get_cloud_db", _get_cloud)
    # También en los módulos que ya importaron la función
    monkeypatch.setattr("app.models.base.get_local_db", _get_local)
    monkeypatch.setattr("app.rate_limit.get_local_db", _get_local)

    yield mock_db

    mock_client.drop_database("inguard_test")

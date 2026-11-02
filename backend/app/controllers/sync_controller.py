from ..services import sync_service


def forzar_sync() -> dict:
    return sync_service.sincronizar()


def estado_sync() -> dict:
    return sync_service.estado()

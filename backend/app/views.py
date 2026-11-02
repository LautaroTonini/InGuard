"""'Vista' de la API: como se serializan los documentos de Mongo hacia JSON."""

_OCULTOS = {"password_hash", "sync_pendiente", "eliminado"}


def serializar(doc: dict | None) -> dict | None:
    if doc is None:
        return None
    return {("id" if k == "_id" else k): v for k, v in doc.items() if k not in _OCULTOS}


def serializar_lista(docs: list[dict]) -> list[dict]:
    return [serializar(d) for d in docs]


def serializar_usuario(doc: dict, incluir_codigo: bool = False) -> dict:
    """El codigo de vinculacion solo lo ve el propio paciente."""
    out = serializar(doc)
    if not incluir_codigo:
        out.pop("codigo_vinculacion", None)
    return out

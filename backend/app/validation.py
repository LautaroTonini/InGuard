from flask import request
from pydantic import ValidationError

from .errors import ApiError


def cuerpo(schema):
    """Lee el JSON del request y lo valida con un schema de Pydantic."""
    data = request.get_json(silent=True)
    if data is None:
        raise ApiError(400, "Se esperaba un cuerpo JSON (Content-Type: application/json)")
    try:
        return schema.model_validate(data)
    except ValidationError as e:
        raise ApiError(
            422,
            [{"campo": ".".join(str(x) for x in err["loc"]), "mensaje": err["msg"]} for err in e.errors()],
        )

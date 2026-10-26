from flask import Blueprint, jsonify

from ..controllers import sync_controller
from ..dependencies import login_requerido

bp = Blueprint("sync", __name__, url_prefix="/sync")


@bp.post("")
@login_requerido
def sincronizar_ahora():
    return jsonify(sync_controller.forzar_sync())


@bp.get("/estado")
@login_requerido
def estado():
    return jsonify(sync_controller.estado_sync())

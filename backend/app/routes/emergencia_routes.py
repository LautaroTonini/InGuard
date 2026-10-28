from flask import Blueprint, jsonify

from ..controllers import emergencia_controller

bp = Blueprint("emergencia", __name__, url_prefix="/emergencia")  # SCRUM-39


@bp.get("/<paciente_id>")
def datos_importantes(paciente_id):
    """Sin login: lo usa un transeunte desde la pantalla de bloqueo."""
    return jsonify(emergencia_controller.datos_importantes(paciente_id))

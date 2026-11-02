from flask import Blueprint, g, jsonify

from ..controllers import paciente_controller
from ..dependencies import login_requerido
from ..schemas import PacienteUpdateIn
from ..validation import cuerpo

bp = Blueprint("pacientes", __name__, url_prefix="/pacientes")  # SCRUM-46


@bp.get("/<paciente_id>")
@login_requerido
def ver_paciente(paciente_id):
    return jsonify(paciente_controller.obtener_paciente(g.usuario, paciente_id))


@bp.put("/<paciente_id>")
@login_requerido
def editar_paciente(paciente_id):
    return jsonify(paciente_controller.editar_paciente(g.usuario, paciente_id, cuerpo(PacienteUpdateIn)))

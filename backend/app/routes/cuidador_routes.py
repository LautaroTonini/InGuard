from flask import Blueprint, g, jsonify

from ..controllers import paciente_controller
from ..dependencies import cuidador_requerido
from ..schemas import VincularIn
from ..validation import cuerpo

bp = Blueprint("cuidador", __name__, url_prefix="/cuidador")


@bp.post("/pacientes/vincular")
@cuidador_requerido
def vincular():
    """Agrega un id_paciente a la lista del cuidador (requiere el codigo del paciente)."""
    return jsonify(paciente_controller.vincular_paciente(g.usuario, cuerpo(VincularIn))), 201


@bp.get("/pacientes")
@cuidador_requerido
def mis_pacientes():
    return jsonify(paciente_controller.listar_pacientes(g.usuario))


@bp.delete("/pacientes/<paciente_id>")
@cuidador_requerido
def desvincular(paciente_id):
    paciente_controller.desvincular_paciente(g.usuario, paciente_id)
    return "", 204

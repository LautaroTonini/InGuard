from flask import Blueprint, g, jsonify, request

from ..controllers import medicamento_controller as ctrl
from ..dependencies import login_requerido
from ..schemas import MedicamentoIn, MedicamentoUpdateIn
from ..validation import cuerpo

bp = Blueprint("medicamentos", __name__)  # SCRUM-42


@bp.post("/pacientes/<paciente_id>/medicamentos")
@login_requerido
def crear(paciente_id):
    return jsonify(ctrl.crear(g.usuario, paciente_id, cuerpo(MedicamentoIn))), 201


@bp.get("/pacientes/<paciente_id>/medicamentos")
@login_requerido
def listar(paciente_id):
    solo_activos = request.args.get("solo_activos", "false").lower() == "true"
    return jsonify(ctrl.listar(g.usuario, paciente_id, solo_activos))


@bp.get("/medicamentos/<med_id>")
@login_requerido
def obtener(med_id):
    return jsonify(ctrl.obtener(g.usuario, med_id))


@bp.put("/medicamentos/<med_id>")
@login_requerido
def actualizar(med_id):
    return jsonify(ctrl.actualizar(g.usuario, med_id, cuerpo(MedicamentoUpdateIn)))


@bp.delete("/medicamentos/<med_id>")
@login_requerido
def eliminar(med_id):
    ctrl.eliminar(g.usuario, med_id)
    return "", 204

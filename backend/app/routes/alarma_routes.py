from flask import Blueprint, g, jsonify

from ..controllers import alarma_controller as ctrl
from ..dependencies import login_requerido
from ..schemas import AlarmaIn, AlarmaUpdateIn
from ..validation import cuerpo

bp = Blueprint("alarmas", __name__)  # SCRUM-43


@bp.post("/medicamentos/<medicamento_id>/alarmas")
@login_requerido
def crear(medicamento_id):
    return jsonify(ctrl.crear(g.usuario, medicamento_id, cuerpo(AlarmaIn))), 201


@bp.get("/pacientes/<paciente_id>/alarmas")
@login_requerido
def listar(paciente_id):
    return jsonify(ctrl.listar(g.usuario, paciente_id))


@bp.put("/alarmas/<alarma_id>")
@login_requerido
def actualizar(alarma_id):
    return jsonify(ctrl.actualizar(g.usuario, alarma_id, cuerpo(AlarmaUpdateIn)))


@bp.delete("/alarmas/<alarma_id>")
@login_requerido
def eliminar(alarma_id):
    ctrl.eliminar(g.usuario, alarma_id)
    return "", 204

from flask import Blueprint, g, jsonify

from ..controllers import contacto_controller as ctrl
from ..dependencies import login_requerido
from ..schemas import ContactoIn, ContactoUpdateIn
from ..validation import cuerpo

bp = Blueprint("contactos", __name__)  # SCRUM-52


@bp.post("/pacientes/<paciente_id>/contactos")
@login_requerido
def crear(paciente_id):
    return jsonify(ctrl.crear(g.usuario, paciente_id, cuerpo(ContactoIn))), 201


@bp.get("/pacientes/<paciente_id>/contactos")
@login_requerido
def listar(paciente_id):
    return jsonify(ctrl.listar(g.usuario, paciente_id))


@bp.put("/contactos/<contacto_id>")
@login_requerido
def actualizar(contacto_id):
    return jsonify(ctrl.actualizar(g.usuario, contacto_id, cuerpo(ContactoUpdateIn)))


@bp.delete("/contactos/<contacto_id>")
@login_requerido
def eliminar(contacto_id):
    ctrl.eliminar(g.usuario, contacto_id)
    return "", 204


@bp.get("/contactos/<contacto_id>/llamar")
@login_requerido
def llamar(contacto_id):
    return jsonify(ctrl.llamar(g.usuario, contacto_id))

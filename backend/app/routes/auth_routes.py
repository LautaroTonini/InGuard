from flask import Blueprint, g, jsonify

from ..controllers import auth_controller
from ..dependencies import login_requerido
from ..schemas import LoginIn, RegistroIn
from ..validation import cuerpo
from ..views import serializar_usuario

bp = Blueprint("auth", __name__, url_prefix="/auth")


@bp.post("/registro")
def registro():
    usuario = auth_controller.registrar(cuerpo(RegistroIn))
    return jsonify(serializar_usuario(usuario, incluir_codigo=True)), 201


@bp.post("/login")
def login():
    return jsonify(auth_controller.login(cuerpo(LoginIn)))


@bp.get("/me")
@login_requerido
def me():
    return jsonify(serializar_usuario(g.usuario, incluir_codigo=True))

from flask import Blueprint, g, jsonify

from ..controllers import app_controller
from ..dependencies import acceso_requerido, cuidador_requerido
from ..schemas import (
    ContactoWebIn,
    LoginIn,
    MedicamentoWebIn,
    PacienteWebIn,
    PacienteWebUpdateIn,
    PruebaIn,
    RecuperarIn,
    RegistroCuidadorIn,
    ResponderIn,
    RestablecerIn,
    SolicitudIn,
    TomaIn,
)
from ..validation import cuerpo

bp = Blueprint("web_app", __name__, url_prefix="/app")


@bp.post("/auth/registro")
def registrar():
    return jsonify(app_controller.registrar_cuidador(cuerpo(RegistroCuidadorIn))), 201


@bp.post("/auth/login")
def login():
    return jsonify(app_controller.login_web(cuerpo(LoginIn)))


@bp.post("/auth/recuperar")
def recuperar():
    data = cuerpo(RecuperarIn)
    return jsonify(app_controller.recuperar(data.email))


@bp.post("/auth/restablecer")
def restablecer():
    app_controller.restablecer(cuerpo(RestablecerIn))
    return "", 204


@bp.get("/snapshot")
@acceso_requerido
def snapshot():
    return jsonify(app_controller.snapshot(g.usuario, g.dispositivo))


@bp.post("/solicitudes")
def solicitar_acceso():
    return jsonify(app_controller.solicitar_acceso(cuerpo(SolicitudIn))), 201


@bp.post("/solicitudes/<solicitud_id>/respuesta")
@cuidador_requerido
def responder_solicitud(solicitud_id):
    data = cuerpo(ResponderIn)
    app_controller.responder_solicitud(g.usuario, solicitud_id, data.aceptar)
    return "", 204


@bp.delete("/solicitudes/<solicitud_id>")
@acceso_requerido
def eliminar_solicitud(solicitud_id):
    app_controller.eliminar_solicitud(g.usuario, g.dispositivo, solicitud_id)
    return "", 204


@bp.post("/pacientes")
@cuidador_requerido
def crear_paciente():
    return jsonify(app_controller.crear_paciente(g.usuario, cuerpo(PacienteWebIn))), 201


@bp.put("/pacientes/<paciente_id>")
@cuidador_requerido
def editar_paciente(paciente_id):
    return jsonify(app_controller.editar_paciente(g.usuario, paciente_id, cuerpo(PacienteWebUpdateIn)))


@bp.delete("/pacientes/<paciente_id>")
@cuidador_requerido
def eliminar_paciente(paciente_id):
    app_controller.eliminar_paciente(g.usuario, paciente_id)
    return "", 204


@bp.post("/pacientes/<paciente_id>/regenerar-codigo")
@cuidador_requerido
def regenerar_codigo(paciente_id):
    return jsonify(app_controller.regenerar_codigo(g.usuario, paciente_id))


@bp.post("/pacientes/<paciente_id>/medicamentos")
@cuidador_requerido
def agregar_medicamento(paciente_id):
    app_controller.agregar_medicamento(g.usuario, paciente_id, cuerpo(MedicamentoWebIn))
    return "", 201


@bp.delete("/pacientes/<paciente_id>/medicamentos/<medicamento_id>")
@cuidador_requerido
def quitar_medicamento(paciente_id, medicamento_id):
    app_controller.quitar_medicamento(g.usuario, paciente_id, medicamento_id)
    return "", 204


@bp.post("/pacientes/<paciente_id>/contactos")
@cuidador_requerido
def agregar_contacto(paciente_id):
    app_controller.agregar_contacto(g.usuario, paciente_id, cuerpo(ContactoWebIn))
    return "", 201


@bp.delete("/pacientes/<paciente_id>/contactos/<contacto_id>")
@cuidador_requerido
def quitar_contacto(paciente_id, contacto_id):
    app_controller.quitar_contacto(g.usuario, paciente_id, contacto_id)
    return "", 204


@bp.put("/pacientes/<paciente_id>/tomas")
@acceso_requerido
def marcar_toma(paciente_id):
    data = cuerpo(TomaIn)
    app_controller.marcar_toma(g.usuario, g.dispositivo, paciente_id, data.clave, data.tomada)
    return "", 204


@bp.post("/pacientes/<paciente_id>/pruebas")
@cuidador_requerido
def crear_prueba(paciente_id):
    app_controller.crear_prueba(g.usuario, paciente_id, cuerpo(PruebaIn))
    return "", 201


@bp.put("/pacientes/<paciente_id>/pruebas/<prueba_id>")
@acceso_requerido
def terminar_prueba(paciente_id, prueba_id):
    app_controller.terminar_prueba(g.usuario, g.dispositivo, paciente_id, prueba_id)
    return "", 204

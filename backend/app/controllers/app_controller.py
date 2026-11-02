"""
Contrato del cliente web/movil (frontend React): todo lo que la pantalla necesita en un solo
formato ("snapshot"), mas las acciones del cuidador y del dispositivo del paciente.

- Cuidador : token de usuario (rol cuidador). Gestiona sus pacientes.
- Dispositivo del paciente : token de una Solicitud de acceso. Solo ve su perfil (cuando el
  cuidador la acepto) y solo puede informar tomas / terminar alarmas de prueba.
"""
import secrets
import time
from datetime import timedelta

from pymongo.errors import DuplicateKeyError

from ..config import settings
from ..database import get_local_db
from ..errors import ApiError
from ..models.alarma import Alarma
from ..models.base import ahora
from ..models.contacto import ContactoEmergencia
from ..models.medicamento import Medicamento
from ..models.prueba import PruebaAlarma
from ..models.solicitud import Solicitud
from ..models.toma import Toma
from ..models.usuario import Usuario
from ..permisos import verificar_acceso_paciente
from ..security import crear_token, hash_password, verificar_password

ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sin 0/O/1/I para evitar confusiones
COLORES = ["blue", "violet", "orange"]
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


# ------------------------------------------------------------------ utilidades
def _crear(modelo, data: dict, doc_id: str | None = None) -> dict:
    try:
        return modelo.create(data, doc_id)
    except DuplicateKeyError:
        raise ApiError(409, "Ese id ya existe")


def _norm(codigo: str) -> str:
    return "".join(c for c in (codigo or "").upper() if c.isalnum())


def _generar_codigo() -> str:
    while True:
        r = "".join(secrets.choice(ALFABETO) for _ in range(6))
        codigo = f"{r[:3]}-{r[3:]}"
        if not Usuario.col().find_one({"codigo_vinculacion": codigo}):
            return codigo


def _paciente_por_codigo(codigo: str) -> dict | None:
    n = _norm(codigo)
    if not n:
        return None
    return Usuario.col().find_one(
        {"rol": "paciente", "eliminado": False, "codigo_vinculacion": {"$in": [n, f"{n[:3]}-{n[3:]}"]}}
    )


def _cuidador(usuario: dict | None) -> dict:
    if usuario is None or usuario["rol"] != "cuidador":
        raise ApiError(403, "Solo para cuidadores")
    return usuario


def _puede(usuario, dispositivo, paciente_id: str, solo_cuidador: bool = False) -> None:
    if dispositivo is not None:
        if solo_cuidador or dispositivo["estado"] != "accepted" or dispositivo["paciente_id"] != paciente_id:
            raise ApiError(403, "No tenes acceso a este paciente")
        return
    if solo_cuidador:
        _cuidador(usuario)
    verificar_acceso_paciente(usuario, paciente_id)


def _etiqueta_fecha(dt) -> str:
    return f"{dt.day} {MESES[dt.month - 1]} {dt.year}"


def _nombre_completo(u: dict) -> str:
    return " ".join(x for x in (u.get("nombre"), u.get("apellido")) if x).strip()


# ------------------------------------------------------------------ serializacion (formato del frontend)
def _dto_solicitud(s: dict) -> dict:
    return {
        "id": s["_id"],
        "patientId": s["paciente_id"],
        "deviceName": s.get("nombre_dispositivo") or "Dispositivo",
        "status": s["estado"],
        "createdAt": int(s["creado_en"].timestamp() * 1000),
    }


def _dto_paciente(p: dict, cuidador_id: str | None = None) -> dict:
    pid = p["_id"]
    ficha = p.get("ficha_medica") or {}
    meds = Medicamento.listar_por_paciente(pid)
    contactos = ContactoEmergencia.listar_por_paciente(pid)
    horas: dict[str, list[str]] = {}
    for a in Alarma.listar_por_paciente(pid):
        if a.get("activa", True):
            horas.setdefault(a["medicamento_id"], []).append(a["hora"])

    desde = ahora() - timedelta(hours=48)
    tomas = Toma.col().find({"paciente_id": pid, "eliminado": False, "tomada_en": {"$gte": desde}})
    ahora_ms = int(time.time() * 1000)
    pruebas = sorted(
        PruebaAlarma.col().find({"paciente_id": pid, "eliminado": False, "ts": {"$gte": ahora_ms - 600_000}}),
        key=lambda t: t["ts"],
    )
    modificados = [p["actualizado_en"]] + [x["actualizado_en"] for x in meds + contactos]

    return {
        "id": pid,
        "caregiverId": cuidador_id,
        "code": p.get("codigo_vinculacion", ""),
        "name": _nombre_completo(p),
        "age": ficha.get("edad") or "",
        "dni": ficha.get("dni") or p.get("dni") or "",
        "blood": ficha.get("grupo_sanguineo") or "",
        "height": ficha.get("altura") or "",
        "weight": ficha.get("peso") or "",
        "allergies": ficha.get("alergias") or [],
        "conditions": ficha.get("diagnosticos") or [],
        "contacts": [
            {"id": c["_id"], "name": c["nombre"], "relation": c.get("parentesco") or "", "phone": c["telefono"]}
            for c in contactos
        ],
        "medicines": [
            {
                "id": m["_id"],
                "name": m["nombre"],
                "dose": m["dosis"],
                "frequency": m.get("frecuencia_texto") or f"Cada {m['frecuencia_horas']} horas",
                "times": m.get("horarios") or sorted(horas.get(m["_id"], [])),
                "color": m.get("color") or COLORES[i % len(COLORES)],
            }
            for i, m in enumerate(m for m in meds if m.get("activo", True))
        ],
        "doses": {t["clave"]: t["tomada_en"].isoformat() for t in tomas},
        "tests": [{"id": t["_id"], "ts": t["ts"], "done": bool(t.get("hecha"))} for t in pruebas],
        "updated": _etiqueta_fecha(max(modificados)),
    }


# ------------------------------------------------------------------ cuenta del cuidador
def registrar_cuidador(data) -> dict:
    email = data.email.lower()
    if Usuario.buscar_por_email(email):
        raise ApiError(409, "Ya existe una cuenta con ese correo.")
    nombre, _, apellido = data.nombre.strip().partition(" ")
    user = _crear(Usuario, {
        "nombre": nombre, "apellido": apellido.strip(), "email": email,
        "password_hash": hash_password(data.password), "rol": "cuidador", "pacientes_ids": [],
    })
    if data.paciente_ejemplo:
        _paciente_de_ejemplo(user)
    return {"id": user["_id"], "token": crear_token(user["_id"], "cuidador")}


def login_web(data) -> dict:
    usuario = Usuario.buscar_por_email(data.email.lower())
    if not usuario or usuario["rol"] != "cuidador" or not verificar_password(data.password, usuario["password_hash"]):
        raise ApiError(401, "Correo o contraseña incorrectos.")
    return {"id": usuario["_id"], "token": crear_token(usuario["_id"], "cuidador")}


def _paciente_de_ejemplo(cuidador: dict) -> None:
    p = _alta_paciente(cuidador, name="Elena Martínez", age=74, dni="18.452.763", blood="O+",
                       height="1,62 m", weight="67 kg", allergies=["Penicilina"],
                       conditions=["Hipertensión arterial", "Diabetes tipo 2"])
    pid = p["_id"]
    for n, rel, tel in (("María Martínez", "Hija · Contacto principal", "+54 261 555-0142"),
                        ("Dr. Pablo Gómez", "Médico de cabecera", "+54 261 555-0188")):
        ContactoEmergencia.create({"paciente_id": pid, "nombre": n, "parentesco": rel, "telefono": tel, "es_principal": False})
    for i, (n, d, f, h) in enumerate((("Losartán", "50 mg", "Cada 24 horas", ["08:00"]),
                                      ("Metformina", "850 mg", "Cada 12 horas", ["08:00", "20:00"]),
                                      ("Aspirina", "100 mg", "Una vez al día", ["13:00"]))):
        _alta_medicamento(cuidador, pid, n, d, f, h, COLORES[i % 3])


def recuperar(email: str) -> dict:
    em = email.lower()
    if not Usuario.col().find_one({"email": em, "eliminado": False}):
        raise ApiError(404, "No encontramos una cuenta con ese correo.")
    codigo = str(secrets.randbelow(900_000) + 100_000)
    get_local_db()["resets"].replace_one(
        {"_id": em}, {"_id": em, "codigo": codigo, "exp": ahora() + timedelta(minutes=10)}, upsert=True
    )
    # En produccion: enviar por correo y poner RESET_DEMO=false (no se devuelve el codigo).
    return {"codigo": codigo} if settings.RESET_DEMO else {"enviado": True}


def restablecer(data) -> None:
    em = data.email.lower()
    col = get_local_db()["resets"]
    r = col.find_one({"_id": em})
    if not r or not secrets.compare_digest(r["codigo"], data.codigo.strip()):
        raise ApiError(400, "El codigo no es correcto.")
    if ahora() > r["exp"]:
        raise ApiError(400, "El codigo vencio. Pedi uno nuevo.")
    usuario = Usuario.col().find_one({"email": em, "eliminado": False})
    if not usuario:
        raise ApiError(404, "Cuenta inexistente.")
    Usuario.update(usuario["_id"], {"password_hash": hash_password(data.password)})
    col.delete_one({"_id": em})


# ------------------------------------------------------------------ snapshot
def snapshot(usuario, dispositivo) -> dict:
    if dispositivo is not None:
        pacientes = []
        if dispositivo["estado"] == "accepted":
            p = Usuario.get(dispositivo["paciente_id"])
            if p is None:
                raise ApiError(401, "El paciente ya no existe")
            pacientes = [_dto_paciente(p)]
        return {"users": [], "patients": pacientes, "requests": [_dto_solicitud(dispositivo)]}

    _cuidador(usuario)
    ids = usuario.get("pacientes_ids", [])
    pacientes = [_dto_paciente(p, usuario["_id"]) for p in (Usuario.get(i) for i in ids) if p]
    solicitudes = Solicitud.listar({"paciente_id": {"$in": ids}}) if ids else []
    return {
        "users": [{"id": usuario["_id"], "role": "caregiver", "name": _nombre_completo(usuario), "email": usuario["email"]}],
        "patients": pacientes,
        "requests": [_dto_solicitud(s) for s in solicitudes],
    }


# ------------------------------------------------------------------ pacientes
def _alta_paciente(cuidador: dict, doc_id=None, **d) -> dict:
    ficha = {
        "enfermedades": [], "alergias": d.get("allergies") or [], "diagnosticos": d.get("conditions") or [],
        "grupo_sanguineo": d.get("blood") or None, "obra_social": None, "numero_afiliado": None, "notas": None,
        "edad": d.get("age") or None, "dni": d.get("dni") or None, "altura": d.get("height") or None, "peso": d.get("weight") or None,
    }
    p = _crear(Usuario, {
        "nombre": d["name"].strip(), "apellido": "", "rol": "paciente",
        "codigo_vinculacion": _generar_codigo(), "ficha_medica": ficha, "creado_por": cuidador["_id"],
    }, doc_id)
    Usuario.vincular_paciente(cuidador["_id"], p["_id"])
    return p


def crear_paciente(usuario, data) -> dict:
    p = _alta_paciente(_cuidador(usuario), data.id, **data.model_dump())
    return _dto_paciente(p, usuario["_id"])


def editar_paciente(usuario, paciente_id: str, data) -> dict:
    _puede(usuario, None, paciente_id, solo_cuidador=True)
    campos = data.model_dump(exclude_unset=True)
    mapa = {"age": "edad", "dni": "dni", "blood": "grupo_sanguineo", "height": "altura", "weight": "peso",
            "allergies": "alergias", "conditions": "diagnosticos"}
    cambios = {f"ficha_medica.{mapa[k]}": v for k, v in campos.items() if k in mapa}
    if "name" in campos:
        cambios["nombre"], cambios["apellido"] = campos["name"].strip(), ""
    if cambios:
        Usuario.update(paciente_id, cambios)
    return _dto_paciente(Usuario.get(paciente_id), usuario["_id"])


def _borrar_datos(paciente_id: str) -> None:
    for m in Medicamento.listar_por_paciente(paciente_id):
        Medicamento.delete(m["_id"])
        Alarma.eliminar_por_medicamento(m["_id"])
    for c in ContactoEmergencia.listar_por_paciente(paciente_id):
        ContactoEmergencia.delete(c["_id"])
    for s in Solicitud.listar({"paciente_id": paciente_id}):
        Solicitud.delete(s["_id"])


def eliminar_paciente(usuario, paciente_id: str) -> None:
    """Lo desvincula del cuidador; si era un paciente sin cuenta y nadie mas lo cuida, se borran sus datos."""
    _puede(usuario, None, paciente_id, solo_cuidador=True)
    Usuario.desvincular_paciente(usuario["_id"], paciente_id)
    p = Usuario.get(paciente_id)
    quedan = Usuario.col().count_documents({"rol": "cuidador", "pacientes_ids": paciente_id, "eliminado": False})
    if p and not p.get("email") and not quedan:
        Usuario.delete(paciente_id)
        _borrar_datos(paciente_id)


def regenerar_codigo(usuario, paciente_id: str) -> dict:
    _puede(usuario, None, paciente_id, solo_cuidador=True)
    codigo = _generar_codigo()
    Usuario.update(paciente_id, {"codigo_vinculacion": codigo})
    return {"code": codigo}


# ------------------------------------------------------------------ medicamentos y contactos
def _alta_medicamento(usuario, paciente_id, nombre, dosis, frecuencia, horarios, color, doc_id=None) -> dict:
    horarios = sorted(set(horarios))
    med = _crear(Medicamento, {
        "paciente_id": paciente_id, "nombre": nombre.strip(), "dosis": dosis.strip(),
        "frecuencia_horas": max(1, round(24 / len(horarios))), "frecuencia_texto": (frecuencia or "").strip() or "Según indicación",
        "horarios": horarios, "color": color, "indicaciones": None, "activo": True, "creado_por": usuario["_id"],
    }, doc_id)
    for h in horarios:  # mantiene coherente la API de alarmas del Sprint 1
        Alarma.create({"paciente_id": paciente_id, "medicamento_id": med["_id"], "hora": h,
                       "dias_semana": list(range(7)), "activa": True, "mensaje": None, "creado_por": usuario["_id"]})
    return med


def agregar_medicamento(usuario, paciente_id: str, d) -> None:
    _puede(usuario, None, paciente_id, solo_cuidador=True)
    _alta_medicamento(usuario, paciente_id, d.name, d.dose, d.frequency, d.times, d.color, d.id)


def quitar_medicamento(usuario, paciente_id: str, med_id: str) -> None:
    _puede(usuario, None, paciente_id, solo_cuidador=True)
    med = Medicamento.get(med_id)
    if not med or med["paciente_id"] != paciente_id:
        raise ApiError(404, "Medicamento no encontrado")
    Medicamento.delete(med_id)
    Alarma.eliminar_por_medicamento(med_id)


def agregar_contacto(usuario, paciente_id: str, d) -> None:
    _puede(usuario, None, paciente_id, solo_cuidador=True)
    _crear(ContactoEmergencia, {"paciente_id": paciente_id, "nombre": d.name.strip(),
                                "parentesco": (d.relation or "").strip() or "Contacto",
                                "telefono": d.phone.strip(), "es_principal": False}, d.id)


def quitar_contacto(usuario, paciente_id: str, contacto_id: str) -> None:
    _puede(usuario, None, paciente_id, solo_cuidador=True)
    c = ContactoEmergencia.get(contacto_id)
    if not c or c["paciente_id"] != paciente_id:
        raise ApiError(404, "Contacto no encontrado")
    ContactoEmergencia.delete(contacto_id)


# ------------------------------------------------------------------ tomas y alarmas de prueba
def marcar_toma(usuario, dispositivo, paciente_id: str, clave: str, tomada: bool) -> None:
    _puede(usuario, dispositivo, paciente_id)
    existente = Toma.col().find_one({"paciente_id": paciente_id, "clave": clave})
    ts = ahora()
    if tomada:
        if existente:
            Toma.col().update_one({"_id": existente["_id"]}, {"$set": {
                "eliminado": False, "tomada_en": ts, "actualizado_en": ts, "sync_pendiente": True}})
        else:
            try:
                Toma.create({"paciente_id": paciente_id, "clave": clave, "tomada_en": ts})
            except DuplicateKeyError:
                pass  # otro dispositivo la marco al mismo tiempo
    elif existente and not existente["eliminado"]:
        Toma.col().update_one({"_id": existente["_id"]}, {"$set": {
            "eliminado": True, "actualizado_en": ts, "sync_pendiente": True}})


def crear_prueba(usuario, paciente_id: str, d) -> None:
    _puede(usuario, None, paciente_id, solo_cuidador=True)
    _crear(PruebaAlarma, {"paciente_id": paciente_id, "ts": d.ts or int(time.time() * 1000), "hecha": False}, d.id)


def terminar_prueba(usuario, dispositivo, paciente_id: str, prueba_id: str) -> None:
    _puede(usuario, dispositivo, paciente_id)
    t = PruebaAlarma.get(prueba_id)
    if not t or t["paciente_id"] != paciente_id:
        raise ApiError(404, "Prueba no encontrada")
    PruebaAlarma.update(prueba_id, {"hecha": True})


# ------------------------------------------------------------------ acceso del paciente por codigo
def solicitar_acceso(data) -> dict:
    p = _paciente_por_codigo(data.codigo)
    if not p:
        raise ApiError(404, "Ese codigo no existe. Revisalo con tu cuidador.")
    sol = _crear(Solicitud, {"paciente_id": p["_id"], "nombre_dispositivo": (data.nombre or "").strip() or "Dispositivo",
                             "estado": "pending"})
    return {"id": sol["_id"], "token": crear_token(sol["_id"], "dispositivo")}


def _solicitud_del_cuidador(usuario, solicitud_id: str) -> dict:
    sol = Solicitud.get(solicitud_id)
    if not sol:
        raise ApiError(404, "Solicitud no encontrada")
    _puede(usuario, None, sol["paciente_id"], solo_cuidador=True)
    return sol


def responder_solicitud(usuario, solicitud_id: str, aceptar: bool) -> None:
    _solicitud_del_cuidador(usuario, solicitud_id)
    Solicitud.update(solicitud_id, {"estado": "accepted" if aceptar else "rejected"})


def eliminar_solicitud(usuario, dispositivo, solicitud_id: str) -> None:
    """Desvincular: lo hace el cuidador, o el propio dispositivo al cancelar su pedido."""
    if dispositivo is not None:
        if dispositivo["_id"] != solicitud_id:
            raise ApiError(403, "No podes modificar otra solicitud")
    else:
        _solicitud_del_cuidador(usuario, solicitud_id)
    Solicitud.delete(solicitud_id)

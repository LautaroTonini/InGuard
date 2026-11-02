from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

HORA_REGEX = r"^([01]\d|2[0-3]):[0-5]\d$"
TEL_REGEX = r"^\+?[\d\s\-()]{6,20}$"


# ---------- Auth ----------
class RegistroIn(BaseModel):
    nombre: str = Field(min_length=1)
    apellido: str = Field(min_length=1)
    dni: str = Field(pattern=r"^\d{7,9}$")
    email: EmailStr
    telefono: str = Field(pattern=TEL_REGEX)
    password: str = Field(min_length=6)
    rol: Literal["cuidador", "paciente"]


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class VincularIn(BaseModel):
    paciente_id: str
    codigo_vinculacion: str


# ---------- Paciente (SCRUM-46) ----------
class FichaMedicaIn(BaseModel):
    enfermedades: Optional[list[str]] = None
    alergias: Optional[list[str]] = None
    diagnosticos: Optional[list[str]] = None
    grupo_sanguineo: Optional[str] = None
    obra_social: Optional[str] = None
    numero_afiliado: Optional[str] = None
    notas: Optional[str] = None
    edad: Optional[int | str] = None
    dni: Optional[str] = None
    altura: Optional[str] = None
    peso: Optional[str] = None


class PacienteUpdateIn(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    telefono: Optional[str] = Field(default=None, pattern=TEL_REGEX)
    ficha_medica: Optional[FichaMedicaIn] = None


# ---------- Medicamentos (SCRUM-42) ----------
class MedicamentoIn(BaseModel):
    nombre: str = Field(min_length=1)
    dosis: str = Field(min_length=1)  # ej: "500 mg", "1 comprimido"
    frecuencia_horas: int = Field(gt=0, le=168)  # cada cuantas horas
    indicaciones: Optional[str] = None
    activo: bool = True


class MedicamentoUpdateIn(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1)
    dosis: Optional[str] = Field(default=None, min_length=1)
    frecuencia_horas: Optional[int] = Field(default=None, gt=0, le=168)
    indicaciones: Optional[str] = None
    activo: Optional[bool] = None


# ---------- Alarmas (SCRUM-43) ----------
def _validar_dias(v):
    if v is not None and (not v or any(d < 0 or d > 6 for d in v)):
        raise ValueError("dias_semana debe tener valores entre 0 (lunes) y 6 (domingo)")
    return v


class AlarmaIn(BaseModel):
    hora: str = Field(pattern=HORA_REGEX)  # "HH:MM"
    dias_semana: list[int] = Field(default_factory=lambda: list(range(7)))
    activa: bool = True
    mensaje: Optional[str] = None

    @field_validator("dias_semana")
    @classmethod
    def validar_dias(cls, v):
        return _validar_dias(v)


class AlarmaUpdateIn(BaseModel):
    hora: Optional[str] = Field(default=None, pattern=HORA_REGEX)
    dias_semana: Optional[list[int]] = None
    activa: Optional[bool] = None
    mensaje: Optional[str] = None

    @field_validator("dias_semana")
    @classmethod
    def validar_dias(cls, v):
        return _validar_dias(v)


# ---------- Contactos de emergencia (SCRUM-52) ----------
class ContactoIn(BaseModel):
    nombre: str = Field(min_length=1)
    parentesco: Optional[str] = None
    telefono: str = Field(pattern=TEL_REGEX)
    es_principal: bool = False


class ContactoUpdateIn(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1)
    parentesco: Optional[str] = None
    telefono: Optional[str] = Field(default=None, pattern=TEL_REGEX)
    es_principal: Optional[bool] = None


# ---------- Cliente web (frontend React): contrato de /app/* ----------
# Los nombres de campo (name, dose, times...) son los que usa el frontend.
class RegistroCuidadorIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6)
    paciente_ejemplo: bool = True


class RecuperarIn(BaseModel):
    email: EmailStr


class RestablecerIn(BaseModel):
    email: EmailStr
    codigo: str
    password: str = Field(min_length=6)


class SolicitudIn(BaseModel):
    codigo: str = Field(min_length=1, max_length=20)
    nombre: Optional[str] = Field(default=None, max_length=60)


class ResponderIn(BaseModel):
    aceptar: bool


class PacienteWebIn(BaseModel):
    id: Optional[str] = Field(default=None, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    age: Optional[int | str] = None
    dni: Optional[str] = None
    blood: Optional[str] = None
    height: Optional[str] = None
    weight: Optional[str] = None
    allergies: list[str] = Field(default_factory=list)
    conditions: list[str] = Field(default_factory=list)


class PacienteWebUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    age: Optional[int | str] = None
    dni: Optional[str] = None
    blood: Optional[str] = None
    height: Optional[str] = None
    weight: Optional[str] = None
    allergies: Optional[list[str]] = None
    conditions: Optional[list[str]] = None


class MedicamentoWebIn(BaseModel):
    id: Optional[str] = Field(default=None, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    dose: str = Field(min_length=1, max_length=60)
    frequency: Optional[str] = Field(default=None, max_length=80)
    times: list[str] = Field(min_length=1, max_length=24)
    color: str = "blue"

    @field_validator("times")
    @classmethod
    def validar_horarios(cls, v):
        import re

        if any(not re.match(HORA_REGEX, t) for t in v):
            raise ValueError("Los horarios deben tener formato HH:MM")
        return v


class ContactoWebIn(BaseModel):
    id: Optional[str] = Field(default=None, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    relation: Optional[str] = Field(default=None, max_length=80)
    phone: str = Field(min_length=1, max_length=30)


class TomaIn(BaseModel):
    clave: str = Field(min_length=1, max_length=120)
    tomada: bool


class PruebaIn(BaseModel):
    id: Optional[str] = Field(default=None, max_length=64)
    ts: Optional[int] = None

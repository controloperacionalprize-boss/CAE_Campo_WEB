from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

_PREFIJO_MSG = "El prefijo debe tener 1 a 10 letras o números, sin espacios ni símbolos"


def _prefijo_ok(v: str) -> str:
    cleaned = v.strip().upper()
    if not cleaned or not cleaned.isalnum() or len(cleaned) > 10:
        raise ValueError(_PREFIJO_MSG)
    return cleaned


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Paginated(BaseModel):
    items: list[Any]
    total: int
    skip: int
    limit: int


class ActividadEconomicaOut(ORMModel):
    codigo: str
    descripcion: str
    created_at: datetime
    updated_at: datetime


class ActividadEconomicaIn(BaseModel):
    codigo: str = Field(min_length=1, max_length=10)
    descripcion: str = Field(min_length=1, max_length=500)


class ActividadEconomicaPatch(BaseModel):
    descripcion: str | None = Field(default=None, min_length=1, max_length=500)


class AreaOut(ORMModel):
    id: int
    prefijo: str
    nombre: str
    activo: bool
    created_at: datetime
    updated_at: datetime


class AreaIn(BaseModel):
    prefijo: str = Field(min_length=1, max_length=10)
    nombre: str = Field(min_length=1, max_length=200)
    activo: bool = True

    @field_validator("prefijo", mode="before")
    @classmethod
    def prefijo_mayusculas(cls, v: object) -> str:
        if not isinstance(v, str):
            raise ValueError(_PREFIJO_MSG)
        return _prefijo_ok(v)


class AreaPatch(BaseModel):
    prefijo: str | None = Field(default=None, min_length=1, max_length=10)
    nombre: str | None = Field(default=None, min_length=1, max_length=200)
    activo: bool | None = None

    @field_validator("prefijo", mode="before")
    @classmethod
    def prefijo_mayusculas(cls, v: object) -> str | None:
        if v is None:
            return None
        if not isinstance(v, str):
            raise ValueError(_PREFIJO_MSG)
        return _prefijo_ok(v)


class CargoOut(ORMModel):
    id: int
    nombre: str
    activo: bool
    created_at: datetime
    updated_at: datetime


class CargoIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    activo: bool = True


class CargoPatch(BaseModel):
    nombre: str | None = Field(default=None, max_length=120)
    activo: bool | None = None


class RolOut(CargoOut):
    pass


class RolIn(CargoIn):
    nombre: str = Field(max_length=80)


class RolPatch(CargoPatch):
    nombre: str | None = Field(default=None, max_length=80)


class ProveedorOut(CargoOut):
    pass


class ProveedorIn(CargoIn):
    pass


class ProveedorPatch(CargoPatch):
    pass


class ChoferOut(ORMModel):
    id: int
    dni: str
    nombre: str
    activo: bool
    created_at: datetime
    updated_at: datetime


class ChoferIn(BaseModel):
    dni: str = Field(min_length=8, max_length=15, pattern=r"^[0-9A-Za-z\-]+$")
    nombre: str = Field(min_length=1, max_length=200)
    activo: bool = True


class ChoferPatch(BaseModel):
    dni: str | None = Field(default=None, min_length=8, max_length=15, pattern=r"^[0-9A-Za-z\-]+$")
    nombre: str | None = Field(default=None, min_length=1, max_length=200)
    activo: bool | None = None


class EmpresaOut(ORMModel):
    id: int
    ruc: str
    razon_social: str
    domicilio_fiscal: str | None
    actividad_economica_codigo: str | None
    activo: bool
    created_at: datetime
    updated_at: datetime


class EmpresaIn(BaseModel):
    ruc: str = Field(min_length=11, max_length=11, pattern=r"^\d{11}$")
    razon_social: str = Field(min_length=1, max_length=200)
    domicilio_fiscal: str | None = Field(default=None, max_length=500)
    actividad_economica_codigo: str | None = Field(default=None, max_length=10)
    activo: bool = True


class EmpresaPatch(BaseModel):
    ruc: str | None = Field(default=None, min_length=11, max_length=11)
    razon_social: str | None = Field(default=None, max_length=200)
    domicilio_fiscal: str | None = None
    actividad_economica_codigo: str | None = None
    activo: bool | None = None


class FundoOut(ORMModel):
    id: int
    empresa_id: int
    nombre: str
    domicilio: str | None
    activo: bool
    created_at: datetime
    updated_at: datetime


class FundoIn(BaseModel):
    empresa_id: int
    nombre: str = Field(max_length=120)
    domicilio: str | None = None
    activo: bool = True


class FundoPatch(BaseModel):
    empresa_id: int | None = None
    nombre: str | None = Field(default=None, max_length=120)
    domicilio: str | None = None
    activo: bool | None = None


class ModuloOut(ORMModel):
    id: int
    fundo_id: int
    codigo: str
    nombre: str | None
    activo: bool
    created_at: datetime
    updated_at: datetime


class ModuloIn(BaseModel):
    fundo_id: int
    codigo: str = Field(max_length=20)
    nombre: str | None = Field(default=None, max_length=80)
    activo: bool = True


class ModuloPatch(BaseModel):
    fundo_id: int | None = None
    codigo: str | None = Field(default=None, max_length=20)
    nombre: str | None = Field(default=None, max_length=80)
    activo: bool | None = None


class TurnoOut(ORMModel):
    id: int
    modulo_id: int
    codigo: str
    nombre: str | None
    activo: bool
    created_at: datetime
    updated_at: datetime


class TurnoIn(BaseModel):
    modulo_id: int
    codigo: str = Field(max_length=20)
    nombre: str | None = Field(default=None, max_length=80)
    activo: bool = True


class TurnoPatch(BaseModel):
    modulo_id: int | None = None
    codigo: str | None = Field(default=None, max_length=20)
    nombre: str | None = Field(default=None, max_length=80)
    activo: bool | None = None


class LoteOut(ORMModel):
    id: int
    turno_id: int
    codigo: str
    area_ha: Decimal
    activo: bool
    created_at: datetime
    updated_at: datetime


class LoteIn(BaseModel):
    turno_id: int
    codigo: str = Field(max_length=30)
    area_ha: Decimal
    activo: bool = True


class LotePatch(BaseModel):
    turno_id: int | None = None
    codigo: str | None = Field(default=None, max_length=30)
    area_ha: Decimal | None = None
    activo: bool | None = None


class GrupoOut(ORMModel):
    id: int
    nombre: str
    empresa_id: int | None
    fundo_id: int | None
    activo: bool
    created_at: datetime
    updated_at: datetime


class GrupoIn(BaseModel):
    nombre: str = Field(max_length=80)
    empresa_id: int | None = None
    fundo_id: int | None = None
    activo: bool = True


class GrupoPatch(BaseModel):
    nombre: str | None = Field(default=None, max_length=80)
    empresa_id: int | None = None
    fundo_id: int | None = None
    activo: bool | None = None


class UsuarioOut(ORMModel):
    id: int
    dni: str
    nombre: str
    cargo_id: int | None
    rol_id: int | None
    grupo_id: int | None
    area_id: int | None
    activo: bool
    created_at: datetime
    updated_at: datetime


class UsuarioIn(BaseModel):
    dni: str = Field(min_length=8, max_length=15, pattern=r"^[0-9A-Za-z\-]+$")
    nombre: str = Field(min_length=1, max_length=200)
    cargo_id: int | None = None
    rol_id: int | None = None
    grupo_id: int | None = None
    area_id: int | None = None
    activo: bool = True


class UsuarioPatch(BaseModel):
    dni: str | None = Field(default=None, min_length=8, max_length=15, pattern=r"^[0-9A-Za-z\-]+$")
    nombre: str | None = Field(default=None, min_length=1, max_length=200)
    cargo_id: int | None = None
    rol_id: int | None = None
    grupo_id: int | None = None
    area_id: int | None = None
    activo: bool | None = None


class VehiculoOut(ORMModel):
    id: int
    placa: str
    proveedor_id: int
    chofer_id: int | None
    activo: bool
    created_at: datetime
    updated_at: datetime


class VehiculoIn(BaseModel):
    placa: str = Field(max_length=15)
    proveedor_id: int
    chofer_id: int | None = None
    activo: bool = True


class VehiculoPatch(BaseModel):
    placa: str | None = Field(default=None, max_length=15)
    proveedor_id: int | None = None
    chofer_id: int | None = None
    activo: bool | None = None


class TurnoNodo(ORMModel):
    id: int
    codigo: str
    nombre: str | None
    activo: bool


class ModuloNodo(ORMModel):
    id: int
    codigo: str
    nombre: str | None
    activo: bool
    turnos: list[TurnoNodo]


class FundoNodo(ORMModel):
    id: int
    nombre: str
    domicilio: str | None
    activo: bool
    modulos: list[ModuloNodo]


class EmpresaNodo(ORMModel):
    id: int
    ruc: str
    razon_social: str
    activo: bool
    fundos: list[FundoNodo]


_HORA_MSG = "La hora de envío debe tener el formato HH:MM"


def _hora_hhmm(v: object) -> time:
    if isinstance(v, time):
        return v.replace(second=0, microsecond=0)
    if isinstance(v, datetime):
        return v.time().replace(second=0, microsecond=0)
    if isinstance(v, str):
        cleaned = v.strip()
        for fmt in ("%H:%M", "%H:%M:%S"):
            try:
                return datetime.strptime(cleaned, fmt).time().replace(second=0, microsecond=0)
            except ValueError:
                continue
    raise ValueError(_HORA_MSG)


ESTADOS_GUIA = ("registrado", "anulado")


class GuiaIngresoOut(ORMModel):
    id: int
    codigo: str
    fecha: date
    hora_envio: time
    usuario_id: int
    usuario_dni: str
    usuario_nombre: str
    grupo_id: int | None
    grupo: str
    fundo_id: int | None
    fundo: str
    modulo_id: int
    modulo: str
    turno_id: int
    turno: str
    lote_id: int
    lote: str
    tipo_producto: str
    tipo_llenado: Decimal
    envase_principal: str
    jabas_completas: int
    jabas_incompletas: int
    jarras_jabas: int
    jarras_extras: int
    jabas_totales: int
    jarras_totales: int
    ha: Decimal
    observacion: str
    vehiculo_id: int
    placa: str
    estado: str
    created_at: datetime
    updated_at: datetime

    @field_serializer("hora_envio")
    def _hora(self, v: time) -> str:
        return v.strftime("%H:%M")

    @field_serializer("fecha")
    def _fecha(self, v: date) -> str:
        return v.isoformat()


class GuiaIngresoIn(BaseModel):
    """POST del móvil. El operador entra con DNI y elige grupo/fundo en la app.
    codigo, ubicación, placa y conteos vienen del cliente; nombre y ha se completan aquí.
    """

    model_config = ConfigDict(extra="ignore")

    codigo: str = Field(min_length=1, max_length=24)
    usuario_id: int | None = None
    usuario_dni: str | None = Field(default=None, min_length=8, max_length=15)
    fundo_id: int | None = None
    fecha: date | None = None
    hora_envio: time | None = None
    grupo_id: int | None = None
    grupo: str | None = Field(default=None, max_length=80)
    fundo_id: int | None = None
    fundo: str | None = Field(default=None, max_length=120)
    modulo: str = Field(min_length=1, max_length=20)
    turno: str = Field(min_length=1, max_length=20)
    lote: str = Field(min_length=1, max_length=30)
    tipo_producto: str = Field(min_length=1, max_length=80)
    tipo_llenado: Decimal
    envase_principal: str = Field(min_length=1, max_length=80)
    jabas_completas: int = Field(default=0, ge=0)
    jabas_incompletas: int = Field(default=0, ge=0)
    jarras_jabas: int = Field(default=0, ge=0)
    jarras_extras: int = Field(default=0, ge=0)
    observacion: str = Field(default="", max_length=2000)
    placa: str = Field(min_length=1, max_length=15)

    @field_validator("hora_envio", mode="before")
    @classmethod
    def parse_hora(cls, v: object) -> time | None:
        if v is None or v == "":
            return None
        return _hora_hhmm(v)

    @field_validator(
        "modulo",
        "turno",
        "lote",
        "placa",
        "tipo_producto",
        "envase_principal",
        "observacion",
        "usuario_dni",
        "grupo",
        "fundo",
        mode="before",
    )
    @classmethod
    def strip_text(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("grupo", "fundo")
    @classmethod
    def vacio_none(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        return v.strip()

    @field_validator("codigo", mode="before")
    @classmethod
    def codigo_norm(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().upper()
        return v

    @field_validator("modulo", "turno", "lote", "placa", "tipo_producto", "envase_principal")
    @classmethod
    def mayusculas(cls, v: str) -> str:
        return v.upper()


class GuiaIngresoPatch(BaseModel):
    tipo_producto: str | None = Field(default=None, min_length=1, max_length=80)
    tipo_llenado: Decimal | None = None
    envase_principal: str | None = Field(default=None, min_length=1, max_length=80)
    jabas_completas: int | None = Field(default=None, ge=0)
    jabas_incompletas: int | None = Field(default=None, ge=0)
    jarras_jabas: int | None = Field(default=None, ge=0)
    jarras_extras: int | None = Field(default=None, ge=0)
    observacion: str | None = Field(default=None, max_length=2000)
    estado: str | None = None
    vehiculo_id: int | None = None

    @field_validator("tipo_producto", "envase_principal", "observacion", mode="before")
    @classmethod
    def strip_text(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("estado", mode="before")
    @classmethod
    def estado_ok(cls, v: object) -> str | None:
        if v is None:
            return None
        if not isinstance(v, str):
            raise ValueError("El estado debe ser registrado o anulado")
        cleaned = v.strip().lower()
        if cleaned not in ESTADOS_GUIA:
            raise ValueError("El estado debe ser registrado o anulado")
        return cleaned


class GuiaContextoOut(BaseModel):
    usuario_id: int
    usuario_dni: str
    usuario_nombre: str
    grupo_id: int | None
    grupo: str
    fundo_id: int | None
    fundo: str
    modulo: str | None = None
    turno: str | None = None
    lote: str | None = None
    ha: Decimal | None = None
    placa: str | None = None
    vehiculo_id: int | None = None
    lote_id: int | None = None


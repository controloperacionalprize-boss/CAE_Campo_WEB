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
    recepcionado_acopio: bool = False
    recepcionado_acopio_at: datetime | None = None
    recepcionado_planta: bool = False
    recepcionado_planta_at: datetime | None = None
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
    grupo_id: int | None = None
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


TIPOS_VIAJE = ("directo", "agrupado")
ESTADOS_VIAJE = ("en_proceso", "finalizado", "recepcionado", "anulado")


def _tipo_viaje_ok(v: object) -> str:
    if not isinstance(v, str):
        raise ValueError("El tipo de viaje debe ser directo o agrupado")
    cleaned = v.strip().lower()
    if cleaned not in TIPOS_VIAJE:
        raise ValueError("El tipo de viaje debe ser directo o agrupado")
    return cleaned


def _estado_viaje_ok(v: object) -> str:
    if not isinstance(v, str):
        raise ValueError("El estado del viaje debe ser en_proceso, finalizado, recepcionado o anulado")
    cleaned = v.strip().lower()
    if cleaned not in ESTADOS_VIAJE:
        raise ValueError("El estado del viaje debe ser en_proceso, finalizado, recepcionado o anulado")
    return cleaned


class ViajeOut(ORMModel):
    id: int
    codigo: str
    tipo_viaje: str
    conductor_id: int | None
    conductor_nombre: str
    vehiculo_id: int | None
    placa: str
    kia_origen: str
    kia_destino: str
    observacion: str
    estado: str
    usuario_id: int | None
    fecha: date
    created_at: datetime
    updated_at: datetime

    @field_serializer("fecha")
    def _fecha(self, v: date) -> str:
        return v.isoformat()


class ViajeIn(BaseModel):
    tipo_viaje: str
    conductor_id: int | None = None
    vehiculo_id: int | None = None
    placa: str = Field(default="", max_length=15)
    kia_origen: str = Field(min_length=1, max_length=80)
    kia_destino: str = Field(min_length=1, max_length=80)
    observacion: str = Field(default="", max_length=4000)
    usuario_id: int

    @field_validator("tipo_viaje", mode="before")
    @classmethod
    def tipo_ok(cls, v: object) -> str:
        return _tipo_viaje_ok(v)

    @field_validator("placa", "kia_origen", "kia_destino", "observacion", mode="before")
    @classmethod
    def strip_text(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("placa")
    @classmethod
    def placa_mayus(cls, v: str) -> str:
        return v.upper()


class ViajePatch(BaseModel):
    estado: str

    @field_validator("estado", mode="before")
    @classmethod
    def estado_ok(cls, v: object) -> str:
        return _estado_viaje_ok(v)


class ViajeDetalleOut(ORMModel):
    id: int
    viaje_id: int
    guia_ingreso_id: int
    modulo: str
    turno: str
    lote: str
    jabas_completas: int
    jabas_incompletas: int
    jarras: int
    created_at: datetime


class ViajeDetalleIn(BaseModel):
    guia_ingreso_ids: list[int] = Field(min_length=1)

    @field_validator("guia_ingreso_ids")
    @classmethod
    def ids_positivos(cls, v: list[int]) -> list[int]:
        if any(i < 1 for i in v):
            raise ValueError("Cada guía de ingreso debe ser un identificador positivo")
        return v


class ViajeDetalleListOut(BaseModel):
    items: list[ViajeDetalleOut]
    total_jarras: int
    total_jabas: int
    total_qrs: int


class CroquisContinuacionIn(BaseModel):
    modulo: str = Field(min_length=1, max_length=20)
    turno: str = Field(min_length=1, max_length=20)
    variedad: str = Field(default="", max_length=80)
    jarras: int = Field(default=0, ge=0)
    jabas: int = Field(default=0, ge=0)

    @field_validator("modulo", "turno", "variedad", mode="before")
    @classmethod
    def strip_text(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("modulo", "turno", "variedad")
    @classmethod
    def mayusculas(cls, v: str) -> str:
        return v.upper()


class CroquisPalletIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=30)
    orden: int = Field(default=0, ge=0)
    modulo: str = Field(min_length=1, max_length=20)
    turno: str = Field(min_length=1, max_length=20)
    variedad: str = Field(default="", max_length=80)
    jarras: int = Field(default=0, ge=0)
    jabas: int = Field(default=0, ge=0)
    continuaciones: list[CroquisContinuacionIn] = Field(default_factory=list)

    @field_validator("nombre", "modulo", "turno", "variedad", mode="before")
    @classmethod
    def strip_text(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("nombre", "modulo", "turno", "variedad")
    @classmethod
    def mayusculas(cls, v: str) -> str:
        return v.upper()


class CroquisIn(BaseModel):
    fecha: date
    placa: str = Field(min_length=1, max_length=15)
    punto_partida: str = Field(min_length=1, max_length=120)
    punto_llegada: str = Field(min_length=1, max_length=120)
    motivo_traslado: str = Field(default="Traslado de fruta", max_length=200)
    hora_salida: time
    temperatura: Decimal | None = None
    pallets: list[CroquisPalletIn] = Field(min_length=1)

    @field_validator("hora_salida", mode="before")
    @classmethod
    def parse_hora(cls, v: object) -> time:
        return _hora_hhmm(v)

    @field_validator("placa", "punto_partida", "punto_llegada", "motivo_traslado", mode="before")
    @classmethod
    def strip_text(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("placa")
    @classmethod
    def placa_mayus(cls, v: str) -> str:
        return v.upper()


class CroquisLineaOut(ORMModel):
    id: int
    croquis_id: int
    nombre: str
    orden: int
    modulo: str
    turno: str
    variedad: str
    jarras: int
    jabas: int
    es_continuacion: bool
    pallet_padre_id: int | None
    created_at: datetime


class CroquisPalletOut(CroquisLineaOut):
    continuaciones: list[CroquisLineaOut] = Field(default_factory=list)


class CroquisOut(ORMModel):
    id: int
    viaje_id: int
    fecha: date
    placa: str
    punto_partida: str
    punto_llegada: str
    motivo_traslado: str
    hora_salida: time
    total_jarras: int
    total_jabas: int
    total_pallets: int
    temperatura: Decimal | None
    created_at: datetime
    updated_at: datetime
    pallets: list[CroquisPalletOut] = Field(default_factory=list)

    @field_serializer("fecha")
    def _fecha(self, v: date) -> str:
        return v.isoformat()

    @field_serializer("hora_salida")
    def _hora(self, v: time) -> str:
        return v.strftime("%H:%M")

    @field_serializer("temperatura")
    def _temp(self, v: Decimal | None) -> float | None:
        return float(v) if v is not None else None


class GrrDetalleOut(ORMModel):
    id: int
    grr_id: int
    pallet: str
    modulo: str
    turno: str
    variedad: str
    jarras: int
    jabas: int
    orden: int
    created_at: datetime


class GrrOut(ORMModel):
    id: int
    viaje_id: int
    numero: str
    fecha_emision: date
    remitente: str
    destinatario: str
    motivo_traslado: str
    placa: str
    punto_partida: str
    punto_llegada: str
    total_jarras: int
    total_jabas: int
    estado: str
    recepcionado: bool = False
    recepcionado_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    detalle_carga: list[GrrDetalleOut] = Field(default_factory=list)

    @field_serializer("fecha_emision")
    def _fecha(self, v: date) -> str:
        return v.isoformat()


class ViajeCompletoOut(ViajeOut):
    detalle: list[ViajeDetalleOut] = Field(default_factory=list)
    croquis: CroquisOut | None = None
    grr: GrrOut | None = None

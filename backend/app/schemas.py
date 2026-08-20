from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


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
    activo: bool
    created_at: datetime
    updated_at: datetime


class UsuarioIn(BaseModel):
    dni: str = Field(min_length=8, max_length=15, pattern=r"^[0-9A-Za-z\-]+$")
    nombre: str = Field(min_length=1, max_length=200)
    cargo_id: int | None = None
    rol_id: int | None = None
    grupo_id: int | None = None
    activo: bool = True


class UsuarioPatch(BaseModel):
    dni: str | None = Field(default=None, min_length=8, max_length=15, pattern=r"^[0-9A-Za-z\-]+$")
    nombre: str | None = Field(default=None, min_length=1, max_length=200)
    cargo_id: int | None = None
    rol_id: int | None = None
    grupo_id: int | None = None
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

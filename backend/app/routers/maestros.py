from typing import Annotated

from fastapi import APIRouter, Query

from .. import schemas as S
from ..crud import get_row, insert_row, list_rows, soft_delete, update_row
from ..db import get_conn

SearchQ = Annotated[str | None, Query(max_length=80)]

router = APIRouter(prefix="/api/v1", tags=["maestros"])


def _page(rows, total, skip, limit):
    return {"items": rows, "total": total, "skip": skip, "limit": limit}


def _list(table: str, *, order: str, skip: int, limit: int, q: str | None, filters: dict):
    with get_conn(write=False) as conn:
        rows, total = list_rows(
            conn.cursor(), table, filters=filters, q=q, skip=skip, limit=limit, order=order
        )
    return _page(rows, total, skip, limit)


def _get(table: str, pk: str, pk_value):
    with get_conn(write=False) as conn:
        return get_row(conn.cursor(), table, pk, pk_value)


def _create(table: str, pk: str, data: dict):
    with get_conn() as conn:
        return insert_row(conn.cursor(), table, data, pk)


def _patch(table: str, pk: str, pk_value, data: dict):
    with get_conn() as conn:
        return update_row(conn.cursor(), table, pk, pk_value, data)


def _deactivate(table: str, pk: str, pk_value):
    with get_conn() as conn:
        return soft_delete(conn.cursor(), table, pk, pk_value)


@router.get("/actividades-economicas")
def list_actividades(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
):
    return _list("actividad_economica", order="codigo", skip=skip, limit=limit, q=q, filters={})


@router.get("/actividades-economicas/{codigo}", response_model=S.ActividadEconomicaOut)
def get_actividad(codigo: str):
    return _get("actividad_economica", "codigo", codigo)


@router.post("/actividades-economicas", response_model=S.ActividadEconomicaOut, status_code=201)
def create_actividad(payload: S.ActividadEconomicaIn):
    return _create("actividad_economica", "codigo", payload.model_dump())


@router.patch("/actividades-economicas/{codigo}", response_model=S.ActividadEconomicaOut)
def patch_actividad(codigo: str, payload: S.ActividadEconomicaPatch):
    return _patch("actividad_economica", "codigo", codigo, payload.model_dump(exclude_unset=True))


@router.get("/cargos")
def list_cargos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    activo: bool | None = True,
):
    return _list("cargo", order="nombre", skip=skip, limit=limit, q=q, filters={"activo": activo})


@router.get("/cargos/{item_id}", response_model=S.CargoOut)
def get_cargo(item_id: int):
    return _get("cargo", "id", item_id)


@router.post("/cargos", response_model=S.CargoOut, status_code=201)
def create_cargo(payload: S.CargoIn):
    return _create("cargo", "id", payload.model_dump())


@router.patch("/cargos/{item_id}", response_model=S.CargoOut)
def patch_cargo(item_id: int, payload: S.CargoPatch):
    return _patch("cargo", "id", item_id, payload.model_dump(exclude_unset=True))


@router.delete("/cargos/{item_id}", response_model=S.CargoOut)
def delete_cargo(item_id: int):
    return _deactivate("cargo", "id", item_id)


@router.get("/roles")
def list_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    activo: bool | None = True,
):
    return _list("rol", order="nombre", skip=skip, limit=limit, q=q, filters={"activo": activo})


@router.get("/roles/{item_id}", response_model=S.RolOut)
def get_rol(item_id: int):
    return _get("rol", "id", item_id)


@router.post("/roles", response_model=S.RolOut, status_code=201)
def create_rol(payload: S.RolIn):
    return _create("rol", "id", payload.model_dump())


@router.patch("/roles/{item_id}", response_model=S.RolOut)
def patch_rol(item_id: int, payload: S.RolPatch):
    return _patch("rol", "id", item_id, payload.model_dump(exclude_unset=True))


@router.delete("/roles/{item_id}", response_model=S.RolOut)
def delete_rol(item_id: int):
    return _deactivate("rol", "id", item_id)


@router.get("/proveedores")
def list_proveedores(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    activo: bool | None = True,
):
    return _list("proveedor", order="nombre", skip=skip, limit=limit, q=q, filters={"activo": activo})


@router.get("/proveedores/{item_id}", response_model=S.ProveedorOut)
def get_proveedor(item_id: int):
    return _get("proveedor", "id", item_id)


@router.post("/proveedores", response_model=S.ProveedorOut, status_code=201)
def create_proveedor(payload: S.ProveedorIn):
    return _create("proveedor", "id", payload.model_dump())


@router.patch("/proveedores/{item_id}", response_model=S.ProveedorOut)
def patch_proveedor(item_id: int, payload: S.ProveedorPatch):
    return _patch("proveedor", "id", item_id, payload.model_dump(exclude_unset=True))


@router.delete("/proveedores/{item_id}", response_model=S.ProveedorOut)
def delete_proveedor(item_id: int):
    return _deactivate("proveedor", "id", item_id)


@router.get("/choferes")
def list_choferes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    activo: bool | None = True,
):
    return _list("chofer", order="nombre", skip=skip, limit=limit, q=q, filters={"activo": activo})


@router.get("/choferes/{item_id}", response_model=S.ChoferOut)
def get_chofer(item_id: int):
    return _get("chofer", "id", item_id)


@router.post("/choferes", response_model=S.ChoferOut, status_code=201)
def create_chofer(payload: S.ChoferIn):
    return _create("chofer", "id", payload.model_dump())


@router.patch("/choferes/{item_id}", response_model=S.ChoferOut)
def patch_chofer(item_id: int, payload: S.ChoferPatch):
    return _patch("chofer", "id", item_id, payload.model_dump(exclude_unset=True))


@router.delete("/choferes/{item_id}", response_model=S.ChoferOut)
def delete_chofer(item_id: int):
    return _deactivate("chofer", "id", item_id)


@router.get("/empresas")
def list_empresas(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    activo: bool | None = True,
):
    return _list("empresa", order="razon_social", skip=skip, limit=limit, q=q, filters={"activo": activo})


@router.get("/empresas/{item_id}", response_model=S.EmpresaOut)
def get_empresa(item_id: int):
    return _get("empresa", "id", item_id)


@router.post("/empresas", response_model=S.EmpresaOut, status_code=201)
def create_empresa(payload: S.EmpresaIn):
    return _create("empresa", "id", payload.model_dump())


@router.patch("/empresas/{item_id}", response_model=S.EmpresaOut)
def patch_empresa(item_id: int, payload: S.EmpresaPatch):
    return _patch("empresa", "id", item_id, payload.model_dump(exclude_unset=True))


@router.delete("/empresas/{item_id}", response_model=S.EmpresaOut)
def delete_empresa(item_id: int):
    return _deactivate("empresa", "id", item_id)


@router.get("/fundos")
def list_fundos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    activo: bool | None = True,
    empresa_id: int | None = None,
):
    return _list(
        "fundo",
        order="nombre",
        skip=skip,
        limit=limit,
        q=q,
        filters={"activo": activo, "empresa_id": empresa_id},
    )


@router.get("/fundos/{item_id}", response_model=S.FundoOut)
def get_fundo(item_id: int):
    return _get("fundo", "id", item_id)


@router.post("/fundos", response_model=S.FundoOut, status_code=201)
def create_fundo(payload: S.FundoIn):
    return _create("fundo", "id", payload.model_dump())


@router.patch("/fundos/{item_id}", response_model=S.FundoOut)
def patch_fundo(item_id: int, payload: S.FundoPatch):
    return _patch("fundo", "id", item_id, payload.model_dump(exclude_unset=True))


@router.delete("/fundos/{item_id}", response_model=S.FundoOut)
def delete_fundo(item_id: int):
    return _deactivate("fundo", "id", item_id)


@router.get("/modulos")
def list_modulos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    activo: bool | None = True,
    fundo_id: int | None = None,
):
    return _list(
        "modulo",
        order="codigo",
        skip=skip,
        limit=limit,
        q=q,
        filters={"activo": activo, "fundo_id": fundo_id},
    )


@router.get("/modulos/{item_id}", response_model=S.ModuloOut)
def get_modulo(item_id: int):
    return _get("modulo", "id", item_id)


@router.post("/modulos", response_model=S.ModuloOut, status_code=201)
def create_modulo(payload: S.ModuloIn):
    return _create("modulo", "id", payload.model_dump())


@router.patch("/modulos/{item_id}", response_model=S.ModuloOut)
def patch_modulo(item_id: int, payload: S.ModuloPatch):
    return _patch("modulo", "id", item_id, payload.model_dump(exclude_unset=True))


@router.delete("/modulos/{item_id}", response_model=S.ModuloOut)
def delete_modulo(item_id: int):
    return _deactivate("modulo", "id", item_id)


@router.get("/turnos")
def list_turnos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    activo: bool | None = True,
    modulo_id: int | None = None,
):
    return _list(
        "turno",
        order="codigo",
        skip=skip,
        limit=limit,
        q=q,
        filters={"activo": activo, "modulo_id": modulo_id},
    )


@router.get("/turnos/{item_id}", response_model=S.TurnoOut)
def get_turno(item_id: int):
    return _get("turno", "id", item_id)


@router.post("/turnos", response_model=S.TurnoOut, status_code=201)
def create_turno(payload: S.TurnoIn):
    return _create("turno", "id", payload.model_dump())


@router.patch("/turnos/{item_id}", response_model=S.TurnoOut)
def patch_turno(item_id: int, payload: S.TurnoPatch):
    return _patch("turno", "id", item_id, payload.model_dump(exclude_unset=True))


@router.delete("/turnos/{item_id}", response_model=S.TurnoOut)
def delete_turno(item_id: int):
    return _deactivate("turno", "id", item_id)


@router.get("/lotes")
def list_lotes(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    q: SearchQ = None,
    activo: bool | None = True,
    turno_id: int | None = None,
):
    return _list(
        "lote",
        order="codigo",
        skip=skip,
        limit=limit,
        q=q,
        filters={"activo": activo, "turno_id": turno_id},
    )


@router.get("/lotes/{item_id}", response_model=S.LoteOut)
def get_lote(item_id: int):
    return _get("lote", "id", item_id)


@router.post("/lotes", response_model=S.LoteOut, status_code=201)
def create_lote(payload: S.LoteIn):
    return _create("lote", "id", payload.model_dump())


@router.patch("/lotes/{item_id}", response_model=S.LoteOut)
def patch_lote(item_id: int, payload: S.LotePatch):
    return _patch("lote", "id", item_id, payload.model_dump(exclude_unset=True))


@router.delete("/lotes/{item_id}", response_model=S.LoteOut)
def delete_lote(item_id: int):
    return _deactivate("lote", "id", item_id)


@router.get("/grupos")
def list_grupos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    activo: bool | None = True,
    empresa_id: int | None = None,
    fundo_id: int | None = None,
):
    return _list(
        "grupo",
        order="nombre",
        skip=skip,
        limit=limit,
        q=q,
        filters={"activo": activo, "empresa_id": empresa_id, "fundo_id": fundo_id},
    )


@router.get("/grupos/{item_id}", response_model=S.GrupoOut)
def get_grupo(item_id: int):
    return _get("grupo", "id", item_id)


@router.post("/grupos", response_model=S.GrupoOut, status_code=201)
def create_grupo(payload: S.GrupoIn):
    return _create("grupo", "id", payload.model_dump())


@router.patch("/grupos/{item_id}", response_model=S.GrupoOut)
def patch_grupo(item_id: int, payload: S.GrupoPatch):
    return _patch("grupo", "id", item_id, payload.model_dump(exclude_unset=True))


@router.delete("/grupos/{item_id}", response_model=S.GrupoOut)
def delete_grupo(item_id: int):
    return _deactivate("grupo", "id", item_id)


@router.get("/usuarios")
def list_usuarios(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    activo: bool | None = True,
    grupo_id: int | None = None,
    cargo_id: int | None = None,
    rol_id: int | None = None,
):
    return _list(
        "usuario",
        order="nombre",
        skip=skip,
        limit=limit,
        q=q,
        filters={"activo": activo, "grupo_id": grupo_id, "cargo_id": cargo_id, "rol_id": rol_id},
    )


@router.get("/usuarios/{item_id}", response_model=S.UsuarioOut)
def get_usuario(item_id: int):
    return _get("usuario", "id", item_id)


@router.post("/usuarios", response_model=S.UsuarioOut, status_code=201)
def create_usuario(payload: S.UsuarioIn):
    return _create("usuario", "id", payload.model_dump())


@router.patch("/usuarios/{item_id}", response_model=S.UsuarioOut)
def patch_usuario(item_id: int, payload: S.UsuarioPatch):
    return _patch("usuario", "id", item_id, payload.model_dump(exclude_unset=True))


@router.delete("/usuarios/{item_id}", response_model=S.UsuarioOut)
def delete_usuario(item_id: int):
    return _deactivate("usuario", "id", item_id)


@router.get("/vehiculos")
def list_vehiculos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    activo: bool | None = True,
    proveedor_id: int | None = None,
    chofer_id: int | None = None,
):
    return _list(
        "vehiculo",
        order="placa",
        skip=skip,
        limit=limit,
        q=q,
        filters={"activo": activo, "proveedor_id": proveedor_id, "chofer_id": chofer_id},
    )


@router.get("/vehiculos/{item_id}", response_model=S.VehiculoOut)
def get_vehiculo(item_id: int):
    return _get("vehiculo", "id", item_id)


@router.post("/vehiculos", response_model=S.VehiculoOut, status_code=201)
def create_vehiculo(payload: S.VehiculoIn):
    return _create("vehiculo", "id", payload.model_dump())


@router.patch("/vehiculos/{item_id}", response_model=S.VehiculoOut)
def patch_vehiculo(item_id: int, payload: S.VehiculoPatch):
    return _patch("vehiculo", "id", item_id, payload.model_dump(exclude_unset=True))


@router.delete("/vehiculos/{item_id}", response_model=S.VehiculoOut)
def delete_vehiculo(item_id: int):
    return _deactivate("vehiculo", "id", item_id)

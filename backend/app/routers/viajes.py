from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from .. import schemas as S
from ..db import get_conn
from ..viajes import (
    agregar_detalle,
    crear_croquis,
    crear_grr,
    crear_viaje,
    detalle_viaje,
    listar_detalle,
    listar_viajes,
    obtener_croquis,
    obtener_grr,
    parchear_viaje,
    quitar_detalle,
)

SearchQ = Annotated[str | None, Query(max_length=80)]

router = APIRouter(prefix="/api/v1", tags=["viajes"])


def _page(rows, total, skip, limit):
    return {"items": rows, "total": total, "skip": skip, "limit": limit}


@router.get("/viajes")
def get_viajes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    usuario_id: int | None = None,
    fecha: date | None = None,
    estado: Annotated[str | None, Query(max_length=20)] = None,
    tipo_viaje: Annotated[str | None, Query(max_length=10)] = None,
):
    estado_norm = estado.strip().lower() if estado else None
    if estado_norm and estado_norm not in S.ESTADOS_VIAJE:
        raise HTTPException(
            status_code=400,
            detail="El estado del viaje debe ser en_proceso, finalizado o anulado",
        )
    tipo_norm = tipo_viaje.strip().lower() if tipo_viaje else None
    if tipo_norm and tipo_norm not in S.TIPOS_VIAJE:
        raise HTTPException(
            status_code=400,
            detail="El tipo de viaje debe ser directo o agrupado",
        )
    with get_conn(write=False) as conn:
        rows, total = listar_viajes(
            conn.cursor(),
            usuario_id=usuario_id,
            fecha=fecha,
            estado=estado_norm,
            tipo_viaje=tipo_norm,
            q=q,
            skip=skip,
            limit=limit,
        )
    return _page(rows, total, skip, limit)


@router.post("/viajes", response_model=S.ViajeOut, status_code=201)
def post_viaje(payload: S.ViajeIn):
    with get_conn() as conn:
        return crear_viaje(conn.cursor(), payload)


@router.get("/viajes/{viaje_id}", response_model=S.ViajeCompletoOut)
def get_viaje_detalle(viaje_id: int):
    with get_conn(write=False) as conn:
        return detalle_viaje(conn.cursor(), viaje_id)


@router.patch("/viajes/{viaje_id}", response_model=S.ViajeOut)
def patch_viaje(viaje_id: int, payload: S.ViajePatch):
    with get_conn() as conn:
        return parchear_viaje(conn.cursor(), viaje_id, payload)


@router.post("/viajes/{viaje_id}/detalle", status_code=201)
def post_detalle(viaje_id: int, payload: S.ViajeDetalleIn):
    with get_conn() as conn:
        return agregar_detalle(conn.cursor(), viaje_id, payload)


@router.get("/viajes/{viaje_id}/detalle", response_model=S.ViajeDetalleListOut)
def get_detalle(viaje_id: int):
    with get_conn(write=False) as conn:
        return listar_detalle(conn.cursor(), viaje_id)


@router.delete("/viajes/{viaje_id}/detalle/{detalle_id}", response_model=S.ViajeDetalleOut)
def delete_detalle(viaje_id: int, detalle_id: int):
    with get_conn() as conn:
        return quitar_detalle(conn.cursor(), viaje_id, detalle_id)


@router.post("/viajes/{viaje_id}/croquis", response_model=S.CroquisOut, status_code=201)
def post_croquis(viaje_id: int, payload: S.CroquisIn):
    with get_conn() as conn:
        return crear_croquis(conn.cursor(), viaje_id, payload)


@router.get("/viajes/{viaje_id}/croquis", response_model=S.CroquisOut)
def get_croquis(viaje_id: int):
    with get_conn(write=False) as conn:
        return obtener_croquis(conn.cursor(), viaje_id)


@router.post("/viajes/{viaje_id}/grr", response_model=S.GrrOut, status_code=201)
def post_grr(viaje_id: int):
    with get_conn() as conn:
        return crear_grr(conn.cursor(), viaje_id)


@router.get("/viajes/{viaje_id}/grr", response_model=S.GrrOut)
def get_grr(viaje_id: int):
    with get_conn(write=False) as conn:
        return obtener_grr(conn.cursor(), viaje_id)

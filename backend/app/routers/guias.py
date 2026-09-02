from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from .. import schemas as S
from ..crud import get_row, list_rows
from ..db import get_conn
from ..guia_ingreso import contexto, crear, parchear, serialize_guia
from ..realtime import publish_guia

SearchQ = Annotated[str | None, Query(max_length=80)]

router = APIRouter(prefix="/api/v1", tags=["guias-ingreso"])


def _page(rows, total, skip, limit):
    return {"items": rows, "total": total, "skip": skip, "limit": limit}


@router.get("/guias-ingreso/contexto", response_model=S.GuiaContextoOut)
def get_contexto(
    usuario_id: int | None = None,
    usuario_dni: Annotated[str | None, Query(max_length=15)] = None,
    lote_id: int | None = None,
    vehiculo_id: int | None = None,
):
    """DNI, nombre, grupo y fundo del usuario; ha del lote; placa del vehículo."""
    with get_conn(write=False) as conn:
        return contexto(
            conn.cursor(),
            usuario_id=usuario_id,
            usuario_dni=usuario_dni,
            lote_id=lote_id,
            vehiculo_id=vehiculo_id,
        )


@router.get("/guias-ingreso")
def list_guias(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: SearchQ = None,
    fecha: date | None = None,
    fundo_id: int | None = None,
    usuario_id: int | None = None,
    usuario_dni: Annotated[str | None, Query(max_length=15)] = None,
    lote_id: int | None = None,
    vehiculo_id: int | None = None,
    estado: Annotated[str | None, Query(max_length=20)] = None,
):
    with get_conn(write=False) as conn:
        rows, total = list_rows(
            conn.cursor(),
            "guia_ingreso",
            filters={
                "fecha": fecha,
                "fundo_id": fundo_id,
                "usuario_id": usuario_id,
                "usuario_dni": usuario_dni.strip() if usuario_dni else None,
                "lote_id": lote_id,
                "vehiculo_id": vehiculo_id,
                "estado": estado.strip().lower() if estado else None,
            },
            q=q,
            skip=skip,
            limit=limit,
            order="codigo",
            descending=True,
        )
    return _page([serialize_guia(r) for r in rows], total, skip, limit)


@router.get("/guias-ingreso/{item_id}", response_model=S.GuiaIngresoOut)
def get_guia(item_id: int):
    with get_conn(write=False) as conn:
        return serialize_guia(get_row(conn.cursor(), "guia_ingreso", "id", item_id))


@router.post("/guias-ingreso", response_model=S.GuiaIngresoOut, status_code=201)
def create_guia(payload: S.GuiaIngresoIn):
    """Alta desde la app móvil. El cliente envía DNI, grupo/fundo de la sesión, ubicación, placa y conteos."""
    with get_conn() as conn:
        row = crear(conn.cursor(), payload)
    publish_guia("guia.created", row)
    return row


@router.patch("/guias-ingreso/{item_id}", response_model=S.GuiaIngresoOut)
def patch_guia(item_id: int, payload: S.GuiaIngresoPatch):
    with get_conn() as conn:
        row = parchear(conn.cursor(), item_id, payload)
    publish_guia("guia.updated", row)
    return row

from datetime import date

from fastapi import APIRouter, Query

from .. import reportes as R
from .. import schemas as S
from ..db import get_conn

router = APIRouter(prefix="/api/v1/reportes", tags=["reportes"])


@router.get("/diario", response_model=S.ReporteDiarioOut)
def get_diario(fecha: date | None = None):
    day = fecha or date.today()
    with get_conn(write=False) as conn:
        return R.diario(conn.cursor(), day)


@router.get("/rango", response_model=S.ReporteRangoOut)
def get_rango(
    desde: date,
    hasta: date,
    agrupar: str = Query("fundo", max_length=20),
):
    with get_conn(write=False) as conn:
        return R.rango(conn.cursor(), desde, hasta, agrupar)


@router.get("/viajes", response_model=S.ReporteViajesOut)
def get_viajes(desde: date, hasta: date):
    with get_conn(write=False) as conn:
        return R.viajes(conn.cursor(), desde, hasta)


@router.get("/vehiculos", response_model=S.ReporteVehiculosOut)
def get_vehiculos(desde: date, hasta: date):
    with get_conn(write=False) as conn:
        return R.vehiculos(conn.cursor(), desde, hasta)

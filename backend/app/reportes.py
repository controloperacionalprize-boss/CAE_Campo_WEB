from datetime import date

from fastapi import HTTPException

from . import schemas as S


def _as_int(value: object) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _as_float(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _rango_ok(desde: date, hasta: date) -> None:
    if hasta < desde:
        raise HTTPException(
            status_code=400,
            detail="La fecha hasta debe ser igual o posterior a la fecha desde",
        )
    if (hasta - desde).days > 366:
        raise HTTPException(status_code=400, detail="El rango no puede superar 366 días")


def diario(cur, fecha: date) -> dict:
    cur.execute(
        """
        SELECT
          COALESCE(NULLIF(TRIM(fundo), ''), '—') AS fundo,
          COALESCE(NULLIF(TRIM(modulo), ''), '—') AS modulo,
          COALESCE(NULLIF(TRIM(turno), ''), '—') AS turno,
          COUNT(*) AS guias,
          COALESCE(SUM(jabas_totales), 0) AS jabas,
          COALESCE(SUM(jarras_totales), 0) AS jarras
        FROM guia_ingreso
        WHERE fecha = %s AND LOWER(estado) <> 'anulado'
        GROUP BY 1, 2, 3
        ORDER BY 1, 2, 3
        """,
        (fecha,),
    )
    filas = [
        {
            "fundo": str(r["fundo"]),
            "modulo": str(r["modulo"]),
            "turno": str(r["turno"]),
            "guias": _as_int(r["guias"]),
            "jabas": _as_int(r["jabas"]),
            "jarras": _as_int(r["jarras"]),
        }
        for r in cur.fetchall()
    ]
    return S.ReporteDiarioOut(
        fecha=fecha,
        filas=filas,
        total_guias=sum(f["guias"] for f in filas),
        total_jabas=sum(f["jabas"] for f in filas),
        total_jarras=sum(f["jarras"] for f in filas),
    ).model_dump(mode="json")


def rango(cur, desde: date, hasta: date, agrupar: str) -> dict:
    _rango_ok(desde, hasta)
    col = agrupar.strip().lower()
    if col not in {"fundo", "modulo", "turno"}:
        raise HTTPException(
            status_code=400,
            detail="El agrupado debe ser fundo, modulo o turno",
        )
    cur.execute(
        """
        SELECT fecha,
               COUNT(*) AS guias,
               COALESCE(SUM(jabas_totales), 0) AS jabas,
               COALESCE(SUM(jarras_totales), 0) AS jarras
        FROM guia_ingreso
        WHERE fecha BETWEEN %s AND %s AND LOWER(estado) <> 'anulado'
        GROUP BY fecha
        ORDER BY fecha
        """,
        (desde, hasta),
    )
    por_fecha = [
        {
            "fecha": r["fecha"],
            "guias": _as_int(r["guias"]),
            "jabas": _as_int(r["jabas"]),
            "jarras": _as_int(r["jarras"]),
        }
        for r in cur.fetchall()
    ]
    cur.execute(
        f"""
        SELECT COALESCE(NULLIF(TRIM({col}), ''), '—') AS label,
               COUNT(*) AS guias,
               COALESCE(SUM(jabas_totales), 0) AS jabas,
               COALESCE(SUM(jarras_totales), 0) AS jarras
        FROM guia_ingreso
        WHERE fecha BETWEEN %s AND %s AND LOWER(estado) <> 'anulado'
        GROUP BY 1
        ORDER BY guias DESC, label
        """,
        (desde, hasta),
    )
    por_grupo = [
        {
            "label": str(r["label"]),
            "guias": _as_int(r["guias"]),
            "jabas": _as_int(r["jabas"]),
            "jarras": _as_int(r["jarras"]),
        }
        for r in cur.fetchall()
    ]
    return S.ReporteRangoOut(
        desde=desde,
        hasta=hasta,
        agrupar=col,
        por_fecha=por_fecha,
        por_grupo=por_grupo,
        total_guias=sum(p["guias"] for p in por_fecha),
        total_jabas=sum(p["jabas"] for p in por_fecha),
        total_jarras=sum(p["jarras"] for p in por_fecha),
    ).model_dump(mode="json")


def viajes(cur, desde: date, hasta: date) -> dict:
    _rango_ok(desde, hasta)
    cur.execute(
        """
        SELECT LOWER(estado) AS estado, COUNT(*) AS n
        FROM viaje
        WHERE fecha BETWEEN %s AND %s
        GROUP BY 1
        ORDER BY 1
        """,
        (desde, hasta),
    )
    por_estado = [{"estado": str(r["estado"]), "count": _as_int(r["n"])} for r in cur.fetchall()]
    cur.execute(
        """
        SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) AS secs
        FROM viaje
        WHERE fecha BETWEEN %s AND %s AND LOWER(estado) = 'recepcionado'
        """,
        (desde, hasta),
    )
    secs = _as_float((cur.fetchone() or {}).get("secs"))
    minutos = round(secs / 60, 1) if secs > 0 else None
    return S.ReporteViajesOut(
        desde=desde,
        hasta=hasta,
        por_estado=por_estado,
        total=sum(r["count"] for r in por_estado),
        minutos_promedio_ciclo=minutos,
    ).model_dump(mode="json")


def vehiculos(cur, desde: date, hasta: date) -> dict:
    _rango_ok(desde, hasta)
    cur.execute(
        """
        SELECT COALESCE(NULLIF(TRIM(placa), ''), '—') AS placa,
               COUNT(*) AS viajes,
               COUNT(*) FILTER (WHERE LOWER(estado) = 'recepcionado') AS recepcionados
        FROM viaje
        WHERE fecha BETWEEN %s AND %s
        GROUP BY 1
        ORDER BY viajes DESC, placa
        """,
        (desde, hasta),
    )
    filas = [
        {
            "placa": str(r["placa"]),
            "viajes": _as_int(r["viajes"]),
            "recepcionados": _as_int(r["recepcionados"]),
        }
        for r in cur.fetchall()
    ]
    return S.ReporteVehiculosOut(
        desde=desde,
        hasta=hasta,
        filas=filas,
        total_viajes=sum(f["viajes"] for f in filas),
    ).model_dump(mode="json")

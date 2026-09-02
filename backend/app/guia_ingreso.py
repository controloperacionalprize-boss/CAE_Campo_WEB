from datetime import date, datetime, timedelta

from fastapi import HTTPException

from . import schemas as S
from .crud import distinct_columns, get_row, insert_row, list_rows, update_row


def serialize_guia(row: dict) -> dict:
    return S.GuiaIngresoOut.model_validate(row).model_dump(mode="json")


def _require_activo(row: dict, mensaje: str) -> None:
    if row.get("activo") is False:
        raise HTTPException(status_code=400, detail=mensaje)


def resolve_usuario(cur, *, usuario_id: int | None, usuario_dni: str | None) -> dict:
    if usuario_id is not None:
        usuario = get_row(cur, "usuario", "id", usuario_id)
    elif usuario_dni:
        rows, _ = list_rows(
            cur,
            "usuario",
            filters={"dni": usuario_dni.strip()},
            skip=0,
            limit=1,
            order="id",
            with_count=False,
        )
        if not rows:
            raise HTTPException(status_code=404, detail="No se encontró el usuario")
        usuario = dict(rows[0])
    else:
        raise HTTPException(
            status_code=400,
            detail="Indique usuario_id o usuario_dni",
        )
    _require_activo(usuario, "El usuario indicado está inactivo")
    return usuario


def snapshot_usuario(cur, usuario: dict) -> dict:
    data = {
        "usuario_id": usuario["id"],
        "usuario_dni": usuario["dni"],
        "usuario_nombre": usuario["nombre"],
        "grupo_id": None,
        "grupo": "",
        "fundo_id": None,
        "fundo": "",
    }
    grupo_id = usuario.get("grupo_id")
    if grupo_id:
        data.update(snapshot_grupo(cur, get_row(cur, "grupo", "id", grupo_id), exigir_activo=False))
    return data


def snapshot_grupo(cur, grupo: dict, *, exigir_activo: bool = True) -> dict:
    if exigir_activo:
        _require_activo(grupo, "El grupo indicado está inactivo")
    fundo_id = grupo.get("fundo_id")
    fundo_nombre = ""
    if fundo_id:
        fundo = get_row(cur, "fundo", "id", fundo_id)
        if exigir_activo:
            _require_activo(fundo, "El fundo indicado está inactivo")
        fundo_nombre = fundo["nombre"] or ""
    return {
        "grupo_id": grupo["id"],
        "grupo": grupo["nombre"] or "",
        "fundo_id": fundo_id,
        "fundo": fundo_nombre,
    }


def snapshot_fundo(cur, fundo: dict) -> dict:
    _require_activo(fundo, "El fundo indicado está inactivo")
    return {"fundo_id": fundo["id"], "fundo": fundo["nombre"] or ""}


def snapshot_lote(cur, lote_id: int) -> dict:
    lote = get_row(cur, "lote", "id", lote_id)
    _require_activo(lote, "El lote indicado está inactivo")
    turno = get_row(cur, "turno", "id", lote["turno_id"])
    modulo = get_row(cur, "modulo", "id", turno["modulo_id"])
    fundo = get_row(cur, "fundo", "id", modulo["fundo_id"])
    return {
        "lote_id": lote["id"],
        "lote": lote["codigo"],
        "ha": lote["area_ha"],
        "turno_id": turno["id"],
        "turno": turno["codigo"],
        "modulo_id": modulo["id"],
        "modulo": modulo["codigo"],
        "fundo_lote_id": fundo["id"],
        "fundo_lote": fundo["nombre"],
    }


def snapshot_vehiculo(cur, vehiculo_id: int) -> dict:
    vehiculo = get_row(cur, "vehiculo", "id", vehiculo_id)
    _require_activo(vehiculo, "El vehículo indicado está inactivo")
    return {"vehiculo_id": vehiculo["id"], "placa": vehiculo["placa"]}


def _norm(value: object) -> str:
    return str(value or "").strip().upper()


def _uno_por_campo(rows: list, campo: str, valor: str, mensaje: str) -> dict:
    wanted = _norm(valor)
    match = [r for r in rows if _norm(r.get(campo)) == wanted]
    if not match:
        raise HTTPException(status_code=400, detail=mensaje)
    if len(match) > 1:
        raise HTTPException(status_code=400, detail=f"{mensaje} (hay más de un registro)")
    return dict(match[0])


def resolve_sesion_movil(cur, payload: S.GuiaIngresoIn, snap_u: dict) -> dict:
    """Grupo y fundo de la sesión del móvil, no el grupo fijo del maestro de usuario."""
    sesion = dict(snap_u)
    grupo = None
    fundo = None

    if payload.grupo_id is not None:
        grupo = get_row(cur, "grupo", "id", payload.grupo_id)
    elif payload.grupo:
        filtros: dict = {"activo": True}
        if payload.fundo_id is not None:
            filtros["fundo_id"] = payload.fundo_id
        rows, _ = list_rows(cur, "grupo", filters=filtros, skip=0, limit=50, order="id", with_count=False)
        if not rows and "fundo_id" in filtros:
            rows, _ = list_rows(cur, "grupo", filters={"activo": True}, skip=0, limit=50, order="id", with_count=False)
        grupo = _uno_por_campo(rows, "nombre", payload.grupo, "El grupo indicado no existe")

    if payload.fundo_id is not None:
        fundo = get_row(cur, "fundo", "id", payload.fundo_id)
    elif payload.fundo:
        rows, _ = list_rows(cur, "fundo", filters={"activo": True}, skip=0, limit=50, order="id", with_count=False)
        fundo = _uno_por_campo(rows, "nombre", payload.fundo, "El fundo indicado no existe")

    if grupo:
        sesion.update(snapshot_grupo(cur, grupo))
    if fundo:
        snap_f = snapshot_fundo(cur, fundo)
        sesion.update(snap_f)
    return sesion


def _lotes_del_turno(cur, turno_id: int, lote: str) -> list:
    lotes, _ = list_rows(
        cur,
        "lote",
        filters={"turno_id": turno_id, "codigo": lote.strip().upper(), "activo": True},
        skip=0,
        limit=20,
        order="id",
        with_count=False,
    )
    if lotes:
        return lotes
    lotes, _ = list_rows(
        cur,
        "lote",
        filters={"turno_id": turno_id, "activo": True},
        skip=0,
        limit=500,
        order="codigo",
        with_count=False,
    )
    wanted = _norm(lote)
    return [r for r in lotes if _norm(r.get("codigo")) == wanted]


def resolve_lote_movil(cur, *, modulo: str, turno: str, lote: str, fundo_id: int | None) -> dict:
    filtros_mod: dict = {"codigo": modulo.strip().upper(), "activo": True}
    if fundo_id is not None:
        filtros_mod["fundo_id"] = fundo_id
    modulos, _ = list_rows(cur, "modulo", filters=filtros_mod, skip=0, limit=50, order="id", with_count=False)
    if not modulos:
        detalle = "en ese fundo" if fundo_id is not None else ""
        raise HTTPException(
            status_code=400,
            detail=f"El módulo indicado no existe {detalle}".strip(),
        )

    coincidencias: list[dict] = []
    for mod in modulos:
        turnos, _ = list_rows(
            cur,
            "turno",
            filters={"modulo_id": mod["id"], "codigo": turno.strip().upper(), "activo": True},
            skip=0,
            limit=20,
            order="id",
            with_count=False,
        )
        turnos = [t for t in turnos if _norm(t.get("codigo")) == _norm(turno)]
        for tur in turnos:
            for lot in _lotes_del_turno(cur, tur["id"], lote):
                coincidencias.append(lot)

    if not coincidencias:
        raise HTTPException(
            status_code=400,
            detail="No hay un lote activo con ese módulo, turno y código",
        )
    if len(coincidencias) > 1:
        detalle = (
            "en el fundo indicado"
            if fundo_id is not None
            else "indique el fundo de la sesión"
        )
        raise HTTPException(
            status_code=400,
            detail=f"Hay más de un lote con ese módulo, turno y código; {detalle}",
        )
    return snapshot_lote(cur, coincidencias[0]["id"])


def resolve_vehiculo_placa(cur, placa: str) -> dict:
    wanted = placa.strip().upper()
    rows, _ = list_rows(cur, "vehiculo", filters={"placa": wanted, "activo": True}, skip=0, limit=5, order="id", with_count=False)
    if not rows:
        rows, _ = list_rows(cur, "vehiculo", filters={"placa": wanted}, skip=0, limit=5, order="id", with_count=False)
    if not rows:
        raise HTTPException(status_code=400, detail="No hay un vehículo activo con esa placa")
    return snapshot_vehiculo(cur, rows[0]["id"])


def contexto(
    cur,
    *,
    usuario_id: int | None,
    usuario_dni: str | None,
    lote_id: int | None,
    vehiculo_id: int | None,
) -> dict:
    usuario = resolve_usuario(cur, usuario_id=usuario_id, usuario_dni=usuario_dni)
    data = snapshot_usuario(cur, usuario)
    if lote_id is not None:
        lote = snapshot_lote(cur, lote_id)
        data.update(
            {
                "lote_id": lote["lote_id"],
                "lote": lote["lote"],
                "ha": lote["ha"],
                "modulo": lote["modulo"],
                "turno": lote["turno"],
            }
        )
        if not data.get("fundo_id"):
            data["fundo_id"] = lote["fundo_lote_id"]
            data["fundo"] = lote["fundo_lote"]
    if vehiculo_id is not None:
        data.update(snapshot_vehiculo(cur, vehiculo_id))
    return data


def _totales(jabas_completas: int, jabas_incompletas: int, jarras_jabas: int, jarras_extras: int) -> dict:
    return {
        "jabas_totales": jabas_completas + jabas_incompletas,
        "jarras_totales": jarras_jabas + jarras_extras,
    }


def crear(cur, payload: S.GuiaIngresoIn) -> dict:
    usuario = resolve_usuario(cur, usuario_id=payload.usuario_id, usuario_dni=payload.usuario_dni)
    snap_u = resolve_sesion_movil(cur, payload, snapshot_usuario(cur, usuario))
    if not snap_u.get("grupo_id") and payload.grupo_id:
        grupo = get_row(cur, "grupo", "id", payload.grupo_id)
        snap_u["grupo_id"] = grupo["id"]
        snap_u["grupo"] = grupo["nombre"] or ""
    snap_l = resolve_lote_movil(
        cur,
        modulo=payload.modulo,
        turno=payload.turno,
        lote=payload.lote,
        fundo_id=snap_u.get("fundo_id") or payload.fundo_id,
    )
    snap_v = resolve_vehiculo_placa(cur, payload.placa)

    fundo_id = snap_u["fundo_id"] or snap_l["fundo_lote_id"]
    fundo = snap_u["fundo"] or snap_l["fundo_lote"]
    if snap_u["fundo_id"] and snap_l["fundo_lote_id"] != snap_u["fundo_id"]:
        raise HTTPException(status_code=400, detail="El lote no pertenece al fundo de la sesión")

    fecha = payload.fecha or date.today()
    hora = payload.hora_envio or datetime.now().time().replace(second=0, microsecond=0)
    totals = _totales(
        payload.jabas_completas,
        payload.jabas_incompletas,
        payload.jarras_jabas,
        payload.jarras_extras,
    )
    row = insert_row(
        cur,
        "guia_ingreso",
        {
            "codigo": payload.codigo,
            "fecha": fecha,
            "hora_envio": hora,
            **snap_u,
            "fundo_id": fundo_id,
            "fundo": fundo,
            "modulo_id": snap_l["modulo_id"],
            "modulo": snap_l["modulo"],
            "turno_id": snap_l["turno_id"],
            "turno": snap_l["turno"],
            "lote_id": snap_l["lote_id"],
            "lote": snap_l["lote"],
            "ha": snap_l["ha"],
            **snap_v,
            "tipo_producto": payload.tipo_producto.upper(),
            "tipo_llenado": payload.tipo_llenado,
            "envase_principal": payload.envase_principal.upper(),
            "jabas_completas": payload.jabas_completas,
            "jabas_incompletas": payload.jabas_incompletas,
            "jarras_jabas": payload.jarras_jabas,
            "jarras_extras": payload.jarras_extras,
            **totals,
            "observacion": payload.observacion or "",
            "estado": "registrado",
        },
        "id",
    )
    return serialize_guia(row)


def parchear(cur, item_id: int, payload: S.GuiaIngresoPatch) -> dict:
    current = get_row(cur, "guia_ingreso", "id", item_id)
    data = payload.model_dump(exclude_unset=True)
    if _guia_ya_es_historica(cur, current):
        extra = [k for k in data if k != "estado"]
        if extra:
            raise HTTPException(
                status_code=400,
                detail="No se puede modificar una guía ya recepcionada o asignada a un viaje",
            )
    if "vehiculo_id" in data and data["vehiculo_id"] is not None:
        data.update(snapshot_vehiculo(cur, data["vehiculo_id"]))
    if "tipo_producto" in data and data["tipo_producto"]:
        data["tipo_producto"] = data["tipo_producto"].upper()
    if "envase_principal" in data and data["envase_principal"]:
        data["envase_principal"] = data["envase_principal"].upper()

    jabas_c = data.get("jabas_completas", current["jabas_completas"])
    jabas_i = data.get("jabas_incompletas", current["jabas_incompletas"])
    jarras_j = data.get("jarras_jabas", current["jarras_jabas"])
    jarras_e = data.get("jarras_extras", current["jarras_extras"])
    if any(k in data for k in ("jabas_completas", "jabas_incompletas", "jarras_jabas", "jarras_extras")):
        data.update(_totales(jabas_c, jabas_i, jarras_j, jarras_e))

    if data.get("estado") == "anulado":
        _assert_se_puede_anular(cur, current)

    row = update_row(cur, "guia_ingreso", "id", item_id, data)
    return serialize_guia(row)


def _guia_en_algun_viaje(cur, guia_id: int) -> bool:
    cur.execute(
        "SELECT 1 FROM viaje_detalle WHERE guia_ingreso_id = %s LIMIT 1",
        (guia_id,),
    )
    return cur.fetchone() is not None


def _guia_ya_es_historica(cur, guia: dict) -> bool:
    if guia.get("recepcionado_acopio") or guia.get("recepcionado_planta"):
        return True
    return _guia_en_algun_viaje(cur, guia["id"])


def _viaje_vigente_de_guia(cur, guia_id: int) -> dict | None:
    cur.execute(
        """
        SELECT v.id, v.codigo, v.estado
        FROM viaje_detalle vd
        JOIN viaje v ON v.id = vd.viaje_id
        WHERE vd.guia_ingreso_id = %s AND v.estado <> 'anulado'
        ORDER BY v.id
        LIMIT 1
        """,
        (guia_id,),
    )
    row = cur.fetchone()
    return dict(row) if row else None


def _assert_se_puede_anular(cur, guia: dict) -> None:
    if guia.get("recepcionado_planta"):
        raise HTTPException(
            status_code=400,
            detail="No se puede anular una guía ya registrada en planta",
        )
    vigente = _viaje_vigente_de_guia(cur, guia["id"])
    if vigente:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede anular la guía: está en el viaje {vigente['codigo']}",
        )


def recepcionar_acopio(cur, item_id: int) -> dict:
    guia = get_row(cur, "guia_ingreso", "id", item_id)
    if (guia.get("estado") or "").lower() == "anulado":
        raise HTTPException(status_code=400, detail="La guía está anulada")
    cur.execute(
        """
        UPDATE guia_ingreso
        SET recepcionado_acopio = TRUE, recepcionado_acopio_at = now(), updated_at = now()
        WHERE id = %s AND recepcionado_acopio = FALSE AND estado <> 'anulado'
        RETURNING *
        """,
        (item_id,),
    )
    row = cur.fetchone()
    if not row:
        if guia.get("recepcionado_acopio"):
            raise HTTPException(status_code=409, detail="Ya fue recepcionada en acopio")
        raise HTTPException(status_code=400, detail="No se pudo recepcionar la guía en acopio")
    return serialize_guia(dict(row))


def recepcionar_planta(cur, item_id: int) -> dict:
    guia = get_row(cur, "guia_ingreso", "id", item_id)
    codigo = guia.get("codigo") or item_id
    if (guia.get("estado") or "").lower() == "anulado":
        raise HTTPException(status_code=400, detail="La guía está anulada")
    if not guia.get("recepcionado_acopio"):
        raise HTTPException(
            status_code=400,
            detail=f"La guía {codigo} no ha sido recepcionada en acopio",
        )
    if guia.get("recepcionado_planta"):
        raise HTTPException(status_code=409, detail="Ya fue registrada en planta")
    vigente = _viaje_vigente_de_guia(cur, item_id)
    if not vigente:
        raise HTTPException(status_code=400, detail="La guía no pertenece a un viaje")
    if vigente["estado"] not in {"finalizado", "recepcionado"}:
        raise HTTPException(
            status_code=400,
            detail="La guía debe estar en un viaje finalizado para recepcionarla en planta",
        )
    cur.execute(
        """
        UPDATE guia_ingreso
        SET recepcionado_planta = TRUE, recepcionado_planta_at = now(), updated_at = now()
        WHERE id = %s
          AND recepcionado_planta = FALSE
          AND recepcionado_acopio = TRUE
          AND estado <> 'anulado'
        RETURNING *
        """,
        (item_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=409, detail="Ya fue registrada en planta")
    return serialize_guia(dict(row))


def _as_int(value: object) -> int:
    return int(value or 0)


def _uniq(values: list[object]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in values:
        text = str(raw or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
    out.sort(key=lambda s: s.lower())
    return out


def _kpis_fecha(cur, fecha: date) -> dict:
    cur.execute(
        """
        SELECT
          COUNT(*) FILTER (WHERE LOWER(estado) <> 'anulado') AS n,
          COALESCE(SUM(jabas_totales) FILTER (WHERE LOWER(estado) <> 'anulado'), 0) AS jabas,
          COALESCE(SUM(jarras_totales) FILTER (WHERE LOWER(estado) <> 'anulado'), 0) AS jarras
        FROM guia_ingreso
        WHERE fecha = %s
        """,
        (fecha,),
    )
    row = cur.fetchone() or {}
    return {
        "count": _as_int(row.get("n")),
        "jabas": _as_int(row.get("jabas")),
        "jarras": _as_int(row.get("jarras")),
    }


def _agrupar_top(cur, fecha: date, columna: str, take: int) -> list[dict]:
    if columna not in {"fundo", "turno", "modulo"}:
        raise ValueError(f"Columna no permitida: {columna}")
    cur.execute(
        f"""
        SELECT COALESCE(NULLIF(TRIM({columna}), ''), '—') AS label,
               COUNT(*) AS n,
               COALESCE(SUM(jarras_totales), 0) AS jarras
        FROM guia_ingreso
        WHERE fecha = %s AND LOWER(estado) <> 'anulado'
        GROUP BY 1
        ORDER BY n DESC
        """,
        (fecha,),
    )
    rows = [
        {"label": str(r["label"]), "count": _as_int(r["n"]), "jarras": _as_int(r["jarras"])}
        for r in cur.fetchall()
    ]
    head = rows[:take]
    rest = rows[take:]
    if rest:
        head.append(
            {
                "label": "Otros",
                "count": sum(r["count"] for r in rest),
                "jarras": sum(r["jarras"] for r in rest),
            }
        )
    total = sum(r["count"] for r in rows) or 1
    for item in head:
        item["pct"] = round(item["count"] * 100 / total)
    return head


def resumen_dashboard(cur, fecha: date) -> dict:
    """KPIs de despacho + muestra corta. Una conexión, sin bajar el día entero."""
    ayer = fecha - timedelta(days=1)
    recientes, _ = list_rows(
        cur,
        "guia_ingreso",
        filters={"fecha": fecha},
        skip=0,
        limit=5,
        order="hora_envio",
        descending=True,
        with_count=False,
    )
    cur.execute(
        """
        SELECT
          COUNT(*) FILTER (WHERE activo) AS activos,
          COUNT(*) AS total
        FROM vehiculo
        """
    )
    veh = cur.fetchone() or {}
    muestra, _ = list_rows(
        cur,
        "vehiculo",
        filters={"activo": True},
        skip=0,
        limit=6,
        order="placa",
        with_count=False,
    )
    return {
        "fecha": fecha,
        "hoy": _kpis_fecha(cur, fecha),
        "ayer": _kpis_fecha(cur, ayer),
        "recientes": [serialize_guia(r) for r in recientes],
        "por_fundo": _agrupar_top(cur, fecha, "fundo", 5),
        "por_turno": _agrupar_top(cur, fecha, "turno", 3),
        "por_modulo": _agrupar_top(cur, fecha, "modulo", 3),
        "vehiculos_activos": _as_int(veh.get("activos")),
        "vehiculos_total": _as_int(veh.get("total")),
        "vehiculos_muestra": muestra,
    }


def _facets_from_rows(
    rows: list[dict],
    *,
    fundo: str | None,
    modulo: str | None,
    turno: str | None,
) -> dict:
    def col(name: str) -> list[object]:
        return [r.get(name) for r in rows]

    scoped_fundo = [
        r for r in rows if not fundo or str(r.get("fundo") or "").strip() == fundo
    ]
    scoped_modulo = [
        r
        for r in scoped_fundo
        if not modulo or str(r.get("modulo") or "").strip() == modulo
    ]
    scoped_turno = [
        r
        for r in scoped_modulo
        if not turno or str(r.get("turno") or "").strip() == turno
    ]
    return {
        "fundos": _uniq(col("fundo")),
        "modulos": _uniq([r.get("modulo") for r in scoped_fundo]),
        "turnos": _uniq([r.get("turno") for r in scoped_modulo]),
        "lotes": _uniq([r.get("lote") for r in scoped_turno]),
        "grupos": _uniq(col("grupo")),
        "tipos_producto": _uniq(col("tipo_producto")),
    }


def listar_guias(
    cur,
    *,
    filters: dict,
    q: str | None,
    skip: int,
    limit: int,
) -> dict:
    rows, total = list_rows(
        cur,
        "guia_ingreso",
        filters=filters,
        q=q,
        skip=skip,
        limit=limit,
        order="codigo",
        descending=True,
    )
    facet_filters = {
        k: filters[k]
        for k in (
            "fecha",
            "estado",
            "recepcionado_acopio",
            "recepcionado_planta",
        )
        if filters.get(k) is not None
    }
    distinct = distinct_columns(
        cur,
        "guia_ingreso",
        ["fundo", "modulo", "turno", "lote", "grupo", "tipo_producto"],
        filters=facet_filters,
        q=q,
    )
    return {
        "items": [serialize_guia(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
        "facets": _facets_from_rows(
            distinct,
            fundo=filters.get("fundo"),
            modulo=filters.get("modulo"),
            turno=filters.get("turno"),
        ),
    }



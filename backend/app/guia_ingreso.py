from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException

from . import schemas as S
from .crud import (
    distinct_columns,
    get_row,
    get_row_for_update,
    insert_row,
    list_rows,
    require_activo,
    update_row,
)
from .tiempo import hora_actual, hoy


def serialize_guia(row: dict) -> dict:
    return S.GuiaIngresoOut.model_validate(row).model_dump(mode="json")


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
    require_activo(usuario, "El usuario indicado está inactivo")
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
        require_activo(grupo, "El grupo indicado está inactivo")
    fundo_id = grupo.get("fundo_id")
    fundo_nombre = ""
    if fundo_id:
        fundo = get_row(cur, "fundo", "id", fundo_id)
        if exigir_activo:
            require_activo(fundo, "El fundo indicado está inactivo")
        fundo_nombre = fundo["nombre"] or ""
    return {
        "grupo_id": grupo["id"],
        "grupo": grupo["nombre"] or "",
        "fundo_id": fundo_id,
        "fundo": fundo_nombre,
    }


def snapshot_fundo(cur, fundo: dict) -> dict:
    require_activo(fundo, "El fundo indicado está inactivo")
    return {"fundo_id": fundo["id"], "fundo": fundo["nombre"] or ""}


def snapshot_lote(cur, lote_id: int) -> dict:
    lote = get_row(cur, "lote", "id", lote_id)
    require_activo(lote, "El lote indicado está inactivo")
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
    require_activo(vehiculo, "El vehículo indicado está inactivo")
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


def resolve_sesion_movil(
    cur,
    snap_u: dict,
    *,
    grupo_id: int | None = None,
    grupo: str | None = None,
    fundo_id: int | None = None,
    fundo: str | None = None,
) -> dict:
    """Grupo y fundo de la sesión del móvil, no el grupo fijo del maestro de usuario."""
    sesion = dict(snap_u)
    grupo_row = None
    fundo_row = None

    if grupo_id is not None:
        grupo_row = get_row(cur, "grupo", "id", grupo_id)
    elif grupo:
        filtros: dict = {"activo": True}
        if fundo_id is not None:
            filtros["fundo_id"] = fundo_id
        rows, _ = list_rows(cur, "grupo", filters=filtros, skip=0, limit=50, order="id", with_count=False)
        if not rows and "fundo_id" in filtros:
            rows, _ = list_rows(cur, "grupo", filters={"activo": True}, skip=0, limit=50, order="id", with_count=False)
        grupo_row = _uno_por_campo(rows, "nombre", grupo, "El grupo indicado no existe")

    if fundo_id is not None:
        fundo_row = get_row(cur, "fundo", "id", fundo_id)
    elif fundo:
        rows, _ = list_rows(cur, "fundo", filters={"activo": True}, skip=0, limit=50, order="id", with_count=False)
        fundo_row = _uno_por_campo(rows, "nombre", fundo, "El fundo indicado no existe")

    if grupo_row:
        sesion.update(snapshot_grupo(cur, grupo_row))
    if fundo_row:
        sesion.update(snapshot_fundo(cur, fundo_row))
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
                "ha_saldo": saldo_ha_lote(cur, lote["lote_id"], hoy())["ha_saldo"],
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


def saldo_ha_lote(
    cur,
    lote_id: int,
    fecha: date,
    *,
    bloquear: bool = False,
    excluir_guia_id: int | None = None,
) -> dict:
    """Saldo diario del lote: area_ha menos las ha de sus guías vigentes de esa fecha.
    Se reinicia solo al cambiar de día; anular una guía libera sus ha."""
    cur.execute(
        f"SELECT id, codigo, area_ha FROM lote WHERE id = %s{' FOR UPDATE' if bloquear else ''}",
        (lote_id,),
    )
    lote = cur.fetchone()
    if not lote:
        raise HTTPException(status_code=404, detail="No se encontró el lote")
    sql = """
        SELECT COALESCE(SUM(ha), 0) AS usada
        FROM guia_ingreso
        WHERE lote_id = %s AND fecha = %s AND estado <> 'anulado'
    """
    params: list = [lote_id, fecha]
    if excluir_guia_id is not None:
        sql += " AND id <> %s"
        params.append(excluir_guia_id)
    cur.execute(sql, params)
    usada = Decimal(cur.fetchone()["usada"])
    area = Decimal(lote["area_ha"])
    return {
        "lote_id": lote["id"],
        "lote": lote["codigo"],
        "fecha": fecha,
        "area_ha": area,
        "ha_usada": usada,
        "ha_saldo": max(area - usada, Decimal(0)),
    }


def _totales(jabas_completas: int, jabas_incompletas: int, jarras_jabas: int, jarras_extras: int) -> dict:
    return {
        "jabas_totales": jabas_completas + jabas_incompletas,
        "jarras_totales": jarras_jabas + jarras_extras,
    }


def _guia_por_codigo(cur, codigo: str) -> dict | None:
    rows, _ = list_rows(cur, "guia_ingreso", filters={"codigo": codigo}, skip=0, limit=1, with_count=False)
    return dict(rows[0]) if rows else None


def crear(cur, payload: S.GuiaIngresoIn) -> dict:
    usuario = resolve_usuario(cur, usuario_id=payload.usuario_id, usuario_dni=payload.usuario_dni)
    # Reintento del móvil (timeout o red intermitente): el código ya guardado por el
    # mismo usuario se devuelve tal cual en vez de responder 409.
    existente = _guia_por_codigo(cur, payload.codigo)
    if existente is not None:
        if existente["usuario_id"] == usuario["id"]:
            return serialize_guia(existente)
        raise HTTPException(status_code=409, detail=f"El código {payload.codigo} ya fue usado por otro usuario")
    snap_u = resolve_sesion_movil(
        cur,
        snapshot_usuario(cur, usuario),
        grupo_id=payload.grupo_id,
        grupo=payload.grupo,
        fundo_id=payload.fundo_id,
        fundo=payload.fundo,
    )
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

    fecha = payload.fecha or hoy()
    hora = payload.hora_envio or hora_actual()
    if payload.ha is None:
        raise HTTPException(status_code=400, detail="Indique las hectáreas trabajadas (ha)")
    # FOR UPDATE serializa las altas del mismo lote: dos usuarios no pueden gastar el mismo saldo.
    saldo = saldo_ha_lote(cur, snap_l["lote_id"], fecha, bloquear=True)
    if payload.ha > saldo["ha_saldo"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Las ha ({payload.ha}) superan el saldo del lote {saldo['lote']} "
                f"para el {fecha.isoformat()}: quedan {saldo['ha_saldo']} de {saldo['area_ha']} ha"
            ),
        )
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
            "ha": payload.ha,
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
    return serialize_guia({**row, "ha_saldo": saldo["ha_saldo"] - payload.ha})


_CAMPOS_SESION = ("grupo_id", "grupo", "fundo_id", "fundo")
_CAMPOS_LOTE = ("modulo", "turno", "lote")
_CAMPOS_CONTEO = ("jabas_completas", "jabas_incompletas", "jarras_jabas", "jarras_extras")


def parchear(cur, item_id: int, payload: S.GuiaIngresoPatch) -> dict:
    current = get_row(cur, "guia_ingreso", "id", item_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return serialize_guia(current)

    if _guia_ya_es_historica(cur, current):
        extra = [k for k in data if k != "estado"]
        if extra:
            raise HTTPException(
                status_code=400,
                detail="No se puede modificar una guía ya recepcionada o asignada a un viaje",
            )

    estado_actual = (current.get("estado") or "").lower()
    if estado_actual == "anulado" and data.get("estado") != "registrado":
        extra = [k for k in data if k != "estado"]
        if extra:
            raise HTTPException(status_code=400, detail="No se puede modificar una guía anulada")

    if "usuario_id" in data or "usuario_dni" in data:
        usuario = resolve_usuario(
            cur,
            usuario_id=data.get("usuario_id"),
            usuario_dni=data.get("usuario_dni"),
        )
        snap_u = snapshot_usuario(cur, usuario)
        data["usuario_id"] = snap_u["usuario_id"]
        data["usuario_dni"] = snap_u["usuario_dni"]
        data["usuario_nombre"] = snap_u["usuario_nombre"]

    cambia_sesion = any(k in data for k in _CAMPOS_SESION)
    if cambia_sesion:
        sesion = resolve_sesion_movil(
            cur,
            {
                "grupo_id": current.get("grupo_id"),
                "grupo": current.get("grupo") or "",
                "fundo_id": current.get("fundo_id"),
                "fundo": current.get("fundo") or "",
            },
            grupo_id=data["grupo_id"] if "grupo_id" in data else None,
            grupo=data.get("grupo"),
            fundo_id=data["fundo_id"] if "fundo_id" in data else None,
            fundo=data.get("fundo"),
        )
        data.update({k: sesion[k] for k in _CAMPOS_SESION})

    fundo_id = data["fundo_id"] if "fundo_id" in data else current.get("fundo_id")
    if any(k in data for k in _CAMPOS_LOTE) or cambia_sesion:
        snap_l = resolve_lote_movil(
            cur,
            modulo=data["modulo"] if "modulo" in data else current["modulo"],
            turno=data["turno"] if "turno" in data else current["turno"],
            lote=data["lote"] if "lote" in data else current["lote"],
            fundo_id=fundo_id,
        )
        if fundo_id and snap_l["fundo_lote_id"] != fundo_id:
            raise HTTPException(status_code=400, detail="El lote no pertenece al fundo de la sesión")
        data.update(
            {
                "modulo_id": snap_l["modulo_id"],
                "modulo": snap_l["modulo"],
                "turno_id": snap_l["turno_id"],
                "turno": snap_l["turno"],
                "lote_id": snap_l["lote_id"],
                "lote": snap_l["lote"],
            }
        )
        if not fundo_id:
            data["fundo_id"] = snap_l["fundo_lote_id"]
            data["fundo"] = snap_l["fundo_lote"]

    if data.get("placa"):
        data.update(resolve_vehiculo_placa(cur, data["placa"]))
    elif "vehiculo_id" in data and data["vehiculo_id"] is not None:
        data.update(snapshot_vehiculo(cur, data["vehiculo_id"]))

    if "tipo_producto" in data and data["tipo_producto"]:
        data["tipo_producto"] = data["tipo_producto"].upper()
    if "envase_principal" in data and data["envase_principal"]:
        data["envase_principal"] = data["envase_principal"].upper()

    if any(k in data for k in _CAMPOS_CONTEO):
        data.update(
            _totales(
                data.get("jabas_completas", current["jabas_completas"]),
                data.get("jabas_incompletas", current["jabas_incompletas"]),
                data.get("jarras_jabas", current["jarras_jabas"]),
                data.get("jarras_extras", current["jarras_extras"]),
            )
        )

    if data.get("estado") == "anulado":
        _assert_se_puede_anular(cur, current)

    nueva_fecha = data.get("fecha", current["fecha"])
    nuevo_lote_id = data.get("lote_id", current["lote_id"])
    nueva_ha = Decimal(str(data.get("ha", current["ha"])))
    nuevo_estado = (data.get("estado", current.get("estado")) or "").lower()

    saldo = None
    if nuevo_estado != "anulado" and any(
        k in data for k in ("ha", "fecha", "estado", "lote_id", *_CAMPOS_LOTE, *_CAMPOS_SESION)
    ):
        saldo = saldo_ha_lote(
            cur, nuevo_lote_id, nueva_fecha, bloquear=True, excluir_guia_id=item_id
        )
        if nueva_ha > saldo["ha_saldo"]:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Las ha ({nueva_ha}) superan el saldo del lote {saldo['lote']} "
                    f"para el {nueva_fecha}: quedan {saldo['ha_saldo']} de {saldo['area_ha']} ha"
                ),
            )

    row = update_row(cur, "guia_ingreso", "id", item_id, data)
    out = serialize_guia(row)
    if saldo is not None:
        out["ha_saldo"] = saldo["ha_saldo"] - nueva_ha
    return out


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


def registrar_llegada(cur, item_id: int, *, jarras_llegaron: int, jabas_llegaron: int) -> dict:
    guia = get_row_for_update(cur, "guia_ingreso", "id", item_id)
    if (guia.get("estado") or "").lower() == "anulado":
        raise HTTPException(status_code=400, detail="La guía está anulada")
    cur.execute(
        """
        UPDATE guia_ingreso
        SET jarras_llegaron = %s, jabas_llegaron = %s, updated_at = now()
        WHERE id = %s
        RETURNING *
        """,
        (jarras_llegaron, jabas_llegaron, item_id),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="No se pudo registrar la llegada")
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



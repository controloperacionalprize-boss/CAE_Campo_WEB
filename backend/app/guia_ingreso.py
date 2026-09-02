from datetime import date, datetime

from fastapi import HTTPException

from . import schemas as S
from .crud import get_row, insert_row, list_rows, update_row


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
        rows, _ = list_rows(cur, "grupo", filters=filtros, skip=0, limit=50, order="id")
        if not rows and "fundo_id" in filtros:
            rows, _ = list_rows(cur, "grupo", filters={"activo": True}, skip=0, limit=50, order="id")
        grupo = _uno_por_campo(rows, "nombre", payload.grupo, "El grupo indicado no existe")

    if payload.fundo_id is not None:
        fundo = get_row(cur, "fundo", "id", payload.fundo_id)
    elif payload.fundo:
        rows, _ = list_rows(cur, "fundo", filters={"activo": True}, skip=0, limit=50, order="id")
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
    )
    wanted = _norm(lote)
    return [r for r in lotes if _norm(r.get("codigo")) == wanted]


def resolve_lote_movil(cur, *, modulo: str, turno: str, lote: str, fundo_id: int | None) -> dict:
    filtros_mod: dict = {"codigo": modulo.strip().upper(), "activo": True}
    if fundo_id is not None:
        filtros_mod["fundo_id"] = fundo_id
    modulos, _ = list_rows(cur, "modulo", filters=filtros_mod, skip=0, limit=50, order="id")
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
    rows, _ = list_rows(cur, "vehiculo", filters={"placa": wanted, "activo": True}, skip=0, limit=5, order="id")
    if not rows:
        rows, _ = list_rows(cur, "vehiculo", filters={"placa": wanted}, skip=0, limit=5, order="id")
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

    row = update_row(cur, "guia_ingreso", "id", item_id, data)
    return serialize_guia(row)


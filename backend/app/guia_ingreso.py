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
    grupo_id = usuario.get("grupo_id")
    grupo_nombre = ""
    fundo_id = None
    fundo_nombre = ""
    if grupo_id:
        grupo = get_row(cur, "grupo", "id", grupo_id)
        grupo_nombre = grupo["nombre"] or ""
        fundo_id = grupo.get("fundo_id")
        if fundo_id:
            fundo = get_row(cur, "fundo", "id", fundo_id)
            fundo_nombre = fundo["nombre"] or ""
    return {
        "usuario_id": usuario["id"],
        "usuario_dni": usuario["dni"],
        "usuario_nombre": usuario["nombre"],
        "grupo_id": grupo_id,
        "grupo": grupo_nombre,
        "fundo_id": fundo_id,
        "fundo": fundo_nombre,
    }


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


def _uno_por_codigo(rows: list, codigo: str, mensaje: str) -> dict:
    wanted = codigo.strip().upper()
    match = [r for r in rows if str(r.get("codigo") or "").strip().upper() == wanted]
    if not match:
        raise HTTPException(status_code=400, detail=mensaje)
    if len(match) > 1:
        raise HTTPException(status_code=400, detail=f"{mensaje} (hay más de un registro con ese código)")
    return dict(match[0])


def resolve_lote_movil(cur, *, modulo: str, turno: str, lote: str, fundo_id: int | None) -> dict:
    filtros_mod: dict = {"codigo": modulo.strip().upper(), "activo": True}
    if fundo_id is not None:
        filtros_mod["fundo_id"] = fundo_id
    modulos, _ = list_rows(cur, "modulo", filters=filtros_mod, skip=0, limit=20, order="id")
    if not modulos and fundo_id is not None:
        modulos, _ = list_rows(
            cur,
            "modulo",
            filters={"codigo": modulo.strip().upper(), "activo": True},
            skip=0,
            limit=20,
            order="id",
        )
    mod = _uno_por_codigo(modulos, modulo, "El módulo indicado no existe")
    turnos, _ = list_rows(
        cur,
        "turno",
        filters={"modulo_id": mod["id"], "codigo": turno.strip().upper(), "activo": True},
        skip=0,
        limit=20,
        order="id",
    )
    tur = _uno_por_codigo(turnos, turno, "El turno indicado no existe en ese módulo")
    lotes, _ = list_rows(
        cur,
        "lote",
        filters={"turno_id": tur["id"], "codigo": lote.strip().upper(), "activo": True},
        skip=0,
        limit=20,
        order="id",
    )
    if not lotes:
        lotes, _ = list_rows(
            cur,
            "lote",
            filters={"turno_id": tur["id"], "activo": True},
            skip=0,
            limit=500,
            order="codigo",
        )
        lotes = [r for r in lotes if str(r.get("codigo") or "").strip().upper() == lote.strip().upper()]
    lot = _uno_por_codigo(lotes, lote, "El lote indicado no existe en ese turno")
    return snapshot_lote(cur, lot["id"])


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
    snap_u = snapshot_usuario(cur, usuario)
    snap_l = resolve_lote_movil(
        cur,
        modulo=payload.modulo,
        turno=payload.turno,
        lote=payload.lote,
        fundo_id=snap_u.get("fundo_id"),
    )
    snap_v = resolve_vehiculo_placa(cur, payload.placa)

    fundo_id = snap_u["fundo_id"] or snap_l["fundo_lote_id"]
    fundo = snap_u["fundo"] or snap_l["fundo_lote"]

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


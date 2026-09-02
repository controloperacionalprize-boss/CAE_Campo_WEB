from datetime import date

from fastapi import HTTPException

from . import schemas as S
from .crud import get_row, get_row_for_update, insert_row, list_rows, update_row


def _require_activo(row: dict, mensaje: str) -> None:
    if row.get("activo") is False:
        raise HTTPException(status_code=400, detail=mensaje)


def serialize_viaje(row: dict) -> dict:
    return S.ViajeOut.model_validate(row).model_dump(mode="json")


def serialize_detalle(row: dict) -> dict:
    return S.ViajeDetalleOut.model_validate(row).model_dump(mode="json")


def _nest_pallets(rows: list[dict]) -> list[dict]:
    by_id = {r["id"]: {**r, "continuaciones": []} for r in rows}
    roots: list[dict] = []
    for r in rows:
        node = by_id[r["id"]]
        padre_id = r.get("pallet_padre_id")
        if r.get("es_continuacion") and padre_id and padre_id in by_id:
            by_id[padre_id]["continuaciones"].append(node)
        else:
            roots.append(node)
    for node in by_id.values():
        node["continuaciones"].sort(key=lambda x: (x.get("orden") or 0, x["id"]))
    roots.sort(key=lambda x: (x.get("orden") or 0, x["id"]))
    return roots


def serialize_croquis(croquis: dict, pallets: list[dict]) -> dict:
    nested = _nest_pallets([dict(p) for p in pallets])
    return S.CroquisOut.model_validate({**croquis, "pallets": nested}).model_dump(mode="json")


def serialize_grr(grr: dict, detalle: list[dict]) -> dict:
    return S.GrrOut.model_validate({**grr, "detalle_carga": detalle}).model_dump(mode="json")


def get_viaje(cur, viaje_id: int) -> dict:
    return get_row(cur, "viaje", "id", viaje_id)


def require_en_proceso(viaje: dict) -> None:
    if viaje.get("estado") != "en_proceso":
        raise HTTPException(
            status_code=400,
            detail="Solo se puede modificar un viaje en proceso",
        )


def _next_monthly_code(cur, table: str, column: str, tag: str) -> str:
    if table not in {"viaje", "grr"} or column not in {"codigo", "numero"}:
        raise ValueError("Generación de código no permitida")
    prefix = f"{tag}-{date.today():%Y-%m}-"
    cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (f"{table}:{prefix}",))
    cur.execute(
        f"SELECT {column} AS code FROM {table} WHERE {column} LIKE %s ORDER BY {column} DESC LIMIT 1",
        (f"{prefix}%",),
    )
    row = cur.fetchone()
    seq = 1
    if row and row["code"]:
        tail = str(row["code"]).rsplit("-", 1)[-1]
        try:
            seq = int(tail) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:04d}"


def _load_detalles(cur, viaje_id: int) -> list[dict]:
    rows, _ = list_rows(
        cur,
        "viaje_detalle",
        filters={"viaje_id": viaje_id},
        skip=0,
        limit=1000,
        order="id",
        with_count=False,
    )
    return [dict(r) for r in rows]


def _load_croquis(cur, viaje_id: int) -> dict | None:
    rows, _ = list_rows(
        cur,
        "croquis",
        filters={"viaje_id": viaje_id},
        skip=0,
        limit=1,
        order="id",
        with_count=False,
    )
    if not rows:
        return None
    croquis = dict(rows[0])
    pallets, _ = list_rows(
        cur,
        "croquis_pallet",
        filters={"croquis_id": croquis["id"]},
        skip=0,
        limit=1000,
        order="orden",
        with_count=False,
    )
    return serialize_croquis(croquis, [dict(p) for p in pallets])


def _load_grr(cur, viaje_id: int) -> dict | None:
    rows, _ = list_rows(
        cur,
        "grr",
        filters={"viaje_id": viaje_id},
        skip=0,
        limit=1,
        order="id",
        with_count=False,
    )
    if not rows:
        return None
    grr = dict(rows[0])
    detalle, _ = list_rows(
        cur,
        "grr_detalle",
        filters={"grr_id": grr["id"]},
        skip=0,
        limit=1000,
        order="orden",
        with_count=False,
    )
    return serialize_grr(grr, [dict(d) for d in detalle])


def crear_viaje(cur, payload: S.ViajeIn) -> dict:
    usuario = get_row(cur, "usuario", "id", payload.usuario_id)
    _require_activo(usuario, "El usuario indicado está inactivo")

    conductor_id = None
    conductor_nombre = ""
    if payload.conductor_id is not None:
        chofer = get_row(cur, "chofer", "id", payload.conductor_id)
        _require_activo(chofer, "El chofer indicado está inactivo")
        conductor_id = chofer["id"]
        conductor_nombre = chofer["nombre"] or ""

    vehiculo_id = None
    placa = payload.placa or ""
    if payload.vehiculo_id is not None:
        vehiculo = get_row(cur, "vehiculo", "id", payload.vehiculo_id)
        _require_activo(vehiculo, "El vehículo indicado está inactivo")
        vehiculo_id = vehiculo["id"]
        if not placa:
            placa = (vehiculo["placa"] or "").strip().upper()

    row = insert_row(
        cur,
        "viaje",
        {
            "codigo": _next_monthly_code(cur, "viaje", "codigo", "VJ"),
            "tipo_viaje": payload.tipo_viaje,
            "conductor_id": conductor_id,
            "conductor_nombre": conductor_nombre,
            "vehiculo_id": vehiculo_id,
            "placa": placa,
            "kia_origen": payload.kia_origen,
            "kia_destino": payload.kia_destino,
            "observacion": payload.observacion or "",
            "estado": "en_proceso",
            "usuario_id": usuario["id"],
            "fecha": date.today(),
        },
        "id",
    )
    return serialize_viaje(row)


def listar_viajes(
    cur,
    *,
    usuario_id: int | None,
    fecha: date | None,
    estado: str | None,
    tipo_viaje: str | None,
    q: str | None,
    skip: int,
    limit: int,
) -> tuple[list[dict], int]:
    rows, total = list_rows(
        cur,
        "viaje",
        filters={
            "usuario_id": usuario_id,
            "fecha": fecha,
            "estado": estado,
            "tipo_viaje": tipo_viaje,
        },
        q=q,
        skip=skip,
        limit=limit,
        order="fecha",
        descending=True,
    )
    return [serialize_viaje(r) for r in rows], total


def detalle_viaje(cur, viaje_id: int) -> dict:
    viaje = get_viaje(cur, viaje_id)
    return S.ViajeCompletoOut.model_validate(
        {
            **viaje,
            "detalle": _load_detalles(cur, viaje_id),
            "croquis": _load_croquis(cur, viaje_id),
            "grr": _load_grr(cur, viaje_id),
        }
    ).model_dump(mode="json")


def parchear_viaje(cur, viaje_id: int, payload: S.ViajePatch) -> dict:
    viaje = get_viaje(cur, viaje_id)
    actual = (viaje.get("estado") or "").lower()
    destino = payload.estado
    if destino == actual:
        return serialize_viaje(viaje)
    if destino == "recepcionado":
        raise HTTPException(
            status_code=400,
            detail="El viaje solo se marca recepcionado al escanear la GRR en planta",
        )
    if actual != "en_proceso":
        raise HTTPException(
            status_code=400,
            detail="Solo se puede cambiar el estado de un viaje en proceso",
        )
    if destino == "finalizado":
        if not _load_detalles(cur, viaje_id):
            raise HTTPException(
                status_code=400,
                detail="No se puede finalizar un viaje sin guías de ingreso",
            )
        if _load_croquis(cur, viaje_id) is None:
            raise HTTPException(
                status_code=400,
                detail="No se puede finalizar un viaje sin croquis",
            )
        if _load_grr(cur, viaje_id) is None:
            raise HTTPException(
                status_code=400,
                detail="No se puede finalizar un viaje sin GRR",
            )
    elif destino != "anulado":
        raise HTTPException(
            status_code=400,
            detail="El estado del viaje debe ser en_proceso, finalizado, recepcionado o anulado",
        )
    row = update_row(cur, "viaje", "id", viaje_id, {"estado": destino})
    return serialize_viaje(row)


def _ids_unicos(ids: list[int]) -> list[int]:
    seen: set[int] = set()
    out: list[int] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


def agregar_detalle(cur, viaje_id: int, payload: S.ViajeDetalleIn) -> list[dict]:
    viaje = get_viaje(cur, viaje_id)
    require_en_proceso(viaje)
    ids = sorted(_ids_unicos(payload.guia_ingreso_ids))
    if not ids:
        raise HTTPException(status_code=400, detail="Indique al menos una guía de ingreso")

    creados: list[dict] = []
    for guia_id in ids:
        guia = get_row_for_update(cur, "guia_ingreso", "id", guia_id)
        codigo = guia.get("codigo") or guia_id
        if (guia.get("estado") or "").lower() == "anulado":
            raise HTTPException(
                status_code=400,
                detail=f"La guía {codigo} está anulada",
            )
        if not guia.get("recepcionado_acopio"):
            raise HTTPException(
                status_code=400,
                detail=f"La guía {codigo} no ha sido recepcionada en acopio",
            )
        if guia.get("recepcionado_planta"):
            raise HTTPException(
                status_code=409,
                detail=f"La guía {codigo} ya fue registrada en planta",
            )
        cur.execute(
            """
            SELECT v.id AS viaje_id, v.codigo, v.estado
            FROM viaje_detalle vd
            JOIN viaje v ON v.id = vd.viaje_id
            WHERE vd.guia_ingreso_id = %s AND v.estado <> 'anulado'
            LIMIT 1
            """,
            (guia_id,),
        )
        ocupada = cur.fetchone()
        if ocupada:
            if ocupada["viaje_id"] == viaje_id:
                raise HTTPException(
                    status_code=409,
                    detail=f"La guía {codigo} ya está en este viaje",
                )
            raise HTTPException(
                status_code=409,
                detail=f"La guía {codigo} ya está en el viaje activo {ocupada['codigo']}",
            )
        row = insert_row(
            cur,
            "viaje_detalle",
            {
                "viaje_id": viaje_id,
                "guia_ingreso_id": guia["id"],
                "modulo": guia.get("modulo") or "",
                "turno": guia.get("turno") or "",
                "lote": guia.get("lote") or "",
                "jabas_completas": guia.get("jabas_completas") or 0,
                "jabas_incompletas": guia.get("jabas_incompletas") or 0,
                "jarras": guia.get("jarras_totales") or 0,
            },
            "id",
        )
        creados.append(serialize_detalle(row))
    return creados


def listar_detalle(cur, viaje_id: int) -> dict:
    get_viaje(cur, viaje_id)
    items = _load_detalles(cur, viaje_id)
    total_jarras = sum(int(r.get("jarras") or 0) for r in items)
    total_jabas = sum(
        int(r.get("jabas_completas") or 0) + int(r.get("jabas_incompletas") or 0) for r in items
    )
    return {
        "items": [serialize_detalle(r) for r in items],
        "total_jarras": total_jarras,
        "total_jabas": total_jabas,
        "total_qrs": len(items),
    }


def quitar_detalle(cur, viaje_id: int, detalle_id: int) -> dict:
    viaje = get_viaje(cur, viaje_id)
    require_en_proceso(viaje)
    cur.execute(
        "DELETE FROM viaje_detalle WHERE id = %s AND viaje_id = %s RETURNING *",
        (detalle_id, viaje_id),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No se encontró el detalle del viaje")
    return serialize_detalle(dict(row))


def crear_croquis(cur, viaje_id: int, payload: S.CroquisIn) -> dict:
    viaje = get_viaje(cur, viaje_id)
    require_en_proceso(viaje)
    if _load_croquis(cur, viaje_id) is not None:
        raise HTTPException(status_code=409, detail="El viaje ya tiene un croquis")

    total_jarras = 0
    total_jabas = 0
    for pallet in payload.pallets:
        total_jarras += pallet.jarras
        total_jabas += pallet.jabas
        for cont in pallet.continuaciones:
            total_jarras += cont.jarras
            total_jabas += cont.jabas

    croquis = insert_row(
        cur,
        "croquis",
        {
            "viaje_id": viaje_id,
            "fecha": payload.fecha,
            "placa": payload.placa or viaje.get("placa") or "",
            "punto_partida": payload.punto_partida,
            "punto_llegada": payload.punto_llegada,
            "motivo_traslado": payload.motivo_traslado or "Traslado de fruta",
            "hora_salida": payload.hora_salida,
            "total_jarras": total_jarras,
            "total_jabas": total_jabas,
            "total_pallets": len(payload.pallets),
            "temperatura": payload.temperatura,
        },
        "id",
    )

    for pallet in payload.pallets:
        padre = insert_row(
            cur,
            "croquis_pallet",
            {
                "croquis_id": croquis["id"],
                "nombre": pallet.nombre,
                "orden": pallet.orden,
                "modulo": pallet.modulo,
                "turno": pallet.turno,
                "variedad": pallet.variedad or "",
                "jarras": pallet.jarras,
                "jabas": pallet.jabas,
                "es_continuacion": False,
                "pallet_padre_id": None,
            },
            "id",
        )
        for cont in pallet.continuaciones:
            insert_row(
                cur,
                "croquis_pallet",
                {
                    "croquis_id": croquis["id"],
                    "nombre": pallet.nombre,
                    "orden": pallet.orden,
                    "modulo": cont.modulo,
                    "turno": cont.turno,
                    "variedad": cont.variedad or "",
                    "jarras": cont.jarras,
                    "jabas": cont.jabas,
                    "es_continuacion": True,
                    "pallet_padre_id": padre["id"],
                },
                "id",
            )

    loaded = _load_croquis(cur, viaje_id)
    if loaded is None:
        raise HTTPException(status_code=500, detail="No se pudo leer el croquis recién creado")
    return loaded


def obtener_croquis(cur, viaje_id: int) -> dict:
    get_viaje(cur, viaje_id)
    croquis = _load_croquis(cur, viaje_id)
    if croquis is None:
        raise HTTPException(status_code=404, detail="No se encontró el croquis")
    return croquis


def _pallets_en_orden(cur, croquis_id: int) -> list[dict]:
    pallets, _ = list_rows(
        cur,
        "croquis_pallet",
        filters={"croquis_id": croquis_id},
        skip=0,
        limit=1000,
        order="orden",
        with_count=False,
    )
    nested = _nest_pallets([dict(p) for p in pallets])
    ordered: list[dict] = []
    for padre in nested:
        conts = padre.pop("continuaciones", [])
        ordered.append(padre)
        ordered.extend(conts)
    return ordered


def crear_grr(cur, viaje_id: int) -> dict:
    viaje = get_viaje(cur, viaje_id)
    require_en_proceso(viaje)
    croquis = _load_croquis(cur, viaje_id)
    if croquis is None:
        raise HTTPException(status_code=400, detail="No se puede generar la GRR sin croquis")
    if _load_grr(cur, viaje_id) is not None:
        raise HTTPException(status_code=409, detail="El viaje ya tiene una GRR")

    lineas = _pallets_en_orden(cur, croquis["id"])
    total_jarras = sum(int(p.get("jarras") or 0) for p in lineas)
    total_jabas = sum(int(p.get("jabas") or 0) for p in lineas)

    grr = insert_row(
        cur,
        "grr",
        {
            "viaje_id": viaje_id,
            "numero": _next_monthly_code(cur, "grr", "numero", "GRR"),
            "fecha_emision": croquis["fecha"],
            "remitente": croquis["punto_partida"],
            "destinatario": croquis["punto_llegada"],
            "motivo_traslado": croquis["motivo_traslado"],
            "placa": croquis["placa"],
            "punto_partida": croquis["punto_partida"],
            "punto_llegada": croquis["punto_llegada"],
            "total_jarras": total_jarras,
            "total_jabas": total_jabas,
            "estado": "emitido",
        },
        "id",
    )

    for i, linea in enumerate(lineas, start=1):
        insert_row(
            cur,
            "grr_detalle",
            {
                "grr_id": grr["id"],
                "pallet": linea.get("nombre") or "",
                "modulo": linea.get("modulo") or "",
                "turno": linea.get("turno") or "",
                "variedad": linea.get("variedad") or "",
                "jarras": linea.get("jarras") or 0,
                "jabas": linea.get("jabas") or 0,
                "orden": i,
            },
            "id",
        )

    loaded = _load_grr(cur, viaje_id)
    if loaded is None:
        raise HTTPException(status_code=500, detail="No se pudo leer la GRR recién creada")
    return loaded


def obtener_grr(cur, viaje_id: int) -> dict:
    get_viaje(cur, viaje_id)
    grr = _load_grr(cur, viaje_id)
    if grr is None:
        raise HTTPException(status_code=404, detail="No se encontró la GRR")
    return grr


def recepcionar_grr(cur, viaje_id: int) -> dict:
    viaje = get_viaje(cur, viaje_id)
    estado = (viaje.get("estado") or "").lower()
    grr = _load_grr(cur, viaje_id)
    if grr is None:
        raise HTTPException(status_code=400, detail="El viaje no tiene GRR")
    if (grr.get("estado") or "").lower() == "anulado":
        raise HTTPException(status_code=400, detail="La GRR está anulada")
    if grr.get("recepcionado"):
        raise HTTPException(status_code=409, detail="La GRR ya fue recepcionada")
    if estado != "finalizado":
        raise HTTPException(
            status_code=400,
            detail="El viaje debe estar finalizado para recepcionar la GRR",
        )
    cur.execute(
        """
        UPDATE grr
        SET recepcionado = TRUE, recepcionado_at = now(), updated_at = now()
        WHERE viaje_id = %s AND recepcionado = FALSE AND estado <> 'anulado'
        RETURNING id
        """,
        (viaje_id,),
    )
    if not cur.fetchone():
        raise HTTPException(status_code=409, detail="La GRR ya fue recepcionada")
    cur.execute(
        """
        UPDATE viaje
        SET estado = 'recepcionado', updated_at = now()
        WHERE id = %s AND estado = 'finalizado'
        """,
        (viaje_id,),
    )
    if cur.rowcount == 0:
        raise HTTPException(
            status_code=400,
            detail="El viaje debe estar finalizado para recepcionar la GRR",
        )
    loaded = _load_grr(cur, viaje_id)
    if loaded is None:
        raise HTTPException(status_code=500, detail="No se pudo leer la GRR recién recepcionada")
    return loaded


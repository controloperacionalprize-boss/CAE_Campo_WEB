from fastapi import APIRouter, Query

from ..crud import get_row, list_rows
from ..db import get_conn

router = APIRouter(prefix="/api/v1", tags=["ubicaciones"])


@router.get("/arbol/ubicaciones")
def arbol_ubicaciones(activo: bool | None = Query(True), incluir_inactivos: bool = Query(False)):
    """Empresa → fundo → módulo → turno (sin lotes; hay cientos).

    `incluir_inactivos=true` trae todo en 1 sola llamada (evita que el
    cliente pida activo=true y luego activo=false por separado).
    """
    activo_filter = None if incluir_inactivos else activo
    filters = {"activo": activo_filter} if activo_filter is not None else {}
    with get_conn(write=False) as conn:
        cur = conn.cursor()
        empresas, _ = list_rows(cur, "empresa", filters=filters, skip=0, limit=500, order="razon_social", with_count=False)
        fundos, _ = list_rows(cur, "fundo", filters=filters, skip=0, limit=500, order="nombre", with_count=False)
        modulos, _ = list_rows(cur, "modulo", filters=filters, skip=0, limit=500, order="codigo", with_count=False)
        turnos, _ = list_rows(cur, "turno", filters=filters, skip=0, limit=500, order="codigo", with_count=False)

    turnos_by_mod: dict[int, list] = {}
    for t in turnos:
        turnos_by_mod.setdefault(t["modulo_id"], []).append(
            {"id": t["id"], "codigo": t["codigo"], "nombre": t["nombre"], "activo": t["activo"]}
        )
    mods_by_fundo: dict[int, list] = {}
    for m in modulos:
        mods_by_fundo.setdefault(m["fundo_id"], []).append(
            {
                "id": m["id"],
                "codigo": m["codigo"],
                "nombre": m["nombre"],
                "activo": m["activo"],
                "turnos": turnos_by_mod.get(m["id"], []),
            }
        )
    fundos_by_emp: dict[int, list] = {}
    for f in fundos:
        fundos_by_emp.setdefault(f["empresa_id"], []).append(
            {
                "id": f["id"],
                "nombre": f["nombre"],
                "domicilio": f["domicilio"],
                "activo": f["activo"],
                "modulos": mods_by_fundo.get(f["id"], []),
            }
        )
    return [
        {
            "id": e["id"],
            "ruc": e["ruc"],
            "razon_social": e["razon_social"],
            "activo": e["activo"],
            "fundos": fundos_by_emp.get(e["id"], []),
        }
        for e in empresas
    ]


@router.get("/fundos/{fundo_id}/detalle")
def fundo_detalle(fundo_id: int, incluir_inactivos: bool = Query(False)):
    """Módulos + turnos + lotes + grupos de un fundo en **una sola llamada** HTTP.

    Reemplaza el patrón N+1 (1 request por módulo, 1 por turno) que antes
    hacía el front al abrir el detalle de un fundo.
    """
    activo_filter = None if incluir_inactivos else True
    with get_conn(write=False) as conn:
        cur = conn.cursor()
        fundo = get_row(cur, "fundo", "id", fundo_id)
        empresa = get_row(cur, "empresa", "id", fundo["empresa_id"])

        modulos, _ = list_rows(
            cur,
            "modulo",
            filters={"fundo_id": fundo_id, "activo": activo_filter},
            skip=0,
            limit=500,
            order="codigo",
            with_count=False,
        )
        modulo_ids = [m["id"] for m in modulos]

        turnos, _ = list_rows(
            cur,
            "turno",
            filters={"modulo_id": modulo_ids, "activo": activo_filter},
            skip=0,
            limit=500,
            order="codigo",
            with_count=False,
        )
        turno_ids = [t["id"] for t in turnos]

        lotes, _ = list_rows(
            cur,
            "lote",
            filters={"turno_id": turno_ids, "activo": activo_filter},
            skip=0,
            limit=500,
            order="codigo",
            with_count=False,
        )

        grupos, _ = list_rows(
            cur,
            "grupo",
            filters={"fundo_id": fundo_id, "activo": activo_filter},
            skip=0,
            limit=500,
            order="nombre",
            with_count=False,
        )
    
    return {
        "fundo": fundo,
        "empresa": empresa,
        "modulos": modulos,
        "turnos": turnos,
        "lotes": lotes,
        "grupos": grupos,
    }

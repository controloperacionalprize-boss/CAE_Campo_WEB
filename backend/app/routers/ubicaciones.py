from fastapi import APIRouter, Query

from ..crud import list_rows
from ..db import get_conn

router = APIRouter(prefix="/api/v1", tags=["ubicaciones"])


@router.get("/arbol/ubicaciones")
def arbol_ubicaciones(activo: bool | None = Query(True)):
    """Empresa → fundo → módulo → turno (sin lotes; hay cientos)."""
    filters = {"activo": activo} if activo is not None else {}
    with get_conn(write=False) as conn:
        cur = conn.cursor()
        empresas, _ = list_rows(cur, "empresa", filters=filters, skip=0, limit=500, order="razon_social")
        fundos, _ = list_rows(cur, "fundo", filters=filters, skip=0, limit=500, order="nombre")
        modulos, _ = list_rows(cur, "modulo", filters=filters, skip=0, limit=500, order="codigo")
        turnos, _ = list_rows(cur, "turno", filters=filters, skip=0, limit=500, order="codigo")

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

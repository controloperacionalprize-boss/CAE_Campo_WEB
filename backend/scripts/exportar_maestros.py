"""Exporta los datos maestros actuales como SQL de carga para otra base.

Uso (desde backend/):  python -m scripts.exportar_maestros

Escribe sql/datos_maestros.sql. Los registros se enlazan por claves naturales
(RUC, nombre de fundo, código de módulo/turno/lote, placa, DNI), no por id,
así que sirve para una base nueva con ids distintos. Cada INSERT usa
ON CONFLICT DO NOTHING: ejecutarlo dos veces no duplica datos.
No incluye usuarios ni datos operativos (guías, viajes, GRR).
"""

from __future__ import annotations

from pathlib import Path

from app.db import get_conn

SALIDA = Path(__file__).resolve().parents[1] / "sql" / "datos_maestros.sql"


def _valores(cur, filas: list[tuple]) -> str:
    return ",\n    ".join(cur.mogrify("(" + ", ".join(["%s"] * len(f)) + ")", f).decode("utf-8") for f in filas)


def main() -> None:
    out: list[str] = [
        "-- ============================================================================",
        "-- Despacho Campo — datos maestros (carga inicial)",
        "--",
        "-- Requiere el esquema creado (esquema_completo.sql). Enlaza por claves naturales,",
        "-- no por id. Se puede ejecutar más de una vez: ON CONFLICT DO NOTHING.",
        "-- Generado desde la base actual con scripts/exportar_maestros.py.",
        "-- ============================================================================",
        "",
        "BEGIN;",
        "",
    ]
    conteo: dict[str, int] = {}

    with get_conn(write=False) as conn:
        cur = conn.cursor()

        def seccion(titulo: str, sql_select: str, plantilla, tabla: str) -> None:
            cur.execute(sql_select)
            filas = [tuple(r.values()) for r in cur.fetchall()]
            conteo[tabla] = len(filas)
            out.append(f"-- ---------- {titulo} ({len(filas)})")
            if filas:
                out.append(plantilla(_valores(cur, filas)))
            out.append("")

        seccion(
            "Actividades económicas",
            "SELECT codigo, descripcion FROM actividad_economica ORDER BY codigo",
            lambda v: f"INSERT INTO actividad_economica (codigo, descripcion)\nVALUES\n    {v}\nON CONFLICT (codigo) DO NOTHING;",
            "actividad_economica",
        )
        seccion(
            "Empresas",
            "SELECT ruc, razon_social, domicilio_fiscal, actividad_economica_codigo, activo FROM empresa ORDER BY ruc",
            lambda v: "INSERT INTO empresa (ruc, razon_social, domicilio_fiscal, actividad_economica_codigo, activo)\n"
            f"VALUES\n    {v}\nON CONFLICT (ruc) DO NOTHING;",
            "empresa",
        )
        seccion(
            "Fundos",
            """SELECT e.ruc, f.nombre, f.domicilio, f.activo
               FROM fundo f JOIN empresa e ON e.id = f.empresa_id ORDER BY e.ruc, f.nombre""",
            lambda v: "INSERT INTO fundo (empresa_id, nombre, domicilio, activo)\n"
            "SELECT e.id, v.nombre, v.domicilio, v.activo\n"
            f"FROM (VALUES\n    {v}\n) AS v(ruc, nombre, domicilio, activo)\n"
            "JOIN empresa e ON e.ruc = v.ruc\n"
            "ON CONFLICT (empresa_id, nombre) DO NOTHING;",
            "fundo",
        )
        seccion(
            "Módulos",
            """SELECT e.ruc, f.nombre AS fundo, m.codigo, m.nombre, m.activo
               FROM modulo m JOIN fundo f ON f.id = m.fundo_id JOIN empresa e ON e.id = f.empresa_id
               ORDER BY e.ruc, f.nombre, m.codigo""",
            lambda v: "INSERT INTO modulo (fundo_id, codigo, nombre, activo)\n"
            "SELECT f.id, v.codigo, v.nombre, v.activo\n"
            f"FROM (VALUES\n    {v}\n) AS v(ruc, fundo, codigo, nombre, activo)\n"
            "JOIN empresa e ON e.ruc = v.ruc\n"
            "JOIN fundo f ON f.empresa_id = e.id AND f.nombre = v.fundo\n"
            "ON CONFLICT (fundo_id, codigo) DO NOTHING;",
            "modulo",
        )
        seccion(
            "Turnos",
            """SELECT e.ruc, f.nombre AS fundo, m.codigo AS modulo, t.codigo, t.nombre, t.activo
               FROM turno t JOIN modulo m ON m.id = t.modulo_id JOIN fundo f ON f.id = m.fundo_id
               JOIN empresa e ON e.id = f.empresa_id
               ORDER BY e.ruc, f.nombre, m.codigo, t.codigo""",
            lambda v: "INSERT INTO turno (modulo_id, codigo, nombre, activo)\n"
            "SELECT m.id, v.codigo, v.nombre, v.activo\n"
            f"FROM (VALUES\n    {v}\n) AS v(ruc, fundo, modulo, codigo, nombre, activo)\n"
            "JOIN empresa e ON e.ruc = v.ruc\n"
            "JOIN fundo f ON f.empresa_id = e.id AND f.nombre = v.fundo\n"
            "JOIN modulo m ON m.fundo_id = f.id AND m.codigo = v.modulo\n"
            "ON CONFLICT (modulo_id, codigo) DO NOTHING;",
            "turno",
        )
        seccion(
            "Lotes",
            """SELECT e.ruc, f.nombre AS fundo, m.codigo AS modulo, t.codigo AS turno, l.codigo, l.area_ha, l.activo
               FROM lote l JOIN turno t ON t.id = l.turno_id JOIN modulo m ON m.id = t.modulo_id
               JOIN fundo f ON f.id = m.fundo_id JOIN empresa e ON e.id = f.empresa_id
               ORDER BY e.ruc, f.nombre, m.codigo, t.codigo, l.codigo""",
            lambda v: "INSERT INTO lote (turno_id, codigo, area_ha, activo)\n"
            "SELECT t.id, v.codigo, v.area_ha::numeric, v.activo\n"
            f"FROM (VALUES\n    {v}\n) AS v(ruc, fundo, modulo, turno, codigo, area_ha, activo)\n"
            "JOIN empresa e ON e.ruc = v.ruc\n"
            "JOIN fundo f ON f.empresa_id = e.id AND f.nombre = v.fundo\n"
            "JOIN modulo m ON m.fundo_id = f.id AND m.codigo = v.modulo\n"
            "JOIN turno t ON t.modulo_id = m.id AND t.codigo = v.turno\n"
            "ON CONFLICT (turno_id, codigo) DO NOTHING;",
            "lote",
        )
        seccion(
            "Proveedores de transporte",
            "SELECT nombre, activo FROM proveedor ORDER BY nombre",
            lambda v: f"INSERT INTO proveedor (nombre, activo)\nVALUES\n    {v}\nON CONFLICT (nombre) DO NOTHING;",
            "proveedor",
        )
        seccion(
            "Choferes",
            "SELECT dni, nombre, activo FROM chofer ORDER BY nombre",
            lambda v: f"INSERT INTO chofer (dni, nombre, activo)\nVALUES\n    {v}\nON CONFLICT (dni) DO NOTHING;",
            "chofer",
        )
        seccion(
            "Vehículos",
            """SELECT v.placa, p.nombre AS proveedor, c.dni AS chofer_dni, v.activo
               FROM vehiculo v JOIN proveedor p ON p.id = v.proveedor_id
               LEFT JOIN chofer c ON c.id = v.chofer_id ORDER BY v.placa""",
            lambda v: "INSERT INTO vehiculo (placa, proveedor_id, chofer_id, activo)\n"
            "SELECT v.placa, p.id, c.id, v.activo\n"
            f"FROM (VALUES\n    {v}\n) AS v(placa, proveedor, chofer_dni, activo)\n"
            "JOIN proveedor p ON p.nombre = v.proveedor\n"
            "LEFT JOIN chofer c ON c.dni = v.chofer_dni\n"
            "ON CONFLICT (placa) DO NOTHING;",
            "vehiculo",
        )
        seccion(
            "Cargos",
            "SELECT nombre, activo FROM cargo ORDER BY nombre",
            lambda v: f"INSERT INTO cargo (nombre, activo)\nVALUES\n    {v}\nON CONFLICT (nombre) DO NOTHING;",
            "cargo",
        )
        seccion(
            "Áreas",
            "SELECT prefijo, nombre, activo FROM areas ORDER BY prefijo",
            lambda v: f"INSERT INTO areas (prefijo, nombre, activo)\nVALUES\n    {v}\nON CONFLICT (prefijo) DO NOTHING;",
            "areas",
        )
        seccion(
            "Grupos de cosecha",
            """SELECT g.nombre, e.ruc, f.nombre AS fundo, g.activo
               FROM grupo g LEFT JOIN empresa e ON e.id = g.empresa_id LEFT JOIN fundo f ON f.id = g.fundo_id
               ORDER BY g.nombre""",
            lambda v: "INSERT INTO grupo (nombre, empresa_id, fundo_id, activo)\n"
            "SELECT v.nombre, e.id, f.id, v.activo\n"
            f"FROM (VALUES\n    {v}\n) AS v(nombre, ruc, fundo, activo)\n"
            "LEFT JOIN empresa e ON e.ruc = v.ruc\n"
            "LEFT JOIN fundo f ON f.empresa_id = e.id AND f.nombre = v.fundo\n"
            "ON CONFLICT (fundo_id, nombre) DO NOTHING;",
            "grupo",
        )

    out += [
        "COMMIT;",
        "",
        "-- Verificación rápida (debe coincidir con los totales de cada sección):",
        "-- SELECT 'empresa', count(*) FROM empresa UNION ALL SELECT 'fundo', count(*) FROM fundo",
        "-- UNION ALL SELECT 'modulo', count(*) FROM modulo UNION ALL SELECT 'turno', count(*) FROM turno",
        "-- UNION ALL SELECT 'lote', count(*) FROM lote UNION ALL SELECT 'proveedor', count(*) FROM proveedor",
        "-- UNION ALL SELECT 'vehiculo', count(*) FROM vehiculo;",
        "",
    ]
    SALIDA.write_text("\n".join(out), encoding="utf-8", newline="\n")
    print(SALIDA)
    for tabla, n in conteo.items():
        print(f"  {tabla:<22} {n}")


if __name__ == "__main__":
    main()

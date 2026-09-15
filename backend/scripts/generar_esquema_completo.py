"""Une todas las migraciones en un solo SQL listo para una base vacía.

Uso (desde backend/):  python -m scripts.generar_esquema_completo

Escribe sql/esquema_completo.sql: esquema + índices + roles base + registro en
schema_migrations (con los mismos checksums que usa migrate.py), de modo que
`python migrate.py` sobre esa base no vuelva a aplicar nada.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
MIGRACIONES = RAIZ / "sql" / "migrations"
SALIDA = RAIZ / "sql" / "esquema_completo.sql"

ROLES = ["ADMINISTRADOR", "SUPERVISOR", "OPERARIO", "AUXILIAR DE ACOPIO"]


def main() -> None:
    archivos = sorted(MIGRACIONES.glob("[0-9][0-9][0-9][0-9]_*.sql"))
    partes = [
        "-- ============================================================================",
        "-- Despacho Campo — esquema completo de base de datos (PostgreSQL 15+)",
        "--",
        "-- Para una base VACÍA. Crea las 21 tablas del sistema con sus restricciones,",
        "-- llaves foráneas, índices, funciones y triggers (auditoría: la data operativa",
        "-- no se borra; tiempo real: pg_notify 'despacho_eventos'), los roles base y el",
        "-- registro de migraciones.",
        "--",
        "-- Ejecutar con psql:   psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -f esquema_completo.sql",
        "-- o pegar completo en el SQL Editor de Neon.",
        "--",
        "-- Generado desde sql/migrations con scripts/generar_esquema_completo.py.",
        "-- No editar a mano: los cambios de esquema van como nueva migración.",
        "-- ============================================================================",
        "",
        "BEGIN;",
        "",
    ]
    registros = []
    for archivo in archivos:
        sql = archivo.read_text(encoding="utf-8")
        checksum = hashlib.sha256(sql.encode("utf-8")).hexdigest()
        registros.append((archivo.name, checksum))
        partes += [
            "-- ############################################################################",
            f"-- Migración {archivo.name}",
            "-- ############################################################################",
            sql.strip(),
            "",
        ]

    partes += [
        "-- ############################################################################",
        "-- Datos base: roles que usan los permisos de la web (app/permisos.py) y el móvil",
        "-- ############################################################################",
        "INSERT INTO rol (nombre)",
        "VALUES " + ",\n       ".join(f"('{r}')" for r in ROLES),
        "ON CONFLICT (nombre) DO NOTHING;",
        "",
        "-- ############################################################################",
        "-- Registro de migraciones (mismo formato que backend/migrate.py)",
        "-- ############################################################################",
        "CREATE TABLE IF NOT EXISTS schema_migrations (",
        "    version TEXT PRIMARY KEY,",
        "    checksum TEXT NOT NULL,",
        "    aplicado_at TIMESTAMPTZ NOT NULL DEFAULT now()",
        ");",
        "INSERT INTO schema_migrations (version, checksum)",
        "VALUES " + ",\n       ".join(f"('{v}', '{c}')" for v, c in registros),
        "ON CONFLICT (version) DO NOTHING;",
        "",
        "COMMIT;",
        "",
        "-- ============================================================================",
        "-- Primer administrador (ejecutar aparte, reemplazando DNI y nombre).",
        "-- Su contraseña inicial en la web es el mismo DNI; se le pedirá cambiarla.",
        "-- ============================================================================",
        "-- INSERT INTO usuario (dni, nombre, rol_id, activo)",
        "-- SELECT '00000000', 'NOMBRE DEL ADMINISTRADOR', id, TRUE FROM rol WHERE nombre = 'ADMINISTRADOR';",
        "",
    ]
    SALIDA.write_text("\n".join(partes), encoding="utf-8", newline="\n")
    print(f"{SALIDA} ({len(registros)} migraciones)")


if __name__ == "__main__":
    main()

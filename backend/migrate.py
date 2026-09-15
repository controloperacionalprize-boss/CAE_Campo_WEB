"""Aplica las migraciones de sql/migrations en orden, una sola vez cada una.

Uso (desde backend/):
    python migrate.py            aplica las pendientes
    python migrate.py --estado   lista aplicadas y pendientes

Cada archivo NNNN_descripcion.sql corre en su propia transacción y queda
registrado en la tabla schema_migrations. En una base que ya tiene el esquema
(creado antes de adoptar migraciones) la 0001 se registra sin ejecutarse.
En Render corre como preDeployCommand: si una migración falla, no se despliega.
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import psycopg2

from app.config import get_settings
from app.db import _harden_dsn

CARPETA = Path(__file__).resolve().parent / "sql" / "migrations"
BASE = "0001_esquema_base.sql"


def _conectar():
    return psycopg2.connect(_harden_dsn(get_settings().database_url), connect_timeout=15)


def _archivos() -> list[Path]:
    return sorted(p for p in CARPETA.glob("[0-9][0-9][0-9][0-9]_*.sql"))


def main() -> int:
    solo_estado = "--estado" in sys.argv
    conn = _conectar()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                checksum TEXT NOT NULL,
                aplicado_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        conn.commit()
        cur.execute("SELECT version, checksum FROM schema_migrations")
        aplicadas = dict(cur.fetchall())

        cur.execute("SELECT to_regclass('public.usuario') IS NOT NULL")
        esquema_existente = cur.fetchone()[0]

        pendientes = 0
        for archivo in _archivos():
            sql = archivo.read_text(encoding="utf-8")
            checksum = hashlib.sha256(sql.encode("utf-8")).hexdigest()
            version = archivo.name
            if version in aplicadas:
                marca = "aplicada" if aplicadas[version] == checksum else "aplicada (¡el archivo cambió después!)"
                print(f"  {marca:<40} {version}")
                continue
            pendientes += 1
            if solo_estado:
                print(f"  {'pendiente':<40} {version}")
                continue
            if version == BASE and esquema_existente:
                cur.execute(
                    "INSERT INTO schema_migrations (version, checksum) VALUES (%s, %s)", (version, checksum)
                )
                conn.commit()
                print(f"  {'registrada (esquema ya existía)':<40} {version}")
                continue
            try:
                cur.execute(sql)
                cur.execute(
                    "INSERT INTO schema_migrations (version, checksum) VALUES (%s, %s)", (version, checksum)
                )
                conn.commit()
                print(f"  {'aplicada ahora':<40} {version}")
            except psycopg2.Error as exc:
                conn.rollback()
                print(f"ERROR en {version}: {exc}", file=sys.stderr)
                return 1
        if solo_estado:
            print(f"{pendientes} pendiente(s)")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())

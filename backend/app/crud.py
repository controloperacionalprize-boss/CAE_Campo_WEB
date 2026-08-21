from typing import Any

from fastapi import HTTPException
from psycopg2 import IntegrityError, errorcodes
from psycopg2.errors import ForeignKeyViolation, UniqueViolation

ALLOWED_TABLES = {
    "actividad_economica",
    "cargo",
    "chofer",
    "empresa",
    "fundo",
    "grupo",
    "lote",
    "modulo",
    "proveedor",
    "rol",
    "turno",
    "usuario",
    "vehiculo",
}

ALLOWED_COLUMNS = {
    "actividad_economica": {
        "codigo",
        "descripcion",
        "created_at",
        "updated_at",
    },
    "cargo": {"id", "nombre", "activo", "created_at", "updated_at"},
    "chofer": {"id", "dni", "nombre", "activo", "created_at", "updated_at"},
    "empresa": {
        "id",
        "ruc",
        "razon_social",
        "domicilio_fiscal",
        "actividad_economica_codigo",
        "activo",
        "created_at",
        "updated_at",
    },
    "fundo": {
        "id",
        "empresa_id",
        "nombre",
        "domicilio",
        "activo",
        "created_at",
        "updated_at",
    },
    "grupo": {
        "id",
        "nombre",
        "activo",
        "empresa_id",
        "fundo_id",
        "created_at",
        "updated_at",
    },
    "lote": {
        "id",
        "turno_id",
        "codigo",
        "area_ha",
        "activo",
        "created_at",
        "updated_at",
    },
    "modulo": {
        "id",
        "fundo_id",
        "codigo",
        "nombre",
        "activo",
        "created_at",
        "updated_at",
    },
    "proveedor": {"id", "nombre", "activo", "created_at", "updated_at"},
    "rol": {"id", "nombre", "activo", "created_at", "updated_at"},
    "turno": {
        "id",
        "modulo_id",
        "codigo",
        "nombre",
        "activo",
        "created_at",
        "updated_at",
    },
    "usuario": {
        "id",
        "dni",
        "nombre",
        "cargo_id",
        "activo",
        "rol_id",
        "grupo_id",
        "created_at",
        "updated_at",
    },
    "vehiculo": {
        "id",
        "placa",
        "proveedor_id",
        "chofer_id",
        "activo",
        "created_at",
        "updated_at",
    },
}

SEARCH_COLUMNS = {
    "actividad_economica": ("codigo", "descripcion"),
    "cargo": ("nombre",),
    "chofer": ("dni", "nombre"),
    "empresa": ("ruc", "razon_social"),
    "fundo": ("nombre",),
    "grupo": ("nombre",),
    "lote": ("codigo",),
    "modulo": ("codigo", "nombre"),
    "proveedor": ("nombre",),
    "rol": ("nombre",),
    "turno": ("codigo", "nombre"),
    "usuario": ("dni", "nombre"),
    "vehiculo": ("placa",),
}


def _check_table(table: str) -> None:
    if table not in ALLOWED_TABLES:
        raise ValueError(f"Tabla no permitida: {table}")


def _check_columns(table: str, columns: list[str]) -> None:
    allowed = ALLOWED_COLUMNS[table]
    bad = [c for c in columns if c not in allowed]
    if bad:
        raise ValueError(f"Columnas no permitidas en {table}: {bad}")


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _raise_db(exc: Exception) -> None:
    code = getattr(exc, "pgcode", None)
    if isinstance(exc, UniqueViolation) or code == errorcodes.UNIQUE_VIOLATION:
        raise HTTPException(status_code=409, detail="Ya existe un registro con esos datos únicos") from None
    if isinstance(exc, ForeignKeyViolation) or code == errorcodes.FOREIGN_KEY_VIOLATION:
        raise HTTPException(status_code=409, detail="Referencia inválida o el registro está en uso") from None
    if isinstance(exc, IntegrityError):
        raise HTTPException(status_code=409, detail="No se pudo guardar el registro") from None
    raise HTTPException(status_code=500, detail="Error interno") from None


def list_rows(
    cur,
    table: str,
    *,
    filters: dict[str, Any] | None = None,
    q: str | None = None,
    skip: int = 0,
    limit: int = 100,
    order: str = "id",
) -> tuple[list[dict], int]:
    _check_table(table)
    cols = sorted(ALLOWED_COLUMNS[table])
    if order not in ALLOWED_COLUMNS[table]:
        order = "id" if "id" in ALLOWED_COLUMNS[table] else "codigo"

    where: list[str] = []
    params: list[Any] = []
    for key, value in (filters or {}).items():
        if value is None or key not in ALLOWED_COLUMNS[table]:
            continue
        if isinstance(value, (list, tuple, set)):
            values = list(value)
            if not values:
                where.append("1 = 0")
                continue
            where.append(f"{key} = ANY(%s)")
            params.append(values)
        else:
            where.append(f"{key} = %s")
            params.append(value)

    if q and q.strip():
        like_cols = SEARCH_COLUMNS.get(table, ())
        if like_cols:
            _check_columns(table, list(like_cols))
            pattern = f"%{_escape_like(q.strip()[:80])}%"
            where.append(
                "("
                + " OR ".join(f"{c} ILIKE %s ESCAPE '\\\\'" for c in like_cols)
                + ")"
            )
            params.extend([pattern] * len(like_cols))

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    select_sql = ", ".join(cols)
    cur.execute(f"SELECT COUNT(*) AS n FROM {table} {where_sql}", params)
    total = int(cur.fetchone()["n"])
    cur.execute(
        f"SELECT {select_sql} FROM {table} {where_sql} ORDER BY {order} LIMIT %s OFFSET %s",
        [*params, limit, skip],
    )
    return list(cur.fetchall()), total


def get_row(cur, table: str, pk: str, pk_value: Any) -> dict:
    _check_table(table)
    if pk not in ALLOWED_COLUMNS[table]:
        raise ValueError("PK inválida")
    cols = ", ".join(sorted(ALLOWED_COLUMNS[table]))
    cur.execute(f"SELECT {cols} FROM {table} WHERE {pk} = %s", (pk_value,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No encontrado")
    return dict(row)


def insert_row(cur, table: str, data: dict[str, Any], pk: str) -> dict:
    _check_table(table)
    payload = {k: v for k, v in data.items() if k in ALLOWED_COLUMNS[table] and k not in {"id", "created_at", "updated_at"}}
    if not payload:
        raise HTTPException(status_code=400, detail="Sin datos para crear")
    columns = list(payload.keys())
    values = [payload[c] for c in columns]
    placeholders = ", ".join(["%s"] * len(columns))
    col_sql = ", ".join(columns)
    try:
        cur.execute(
            f"INSERT INTO {table} ({col_sql}) VALUES ({placeholders}) RETURNING {pk}",
            values,
        )
        pk_value = cur.fetchone()[pk]
    except Exception as exc:
        _raise_db(exc)
    return get_row(cur, table, pk, pk_value)


def update_row(cur, table: str, pk: str, pk_value: Any, data: dict[str, Any]) -> dict:
    _check_table(table)
    get_row(cur, table, pk, pk_value)
    payload = {
        k: v
        for k, v in data.items()
        if k in ALLOWED_COLUMNS[table] and k not in {pk, "created_at", "updated_at"}
    }
    if not payload:
        return get_row(cur, table, pk, pk_value)
    sets = ["updated_at = now()"]
    values: list[Any] = []
    for k, v in payload.items():
        sets.append(f"{k} = %s")
        values.append(v)
    values.append(pk_value)
    try:
        cur.execute(f"UPDATE {table} SET {', '.join(sets)} WHERE {pk} = %s", values)
    except Exception as exc:
        _raise_db(exc)
    return get_row(cur, table, pk, pk_value)


def soft_delete(cur, table: str, pk: str, pk_value: Any) -> dict:
    if "activo" not in ALLOWED_COLUMNS[table]:
        raise HTTPException(status_code=400, detail="Este catálogo no admite desactivar")
    return update_row(cur, table, pk, pk_value, {"activo": False})

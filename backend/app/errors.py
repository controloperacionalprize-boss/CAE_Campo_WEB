"""Mensajes de error en español para Swagger, app móvil y web."""

from __future__ import annotations

import re
from typing import Any

from fastapi.responses import JSONResponse

FIELD_LABELS: dict[str, str] = {
    "activo": "activo",
    "actividad_economica_codigo": "código de actividad económica",
    "area_ha": "área (ha)",
    "area_id": "área",
    "cargo_id": "cargo",
    "chofer_id": "chofer",
    "codigo": "código",
    "descripcion": "descripción",
    "dni": "DNI",
    "domicilio": "domicilio",
    "domicilio_fiscal": "domicilio fiscal",
    "empresa_id": "empresa",
    "fundo_id": "fundo",
    "grupo_id": "grupo",
    "incluir_inactivos": "incluir inactivos",
    "item_id": "identificador",
    "limit": "límite",
    "modulo_id": "módulo",
    "nombre": "nombre",
    "placa": "placa",
    "prefijo": "prefijo",
    "proveedor_id": "proveedor",
    "q": "búsqueda",
    "razon_social": "razón social",
    "rol_id": "rol",
    "ruc": "RUC",
    "skip": "paginación",
    "turno_id": "turno",
    "x-api-key": "X-API-Key",
    "usuario_id": "usuario",
    "usuario_dni": "DNI",
    "usuario_nombre": "nombre de usuario",
    "fecha": "fecha",
    "hora_envio": "hora de envío",
    "lote_id": "lote",
    "vehiculo_id": "vehículo",
    "tipo_producto": "tipo de producto",
    "tipo_llenado": "tipo de llenado",
    "envase_principal": "envase principal",
    "jabas_completas": "jabas completas",
    "jabas_incompletas": "jabas incompletas",
    "jarras_jabas": "jarras en jabas",
    "jarras_extras": "jarras extras",
    "jabas_totales": "jabas totales",
    "jarras_totales": "jarras totales",
    "ha": "hectáreas",
    "observacion": "observación",
    "estado": "estado",
    "modulo": "módulo",
    "turno": "turno",
    "lote": "lote",
}

TABLE_LABELS: dict[str, str] = {
    "actividad_economica": "actividad económica",
    "areas": "área",
    "cargo": "cargo",
    "chofer": "chofer",
    "empresa": "empresa",
    "fundo": "fundo",
    "grupo": "grupo",
    "lote": "lote",
    "modulo": "módulo",
    "proveedor": "proveedor",
    "rol": "rol",
    "turno": "turno",
    "usuario": "usuario",
    "vehiculo": "vehículo",
    "guia_ingreso": "guía de ingreso",
}

UNIQUE_BY_COLUMN: dict[str, str] = {
    "codigo": "Ya existe un registro con ese código.",
    "dni": "Ya existe un registro con ese DNI.",
    "nombre": "Ya existe un registro con ese nombre.",
    "placa": "Ya existe un vehículo con esa placa.",
    "prefijo": "Ya existe un área con ese prefijo.",
    "ruc": "Ya existe una empresa con ese RUC.",
}

FK_BY_COLUMN: dict[str, str] = {
    "actividad_economica_codigo": "La actividad económica indicada no existe",
    "area_id": "El área indicada no existe",
    "cargo_id": "El cargo indicado no existe",
    "chofer_id": "El chofer indicado no existe",
    "empresa_id": "La empresa indicada no existe",
    "fundo_id": "El fundo indicado no existe",
    "grupo_id": "El grupo indicado no existe",
    "modulo_id": "El módulo indicado no existe",
    "proveedor_id": "El proveedor indicado no existe",
    "rol_id": "El rol indicado no existe",
    "turno_id": "El turno indicado no existe",
    "lote_id": "El lote indicado no existe",
    "usuario_id": "El usuario indicado no existe",
    "vehiculo_id": "El vehículo indicado no existe",
}

_HTTP_DEFAULTS: dict[int, str] = {
    400: "La solicitud no es válida",
    401: "No autorizado. Envíe el header X-API-Key",
    403: "No tiene permiso para esta operación",
    404: "No se encontró el recurso solicitado",
    405: "Este método HTTP no está permitido en esta ruta",
    409: "Conflicto con un registro existente",
    422: "Hay datos inválidos en la solicitud",
    429: "Demasiadas solicitudes. Espere un momento e intente de nuevo",
    500: "Error interno del servidor. Intente más tarde",
    503: "Servicio no disponible. Intente más tarde",
}

_KEY_RE = re.compile(r"Key \(([^)]+)\)=")
_REF_TABLE_RE = re.compile(r'(?:table|from table) "([^"]+)"')


def field_label(name: str) -> str:
    return FIELD_LABELS.get(name, name.replace("_", " "))


_NOT_FOUND: dict[str, str] = {
    "actividad_economica": "No se encontró la actividad económica",
    "areas": "No se encontró el área",
    "cargo": "No se encontró el cargo",
    "chofer": "No se encontró el chofer",
    "empresa": "No se encontró la empresa",
    "fundo": "No se encontró el fundo",
    "grupo": "No se encontró el grupo",
    "lote": "No se encontró el lote",
    "modulo": "No se encontró el módulo",
    "proveedor": "No se encontró el proveedor",
    "rol": "No se encontró el rol",
    "turno": "No se encontró el turno",
    "usuario": "No se encontró el usuario",
    "vehiculo": "No se encontró el vehículo",
    "guia_ingreso": "No se encontró la guía de ingreso",
}


def not_found(table: str) -> str:
    return _NOT_FOUND.get(table, "No se encontró el registro solicitado")


def error_body(detail: str, *, errors: list[dict[str, str]] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"detail": detail}
    if errors:
        body["errors"] = errors
    return body


def json_error(
    status_code: int,
    detail: str,
    *,
    errors: list[dict[str, str]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=error_body(detail, errors=errors),
        headers=headers or {},
    )


def normalize_http_detail(status_code: int, detail: Any) -> str:
    if isinstance(detail, str) and detail.strip():
        mapped = {
            "Not Found": _HTTP_DEFAULTS[404],
            "Method Not Allowed": _HTTP_DEFAULTS[405],
            "Unauthorized": _HTTP_DEFAULTS[401],
            "Forbidden": _HTTP_DEFAULTS[403],
            "Internal Server Error": _HTTP_DEFAULTS[500],
        }
        return mapped.get(detail, detail)
    if isinstance(detail, list):
        parts = [_one_validation_msg(err if isinstance(err, dict) else {"msg": str(err)}) for err in detail]
        return _join(parts) or _HTTP_DEFAULTS.get(status_code, "Error en la solicitud")
    if isinstance(detail, dict):
        msg = detail.get("msg") or detail.get("message") or detail.get("detail")
        if isinstance(msg, str) and msg.strip():
            return msg
    return _HTTP_DEFAULTS.get(status_code, "Error en la solicitud")


def format_validation(errors: list[dict[str, Any]]) -> tuple[str, list[dict[str, str]]]:
    items: list[dict[str, str]] = []
    messages: list[str] = []
    for err in errors:
        msg = _one_validation_msg(err)
        loc = [str(p) for p in err.get("loc", []) if p not in {"body", "query", "path", "header"}]
        campo = loc[-1] if loc else ""
        items.append({"campo": campo, "mensaje": msg})
        messages.append(msg)
    return _join(messages) or _HTTP_DEFAULTS[422], items


def _join(parts: list[str]) -> str:
    seen: list[str] = []
    for p in parts:
        if p and p not in seen:
            seen.append(p)
    return " ".join(seen)


def _one_validation_msg(err: dict[str, Any]) -> str:
    loc = list(err.get("loc", []))
    err_type = str(err.get("type", ""))
    ctx = err.get("ctx") or {}
    raw_msg = str(err.get("msg") or "")

    if loc == ["body"] or err_type in {"json_invalid", "json_decode"}:
        return "El cuerpo de la petición no es un JSON válido"

    field = next((str(p) for p in reversed(loc) if p not in {"body", "query", "path", "header"}), "")
    label = field_label(field) if field else "dato"

    if err_type in {"missing", "missing_argument"}:
        return f"El campo {label} es obligatorio."
    if err_type in {"value_error.missing"}:
        return f"El campo {label} es obligatorio."
    if "string_too_short" in err_type:
        n = ctx.get("min_length")
        extra = f" al menos {n} caracteres" if n is not None else " más caracteres"
        return f"El campo {label} debe tener{extra}."
    if "string_too_long" in err_type:
        n = ctx.get("max_length")
        extra = f" {n} caracteres" if n is not None else " tantos caracteres"
        return f"El campo {label} no puede superar{extra}."
    if "string_pattern" in err_type or err_type == "string_type":
        if field == "dni":
            return "El DNI debe tener entre 8 y 15 caracteres (números o letras)."
        if field == "ruc":
            return "El RUC debe tener exactamente 11 dígitos."
        if field == "codigo":
            return "El código debe tener un formato válido."
        return f"El campo {label} tiene un formato inválido."
    if err_type in {"int_parsing", "int_type", "integer_parsing", "integer_type"}:
        return f"El campo {label} debe ser un número entero."
    if err_type in {"float_parsing", "float_type", "decimal_parsing", "decimal_type", "number_parsing"}:
        return f"El campo {label} debe ser un número."
    if err_type in {"bool_parsing", "bool_type"}:
        return f"El campo {label} debe ser verdadero o falso."
    if err_type in {"date_parsing", "date_type", "date_from_datetime_parsing"}:
        return f"El campo {label} debe ser una fecha (AAAA-MM-DD)."
    if err_type in {"time_parsing", "time_type"}:
        return f"El campo {label} debe ser una hora (HH:MM)."
    if "greater_than_equal" in err_type:
        return f"El campo {label} debe ser mayor o igual a {ctx.get('ge', 0)}."
    if "less_than_equal" in err_type:
        return f"El campo {label} debe ser menor o igual a {ctx.get('le', '')}."
    if "greater_than" in err_type:
        return f"El campo {label} debe ser mayor que {ctx.get('gt', 0)}."
    if err_type == "extra_forbidden":
        return f"El campo {label} no está permitido."
    if "enum" in err_type:
        return f"El campo {label} tiene un valor no permitido."

    if "value_error" in err_type:
        custom = raw_msg.split(",", 1)[-1].strip() if "," in raw_msg else raw_msg
        if custom.lower().startswith("value error"):
            custom = ""
        if custom:
            return custom if custom.endswith(".") else f"{custom}."
        return f"El campo {label} no es válido."
    if raw_msg and not raw_msg.lower().startswith("value error"):
        # Evitar inglés crudo de Pydantic cuando ya tenemos tipo cubierto
        if any(
            k in raw_msg.lower()
            for k in ("field required", "string should", "input should", "unable to parse", "value is not")
        ):
            return f"El campo {label} no es válido."
        return raw_msg if raw_msg.endswith(".") else f"{raw_msg}."
    return f"El campo {label} no es válido."


def _columns_from_pg(exc: BaseException) -> list[str]:
    diag = getattr(exc, "diag", None)
    text = " ".join(
        filter(
            None,
            [
                getattr(diag, "message_detail", None) if diag else None,
                getattr(diag, "message_primary", None) if diag else None,
                str(getattr(exc, "pgerror", "") or ""),
            ],
        )
    )
    match = _KEY_RE.search(text)
    if not match:
        col = getattr(diag, "column_name", None) if diag else None
        return [col] if col else []
    return [c.strip() for c in match.group(1).split(",") if c.strip()]


def _ref_table_from_pg(exc: BaseException) -> str | None:
    diag = getattr(exc, "diag", None)
    text = " ".join(
        filter(
            None,
            [
                getattr(diag, "message_detail", None) if diag else None,
                str(getattr(exc, "pgerror", "") or ""),
            ],
        )
    )
    match = _REF_TABLE_RE.search(text)
    return match.group(1) if match else None


def unique_message(exc: BaseException) -> str:
    cols = _columns_from_pg(exc)
    for col in cols:
        if col in UNIQUE_BY_COLUMN:
            return UNIQUE_BY_COLUMN[col]
    if cols:
        labels = ", ".join(field_label(c) for c in cols)
        return f"Ya existe un registro con esos datos únicos ({labels})."
    return "Ya existe un registro con esos datos únicos."


def fk_message(exc: BaseException) -> str:
    text = str(getattr(exc, "pgerror", "") or "")
    diag = getattr(exc, "diag", None)
    if diag:
        text = f"{text} {getattr(diag, 'message_detail', '') or ''} {getattr(diag, 'message_primary', '') or ''}"
    cols = _columns_from_pg(exc)
    still = "still referenced" in text.lower() or "sigue siendo referenciada" in text.lower()
    if still:
        ref = _ref_table_from_pg(exc)
        destino = TABLE_LABELS.get(ref or "", ref or "otros registros")
        return f"No se puede completar la operación porque hay {destino} que dependen de este registro."
    for col in cols:
        if col in FK_BY_COLUMN:
            return FK_BY_COLUMN[col]
    ref = _ref_table_from_pg(exc)
    if ref:
        label = TABLE_LABELS.get(ref, ref)
        return f"La referencia a {label} no existe. Verifique el identificador."
    return "Hay una referencia inválida o el registro está en uso."


def integrity_message() -> str:
    return "No se pudo guardar el registro. Revise que los datos no se dupliquen y que las referencias existan."

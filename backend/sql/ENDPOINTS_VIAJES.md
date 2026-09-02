# Viajes, Croquis y GRR — API para consumo

Base: `/api/v1`  
Auth: header `X-API-Key` (igual que el resto de la API). Sin clave → `401`.

Errores: `{ "detail": "texto en español" }`. En validación `422` también viene `errors: [{ "campo", "mensaje" }]`.

Códigos: `400` dato inválido / regla de negocio, `404` no existe, `409` conflicto (duplicado o ya usado).

Mutaciones de detalle, croquis y GRR solo si el viaje está `en_proceso`.

Orden típico: crear viaje → agregar QRs → crear croquis → generar GRR → `PATCH` a `finalizado`.

---

## 1. Viajes

### POST `/api/v1/viajes` — Crear

`201`

`usuario_id`, `kia_origen` y `kia_destino` son obligatorios. `tipo_viaje`: `directo` | `agrupado`.

`conductor_id` y `vehiculo_id` son opcionales. Si va `conductor_id`, el servidor llena `conductor_nombre`. Si va `vehiculo_id` y no mandas `placa`, usa la placa del vehículo.

```json
{
  "tipo_viaje": "directo",
  "conductor_id": 1,
  "vehiculo_id": 2,
  "placa": "TDA-808",
  "kia_origen": "ACOPIO CAMPO 1",
  "kia_destino": "PLANTA",
  "observacion": "",
  "usuario_id": 2
}
```

Respuesta: el viaje con `codigo` auto (`VJ-YYYY-MM-NNNN`), `estado: "en_proceso"` y `fecha` de hoy.

```json
{
  "id": 1,
  "codigo": "VJ-2026-09-0001",
  "tipo_viaje": "directo",
  "conductor_id": 1,
  "conductor_nombre": "YOSHI VERA",
  "vehiculo_id": 2,
  "placa": "TDA-808",
  "kia_origen": "ACOPIO CAMPO 1",
  "kia_destino": "PLANTA",
  "observacion": "",
  "estado": "en_proceso",
  "usuario_id": 2,
  "fecha": "2026-09-02",
  "created_at": "2026-09-02T14:30:00.000000-05:00",
  "updated_at": "2026-09-02T14:30:00.000000-05:00"
}
```

### GET `/api/v1/viajes` — Listar

Query (todos opcionales):

| Param | Notas |
|-------|--------|
| `usuario_id` | int |
| `fecha` | `YYYY-MM-DD` |
| `estado` | `en_proceso` \| `finalizado` \| `anulado` |
| `tipo_viaje` | `directo` \| `agrupado` |
| `q` | busca en codigo, placa, conductor, kia origen/destino (máx. 80) |
| `skip` | default `0` |
| `limit` | default `100`, máx. `500` |

```json
{
  "items": [ { "...viaje..." } ],
  "total": 1,
  "skip": 0,
  "limit": 100
}
```

### GET `/api/v1/viajes/{viaje_id}` — Detalle completo

Viaje + QRs + croquis + GRR. Si aún no hay croquis o GRR, vienen `null`.

```json
{
  "id": 1,
  "codigo": "VJ-2026-09-0001",
  "estado": "en_proceso",
  "detalle": [ { "...qr..." } ],
  "croquis": { "...croquis con pallets..." },
  "grr": { "...grr con detalle_carga..." }
}
```

### PATCH `/api/v1/viajes/{viaje_id}` — Cambiar estado

```json
{ "estado": "finalizado" }
```

Valores: `en_proceso` | `finalizado` | `anulado`.

---

## 2. Detalle (QRs / guías de ingreso)

### POST `/api/v1/viajes/{viaje_id}/detalle` — Agregar QRs

`201` — lista de filas creadas.

```json
{ "guia_ingreso_ids": [8, 7] }
```

Por cada id copia de `guia_ingreso`: `modulo`, `turno`, `lote`, `jabas_completas`, `jabas_incompletas`, `jarras` (desde `jarras_totales`).

No se puede agregar una guía anulada, ni una que ya esté en este viaje u otro viaje que no esté `anulado` (`409`).

```json
[
  {
    "id": 1,
    "viaje_id": 1,
    "guia_ingreso_id": 8,
    "modulo": "M14",
    "turno": "T01",
    "lote": "115B",
    "jabas_completas": 2,
    "jabas_incompletas": 0,
    "jarras": 20,
    "created_at": "2026-09-02T14:31:00.000000-05:00"
  }
]
```

### GET `/api/v1/viajes/{viaje_id}/detalle`

`total_jabas` = suma de completas + incompletas.

```json
{
  "items": [ { "...qr..." } ],
  "total_jarras": 46,
  "total_jabas": 5,
  "total_qrs": 2
}
```

### DELETE `/api/v1/viajes/{viaje_id}/detalle/{detalle_id}`

Quita esa línea. Responde el registro eliminado.

---

## 3. Croquis

Un solo croquis por viaje. El viaje debe estar `en_proceso`. Mínimo 1 pallet.

Totales los calcula el servidor: `total_jarras`, `total_jabas` (pallets + continuaciones) y `total_pallets` (solo pallets, no continuaciones).

### POST `/api/v1/viajes/{viaje_id}/croquis`

`201`. Si ya existe → `409`.

`hora_salida`: `HH:MM`. `temperatura` opcional. Continuaciones opcionales (sin `nombre`; heredan el del pallet padre).

```json
{
  "fecha": "2026-09-02",
  "placa": "TDA-808",
  "punto_partida": "ACOPIO CAMPO 1",
  "punto_llegada": "PLANTA PROCESADORA",
  "motivo_traslado": "Traslado de fruta",
  "hora_salida": "08:30",
  "temperatura": 18.5,
  "pallets": [
    {
      "nombre": "PALLET 1",
      "orden": 1,
      "modulo": "M14",
      "turno": "T01",
      "variedad": "HASS",
      "jarras": 120,
      "jabas": 10,
      "continuaciones": [
        {
          "modulo": "M14",
          "turno": "T02",
          "variedad": "HASS",
          "jarras": 80,
          "jabas": 7
        }
      ]
    }
  ]
}
```

Respuesta (continuaciones anidadas):

```json
{
  "id": 1,
  "viaje_id": 1,
  "fecha": "2026-09-02",
  "placa": "TDA-808",
  "punto_partida": "ACOPIO CAMPO 1",
  "punto_llegada": "PLANTA PROCESADORA",
  "motivo_traslado": "Traslado de fruta",
  "hora_salida": "08:30",
  "total_jarras": 200,
  "total_jabas": 17,
  "total_pallets": 1,
  "temperatura": 18.5,
  "pallets": [
    {
      "id": 1,
      "croquis_id": 1,
      "nombre": "PALLET 1",
      "orden": 1,
      "modulo": "M14",
      "turno": "T01",
      "variedad": "HASS",
      "jarras": 120,
      "jabas": 10,
      "es_continuacion": false,
      "pallet_padre_id": null,
      "continuaciones": [
        {
          "id": 2,
          "croquis_id": 1,
          "nombre": "PALLET 1",
          "orden": 1,
          "modulo": "M14",
          "turno": "T02",
          "variedad": "HASS",
          "jarras": 80,
          "jabas": 7,
          "es_continuacion": true,
          "pallet_padre_id": 1,
          "created_at": "2026-09-02T14:32:00.000000-05:00"
        }
      ],
      "created_at": "2026-09-02T14:32:00.000000-05:00"
    }
  ],
  "created_at": "2026-09-02T14:32:00.000000-05:00",
  "updated_at": "2026-09-02T14:32:00.000000-05:00"
}
```

### GET `/api/v1/viajes/{viaje_id}/croquis`

Misma forma. Si no hay croquis → `404`.

---

## 4. GRR

Una sola GRR por viaje. Sin body: se arma con el croquis.

Sin croquis → `400`. Si ya existe → `409`.

`numero` auto: `GRR-YYYY-MM-NNNN`.  
`remitente` = `punto_partida` del croquis.  
`destinatario` = `punto_llegada` del croquis.  
`detalle_carga` = cada pallet y cada continuación.

### POST `/api/v1/viajes/{viaje_id}/grr`

`201`

```json
{
  "id": 1,
  "viaje_id": 1,
  "numero": "GRR-2026-09-0001",
  "fecha_emision": "2026-09-02",
  "remitente": "ACOPIO CAMPO 1",
  "destinatario": "PLANTA PROCESADORA",
  "motivo_traslado": "Traslado de fruta",
  "placa": "TDA-808",
  "punto_partida": "ACOPIO CAMPO 1",
  "punto_llegada": "PLANTA PROCESADORA",
  "total_jarras": 200,
  "total_jabas": 17,
  "estado": "emitido",
  "detalle_carga": [
    {
      "id": 1,
      "grr_id": 1,
      "pallet": "PALLET 1",
      "modulo": "M14",
      "turno": "T01",
      "variedad": "HASS",
      "jarras": 120,
      "jabas": 10,
      "orden": 1,
      "created_at": "2026-09-02T14:33:00.000000-05:00"
    },
    {
      "id": 2,
      "grr_id": 1,
      "pallet": "PALLET 1",
      "modulo": "M14",
      "turno": "T02",
      "variedad": "HASS",
      "jarras": 80,
      "jabas": 7,
      "orden": 2,
      "created_at": "2026-09-02T14:33:00.000000-05:00"
    }
  ],
  "created_at": "2026-09-02T14:33:00.000000-05:00",
  "updated_at": "2026-09-02T14:33:00.000000-05:00"
}
```

### GET `/api/v1/viajes/{viaje_id}/grr`

Misma forma. Si no hay GRR → `404`.

---

## Resumen de rutas

| Método | Ruta | Status |
|--------|------|--------|
| POST | `/api/v1/viajes` | 201 |
| GET | `/api/v1/viajes` | 200 |
| GET | `/api/v1/viajes/{viaje_id}` | 200 |
| PATCH | `/api/v1/viajes/{viaje_id}` | 200 |
| POST | `/api/v1/viajes/{viaje_id}/detalle` | 201 |
| GET | `/api/v1/viajes/{viaje_id}/detalle` | 200 |
| DELETE | `/api/v1/viajes/{viaje_id}/detalle/{detalle_id}` | 200 |
| POST | `/api/v1/viajes/{viaje_id}/croquis` | 201 |
| GET | `/api/v1/viajes/{viaje_id}/croquis` | 200 |
| POST | `/api/v1/viajes/{viaje_id}/grr` | 201 |
| GET | `/api/v1/viajes/{viaje_id}/grr` | 200 |

Local: `http://127.0.0.1:8001` — Swagger en `/docs`.

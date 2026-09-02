# Flujo QR → Viaje → GRR

Documento para implementar en backend (y el mínimo en web).  
Auth igual que el resto: header `X-API-Key`. Errores `{ "detail": "..." }`. Validación `422` trae `errors: [{ "campo", "mensaje" }]`.

Hoy la API ya tiene guías, viajes, croquis y GRR, pero **no están atados**: un QR de campo se puede meter a un viaje sin pasar por acopio, y planta no existe. Este flujo cierra eso.

---

## Flujo

```
CAMPO (móvil)
  POST /guias-ingreso
  GI.estado = registrado
  flags acopio/planta = false
        │
ACOPIO — escanea QR de campo
  PATCH /guias-ingreso/{id}/recepcionar-acopio
  recepcionado_acopio = true
        │
ACOPIO — arma el viaje
  POST /viajes                         → en_proceso
  POST /viajes/{id}/detalle            → GI entra al viaje (ya no reusable)
  POST /viajes/{id}/croquis
  POST /viajes/{id}/grr
  PATCH /viajes/{id}  { estado: finalizado }
        │
PLANTA — registro por guía
  PATCH /guias-ingreso/{id}/recepcionar-planta
  recepcionado_planta = true
        │
PLANTA — cierra el camión (QR de la GRR)
  PATCH /viajes/{id}/grr/recepcionar
  grr.recepcionado = true
  viaje.estado = recepcionado
```

Un QR de **guía** se lee dos veces (acopio y planta).  
Un QR de **GRR** se lee una vez y eso cierra el viaje.

---

## Modelo (no duplicar)

| Dónde | Para qué | Valores |
|-------|----------|---------|
| `guia_ingreso.estado` | ¿El documento vale? | `registrado` \| `anulado` (ya existe) |
| `guia_ingreso.recepcionado_acopio` | ¿Pasó la pistola de acopio? | boolean + `_at` |
| `guia_ingreso.recepcionado_planta` | ¿Pasó la pistola de planta? | boolean + `_at` |
| `viaje_detalle` | ¿Está en un viaje vigente? | la fila es el candado; no pongas `en_viaje` en la guía |
| `viaje.estado` | ¿Dónde va el camión? | `en_proceso` → `finalizado` → `recepcionado` \| `anulado` |
| `grr.recepcionado` | ¿Planta leyó la GRR? | boolean + `_at` (no boolean en `viaje`) |

---

## SQL (ejecutar en Neon)

Antes del `DROP CONSTRAINT`, verificar el nombre real:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'viaje'::regclass AND contype = 'c';
```

Si no se llama `viaje_estado_check`, usar el nombre que salga.

```sql
-- 1. guia_ingreso: marcas de estación
ALTER TABLE guia_ingreso ADD COLUMN IF NOT EXISTS recepcionado_acopio BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE guia_ingreso ADD COLUMN IF NOT EXISTS recepcionado_acopio_at TIMESTAMPTZ;
ALTER TABLE guia_ingreso ADD COLUMN IF NOT EXISTS recepcionado_planta BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE guia_ingreso ADD COLUMN IF NOT EXISTS recepcionado_planta_at TIMESTAMPTZ;

ALTER TABLE guia_ingreso DROP CONSTRAINT IF EXISTS chk_gi_orden_recepcion;
ALTER TABLE guia_ingreso ADD CONSTRAINT chk_gi_orden_recepcion
  CHECK (NOT recepcionado_planta OR recepcionado_acopio);

CREATE INDEX IF NOT EXISTS gi_cola_acopio_idx
  ON guia_ingreso (fecha, recepcionado_acopio, recepcionado_planta)
  WHERE estado = 'registrado';

-- 2. grr
ALTER TABLE grr ADD COLUMN IF NOT EXISTS recepcionado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE grr ADD COLUMN IF NOT EXISTS recepcionado_at TIMESTAMPTZ;

-- 3. viaje: nuevo estado (confirmar nombre del constraint)
ALTER TABLE viaje DROP CONSTRAINT IF EXISTS viaje_estado_check;
ALTER TABLE viaje ADD CONSTRAINT viaje_estado_check
  CHECK (estado IN ('en_proceso', 'finalizado', 'recepcionado', 'anulado'));
```

---

## Reglas

### Escanear GI en acopio

- `estado <> anulado`
- `recepcionado_acopio = false`
- `UPDATE … WHERE id = %s AND recepcionado_acopio = FALSE AND estado <> 'anulado' RETURNING *`
- 0 filas → `409` "Ya fue recepcionada en acopio" (o `400` si está anulada: chequear estado antes)
- **No** inserta `viaje_detalle`. El viaje se arma después, con varias GI.

### Meter GI al viaje (`POST /viajes/{id}/detalle`) — hoy es el hueco

Por cada guía, además de lo que ya hace (`en_proceso`, no anulada, no en otro viaje `estado <> anulado`):

1. `recepcionado_acopio = true` → si no, `400` "La guía {codigo} no ha sido recepcionada en acopio"
2. `recepcionado_planta = false` → si no, `409` "La guía {codigo} ya fue registrada en planta"
3. `SELECT … FOR UPDATE` sobre la fila de la guía (carrera de dos pistolas)

### Quitar GI del viaje (`DELETE .../detalle/{id}`)

Solo viaje `en_proceso` (ya está).  
**No** bajar `recepcionado_acopio`. Esa GI puede ir a otro viaje.

### Croquis y crear GRR

Igual que ahora: solo viaje `en_proceso`. Un croquis y una GRR por viaje.

### Finalizar viaje (`PATCH /viajes/{id}`)

Hoy el PATCH acepta cualquier estado sin validar. Cambiar a transiciones:

| Desde | Hacia | Condición |
|-------|--------|-----------|
| `en_proceso` | `finalizado` | ≥1 GI en detalle, existe croquis, existe GRR |
| `en_proceso` | `anulado` | sí. Las GI **no** se anulan; quedan con acopio y pueden ir a otro viaje |
| `*` | `recepcionado` | **prohibido** aquí. Solo el PATCH de GRR |

`finalizado` / `recepcionado` → no se anulan.  
Cualquier otro salto → `400`.

### Escanear GI en planta

- no anulada
- `recepcionado_acopio = true`
- `recepcionado_planta = false`
- **está en** `viaje_detalle` de un viaje `finalizado` o `recepcionado`
- `UPDATE … WHERE id = %s AND recepcionado_planta = FALSE AND recepcionado_acopio = TRUE AND estado <> 'anulado'`
- 0 filas → `409` / `400` según el caso
- Si no está en un viaje → `400` "La guía no pertenece a un viaje"

### Escanear GRR (cierra el viaje)

- viaje actual = `finalizado` (si sigue `en_proceso` → `400`)
- GRR existe y `recepcionado = false`
- marcar GRR + `viaje.estado = recepcionado` en la misma transacción
- `UPDATE grr … WHERE recepcionado = FALSE`
- `UPDATE viaje … WHERE id = %s AND estado = 'finalizado'`
- No exigir que todas las GI estén en planta: la GRR cierra el camión; el registro por QR es otro paso

### Anular una GI (`PATCH /guias-ingreso/{id}` con `estado: anulado`)

Permitir solo si:

- no está `recepcionado_planta`
- no está en un viaje cuyo estado no sea `anulado`

Si ya pasó acopio pero **no** entró a un viaje vigente, sí se puede anular (QR mal generado).

No usar un CHECK SQL que prohíba anular cuando `recepcionado_acopio = true`. Eso choca con el PATCH actual de guías.

---

## Endpoints nuevos (3)

Todos PATCH, **sin body**, devuelven el objeto completo (`GuiaIngresoOut` / `GrrOut`).

### 1. `PATCH /api/v1/guias-ingreso/{id}/recepcionar-acopio`

Marca acopio. Publicar SSE `guia.updated` (igual que el PATCH de guías) para que Despacho en vivo no quede ciego.

### 2. `PATCH /api/v1/guias-ingreso/{id}/recepcionar-planta`

Marca planta. También `publish_guia("guia.updated", row)`.

### 3. `PATCH /api/v1/viajes/{viaje_id}/grr/recepcionar`

Ruta anidada (coherente con `GET/POST /viajes/{id}/grr`).  
Response: `GrrOut` con `recepcionado` y `recepcionado_at`.

---

## Cambios en endpoints que ya existen

### `GET /api/v1/guias-ingreso`

Query params opcionales:

- `recepcionado_acopio=true|false`
- `recepcionado_planta=true|false`

Ejemplos:

| Pantalla | Query |
|----------|-------|
| Cola acopio (pendientes de escanear) | `?fecha=YYYY-MM-DD&recepcionado_acopio=false` |
| Listas para armar viaje | `?fecha=YYYY-MM-DD&recepcionado_acopio=true&recepcionado_planta=false` |

La cola “planta + viaje finalizado” **no** sale solo con este GET: hay que cruzar `viaje_detalle` + `viaje`. Si el móvil la necesita, un endpoint aparte; no forzarla en el listado de guías.

### `POST /api/v1/viajes/{id}/detalle`

Validaciones nuevas (arriba).

### `PATCH /api/v1/viajes/{id}`

Solo transiciones de la tabla. **Nunca** `recepcionado` por este camino.

### GET de guías y de GRR / viaje completo

Los schemas de salida deben incluir los campos nuevos siempre.

---

## QR de la GRR (móvil, sin backend extra)

El móvil arma el string con `GET /api/v1/viajes/{id}/grr`. No incluir `total_pallets` (vive en croquis) ni `ESTADO` (el papel queda viejo).

```
Qr_GRR
NUMERO = GRR-2026-09-0001
FECHA = 2026-09-02
REMITENTE = Acopio Campo 1
DESTINATARIO = Planta Procesadora
MOTIVO = Traslado de fruta
PLACA = YEE-895
TOTAL_JARRAS = 3392
TOTAL_JABAS = 272
```

---

## Archivos backend a tocar

| Archivo | Qué |
|---------|-----|
| `app/crud.py` | `ALLOWED_COLUMNS` de `guia_ingreso` y `grr`. Mensaje CHECK de `viaje.estado` (agregar `recepcionado`). |
| `app/schemas.py` | Campos nuevos en `GuiaIngresoOut` y `GrrOut`. `ESTADOS_VIAJE` = `en_proceso`, `finalizado`, `recepcionado`, `anulado`. |
| `app/errors.py` | Etiquetas `recepcionado_acopio`, `recepcionado_planta`, `recepcionado_at`, etc. |
| `app/viajes.py` | `agregar_detalle`, `parchear_viaje`, `recepcionar_grr` (nuevo). |
| `app/guia_ingreso.py` | `recepcionar_acopio`, `recepcionar_planta`. Ajustar `parchear` al anular. |
| `app/routers/guias.py` | 2 PATCH + filtros en el GET. SSE en los PATCH nuevos. |
| `app/routers/viajes.py` | PATCH GRR recepcionar. Mensaje del GET si filtran estado. |

Sin meter las columnas en `ALLOWED_COLUMNS`, `list_rows` ignora los filtros y `update_row` rechaza el UPDATE.

---

## Web (mínimo para que no mienta)

No hace falta pantalla de viajes para cerrar el flujo (eso es el móvil + API). Sí hace falta que **Despacho** no siga mostrando todo como “registrado”:

- `frontend/src/types/api.ts` — los 4 campos de la guía
- Filtros / pastillas acopio y planta en `DespachoPage`
- `EstadoDespacho` no aplica a los booleanos: son flags aparte, no sustituyen `estado`

Inicio puede seguir contando no anuladas. Si más adelante quieren “pendientes de acopio”, usan el filtro nuevo.

---

## Orden de implementación

1. SQL en Neon  
2. `crud` + schemas + errors (si no, 500 al serializar o al guardar)  
3. `agregar_detalle` + `parchear_viaje`  
4. Los 3 PATCH + SSE en guías  
5. Filtros del GET guías  
6. Tipos y filtros en Despacho  

---

## Rutas de viajes que ya existen (recordatorio)

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

Detalle / croquis / crear GRR: solo `en_proceso`.  
Listado viajes: `usuario_id`, `fecha`, `estado`, `tipo_viaje`, `q`, `skip`, `limit`.

---

## No hacer

- Boolean `recepcionado` en `viaje` (duplica `estado`)
- Un solo boolean `leido` en la guía (acopio y planta son dos hechos)
- Que el escaneo de acopio inserte `viaje_detalle`
- Endpoint suelto `/api/v1/grr/{id}/…`
- Quitar `anulado` de la guía (Despacho / Inicio ya lo usan)
- Poner `total_pallets` o `ESTADO` en el QR impreso de la GRR

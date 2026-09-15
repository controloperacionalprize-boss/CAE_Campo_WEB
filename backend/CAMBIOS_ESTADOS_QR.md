# Cambios: Estados de QR, Viaje y GRR — v2

## Contexto del flujo

```
Campo (crea GI)
    → Acopio escanea QR de GI         [recepcionado_acopio]
        → GI entra al viaje           [viaje_detalle — ya no reutilizable]
            → viaje finalizado         [viaje.estado = finalizado]
                → Planta escanea GI    [recepcionado_planta]
                → Planta escanea GRR   [grr.recepcionado → viaje.estado = recepcionado]
```

---

## 1. Columnas nuevas en `guia_ingreso`

```sql
ALTER TABLE guia_ingreso ADD COLUMN IF NOT EXISTS recepcionado_acopio BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE guia_ingreso ADD COLUMN IF NOT EXISTS recepcionado_acopio_at TIMESTAMPTZ;
ALTER TABLE guia_ingreso ADD COLUMN IF NOT EXISTS recepcionado_planta BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE guia_ingreso ADD COLUMN IF NOT EXISTS recepcionado_planta_at TIMESTAMPTZ;

-- Integridad: no puede estar en planta sin haber pasado por acopio
ALTER TABLE guia_ingreso ADD CONSTRAINT chk_gi_orden_recepcion
  CHECK (NOT recepcionado_planta OR recepcionado_acopio);

-- No se puede recepcionar una guía anulada
ALTER TABLE guia_ingreso ADD CONSTRAINT chk_gi_no_anulado_recepcion
  CHECK (estado <> 'anulado' OR (NOT recepcionado_acopio AND NOT recepcionado_planta));

-- Índice para la cola acopio→planta (consulta diaria frecuente)
CREATE INDEX IF NOT EXISTS gi_cola_acopio_idx
  ON guia_ingreso (fecha, recepcionado_acopio, recepcionado_planta)
  WHERE estado = 'registrado';
```

**Nombres distintos para evitar confusión:**
- `recepcionado_acopio` = lo escanearon en Acopio
- `recepcionado_planta` = lo usaron en Registro Planta

---

## 2. Columna nueva en `grr`

```sql
ALTER TABLE grr ADD COLUMN IF NOT EXISTS recepcionado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE grr ADD COLUMN IF NOT EXISTS recepcionado_at TIMESTAMPTZ;

-- No se puede recepcionar una GRR anulada
ALTER TABLE grr ADD CONSTRAINT chk_grr_no_anulado_recepcion
  CHECK (estado <> 'anulado' OR NOT recepcionado);
```

---

## 3. Nuevo estado en `viaje`

Agregar `recepcionado` al CHECK de estados:

```sql
ALTER TABLE viaje DROP CONSTRAINT IF EXISTS viaje_estado_check;
ALTER TABLE viaje ADD CONSTRAINT viaje_estado_check
  CHECK (estado IN ('en_proceso', 'finalizado', 'recepcionado', 'anulado'));
```

Ciclo de vida del viaje:
```
en_proceso → finalizado → recepcionado
     ↓
  anulado
```

---

## 4. Validaciones en `agregar_detalle` (existente)

Al hacer `POST /api/v1/viajes/{viaje_id}/detalle`, agregar estas validaciones **por cada guía**:

```python
# La guía debe estar recepcionada en acopio
if not guia.get("recepcionado_acopio"):
    raise HTTPException(400, f"La guía {codigo} no ha sido recepcionada en acopio")

# La guía no debe estar ya usada en planta
if guia.get("recepcionado_planta"):
    raise HTTPException(409, f"La guía {codigo} ya fue registrada en planta")

# La guía no debe estar anulada
if (guia.get("estado") or "").lower() == "anulado":
    raise HTTPException(400, f"La guía {codigo} está anulada")
```

Esto **cierra el hueco** de que un QR entre a un viaje sin haber sido escaneado en acopio, o que un QR ya usado en planta se reutilice.

---

## 5. Endpoints nuevos (3)

### 5.1 PATCH `/api/v1/guias-ingreso/{id}/recepcionar-acopio`

Acopio escanea el QR de campo.

**Sin body.** Marca `recepcionado_acopio = TRUE`, `recepcionado_acopio_at = now()`.

```sql
UPDATE guia_ingreso
SET recepcionado_acopio = TRUE, recepcionado_acopio_at = now(), updated_at = now()
WHERE id = %s AND recepcionado_acopio = FALSE
RETURNING *;
```

Validaciones:
- Si `estado = 'anulado'` → 400 "La guía está anulada"
- Si `recepcionado_acopio = TRUE` (el UPDATE no tocó filas) → 409 "Ya fue recepcionada en acopio"

Response: `GuiaIngresoOut` completo (mismo schema que GET).

---

### 5.2 PATCH `/api/v1/guias-ingreso/{id}/recepcionar-planta`

Registro Planta usa el QR de la guía.

**Sin body.** Marca `recepcionado_planta = TRUE`, `recepcionado_planta_at = now()`.

```sql
UPDATE guia_ingreso
SET recepcionado_planta = TRUE, recepcionado_planta_at = now(), updated_at = now()
WHERE id = %s AND recepcionado_planta = FALSE
RETURNING *;
```

Validaciones:
- Si `estado = 'anulado'` → 400 "La guía está anulada"
- Si `recepcionado_acopio = FALSE` → 400 "La guía no ha sido recepcionada en acopio"
- Si `recepcionado_planta = TRUE` (UPDATE no tocó filas) → 409 "Ya fue registrada en planta"

Response: `GuiaIngresoOut` completo.

---

### 5.3 PATCH `/api/v1/viajes/{viaje_id}/grr/recepcionar`

Planta escanea el QR de la GRR. **Esto también cambia el estado del viaje a `recepcionado`.**

**Sin body.**

```python
# 1. Obtener GRR del viaje
grr = obtener_grr(cur, viaje_id)

# 2. Validar
if grr["estado"] == "anulado":
    raise HTTPException(400, "La GRR está anulada")
if grr["recepcionado"]:
    raise HTTPException(409, "La GRR ya fue recepcionada")

# 3. Marcar GRR
UPDATE grr SET recepcionado = TRUE, recepcionado_at = now(), updated_at = now()
WHERE id = %s AND recepcionado = FALSE;

# 4. Marcar viaje como recepcionado
UPDATE viaje SET estado = 'recepcionado', updated_at = now()
WHERE id = %s;
```

**Ruta anidada** (coherente con `/api/v1/viajes/{viaje_id}/grr`).

Response: `GrrOut` completo (con `recepcionado` y `recepcionado_at` incluidos).

---

## 6. Actualizar schemas Pydantic

### GuiaIngresoOut — agregar:
```python
recepcionado_acopio: bool
recepcionado_acopio_at: datetime | None
recepcionado_planta: bool
recepcionado_planta_at: datetime | None
```

### GrrOut — agregar:
```python
recepcionado: bool
recepcionado_at: datetime | None
```

---

## 7. Filtros en listado de guías

En `GET /api/v1/guias-ingreso` agregar query params opcionales:

```python
recepcionado_acopio: bool | None = None
recepcionado_planta: bool | None = None
```

Casos de uso:
| Pantalla | Query |
|----------|-------|
| Cola de acopio (QRs pendientes de escanear) | `?fecha=2026-09-02&recepcionado_acopio=false` |
| QRs listos para viaje (escaneados, no en planta) | `?fecha=2026-09-02&recepcionado_acopio=true&recepcionado_planta=false` |
| Registro planta (QRs por recepcionar) | `?fecha=2026-09-02&recepcionado_planta=false` con viaje finalizado |

---

## 8. QR de la GRR — contenido

El QR se genera en el móvil con datos del `GET /api/v1/viajes/{viaje_id}/grr`. Formato del string:

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

**No incluir `total_pallets`** (no está en la tabla `grr`, vive en `croquis`).
**No incluir `ESTADO`** (el QR impreso es una foto fija, el estado vivo se consulta al escanear).

**No se necesita cambio backend** para generar el QR — solo los datos que ya devuelve el GET.

---

## 9. Reglas de negocio consolidadas

| Acción | Precondición | Efecto en BD |
|--------|-------------|--------------|
| Escanear QR campo en Acopio | `estado ≠ anulado`, `recepcionado_acopio = false` | `recepcionado_acopio = true` |
| Agregar GI a viaje | `recepcionado_acopio = true`, `recepcionado_planta = false`, `estado ≠ anulado`, no en otro viaje activo | Inserta `viaje_detalle` |
| Finalizar viaje | `viaje.estado = en_proceso`, tiene croquis y GRR | `viaje.estado = finalizado` |
| Escanear QR GI en Planta | `recepcionado_acopio = true`, `recepcionado_planta = false`, `estado ≠ anulado` | `recepcionado_planta = true` |
| Escanear QR GRR en Planta | `grr.estado ≠ anulado`, `grr.recepcionado = false` | `grr.recepcionado = true`, `viaje.estado = recepcionado` |

---

## 10. SQL completo para ejecutar

```sql
-- 1. guia_ingreso: flags de estación
ALTER TABLE guia_ingreso ADD COLUMN IF NOT EXISTS recepcionado_acopio BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE guia_ingreso ADD COLUMN IF NOT EXISTS recepcionado_acopio_at TIMESTAMPTZ;
ALTER TABLE guia_ingreso ADD COLUMN IF NOT EXISTS recepcionado_planta BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE guia_ingreso ADD COLUMN IF NOT EXISTS recepcionado_planta_at TIMESTAMPTZ;

ALTER TABLE guia_ingreso ADD CONSTRAINT chk_gi_orden_recepcion
  CHECK (NOT recepcionado_planta OR recepcionado_acopio);

-- 2. grr: flag de recepción
ALTER TABLE grr ADD COLUMN IF NOT EXISTS recepcionado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE grr ADD COLUMN IF NOT EXISTS recepcionado_at TIMESTAMPTZ;

-- 3. viaje: nuevo estado
ALTER TABLE viaje DROP CONSTRAINT IF EXISTS viaje_estado_check;
ALTER TABLE viaje ADD CONSTRAINT viaje_estado_check
  CHECK (estado IN ('en_proceso', 'finalizado', 'recepcionado', 'anulado'));

-- 4. Índice para cola diaria
CREATE INDEX IF NOT EXISTS gi_cola_acopio_idx
  ON guia_ingreso (fecha, recepcionado_acopio, recepcionado_planta)
  WHERE estado = 'registrado';
```

## Resumen para el backend dev

- **3 endpoints nuevos** (todos PATCH sin body, devuelven objeto completo)
- **4 columnas** en `guia_ingreso`, **2 columnas** en `grr`
- **1 estado nuevo** en `viaje` (`recepcionado`)
- **Modificar** `agregar_detalle` para validar `recepcionado_acopio` y `recepcionado_planta`
- **Modificar** `GuiaIngresoOut` y `GrrOut` para incluir los nuevos campos
- **Agregar filtros** `recepcionado_acopio` y `recepcionado_planta` al listado de guías
- **Usar `UPDATE ... WHERE flag = FALSE`** para evitar doble escaneo por carrera de requests

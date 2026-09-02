-- ============================================================
-- Flujo QR → Viaje → GRR (migración)
-- Ejecutar en Neon sobre el esquema ya creado.
--
-- Antes, confirmar el nombre del CHECK de viaje.estado:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'viaje'::regclass AND contype = 'c';
-- Si no se llama viaje_estado_check, ajustar el DROP de abajo.
-- ============================================================

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

-- 3. viaje: estado recepcionado
ALTER TABLE viaje DROP CONSTRAINT IF EXISTS viaje_estado_check;
ALTER TABLE viaje ADD CONSTRAINT viaje_estado_check
  CHECK (estado IN ('en_proceso', 'finalizado', 'recepcionado', 'anulado'));

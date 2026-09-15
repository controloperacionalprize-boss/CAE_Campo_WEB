-- Índices para las consultas más frecuentes de la operación.

-- Saldo diario de ha por lote: SUM(ha) de las guías vigentes del lote en la fecha.
CREATE INDEX IF NOT EXISTS gi_lote_fecha_ha_idx
    ON guia_ingreso (lote_id, fecha)
    WHERE estado <> 'anulado';

-- "¿En qué viaje está esta guía?" (recepción en planta, anulación, agregar al viaje).
-- La restricción única (viaje_id, guia_ingreso_id) no sirve para buscar solo por guía.
CREATE INDEX IF NOT EXISTS viaje_detalle_guia_idx
    ON viaje_detalle (guia_ingreso_id);

-- Recepción: viajes finalizados pendientes de escanear GRR.
CREATE INDEX IF NOT EXISTS viaje_estado_fecha_idx
    ON viaje (estado, fecha DESC);

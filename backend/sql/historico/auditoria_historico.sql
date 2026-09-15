-- ============================================================
-- Auditoría: el histórico NO se reescribe ni se borra con el maestro
-- Tablas ya creadas: solo ALTER + triggers.
--
-- Regla:
--   UPDATE placa/nombre en vehiculo/chofer/fundo  → solo afecta al maestro
--   Los 100 viajes/GI/GRR conservan la placa/nombre que se copió al crear
--   DELETE físico de GI, viaje, croquis, GRR     → bloqueado
--   DELETE de maestro                            → la API ya es soft (activo=false)
--     y el FK RESTRICT impide un DELETE SQL si hay documentos
-- ============================================================

-- ---------- 1. Quitar CASCADE de documentos (si se borra el padre, no se lleva el hijo)
-- viaje_detalle / croquis no deben desaparecer si alguien hace DELETE FROM viaje

ALTER TABLE viaje_detalle DROP CONSTRAINT IF EXISTS viaje_detalle_viaje_id_fkey;
ALTER TABLE viaje_detalle
  ADD CONSTRAINT viaje_detalle_viaje_id_fkey
  FOREIGN KEY (viaje_id) REFERENCES viaje (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE viaje_detalle DROP CONSTRAINT IF EXISTS viaje_detalle_guia_ingreso_id_fkey;
ALTER TABLE viaje_detalle
  ADD CONSTRAINT viaje_detalle_guia_ingreso_id_fkey
  FOREIGN KEY (guia_ingreso_id) REFERENCES guia_ingreso (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE croquis DROP CONSTRAINT IF EXISTS croquis_viaje_id_fkey;
ALTER TABLE croquis
  ADD CONSTRAINT croquis_viaje_id_fkey
  FOREIGN KEY (viaje_id) REFERENCES viaje (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE croquis_pallet DROP CONSTRAINT IF EXISTS croquis_pallet_croquis_id_fkey;
ALTER TABLE croquis_pallet
  ADD CONSTRAINT croquis_pallet_croquis_id_fkey
  FOREIGN KEY (croquis_id) REFERENCES croquis (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE grr DROP CONSTRAINT IF EXISTS grr_viaje_id_fkey;
ALTER TABLE grr
  ADD CONSTRAINT grr_viaje_id_fkey
  FOREIGN KEY (viaje_id) REFERENCES viaje (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE grr_detalle DROP CONSTRAINT IF EXISTS grr_detalle_grr_id_fkey;
ALTER TABLE grr_detalle
  ADD CONSTRAINT grr_detalle_grr_id_fkey
  FOREIGN KEY (grr_id) REFERENCES grr (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ---------- 2. Documentos → maestros: no borrar ni cambiar el id del maestro si hay histórico

ALTER TABLE guia_ingreso DROP CONSTRAINT IF EXISTS guia_ingreso_usuario_id_fkey;
ALTER TABLE guia_ingreso
  ADD CONSTRAINT guia_ingreso_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE guia_ingreso DROP CONSTRAINT IF EXISTS guia_ingreso_grupo_id_fkey;
ALTER TABLE guia_ingreso
  ADD CONSTRAINT guia_ingreso_grupo_id_fkey
  FOREIGN KEY (grupo_id) REFERENCES grupo (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE guia_ingreso DROP CONSTRAINT IF EXISTS guia_ingreso_fundo_id_fkey;
ALTER TABLE guia_ingreso
  ADD CONSTRAINT guia_ingreso_fundo_id_fkey
  FOREIGN KEY (fundo_id) REFERENCES fundo (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE guia_ingreso DROP CONSTRAINT IF EXISTS guia_ingreso_modulo_id_fkey;
ALTER TABLE guia_ingreso
  ADD CONSTRAINT guia_ingreso_modulo_id_fkey
  FOREIGN KEY (modulo_id) REFERENCES modulo (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE guia_ingreso DROP CONSTRAINT IF EXISTS guia_ingreso_turno_id_fkey;
ALTER TABLE guia_ingreso
  ADD CONSTRAINT guia_ingreso_turno_id_fkey
  FOREIGN KEY (turno_id) REFERENCES turno (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE guia_ingreso DROP CONSTRAINT IF EXISTS guia_ingreso_lote_id_fkey;
ALTER TABLE guia_ingreso
  ADD CONSTRAINT guia_ingreso_lote_id_fkey
  FOREIGN KEY (lote_id) REFERENCES lote (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE guia_ingreso DROP CONSTRAINT IF EXISTS guia_ingreso_vehiculo_id_fkey;
ALTER TABLE guia_ingreso
  ADD CONSTRAINT guia_ingreso_vehiculo_id_fkey
  FOREIGN KEY (vehiculo_id) REFERENCES vehiculo (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE viaje DROP CONSTRAINT IF EXISTS viaje_conductor_id_fkey;
ALTER TABLE viaje
  ADD CONSTRAINT viaje_conductor_id_fkey
  FOREIGN KEY (conductor_id) REFERENCES chofer (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE viaje DROP CONSTRAINT IF EXISTS viaje_vehiculo_id_fkey;
ALTER TABLE viaje
  ADD CONSTRAINT viaje_vehiculo_id_fkey
  FOREIGN KEY (vehiculo_id) REFERENCES vehiculo (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE viaje DROP CONSTRAINT IF EXISTS viaje_usuario_id_fkey;
ALTER TABLE viaje
  ADD CONSTRAINT viaje_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ---------- 3. Impedir DELETE físico de documentos operativos (aunque alguien lo ejecute en SQL)
-- viaje_detalle SÍ se puede borrar desde la API mientras el viaje está en_proceso (corregir scan).

CREATE OR REPLACE FUNCTION deny_hard_delete_operativo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'No se puede eliminar %: la data operativa se conserva por auditoría (id=%)',
    TG_TABLE_NAME, OLD.id
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS guia_ingreso_no_delete ON guia_ingreso;
CREATE TRIGGER guia_ingreso_no_delete
  BEFORE DELETE ON guia_ingreso
  FOR EACH ROW EXECUTE FUNCTION deny_hard_delete_operativo();

DROP TRIGGER IF EXISTS viaje_no_delete ON viaje;
CREATE TRIGGER viaje_no_delete
  BEFORE DELETE ON viaje
  FOR EACH ROW EXECUTE FUNCTION deny_hard_delete_operativo();

DROP TRIGGER IF EXISTS croquis_no_delete ON croquis;
CREATE TRIGGER croquis_no_delete
  BEFORE DELETE ON croquis
  FOR EACH ROW EXECUTE FUNCTION deny_hard_delete_operativo();

DROP TRIGGER IF EXISTS croquis_pallet_no_delete ON croquis_pallet;
CREATE TRIGGER croquis_pallet_no_delete
  BEFORE DELETE ON croquis_pallet
  FOR EACH ROW EXECUTE FUNCTION deny_hard_delete_operativo();

DROP TRIGGER IF EXISTS grr_no_delete ON grr;
CREATE TRIGGER grr_no_delete
  BEFORE DELETE ON grr
  FOR EACH ROW EXECUTE FUNCTION deny_hard_delete_operativo();

DROP TRIGGER IF EXISTS grr_detalle_no_delete ON grr_detalle;
CREATE TRIGGER grr_detalle_no_delete
  BEFORE DELETE ON grr_detalle
  FOR EACH ROW EXECUTE FUNCTION deny_hard_delete_operativo();

-- ============================================================================
-- Despacho Campo — esquema completo de base de datos (PostgreSQL 15+)
--
-- Para una base VACÍA. Crea las 21 tablas del sistema con sus restricciones,
-- llaves foráneas, índices, funciones y triggers (auditoría: la data operativa
-- no se borra; tiempo real: pg_notify 'despacho_eventos'), los roles base y el
-- registro de migraciones.
--
-- Ejecutar con psql:   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f esquema_completo.sql
-- o pegar completo en el SQL Editor de Neon.
--
-- Generado desde sql/migrations con scripts/generar_esquema_completo.py.
-- No editar a mano: los cambios de esquema van como nueva migración.
-- ============================================================================

BEGIN;

-- ############################################################################
-- Migración 0001_esquema_base.sql
-- ############################################################################
-- Esquema base de Despacho Campo (generado desde el catálogo de Postgres).
-- Aplicar solo sobre una base vacía; en la base existente se marca como aplicado.

SET client_min_messages = warning;

-- ---------- Funciones
CREATE OR REPLACE FUNCTION public.nombre_desde_codigo_modulo(p_codigo text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN upper(btrim(p_codigo)) ~ '^M[0-9]{2}[A-Z]*$'
      THEN 'MODULO ' || substr(upper(btrim(p_codigo)), 2)
    ELSE NULL
  END;
$function$;

CREATE OR REPLACE FUNCTION public.nombre_desde_codigo_turno(p_codigo text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN upper(btrim(p_codigo)) ~ '^T[0-9]{2}$'
      THEN 'TURNO ' || substr(upper(btrim(p_codigo)), 2)
    ELSE NULL
  END;
$function$;

CREATE OR REPLACE FUNCTION public.deny_hard_delete_operativo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION
    'No se puede eliminar %: la data operativa se conserva por auditoría (id=%)',
    TG_TABLE_NAME, OLD.id
    USING ERRCODE = 'restrict_violation';
END;
$function$;

CREATE OR REPLACE FUNCTION public.despacho_notify()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    tipo TEXT;
    ref_id INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'guia_ingreso' THEN
        tipo := 'guia';
        ref_id := NEW.id;
    ELSIF TG_TABLE_NAME = 'viaje' THEN
        tipo := 'viaje';
        ref_id := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        -- viaje_detalle: quitar una guía del viaje también cambia el viaje.
        tipo := 'viaje';
        ref_id := OLD.viaje_id;
    ELSE
        -- grr, viaje_detalle: se notifica el viaje al que pertenecen.
        tipo := 'viaje';
        ref_id := NEW.viaje_id;
    END IF;
    PERFORM pg_notify(
        'despacho_eventos',
        json_build_object('t', tipo, 'tb', TG_TABLE_NAME, 'op', TG_OP, 'id', ref_id)::text
    );
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_grupo_empresa_fundo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.fundo_id IS NOT NULL AND NEW.empresa_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM fundo f
      WHERE f.id = NEW.fundo_id
        AND f.empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'El fundo no pertenece a la empresa del grupo';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_lote_codigo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v text;
BEGIN
  v := upper(btrim(NEW.codigo));
  IF v ~ '^[0-9]{1,3}$' THEN
    NEW.codigo := 'L' || lpad(v, 3, '0');
  ELSE
    NEW.codigo := v;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_modulo_nombre()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.codigo := upper(btrim(NEW.codigo));
  IF NEW.nombre IS NULL OR btrim(NEW.nombre) = '' THEN
    NEW.nombre := nombre_desde_codigo_modulo(NEW.codigo);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_turno_nombre()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.codigo := upper(btrim(NEW.codigo));
  IF NEW.nombre IS NULL OR btrim(NEW.nombre) = '' THEN
    NEW.nombre := nombre_desde_codigo_turno(NEW.codigo);
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------- Tablas
CREATE TABLE actividad_economica (
    codigo character varying(10) NOT NULL,
    descripcion text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT actividad_economica_pkey PRIMARY KEY (codigo)
);

CREATE TABLE areas (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    prefijo text NOT NULL,
    nombre text NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT areas_prefijo_key UNIQUE (prefijo),
    CONSTRAINT areas_pkey PRIMARY KEY (id),
    CONSTRAINT areas_prefijo_upper CHECK ((prefijo = upper(prefijo)))
);

CREATE TABLE cargo (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    nombre character varying(120) NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uk_cargo_nombre UNIQUE (nombre),
    CONSTRAINT cargo_pkey PRIMARY KEY (id)
);

CREATE TABLE chofer (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    dni character varying(15) NOT NULL,
    nombre character varying(200) NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uk_chofer_dni UNIQUE (dni),
    CONSTRAINT chofer_pkey PRIMARY KEY (id)
);

CREATE TABLE croquis (
    id serial NOT NULL,
    viaje_id integer NOT NULL,
    fecha date NOT NULL,
    placa character varying(15) NOT NULL,
    punto_partida character varying(120) NOT NULL,
    punto_llegada character varying(120) NOT NULL,
    motivo_traslado character varying(200) NOT NULL DEFAULT 'Traslado de fruta'::character varying,
    hora_salida time without time zone NOT NULL,
    total_jarras integer NOT NULL DEFAULT 0,
    total_jabas integer NOT NULL DEFAULT 0,
    total_pallets integer NOT NULL DEFAULT 0,
    temperatura numeric(5,2),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT croquis_viaje_id_key UNIQUE (viaje_id),
    CONSTRAINT croquis_pkey PRIMARY KEY (id)
);

CREATE TABLE croquis_pallet (
    id serial NOT NULL,
    croquis_id integer NOT NULL,
    nombre character varying(30) NOT NULL,
    orden integer NOT NULL DEFAULT 0,
    modulo character varying(20) NOT NULL,
    turno character varying(20) NOT NULL,
    variedad character varying(80) NOT NULL DEFAULT ''::character varying,
    jarras integer NOT NULL DEFAULT 0,
    jabas integer NOT NULL DEFAULT 0,
    es_continuacion boolean NOT NULL DEFAULT false,
    pallet_padre_id integer,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT croquis_pallet_pkey PRIMARY KEY (id)
);

CREATE TABLE empresa (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    ruc character(11) NOT NULL,
    razon_social character varying(200) NOT NULL,
    domicilio_fiscal text,
    actividad_economica_codigo character varying(10),
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uk_empresa_ruc UNIQUE (ruc),
    CONSTRAINT empresa_pkey PRIMARY KEY (id)
);

CREATE TABLE fundo (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    empresa_id bigint NOT NULL,
    nombre character varying(120) NOT NULL,
    domicilio text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uk_fundo_empresa_nombre UNIQUE (empresa_id, nombre),
    CONSTRAINT fundo_pkey PRIMARY KEY (id)
);

CREATE TABLE grr (
    id serial NOT NULL,
    viaje_id integer NOT NULL,
    numero character varying(30) NOT NULL,
    fecha_emision date NOT NULL,
    remitente character varying(200) NOT NULL,
    destinatario character varying(200) NOT NULL,
    motivo_traslado character varying(200) NOT NULL,
    placa character varying(15) NOT NULL,
    punto_partida character varying(120) NOT NULL DEFAULT ''::character varying,
    punto_llegada character varying(120) NOT NULL DEFAULT ''::character varying,
    total_jarras integer NOT NULL DEFAULT 0,
    total_jabas integer NOT NULL DEFAULT 0,
    estado character varying(20) NOT NULL DEFAULT 'emitido'::character varying,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    recepcionado boolean NOT NULL DEFAULT false,
    recepcionado_at timestamp with time zone,
    CONSTRAINT grr_numero_key UNIQUE (numero),
    CONSTRAINT grr_viaje_id_key UNIQUE (viaje_id),
    CONSTRAINT grr_pkey PRIMARY KEY (id),
    CONSTRAINT grr_estado_check CHECK (((estado)::text = ANY ((ARRAY['emitido'::character varying, 'anulado'::character varying])::text[])))
);

CREATE TABLE grr_detalle (
    id serial NOT NULL,
    grr_id integer NOT NULL,
    pallet character varying(30) NOT NULL,
    modulo character varying(20) NOT NULL,
    turno character varying(20) NOT NULL,
    variedad character varying(80) NOT NULL DEFAULT ''::character varying,
    jarras integer NOT NULL DEFAULT 0,
    jabas integer NOT NULL DEFAULT 0,
    orden integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT grr_detalle_pkey PRIMARY KEY (id)
);

CREATE TABLE grupo (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    nombre character varying(80) NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    empresa_id bigint,
    fundo_id bigint,
    CONSTRAINT uk_grupo_fundo_nombre UNIQUE (fundo_id, nombre),
    CONSTRAINT grupo_pkey PRIMARY KEY (id)
);

CREATE TABLE guia_ingreso (
    id serial NOT NULL,
    codigo character varying(24) NOT NULL,
    fecha date NOT NULL,
    hora_envio time without time zone NOT NULL,
    usuario_id integer NOT NULL,
    usuario_dni character varying(15) NOT NULL,
    usuario_nombre character varying(200) NOT NULL,
    grupo_id integer,
    grupo character varying(80) NOT NULL DEFAULT ''::character varying,
    fundo_id integer,
    fundo character varying(120) NOT NULL DEFAULT ''::character varying,
    modulo_id integer NOT NULL,
    modulo character varying(20) NOT NULL,
    turno_id integer NOT NULL,
    turno character varying(20) NOT NULL,
    lote_id integer NOT NULL,
    lote character varying(30) NOT NULL,
    tipo_producto character varying(80) NOT NULL,
    tipo_llenado numeric(10,2) NOT NULL,
    envase_principal character varying(80) NOT NULL,
    jabas_completas integer NOT NULL DEFAULT 0,
    jabas_incompletas integer NOT NULL DEFAULT 0,
    jarras_jabas integer NOT NULL DEFAULT 0,
    jarras_extras integer NOT NULL DEFAULT 0,
    jabas_totales integer NOT NULL DEFAULT 0,
    jarras_totales integer NOT NULL DEFAULT 0,
    ha numeric(12,4) NOT NULL DEFAULT 0,
    observacion text NOT NULL DEFAULT ''::text,
    vehiculo_id integer NOT NULL,
    placa character varying(15) NOT NULL,
    estado character varying(20) NOT NULL DEFAULT 'registrado'::character varying,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    recepcionado_acopio boolean NOT NULL DEFAULT false,
    recepcionado_acopio_at timestamp with time zone,
    recepcionado_planta boolean NOT NULL DEFAULT false,
    recepcionado_planta_at timestamp with time zone,
    jarras_llegaron integer,
    jabas_llegaron integer,
    CONSTRAINT guia_ingreso_codigo_key UNIQUE (codigo),
    CONSTRAINT guia_ingreso_pkey PRIMARY KEY (id),
    CONSTRAINT chk_gi_orden_recepcion CHECK (((NOT recepcionado_planta) OR recepcionado_acopio)),
    CONSTRAINT guia_ingreso_estado_chk CHECK (((estado)::text = ANY ((ARRAY['registrado'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT guia_ingreso_jabas_completas_check CHECK ((jabas_completas >= 0)),
    CONSTRAINT guia_ingreso_jabas_incompletas_check CHECK ((jabas_incompletas >= 0)),
    CONSTRAINT guia_ingreso_jabas_totales_check CHECK ((jabas_totales >= 0)),
    CONSTRAINT guia_ingreso_jarras_extras_check CHECK ((jarras_extras >= 0)),
    CONSTRAINT guia_ingreso_jarras_jabas_check CHECK ((jarras_jabas >= 0)),
    CONSTRAINT guia_ingreso_jarras_totales_check CHECK ((jarras_totales >= 0))
);

CREATE TABLE lote (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    turno_id bigint NOT NULL,
    codigo character varying(30) NOT NULL,
    area_ha numeric(12,4) NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uk_lote_turno_codigo UNIQUE (turno_id, codigo),
    CONSTRAINT lote_pkey PRIMARY KEY (id),
    CONSTRAINT ck_lote_area CHECK ((area_ha > (0)::numeric))
);

CREATE TABLE modulo (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    fundo_id bigint NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(80),
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uk_modulo_fundo_codigo UNIQUE (fundo_id, codigo),
    CONSTRAINT modulo_pkey PRIMARY KEY (id)
);

CREATE TABLE proveedor (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    nombre character varying(120) NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uk_proveedor_nombre UNIQUE (nombre),
    CONSTRAINT proveedor_pkey PRIMARY KEY (id)
);

CREATE TABLE rol (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    nombre character varying(80) NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uk_rol_nombre UNIQUE (nombre),
    CONSTRAINT rol_pkey PRIMARY KEY (id)
);

CREATE TABLE turno (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    modulo_id bigint NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(80),
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uk_turno_modulo_codigo UNIQUE (modulo_id, codigo),
    CONSTRAINT turno_pkey PRIMARY KEY (id)
);

CREATE TABLE usuario (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    dni character varying(15) NOT NULL,
    nombre character varying(200) NOT NULL,
    cargo_id bigint,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    password_hash character varying(255),
    rol_id bigint,
    grupo_id bigint,
    area_id bigint,
    CONSTRAINT uk_usuario_dni UNIQUE (dni),
    CONSTRAINT usuario_pkey PRIMARY KEY (id)
);

CREATE TABLE vehiculo (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    placa character varying(15) NOT NULL,
    proveedor_id bigint NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    chofer_id bigint,
    CONSTRAINT uk_vehiculo_placa UNIQUE (placa),
    CONSTRAINT vehiculo_pkey PRIMARY KEY (id)
);

CREATE TABLE viaje (
    id serial NOT NULL,
    codigo character varying(30) NOT NULL,
    tipo_viaje character varying(10) NOT NULL,
    conductor_id integer,
    conductor_nombre character varying(200) NOT NULL DEFAULT ''::character varying,
    vehiculo_id integer,
    placa character varying(15) NOT NULL DEFAULT ''::character varying,
    kia_origen character varying(80) NOT NULL DEFAULT ''::character varying,
    kia_destino character varying(80) NOT NULL DEFAULT ''::character varying,
    observacion text NOT NULL DEFAULT ''::text,
    estado character varying(20) NOT NULL DEFAULT 'en_proceso'::character varying,
    usuario_id integer,
    fecha date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT viaje_codigo_key UNIQUE (codigo),
    CONSTRAINT viaje_pkey PRIMARY KEY (id),
    CONSTRAINT viaje_estado_check CHECK (((estado)::text = ANY ((ARRAY['en_proceso'::character varying, 'finalizado'::character varying, 'recepcionado'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT viaje_tipo_viaje_check CHECK (((tipo_viaje)::text = ANY ((ARRAY['directo'::character varying, 'agrupado'::character varying])::text[])))
);

CREATE TABLE viaje_detalle (
    id serial NOT NULL,
    viaje_id integer NOT NULL,
    guia_ingreso_id integer NOT NULL,
    modulo character varying(20) NOT NULL DEFAULT ''::character varying,
    turno character varying(20) NOT NULL DEFAULT ''::character varying,
    lote character varying(30) NOT NULL DEFAULT ''::character varying,
    jabas_completas integer NOT NULL DEFAULT 0,
    jabas_incompletas integer NOT NULL DEFAULT 0,
    jarras integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT viaje_detalle_viaje_id_guia_ingreso_id_key UNIQUE (viaje_id, guia_ingreso_id),
    CONSTRAINT viaje_detalle_pkey PRIMARY KEY (id)
);

-- ---------- Llaves foráneas
ALTER TABLE croquis ADD CONSTRAINT croquis_viaje_id_fkey FOREIGN KEY (viaje_id) REFERENCES viaje(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE croquis_pallet ADD CONSTRAINT croquis_pallet_croquis_id_fkey FOREIGN KEY (croquis_id) REFERENCES croquis(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE croquis_pallet ADD CONSTRAINT croquis_pallet_pallet_padre_id_fkey FOREIGN KEY (pallet_padre_id) REFERENCES croquis_pallet(id);
ALTER TABLE empresa ADD CONSTRAINT empresa_actividad_economica_codigo_fkey FOREIGN KEY (actividad_economica_codigo) REFERENCES actividad_economica(codigo);
ALTER TABLE fundo ADD CONSTRAINT fundo_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresa(id);
ALTER TABLE grr ADD CONSTRAINT grr_viaje_id_fkey FOREIGN KEY (viaje_id) REFERENCES viaje(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE grr_detalle ADD CONSTRAINT grr_detalle_grr_id_fkey FOREIGN KEY (grr_id) REFERENCES grr(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE grupo ADD CONSTRAINT grupo_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresa(id);
ALTER TABLE grupo ADD CONSTRAINT grupo_fundo_id_fkey FOREIGN KEY (fundo_id) REFERENCES fundo(id);
ALTER TABLE guia_ingreso ADD CONSTRAINT guia_ingreso_fundo_id_fkey FOREIGN KEY (fundo_id) REFERENCES fundo(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE guia_ingreso ADD CONSTRAINT guia_ingreso_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES grupo(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE guia_ingreso ADD CONSTRAINT guia_ingreso_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES lote(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE guia_ingreso ADD CONSTRAINT guia_ingreso_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES modulo(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE guia_ingreso ADD CONSTRAINT guia_ingreso_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES turno(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE guia_ingreso ADD CONSTRAINT guia_ingreso_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE guia_ingreso ADD CONSTRAINT guia_ingreso_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES vehiculo(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE lote ADD CONSTRAINT lote_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES turno(id);
ALTER TABLE modulo ADD CONSTRAINT modulo_fundo_id_fkey FOREIGN KEY (fundo_id) REFERENCES fundo(id);
ALTER TABLE turno ADD CONSTRAINT turno_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES modulo(id);
ALTER TABLE usuario ADD CONSTRAINT usuario_area_id_fkey FOREIGN KEY (area_id) REFERENCES areas(id);
ALTER TABLE usuario ADD CONSTRAINT usuario_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES cargo(id);
ALTER TABLE usuario ADD CONSTRAINT usuario_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES grupo(id);
ALTER TABLE usuario ADD CONSTRAINT usuario_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES rol(id);
ALTER TABLE vehiculo ADD CONSTRAINT vehiculo_chofer_id_fkey FOREIGN KEY (chofer_id) REFERENCES chofer(id);
ALTER TABLE vehiculo ADD CONSTRAINT vehiculo_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES proveedor(id);
ALTER TABLE viaje ADD CONSTRAINT viaje_conductor_id_fkey FOREIGN KEY (conductor_id) REFERENCES chofer(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE viaje ADD CONSTRAINT viaje_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE viaje ADD CONSTRAINT viaje_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES vehiculo(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE viaje_detalle ADD CONSTRAINT viaje_detalle_guia_ingreso_id_fkey FOREIGN KEY (guia_ingreso_id) REFERENCES guia_ingreso(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE viaje_detalle ADD CONSTRAINT viaje_detalle_viaje_id_fkey FOREIGN KEY (viaje_id) REFERENCES viaje(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

-- ---------- Índices (los de PK/UNIQUE ya los crean sus restricciones)
CREATE INDEX croquis_pallet_croquis_idx ON public.croquis_pallet USING btree (croquis_id);
CREATE INDEX ix_fundo_empresa ON public.fundo USING btree (empresa_id);
CREATE INDEX grr_detalle_grr_idx ON public.grr_detalle USING btree (grr_id);
CREATE INDEX ix_grupo_empresa ON public.grupo USING btree (empresa_id);
CREATE INDEX ix_grupo_fundo ON public.grupo USING btree (fundo_id);
CREATE INDEX gi_cola_acopio_idx ON public.guia_ingreso USING btree (fecha, recepcionado_acopio, recepcionado_planta) WHERE ((estado)::text = 'registrado'::text);
CREATE INDEX gi_lote_fecha_ha_idx ON public.guia_ingreso USING btree (lote_id, fecha) WHERE ((estado)::text <> 'anulado'::text);
CREATE INDEX guia_ingreso_fecha_idx ON public.guia_ingreso USING btree (fecha DESC, codigo DESC);
CREATE INDEX guia_ingreso_fundo_idx ON public.guia_ingreso USING btree (fundo_id);
CREATE INDEX guia_ingreso_usuario_idx ON public.guia_ingreso USING btree (usuario_id);
CREATE INDEX guia_ingreso_vehiculo_idx ON public.guia_ingreso USING btree (vehiculo_id);
CREATE INDEX ix_lote_turno ON public.lote USING btree (turno_id);
CREATE INDEX ix_modulo_fundo ON public.modulo USING btree (fundo_id);
CREATE INDEX ix_turno_modulo ON public.turno USING btree (modulo_id);
CREATE INDEX ix_usuario_cargo ON public.usuario USING btree (cargo_id);
CREATE INDEX ix_usuario_grupo ON public.usuario USING btree (grupo_id);
CREATE INDEX ix_usuario_rol ON public.usuario USING btree (rol_id);
CREATE INDEX ix_vehiculo_chofer ON public.vehiculo USING btree (chofer_id);
CREATE INDEX ix_vehiculo_proveedor ON public.vehiculo USING btree (proveedor_id);
CREATE INDEX viaje_estado_fecha_idx ON public.viaje USING btree (estado, fecha DESC);
CREATE INDEX viaje_fecha_idx ON public.viaje USING btree (fecha DESC);
CREATE INDEX viaje_usuario_idx ON public.viaje USING btree (usuario_id);
CREATE INDEX viaje_detalle_guia_idx ON public.viaje_detalle USING btree (guia_ingreso_id);
CREATE INDEX viaje_detalle_viaje_idx ON public.viaje_detalle USING btree (viaje_id);

-- ---------- Triggers
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.actividad_economica FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.cargo FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.chofer FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER croquis_no_delete BEFORE DELETE ON public.croquis FOR EACH ROW EXECUTE FUNCTION deny_hard_delete_operativo();
CREATE TRIGGER croquis_pallet_no_delete BEFORE DELETE ON public.croquis_pallet FOR EACH ROW EXECUTE FUNCTION deny_hard_delete_operativo();
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.empresa FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.fundo FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER despacho_notify_grr AFTER INSERT OR UPDATE ON public.grr FOR EACH ROW EXECUTE FUNCTION despacho_notify();
CREATE TRIGGER grr_no_delete BEFORE DELETE ON public.grr FOR EACH ROW EXECUTE FUNCTION deny_hard_delete_operativo();
CREATE TRIGGER grr_detalle_no_delete BEFORE DELETE ON public.grr_detalle FOR EACH ROW EXECUTE FUNCTION deny_hard_delete_operativo();
CREATE TRIGGER t_biu_grupo_empresa_fundo BEFORE INSERT OR UPDATE OF empresa_id, fundo_id ON public.grupo FOR EACH ROW EXECUTE FUNCTION trg_grupo_empresa_fundo();
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.grupo FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER despacho_notify_guia AFTER INSERT OR UPDATE ON public.guia_ingreso FOR EACH ROW EXECUTE FUNCTION despacho_notify();
CREATE TRIGGER guia_ingreso_no_delete BEFORE DELETE ON public.guia_ingreso FOR EACH ROW EXECUTE FUNCTION deny_hard_delete_operativo();
CREATE TRIGGER t_biu_lote_codigo BEFORE INSERT OR UPDATE OF codigo ON public.lote FOR EACH ROW EXECUTE FUNCTION trg_lote_codigo();
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.lote FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER t_biu_modulo_nombre BEFORE INSERT OR UPDATE OF codigo, nombre ON public.modulo FOR EACH ROW EXECUTE FUNCTION trg_modulo_nombre();
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.modulo FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.proveedor FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.rol FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER t_biu_turno_nombre BEFORE INSERT OR UPDATE OF codigo, nombre ON public.turno FOR EACH ROW EXECUTE FUNCTION trg_turno_nombre();
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.turno FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.usuario FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER t_bu_updated_at BEFORE UPDATE ON public.vehiculo FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER despacho_notify_viaje AFTER INSERT OR UPDATE ON public.viaje FOR EACH ROW EXECUTE FUNCTION despacho_notify();
CREATE TRIGGER viaje_no_delete BEFORE DELETE ON public.viaje FOR EACH ROW EXECUTE FUNCTION deny_hard_delete_operativo();
CREATE TRIGGER despacho_notify_viaje_detalle AFTER INSERT OR DELETE OR UPDATE ON public.viaje_detalle FOR EACH ROW EXECUTE FUNCTION despacho_notify();

-- ############################################################################
-- Migración 0002_indices_operacion.sql
-- ############################################################################
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

-- ############################################################################
-- Datos base: roles que usan los permisos de la web (app/permisos.py) y el móvil
-- ############################################################################
INSERT INTO rol (nombre)
VALUES ('ADMINISTRADOR'),
       ('SUPERVISOR'),
       ('OPERARIO'),
       ('AUXILIAR DE ACOPIO')
ON CONFLICT (nombre) DO NOTHING;

-- ############################################################################
-- Registro de migraciones (mismo formato que backend/migrate.py)
-- ############################################################################
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    aplicado_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (version, checksum)
VALUES ('0001_esquema_base.sql', '9c95684af06ecb535620c2773fd2d9e74e323ceff658f2b2ab3ea3486a4cde43'),
       ('0002_indices_operacion.sql', '604052f12155811a7562d9346c94d9b4faf5846a2a27fa66a3ee2fb6e0696603')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Primer administrador (ejecutar aparte, reemplazando DNI y nombre).
-- Su contraseña inicial en la web es el mismo DNI; se le pedirá cambiarla.
-- ============================================================================
-- INSERT INTO usuario (dni, nombre, rol_id, activo)
-- SELECT '00000000', 'NOMBRE DEL ADMINISTRADOR', id, TRUE FROM rol WHERE nombre = 'ADMINISTRADOR';

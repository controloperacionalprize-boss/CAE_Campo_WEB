-- Guía de ingreso (GI-YYMMDD-NNNN). Snapshots de usuario/grupo/fundo/lote/placa
-- para que el registro histórico no cambie si se editan los maestros.

CREATE TABLE IF NOT EXISTS guia_ingreso (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(24) NOT NULL UNIQUE,
    fecha DATE NOT NULL,
    hora_envio TIME NOT NULL,
    usuario_id INTEGER NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    usuario_dni VARCHAR(15) NOT NULL,
    usuario_nombre VARCHAR(200) NOT NULL,
    grupo_id INTEGER REFERENCES grupo (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    grupo VARCHAR(80) NOT NULL DEFAULT '',
    fundo_id INTEGER REFERENCES fundo (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    fundo VARCHAR(120) NOT NULL DEFAULT '',
    modulo_id INTEGER NOT NULL REFERENCES modulo (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    modulo VARCHAR(20) NOT NULL,
    turno_id INTEGER NOT NULL REFERENCES turno (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    turno VARCHAR(20) NOT NULL,
    lote_id INTEGER NOT NULL REFERENCES lote (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    lote VARCHAR(30) NOT NULL,
    tipo_producto VARCHAR(80) NOT NULL,
    tipo_llenado NUMERIC(10, 2) NOT NULL,
    envase_principal VARCHAR(80) NOT NULL,
    jabas_completas INTEGER NOT NULL DEFAULT 0 CHECK (jabas_completas >= 0),
    jabas_incompletas INTEGER NOT NULL DEFAULT 0 CHECK (jabas_incompletas >= 0),
    jarras_jabas INTEGER NOT NULL DEFAULT 0 CHECK (jarras_jabas >= 0),
    jarras_extras INTEGER NOT NULL DEFAULT 0 CHECK (jarras_extras >= 0),
    jabas_totales INTEGER NOT NULL DEFAULT 0 CHECK (jabas_totales >= 0),
    jarras_totales INTEGER NOT NULL DEFAULT 0 CHECK (jarras_totales >= 0),
    ha NUMERIC(12, 4) NOT NULL DEFAULT 0,
    observacion TEXT NOT NULL DEFAULT '',
    vehiculo_id INTEGER NOT NULL REFERENCES vehiculo (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    placa VARCHAR(15) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'registrado',
    recepcionado_acopio BOOLEAN NOT NULL DEFAULT FALSE,
    recepcionado_acopio_at TIMESTAMPTZ,
    recepcionado_planta BOOLEAN NOT NULL DEFAULT FALSE,
    recepcionado_planta_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT guia_ingreso_estado_chk CHECK (estado IN ('registrado', 'anulado')),
    CONSTRAINT chk_gi_orden_recepcion CHECK (NOT recepcionado_planta OR recepcionado_acopio)
);

CREATE INDEX IF NOT EXISTS guia_ingreso_fecha_idx ON guia_ingreso (fecha DESC, codigo DESC);
CREATE INDEX IF NOT EXISTS guia_ingreso_fundo_idx ON guia_ingreso (fundo_id);
CREATE INDEX IF NOT EXISTS guia_ingreso_usuario_idx ON guia_ingreso (usuario_id);
CREATE INDEX IF NOT EXISTS guia_ingreso_vehiculo_idx ON guia_ingreso (vehiculo_id);
CREATE INDEX IF NOT EXISTS gi_cola_acopio_idx
    ON guia_ingreso (fecha, recepcionado_acopio, recepcionado_planta)
    WHERE estado = 'registrado';

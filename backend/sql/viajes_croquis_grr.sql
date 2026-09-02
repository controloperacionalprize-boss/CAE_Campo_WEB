-- ============================================================
-- TABLAS PARA: Viajes, Croquis y GRR
-- Depende de: guia_ingreso, vehiculo, chofer
-- ============================================================

-- 1. VIAJE
CREATE TABLE IF NOT EXISTS viaje (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    tipo_viaje VARCHAR(10) NOT NULL CHECK (tipo_viaje IN ('directo', 'agrupado')),
    conductor_id INTEGER REFERENCES chofer (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    conductor_nombre VARCHAR(200) NOT NULL DEFAULT '',
    vehiculo_id INTEGER REFERENCES vehiculo (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    placa VARCHAR(15) NOT NULL DEFAULT '',
    kia_origen VARCHAR(80) NOT NULL DEFAULT '',
    kia_destino VARCHAR(80) NOT NULL DEFAULT '',
    observacion TEXT NOT NULL DEFAULT '',
    estado VARCHAR(20) NOT NULL DEFAULT 'en_proceso' CHECK (estado IN ('en_proceso', 'finalizado', 'recepcionado', 'anulado')),
    usuario_id INTEGER REFERENCES usuario (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS viaje_fecha_idx ON viaje (fecha DESC);
CREATE INDEX IF NOT EXISTS viaje_usuario_idx ON viaje (usuario_id);

-- 2. VIAJE_DETALLE (QRs/guias seleccionadas por viaje)
CREATE TABLE IF NOT EXISTS viaje_detalle (
    id SERIAL PRIMARY KEY,
    viaje_id INTEGER NOT NULL REFERENCES viaje (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    guia_ingreso_id INTEGER NOT NULL REFERENCES guia_ingreso (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    modulo VARCHAR(20) NOT NULL DEFAULT '',
    turno VARCHAR(20) NOT NULL DEFAULT '',
    lote VARCHAR(30) NOT NULL DEFAULT '',
    jabas_completas INTEGER NOT NULL DEFAULT 0,
    jabas_incompletas INTEGER NOT NULL DEFAULT 0,
    jarras INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (viaje_id, guia_ingreso_id)
);

CREATE INDEX IF NOT EXISTS viaje_detalle_viaje_idx ON viaje_detalle (viaje_id);

-- 3. CROQUIS
CREATE TABLE IF NOT EXISTS croquis (
    id SERIAL PRIMARY KEY,
    viaje_id INTEGER NOT NULL UNIQUE REFERENCES viaje (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    fecha DATE NOT NULL,
    placa VARCHAR(15) NOT NULL,
    punto_partida VARCHAR(120) NOT NULL,
    punto_llegada VARCHAR(120) NOT NULL,
    motivo_traslado VARCHAR(200) NOT NULL DEFAULT 'Traslado de fruta',
    hora_salida TIME NOT NULL,
    total_jarras INTEGER NOT NULL DEFAULT 0,
    total_jabas INTEGER NOT NULL DEFAULT 0,
    total_pallets INTEGER NOT NULL DEFAULT 0,
    temperatura NUMERIC(5, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. CROQUIS_PALLET (cada pallet del croquis)
CREATE TABLE IF NOT EXISTS croquis_pallet (
    id SERIAL PRIMARY KEY,
    croquis_id INTEGER NOT NULL REFERENCES croquis (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    nombre VARCHAR(30) NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    modulo VARCHAR(20) NOT NULL,
    turno VARCHAR(20) NOT NULL,
    variedad VARCHAR(80) NOT NULL DEFAULT '',
    jarras INTEGER NOT NULL DEFAULT 0,
    jabas INTEGER NOT NULL DEFAULT 0,
    es_continuacion BOOLEAN NOT NULL DEFAULT FALSE,
    pallet_padre_id INTEGER REFERENCES croquis_pallet (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS croquis_pallet_croquis_idx ON croquis_pallet (croquis_id);

-- 5. GRR (Guía de Remisión del Remitente)
CREATE TABLE IF NOT EXISTS grr (
    id SERIAL PRIMARY KEY,
    viaje_id INTEGER NOT NULL UNIQUE REFERENCES viaje (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    numero VARCHAR(30) NOT NULL UNIQUE,
    fecha_emision DATE NOT NULL,
    remitente VARCHAR(200) NOT NULL,
    destinatario VARCHAR(200) NOT NULL,
    motivo_traslado VARCHAR(200) NOT NULL,
    placa VARCHAR(15) NOT NULL,
    punto_partida VARCHAR(120) NOT NULL DEFAULT '',
    punto_llegada VARCHAR(120) NOT NULL DEFAULT '',
    total_jarras INTEGER NOT NULL DEFAULT 0,
    total_jabas INTEGER NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'emitido' CHECK (estado IN ('emitido', 'anulado')),
    recepcionado BOOLEAN NOT NULL DEFAULT FALSE,
    recepcionado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. GRR_DETALLE (líneas de la guía)
CREATE TABLE IF NOT EXISTS grr_detalle (
    id SERIAL PRIMARY KEY,
    grr_id INTEGER NOT NULL REFERENCES grr (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    pallet VARCHAR(30) NOT NULL,
    modulo VARCHAR(20) NOT NULL,
    turno VARCHAR(20) NOT NULL,
    variedad VARCHAR(80) NOT NULL DEFAULT '',
    jarras INTEGER NOT NULL DEFAULT 0,
    jabas INTEGER NOT NULL DEFAULT 0,
    orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grr_detalle_grr_idx ON grr_detalle (grr_id);

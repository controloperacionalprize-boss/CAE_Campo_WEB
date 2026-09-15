-- Tiempo real entre procesos: cada cambio en guías, viajes o GRR emite un
-- pg_notify en el canal 'despacho_eventos'. Todos los backends (Render, local,
-- varios workers) escuchan ese canal y reenvían el evento por SSE a la web.
-- Postgres entrega el aviso al hacer COMMIT y colapsa duplicados de la misma
-- transacción. Idempotente: se puede volver a ejecutar.

CREATE OR REPLACE FUNCTION despacho_notify() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS despacho_notify_guia ON guia_ingreso;
CREATE TRIGGER despacho_notify_guia
    AFTER INSERT OR UPDATE ON guia_ingreso
    FOR EACH ROW EXECUTE FUNCTION despacho_notify();

DROP TRIGGER IF EXISTS despacho_notify_viaje ON viaje;
CREATE TRIGGER despacho_notify_viaje
    AFTER INSERT OR UPDATE ON viaje
    FOR EACH ROW EXECUTE FUNCTION despacho_notify();

DROP TRIGGER IF EXISTS despacho_notify_grr ON grr;
CREATE TRIGGER despacho_notify_grr
    AFTER INSERT OR UPDATE ON grr
    FOR EACH ROW EXECUTE FUNCTION despacho_notify();

DROP TRIGGER IF EXISTS despacho_notify_viaje_detalle ON viaje_detalle;
CREATE TRIGGER despacho_notify_viaje_detalle
    AFTER INSERT OR UPDATE OR DELETE ON viaje_detalle
    FOR EACH ROW EXECUTE FUNCTION despacho_notify();

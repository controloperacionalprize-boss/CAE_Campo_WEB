# Despliegue y operación — Despacho Campo

Servicios: **API** en Render (Python), **web** en Vercel (sitio estático) y **base de datos** en Neon (Postgres).

Orden del primer despliegue: base de datos → API en Render → web en Vercel → volver a Render para autorizar el dominio de Vercel.

## 1. Base de datos (Neon)

1. Crear un proyecto (o branch) de Neon **solo para producción**, región **AWS us-east-2 (Ohio)**. No usar la base de desarrollo: comparte el esquema con tablas de otra aplicación.
2. Activar el historial de restauración a un punto en el tiempo (PITR) de al menos 7 días.
3. Crear el esquema. Elegir **una** de estas dos opciones:
   - **SQL Editor de Neon:** pegar y ejecutar completo `backend/sql/esquema_completo.sql`.
   - **Automático:** dejar la base vacía; el primer deploy de Render corre `python migrate.py` y crea todo.
4. Crear el primer administrador en el SQL Editor (reemplazar DNI y nombre):

   ```sql
   INSERT INTO usuario (dni, nombre, rol_id, activo)
   SELECT '00000000', 'NOMBRE DEL ADMINISTRADOR', id, TRUE FROM rol WHERE nombre = 'ADMINISTRADOR';
   ```

   Si el esquema se creó por migraciones (opción automática), antes crear los roles:
   `INSERT INTO rol (nombre) VALUES ('ADMINISTRADOR'),('SUPERVISOR'),('OPERARIO'),('AUXILIAR DE ACOPIO') ON CONFLICT (nombre) DO NOTHING;`
5. Copiar la cadena de conexión **con pooler** (host con `-pooler`) y `sslmode=require`.
6. Recomendado: un rol de mínimos privilegios para la API (`SELECT/INSERT/UPDATE` sobre las tablas del sistema, sin `DELETE` ni `DROP`) y otro, dueño del esquema, para las migraciones.

## 2. API en Render

1. Render → **New → Blueprint** → conectar el repositorio de GitHub → Render lee `render.yaml` y propone `despacho-campo-api`.
2. Completar las variables marcadas para llenar a mano:

   | Variable | Valor |
   |----------|-------|
   | `DATABASE_URL` | Cadena del pooler de Neon de producción (`...-pooler...neon.tech/...?sslmode=require`) |
   | `CORS_ORIGINS` | Por ahora `https://placeholder.invalid`; se reemplaza en el paso 4 con el dominio de Vercel |

   Render genera `API_KEY` y `AUTH_SECRET`. El resto (`APP_ENV=production`, `TZ=America/Lima`, región Ohio, plan Starter, `preDeployCommand: python migrate.py`, arranque con `--proxy-headers`) ya viene en `render.yaml`.
3. **Apply** → esperar el deploy. Verificar:
   - `https://despacho-campo-api.onrender.com/api/health` responde `{"ok": true}`.
   - En **Logs**: `migrate.py` aplicó o registró las migraciones y aparece `Tiempo real: escuchando Postgres`.
4. Cuando la web esté en Vercel (sección 3): **Environment → `CORS_ORIGINS`** = dominio de Vercel, p. ej. `https://despacho-campo.vercel.app` (sin `/` final; varios separados por coma) → **Save, rebuild and deploy**.
5. **Environment → `API_KEY` → copiar el valor** y entregarlo al equipo móvil por un canal seguro. No va en Vercel ni en ningún `VITE_*`.
6. Dominio propio para la API (opcional): **Settings → Custom Domains**, y agregarlo a `TRUSTED_HOSTS` (p. ej. `*.onrender.com,api.midominio.com`).
7. **Health Check** ya apunta a `/api/health`. Configurar además un monitor externo (UptimeRobot o similar) cada 5 minutos con alerta por correo.

> Notas: `preDeployCommand` requiere plan pago (Starter o superior). Si una migración falla, Render cancela el deploy y sigue la versión anterior. Mantener **1 instancia** hasta mover a almacén compartido el límite de tasa (ver «Escalar»).

## 3. Web en Vercel

1. Vercel → **Add New → Project** → importar el mismo repositorio de GitHub.
2. Configurar el proyecto:

   | Campo | Valor |
   |-------|-------|
   | Root Directory | `frontend` |
   | Framework Preset | Vite (lo detecta; `frontend/vercel.json` fija build, salida y rewrites) |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Node.js Version (Settings → General) | 22.x |

3. **Environment Variables** (entorno *Production*; repetir en *Preview* si se usarán previews):

   | Variable | Valor |
   |----------|-------|
   | `VITE_API_BASE_URL` | `https://despacho-campo-api.onrender.com` (sin `/` final) |

   Es la **única** variable. No agregar `VITE_API_KEY` ni ningún secreto: todo lo `VITE_*` queda público en el navegador.
4. **Deploy**. Anotar el dominio de producción (p. ej. `despacho-campo.vercel.app`) y volver a Render, paso 2.4, para ponerlo en `CORS_ORIGINS`.
5. Cambiar `VITE_API_BASE_URL` exige **Redeploy** en Vercel: se inyecta al compilar.
6. Dominio propio (opcional): **Settings → Domains**; agregar ese dominio también a `CORS_ORIGINS` en Render.
7. Previews: cada PR genera una URL distinta que la API rechazará por CORS. Para probar previews, agregar esa URL a `CORS_ORIGINS` temporalmente o usar solo el dominio de producción.

## 4. Verificación final

- Abrir la web → iniciar sesión con el administrador (contraseña = DNI) → la web pide cambiarla.
- Recargar el navegador estando en `/despacho`: debe cargar (no 404; lo resuelve el rewrite de `vercel.json`).
- Si la web muestra «No se pudo conectar con el servidor»: revisar `VITE_API_BASE_URL` en Vercel y `CORS_ORIGINS` en Render (el dominio exacto, con `https://`).
- Registrar una guía desde el móvil y verificar que aparece sola en Despacho (tiempo real).
- Iniciar sesión con un usuario OPERARIO: la web debe rechazarlo («use la app móvil»).
- Hacer un restore de prueba de Neon a un branch y confirmar que la API arranca contra él.

## 5. Operación

| Tarea | Cómo |
|-------|------|
| Cambio de esquema | Nuevo archivo `backend/sql/migrations/NNNN_descripcion.sql`; se aplica en el siguiente deploy de Render. Regenerar `sql/esquema_completo.sql` con `python -m scripts.generar_esquema_completo` |
| Ver migraciones | `python migrate.py --estado` (con `DATABASE_URL` de la base objetivo) |
| Rotar la clave del móvil | Nueva `API_KEY` en Render → redeploy → actualizar la app. La web no se afecta |
| Cerrar todas las sesiones web | Cambiar `AUTH_SECRET` en Render → redeploy |
| Usuario olvidó su contraseña | Personas → editar usuario → **Restablecer contraseña** (queda igual al DNI) |
| Dar o quitar acceso web a un rol | `PERMISOS_POR_ROL` en `backend/app/permisos.py` → PR → deploy |
| Rastrear un error reportado | Pedir la hora aproximada; buscar el `X-Request-ID` en los logs de Render |
| Monitoreo | Configurar un chequeo externo cada 1–5 min a `/api/health`, con alerta por correo |

### Escalar

- Mantener **1 instancia** de la API al inicio. El límite de tasa y el freno de intentos de login viven en memoria de cada proceso.
- Antes de pasar a 2 o más instancias: mover esos contadores a un almacén compartido (Redis o una tabla de Postgres). El tiempo real ya funciona entre instancias (triggers `pg_notify`), pero cada instancia abre una conexión directa (sin pooler) para `LISTEN`.
- `DB_POOL_MAX` × instancias debe quedar por debajo del límite de conexiones del pooler de Neon.

## 6. Contrato con la app móvil

| Caso | Endpoint | Notas |
|------|----------|-------|
| Autenticación | Header `X-API-Key` en cada petición | Clave del dispositivo |
| Ingreso del operador | `POST /api/v1/auth/login-movil` `{ "dni": "..." }` | Solo DNI. Devuelve `id`, `nombre`, `rol_id`, `rol`, `grupo_id`, `activo` para decidir las vistas |
| Registrar guía | `POST /api/v1/guias-ingreso` | **`ha` obligatorio** (> 0, hectáreas trabajadas). Se descuenta del saldo diario del lote; si excede, `400` con el saldo disponible |
| Reintento de envío | Mismo `POST` con el mismo `codigo` | Si ese usuario ya lo guardó, responde la guía existente (no duplica). `409` solo si el código es de otro usuario |
| Saldo de ha antes de registrar | `GET /api/v1/lotes/{id}/saldo-ha?fecha=` o `GET /api/v1/guias-ingreso/contexto?lote_id=` (`ha_saldo`) | El saldo se reinicia a las 00:00 hora de Lima |
| Recepción en acopio (escaneo QR) | `PATCH /api/v1/guias-ingreso/{id}/recepcionar-acopio` | Repetible: si la guía ya estaba en acopio responde `200` con la guía (no `409`) y conserva la hora del primer escaneo. Rechaza anuladas |
| Registrar llegada | `PATCH /api/v1/guias-ingreso/{id}/registrar-llegada` `{ jarras_llegaron, jabas_llegaron }` | Se puede volver a enviar para corregir el conteo. Rechaza guías anuladas |
| Anular viaje | `DELETE /api/v1/viajes/{id}` | **No borra**: pasa a `anulado` (solo viajes en proceso) y libera sus guías para otro viaje |
| Recepción en planta | `PATCH /api/v1/viajes/{id}/grr/recepcionar` | Marca también las guías del viaje como recepcionadas en planta |

Errores esperables: `401` clave inválida · `403` sin permiso · `409` conflicto · `429` demasiadas solicitudes (reintentar tras `Retry-After`) · `503` servidor ocupado (reintentar).

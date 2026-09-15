# Despacho Campo — API (FastAPI + Neon)

Backend compartido para la **app móvil** y la **web**. Despliegue y operación: [`docs/DESPLIEGUE.md`](../docs/DESPLIEGUE.md).

## Acceso

| Cliente | Credencial | Permisos |
|---------|------------|----------|
| Web | `POST /api/v1/auth/login` con DNI + contraseña → `Authorization: Bearer <token>` | Según rol (`app/permisos.py`) |
| App móvil | Header `X-API-Key` (credencial del dispositivo) | Operación completa; las vistas por rol las resuelve la app |
| Healthcheck | Ninguna: `GET /api/health` | — |

Matriz de la web (para cambiarla, editar solo `PERMISOS_POR_ROL` en `app/permisos.py`):

| Rol | Entra a la web | Operación (ver) | Reportes | Maestros (ver) | Maestros (editar) | Restablecer contraseñas |
|-----|:-:|:-:|:-:|:-:|:-:|:-:|
| ADMINISTRADOR | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SUPERVISOR | ✓ | ✓ | ✓ | ✓ | — | — |
| AUXILIAR DE ACOPIO | ✓ | ✓ | — | — | — | — |
| OPERARIO | — (solo móvil) | — | — | — | — | — |

- Contraseña inicial de la web = DNI. Al primer ingreso se guarda su hash (scrypt) y la web pide cambiarla.
- Cambiar contraseña o desactivar al usuario invalida sus sesiones abiertas.
- 5 intentos fallidos por DNI o IP bloquean el login 10 minutos.
- Todas las fechas de negocio ("hoy") usan la hora de Lima (`app/tiempo.py`), no la del servidor.

## Arranque local

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python migrate.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

`.env` en `backend/` o en la raíz:

| Variable | Local | Producción |
|----------|-------|------------|
| `DATABASE_URL` | Neon (branch de desarrollo) | Neon producción, `sslmode=require` |
| `API_KEY` | cualquiera | ≥ 24 caracteres (la genera Render) |
| `AUTH_SECRET` | opcional (se deriva de `API_KEY`) | **obligatorio**, ≥ 32 caracteres |
| `APP_ENV` | `development` | `production` |
| `CORS_ORIGINS` | `http://localhost:5173` | dominio de la web |
| `TRUSTED_HOSTS` | `localhost,127.0.0.1` | `*.onrender.com` (+ dominio propio) |
| `SESION_HORAS` | 12 | 12 |
| `RATE_LIMIT_PER_MINUTE` | 240 | 240 |
| `DB_POOL_MAX` | 10 | 10 |

En producción la API no arranca si falta `AUTH_SECRET` o la `API_KEY` es corta.

- Swagger (solo development): http://127.0.0.1:8001/docs
- `GET /api/health` (público) · `GET /api/ready` (con credencial, verifica la BD)

## Pruebas

```powershell
python -m pytest -q
```

No necesitan base de datos. Cubren contraseñas, tokens, permisos por rol, zona horaria, búsqueda y configuración de producción. CI las corre en cada push (`.github/workflows/ci.yml`).

## Base de datos y migraciones

- `sql/migrations/NNNN_descripcion.sql` se aplican en orden con `python migrate.py` y quedan registradas en `schema_migrations`. En Render corre antes de cada deploy; si falla, no se despliega.
- `0001_esquema_base.sql` recrea el esquema completo en una base vacía (se regenera con `python -m scripts.exportar_esquema`).
- Un cambio de esquema = **un archivo nuevo**. Nunca editar una migración ya aplicada (`migrate.py --estado` lo detecta).
- `sql/historico/` guarda los scripts sueltos anteriores a las migraciones; ya están incluidos en la 0001.
- La data operativa (guías, viajes, croquis, GRR) no se borra: triggers `*_no_delete`. Anular = cambiar `estado`.

## Convenio `/api/v1`

| Método | Uso |
|--------|-----|
| `GET` lista | `items`, `total`, `skip`, `limit`. Default `activo=true`. `q` máx. 80 |
| `GET /{id}` | Detalle |
| `POST` | Alta (`201`) |
| `PATCH /{id}` | Parcial |
| `DELETE /{id}` | Maestros: desactiva (`activo=false`). Viajes: anula |

Errores: `{ "detail": "texto en español" }`. `401` sin sesión · `403` sin permiso · `409` duplicado o auditoría · `429` límite · `503` servidor ocupado. Cada respuesta trae `X-Request-ID` para ubicarla en los logs.

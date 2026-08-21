# Despacho Campo — API (FastAPI + Neon)

Backend compartido para **móvil** y **web**. Las apps llaman con header `X-API-Key` (aún no hay login por persona).

## Quién consume las APIs

| Quién | Cómo |
|-------|------|
| App móvil / web | Cada request lleva `X-API-Key` con el valor de `API_KEY`. |
| Operador en campo | Usa la app; no llama a Render a mano. |
| Healthcheck Render | Solo `GET /api/health` (sin clave). |

```http
GET https://TU-SERVICIO.onrender.com/api/v1/empresas
X-API-Key: <mismo API_KEY que en Environment de Render>
```

Sin esa cabecera → `401`. Al móvil: **URL pública + API_KEY** (canal seguro).

Más adelante: login con `usuario` + JWT.

## Arranque local

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port 8001
```

- Swagger (solo development): http://127.0.0.1:8001/docs
- Salud: `GET /api/health`
- Listo (con key): `GET /api/ready`

## Deploy en Render

1. Sube el repo a GitHub (**nunca** subas `.env`).
2. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint** (usa `render.yaml` en la raíz)  
   o **Web Service** manual:
   - Root Directory: `backend`
   - Runtime: Python
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Health Check Path: `/api/health`
3. Environment:

| Variable | Valor |
|----------|--------|
| `DATABASE_URL` | Neon (`sslmode=require`) |
| `API_KEY` | Clave larga (o la que Render genere si usas Blueprint) |
| `APP_ENV` | `production` |
| `TRUSTED_HOSTS` | `*.onrender.com` |
| `CORS_ORIGINS` | URLs del front web (`https://...`) |
| `RATE_LIMIT_PER_MINUTE` | `120` (opcional) |

`PORT` lo asigna Render. En plan free el servicio **se duerme** tras inactividad; el primer request puede tardar ~30–60 s.

4. Prueba: `GET https://....onrender.com/api/health` → `{"ok":true}`, luego un catálogo con `X-API-Key`.

## Convenio `/api/v1`

| Método | Uso |
|--------|-----|
| `GET` lista | `items`, `total`, `skip`, `limit`. Default `activo=true`. `q` máx. 80. |
| `GET /{id}` | Detalle |
| `POST` | Alta (`201`) |
| `PATCH /{id}` | Parcial |
| `DELETE /{id}` | Soft delete (`activo=false`) |

`password_hash` **no** se expone. Único/FK → `409`. Rate limit → `429`.

### Endpoints útiles para móvil

- `GET /api/v1/arbol/ubicaciones`
- `GET /api/v1/empresas` · `fundos?empresa_id=` · `modulos?fundo_id=` · `turnos?modulo_id=` · `lotes?turno_id=`
- `GET /api/v1/usuarios` · `grupos` · `roles` · `cargos` · `choferes` · `vehiculos` · `proveedores`

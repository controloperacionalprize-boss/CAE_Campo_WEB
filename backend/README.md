# Despacho Campo — API (FastAPI + Neon)

Backend compartido para **móvil** y **web**. Las apps llaman con header `X-API-Key` (aún no hay login por persona).

## Quién consume las APIs

| Quién | Cómo |
|-------|------|
| App móvil / web | Cada request lleva `X-API-Key` con el valor de `API_KEY` (variable de entorno del backend). |
| Operador en campo | Usa la app; **no** llama a Railway a mano. |
| Railway healthcheck | Solo `GET /api/health` (sin clave). |

```http
GET https://TU-SERVICIO.up.railway.app/api/v1/empresas
X-API-Key: <mismo API_KEY que en Railway Variables>
```

Sin esa cabecera → `401`. Entrega al desarrollador móvil: **URL pública + API_KEY** (por canal seguro, no en el chat).

Más adelante: login con `usuario` + JWT; el `API_KEY` puede quedar solo para servicios internos.

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

## Deploy en Railway

1. Sube el repo a GitHub/GitLab (**nunca** subas `.env`).
2. New Project → Deploy from repo.
3. **Root Directory** = `backend` (ahí está `requirements.txt` y `railway.toml`).
4. Variables (Settings → Variables):

| Variable | Valor |
|----------|--------|
| `DATABASE_URL` | Connection string Neon (`sslmode=require`) |
| `API_KEY` | Clave larga aleatoria (la misma que das al móvil) |
| `APP_ENV` | `production` |
| `TRUSTED_HOSTS` | `*.up.railway.app` (o `*` si usas dominio custom) |
| `CORS_ORIGINS` | URLs del front web (coma-separadas, con `https://`) |
| `RATE_LIMIT_PER_MINUTE` | `120` (opcional) |

`PORT` lo pone Railway solo. Start command (ya en `railway.toml`):

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

5. Healthcheck: `/api/health`.
6. Prueba: `GET https://.../api/health` → `{"ok":true}` y luego un catálogo con `X-API-Key`.

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

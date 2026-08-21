# Despacho Campo — Web

React + Vite + Tailwind. Consume la API FastAPI (`X-API-Key`).

## Arranque

1. Backend en `http://127.0.0.1:8001` (ver `backend/README.md`).
2. Frontend:

```powershell
cd frontend
copy .env.example .env
# Editar .env: VITE_API_BASE_URL y VITE_API_KEY (misma clave que el backend)
npm install
npm run dev
```

Login: **DNI de un usuario activo** en el maestro (`GET /api/v1/usuarios`). Contraseña: cualquier valor ≥4 (aún no hay JWT).

## Variables

| Variable | Uso |
|----------|-----|
| `VITE_API_BASE_URL` | Base del API (ej. `http://127.0.0.1:8001`) |
| `VITE_API_KEY` | Header `X-API-Key` — no commitear |

## Pantallas

Inicio, Ubicaciones, Personas (usuarios/grupos/roles/cargos), Flota (vehículos/choferes/proveedores), Despacho.

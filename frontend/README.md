# Despacho Campo — Web

React + Vite + Tailwind. Consume la API FastAPI con la sesión del usuario (`Authorization: Bearer`).

## Arranque

1. Backend en `http://127.0.0.1:8001` (ver `backend/README.md`).
2. Frontend:

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Login: **DNI y contraseña**. La contraseña inicial es el DNI; la web pide cambiarla al entrar. Solo los roles con acceso web pueden ingresar (el operario de campo usa la app móvil).

## Variables

| Variable | Uso |
|----------|-----|
| `VITE_API_BASE_URL` | URL de la API (ej. `http://127.0.0.1:8001`) |

La web **no** lleva API key: todo lo que va en el bundle es público. CI falla si aparece una en el build.

## Permisos

- El menú y cada ruta se filtran por los permisos que devuelve el login (`src/lib/permisos.ts`, `src/config/navigation.ts`).
- Crear o editar catálogos se oculta sin `maestros.editar` (`SoloEditores`, `EditButton`, `RowActionsMenu`).
- La API vuelve a validar cada permiso: ocultar un botón es solo comodidad.
- Una respuesta `401` cierra la sesión y vuelve al login con el motivo.

## Pantallas

Inicio, Despacho, Viajes, Recepción, Reportes (con exportación a Excel), Fundos, Personas y Flota. Cada pantalla se descarga al abrirla.

## Verificación

```powershell
npx tsc -b
npx oxlint
npm run build
```

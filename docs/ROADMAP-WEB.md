# DespachoCampo — Roadmap Frontend Web

> Documento de planificación para el desarrollo del frontend web.
> El backend ya cubre el 100% de endpoints que consume el móvil.
> Este plan define los módulos web, endpoints pendientes y prioridades.

## Estado actual

| Capa | Estado |
|------|--------|
| Backend API (FastAPI) | Completo — 27 endpoints, SSE, WebSocket hub |
| App Móvil (React Native) | En desarrollo — 19 pantallas, flujo completo |
| Frontend Web (React/Vite) | Scaffolding solamente — `src/` vacío |

## Módulos Web a Desarrollar

### Fase 1 — Core (Prioridad Alta)

#### 1. Dashboard Principal
- **Consume:** `GET /dashboard/resumen`, `GET /eventos` (SSE)
- **Funcionalidad:**
  - KPIs del día: conteo guías, jabas totales, jarras totales
  - Comparativa con el día anterior (delta %)
  - Distribución por fundo (gráfico de barras/dona)
  - Distribución por turno y módulo
  - Lista de 5 guías más recientes (actualización en tiempo real)
  - Indicador de vehículos activos/total
- **Componentes:** StatCard, BarChart, DonutChart, RecentTable, VehicleBadges
- **Tiempo estimado:** 3-4 días

#### 2. Despacho Campo (Guías de Ingreso)
- **Consume:** `GET /guias-ingreso`, `GET /guias-ingreso/:id`, `PATCH /guias-ingreso/:id`, `PATCH /:id/recepcionar-acopio`
- **Funcionalidad:**
  - Tabla paginada con filtros: fecha, fundo, módulo, turno, lote, grupo, estado
  - Facetas dinámicas (los filtros se actualizan entre sí)
  - Panel lateral de detalle al seleccionar una guía
  - Acción de recepción en acopio desde la tabla
  - Indicador de estado: registrado / anulado / recepcionado
  - Actualización en tiempo real vía SSE (`guia.created`, `guia.updated`)
- **Componentes:** DataTable, FilterBar, FacetSidebar, DetailDrawer, StatusBadge
- **Tiempo estimado:** 4-5 días

#### 3. Viajes
- **Consume:** `GET /viajes`, `GET /viajes/:id`, `PATCH /viajes/:id`
- **Funcionalidad:**
  - Lista de viajes con filtros: fecha, estado, tipo, búsqueda
  - Vista de detalle completo: detalle de guías + croquis + GRR
  - Visualización de croquis (pallets con continuaciones)
  - Vista de la GRR con detalle de carga
  - Timeline visual del estado: en_proceso → finalizado → recepcionado
  - Acción de anular viaje desde la web
- **Componentes:** ViajeCard, ViajeTimeline, CroquisViewer, GRRViewer, DetalleTable
- **Tiempo estimado:** 5-6 días

### Fase 2 — Operaciones (Prioridad Media)

#### 4. Recepción en Planta
- **Consume:** `PATCH /guias-ingreso/:id/recepcionar-planta`, `PATCH /viajes/:id/grr/recepcionar`, `GET /eventos` (SSE)
- **Funcionalidad:**
  - Vista en tiempo real de GRRs pendientes de recepción
  - Búsqueda rápida por código de GRR o placa
  - Acción de recepcionar GRR (marca viaje como recepcionado)
  - Acción de recepcionar guías individuales en planta
  - Historial de recepciones del día
  - Indicadores: pendientes / recepcionados / total
- **Componentes:** PendingQueue, SearchBar, ReceptionAction, HistoryLog
- **Endpoint nuevo necesario:** Ninguno — todo existe
- **Tiempo estimado:** 3-4 días

#### 5. Reportes
- **Consume:** Endpoints nuevos (ver abajo)
- **Funcionalidad:**
  - Reporte diario: guías por fundo, módulo, turno con totales
  - Reporte semanal/mensual: tendencia de jarras y jabas
  - Reporte de viajes: cantidad por estado, tiempo promedio en proceso
  - Reporte de vehículos: viajes por placa, utilización
  - Exportación a Excel/CSV
- **Endpoints nuevos a crear en backend:**
  ```
  GET /api/v1/reportes/diario?fecha=YYYY-MM-DD
  GET /api/v1/reportes/rango?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&agrupar=fundo|modulo|turno
  GET /api/v1/reportes/viajes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
  GET /api/v1/reportes/vehiculos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
  ```
- **Componentes:** DateRangePicker, AggregationChart, SummaryTable, ExportButton
- **Tiempo estimado:** 5-6 días (incluye backend)

### Fase 3 — Administración (Prioridad Baja)

#### 6. Catálogos (Maestros)
- **Consume:** Todos los CRUD de `/api/v1/maestros`
- **Funcionalidad:**
  - CRUD de: Empresas, Fundos, Módulos, Turnos, Lotes, Grupos, Usuarios, Vehículos, Choferes, Proveedores, Áreas, Cargos, Roles, Actividades Económicas
  - Tabla genérica reutilizable con búsqueda y paginación
  - Formularios modales para crear/editar
  - Soft-delete (desactivar) con confirmación
  - Filtro activo/inactivo con toggle "incluir inactivos"
- **Componentes:** CrudTable, CrudModal, ConfirmDialog, ActiveToggle
- **Tiempo estimado:** 4-5 días (mucho es reutilización)

#### 7. Ubicaciones (Árbol Jerárquico)
- **Consume:** `GET /arbol/ubicaciones`, `GET /fundos/:id/detalle`
- **Funcionalidad:**
  - Árbol colapsable: Empresa → Fundo → Módulo → Turno → Lote
  - Click en fundo abre detalle con módulos, turnos, lotes y grupos
  - Búsqueda rápida dentro del árbol
  - Toggle para mostrar/ocultar inactivos
- **Componentes:** TreeView, TreeNode, FundoDetailPanel
- **Tiempo estimado:** 2-3 días

---

## Endpoints Backend Pendientes

| Método | Ruta | Módulo | Descripción |
|--------|------|--------|-------------|
| GET | `/api/v1/reportes/diario` | Reportes | Guías agrupadas por fundo/módulo/turno en una fecha |
| GET | `/api/v1/reportes/rango` | Reportes | Tendencia de jarras/jabas en un rango de fechas |
| GET | `/api/v1/reportes/viajes` | Reportes | Estadísticas de viajes por estado en un rango |
| GET | `/api/v1/reportes/vehiculos` | Reportes | Utilización de vehículos en un rango |

> Total: 4 endpoints nuevos. Todo lo demás ya existe.


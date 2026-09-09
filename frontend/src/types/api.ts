/** Tipos alineados con schemas del backend FastAPI */

export type Paginated<T> = {
  items: T[]
  total: number
  skip: number
  limit: number
}

export type Empresa = {
  id: number
  ruc: string
  razon_social: string
  domicilio_fiscal: string | null
  actividad_economica_codigo: string | null
  activo: boolean
}

export type Fundo = {
  id: number
  empresa_id: number
  nombre: string
  domicilio: string | null
  activo: boolean
}

export type Modulo = {
  id: number
  fundo_id: number
  codigo: string
  nombre: string | null
  activo: boolean
}

export type Turno = {
  id: number
  modulo_id: number
  codigo: string
  nombre: string | null
  activo: boolean
}

export type Lote = {
  id: number
  turno_id: number
  codigo: string
  area_ha: number | string
  activo: boolean
}

export type Grupo = {
  id: number
  nombre: string
  empresa_id: number | null
  fundo_id: number | null
  activo: boolean
}

export type Area = { id: number; prefijo: string; nombre: string; activo: boolean }
export type Rol = { id: number; nombre: string; activo: boolean }
export type Cargo = { id: number; nombre: string; activo: boolean }

export type Usuario = {
  id: number
  dni: string
  nombre: string
  cargo_id: number | null
  rol_id: number | null
  grupo_id: number | null
  area_id: number | null
  activo: boolean
}

export type Proveedor = { id: number; nombre: string; activo: boolean }
export type Chofer = { id: number; dni: string; nombre: string; activo: boolean }

export type Vehiculo = {
  id: number
  placa: string
  proveedor_id: number
  chofer_id: number | null
  activo: boolean
}

export type TurnoNodo = {
  id: number
  codigo: string
  nombre: string | null
  activo: boolean
}

export type ModuloNodo = {
  id: number
  codigo: string
  nombre: string | null
  activo: boolean
  turnos: TurnoNodo[]
}

export type FundoNodo = {
  id: number
  nombre: string
  domicilio: string | null
  activo: boolean
  modulos: ModuloNodo[]
}

export type EmpresaNodo = {
  id: number
  ruc: string
  razon_social: string
  activo: boolean
  fundos: FundoNodo[]
}

/** Respuesta de GET /api/v1/fundos/{id}/detalle — 1 sola llamada */
export type FundoDetalle = {
  fundo: Fundo
  empresa: Empresa
  modulos: Modulo[]
  turnos: Turno[]
  lotes: Lote[]
  grupos: Grupo[]
}

/** Respuesta de GET /api/v1/dashboard/resumen — KPIs de despacho en 1 llamada */
export type DashboardKpis = {
  count: number
  jabas: number
  jarras: number
}

export type DashboardGrupo = {
  label: string
  count: number
  jarras: number
  pct: number
}

export type DashboardResumen = {
  fecha: string
  hoy: DashboardKpis
  ayer: DashboardKpis
  recientes: GuiaIngreso[]
  por_fundo: DashboardGrupo[]
  por_turno: DashboardGrupo[]
  por_modulo: DashboardGrupo[]
  vehiculos_activos: number
  vehiculos_total: number
  vehiculos_muestra: Vehiculo[]
}

export type GuiaFacets = {
  fundos: string[]
  modulos: string[]
  turnos: string[]
  lotes: string[]
  grupos: string[]
  tipos_producto: string[]
}

export type GuiaListPage = Paginated<GuiaIngreso> & {
  facets?: GuiaFacets
}

export type GuiaIngreso = {
  id: number
  codigo: string
  fecha: string
  hora_envio: string
  usuario_id: number
  usuario_dni: string
  usuario_nombre: string
  grupo_id: number | null
  grupo: string
  fundo_id: number | null
  fundo: string
  modulo_id: number
  modulo: string
  turno_id: number
  turno: string
  lote_id: number
  lote: string
  tipo_producto: string
  tipo_llenado: number | string
  envase_principal: string
  jabas_completas: number
  jabas_incompletas: number
  jarras_jabas: number
  jarras_extras: number
  jabas_totales: number
  jarras_totales: number
  ha: number | string
  observacion: string
  vehiculo_id: number
  placa: string
  estado: string
  recepcionado_acopio: boolean
  recepcionado_acopio_at: string | null
  recepcionado_planta: boolean
  recepcionado_planta_at: string | null
  created_at: string
  updated_at: string
}

export type Viaje = {
  id: number
  codigo: string
  tipo_viaje: string
  conductor_id: number | null
  conductor_nombre: string
  vehiculo_id: number | null
  placa: string
  kia_origen: string
  kia_destino: string
  observacion: string
  estado: string
  usuario_id: number | null
  fecha: string
  created_at: string
  updated_at: string
  grr_numero?: string
  grr_recepcionado?: boolean
}

export type ViajeDetalle = {
  id: number
  viaje_id: number
  guia_ingreso_id: number
  modulo: string
  turno: string
  lote: string
  jabas_completas: number
  jabas_incompletas: number
  jarras: number
  created_at: string
  guia_codigo: string
  fundo: string
  jarras_jabas: number
  jarras_extras: number
  recepcionado_acopio: boolean
  recepcionado_planta: boolean
}

export type CroquisLinea = {
  id: number
  croquis_id: number
  nombre: string
  orden: number
  modulo: string
  turno: string
  variedad: string
  jarras: number
  jabas: number
  es_continuacion: boolean
  pallet_padre_id: number | null
  continuaciones?: CroquisLinea[]
}

export type Croquis = {
  id: number
  viaje_id: number
  fecha: string
  placa: string
  punto_partida: string
  punto_llegada: string
  motivo_traslado: string
  hora_salida: string
  total_jarras: number
  total_jabas: number
  total_pallets: number
  temperatura: number | null
  pallets: CroquisLinea[]
}

export type GrrDetalle = {
  id: number
  grr_id: number
  pallet: string
  modulo: string
  turno: string
  variedad: string
  jarras: number
  jabas: number
  orden: number
}

export type Grr = {
  id: number
  viaje_id: number
  numero: string
  fecha_emision: string
  remitente: string
  destinatario: string
  motivo_traslado: string
  placa: string
  punto_partida: string
  punto_llegada: string
  total_jarras: number
  total_jabas: number
  estado: string
  recepcionado: boolean
  recepcionado_at: string | null
  conductor_nombre?: string
  detalle_carga: GrrDetalle[]
}

export type ViajeCompleto = Viaje & {
  detalle: ViajeDetalle[]
  croquis: Croquis | null
  grr: Grr | null
}

export type ReporteDiario = {
  fecha: string
  filas: Array<{ fundo: string; modulo: string; turno: string; guias: number; jabas: number; jarras: number }>
  total_guias: number
  total_jabas: number
  total_jarras: number
}

export type ReporteRango = {
  desde: string
  hasta: string
  agrupar: string
  por_fecha: Array<{ fecha: string; guias: number; jabas: number; jarras: number }>
  por_grupo: Array<{ label: string; guias: number; jabas: number; jarras: number }>
  total_guias: number
  total_jabas: number
  total_jarras: number
}

export type ReporteViajes = {
  desde: string
  hasta: string
  por_estado: Array<{ estado: string; count: number }>
  total: number
  minutos_promedio_ciclo: number | null
}

export type ReporteVehiculos = {
  desde: string
  hasta: string
  filas: Array<{ placa: string; viajes: number; recepcionados: number }>
  total_viajes: number
}

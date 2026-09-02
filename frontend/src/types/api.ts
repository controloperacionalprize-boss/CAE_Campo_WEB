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

/** Respuesta de GET /api/v1/dashboard/resumen — 1 sola llamada */
export type DashboardResumen = {
  empresas: number
  fundos: number
  turnos: number
  vehiculos: number
  empresas_muestra: Empresa[]
  vehiculos_muestra: Vehiculo[]
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
  created_at: string
  updated_at: string
}

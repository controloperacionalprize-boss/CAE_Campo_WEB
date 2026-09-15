/** Permisos que devuelve el backend (app/permisos.py). La API los vuelve a validar en cada petición. */
export const PERMISOS = {
  operacionVer: 'operacion.ver',
  operacionEditar: 'operacion.editar',
  reportesVer: 'reportes.ver',
  maestrosVer: 'maestros.ver',
  maestrosEditar: 'maestros.editar',
  usuariosAdmin: 'usuarios.admin',
} as const

export type Permiso = (typeof PERMISOS)[keyof typeof PERMISOS]

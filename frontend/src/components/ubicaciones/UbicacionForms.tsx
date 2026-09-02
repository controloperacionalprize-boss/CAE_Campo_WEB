import { useEffect, useState, type FormEvent } from 'react'
import { FormActions, Input, Select, Switch } from '../ui/Form'
import { Drawer } from '../ui/Overlay'
import { labelCodigo } from '../../lib/ubicacionesLookups'
import { apiPatch, apiPost } from '../../lib/api'
import { useToast } from '../../context/ToastContext'

export type FundoForm = {
  id?: number
  empresaId: number
  nombre: string
  domicilio: string
  activo: boolean
}

export type ModuloForm = {
  id?: number
  fundoId: number
  codigo: string
  nombre: string
  activo: boolean
}

export type TurnoForm = {
  id?: number
  moduloId: number
  codigo: string
  nombre: string
  activo: boolean
}

export type LoteForm = {
  id?: number
  turnoId: number
  codigo: string
  areaHa: string
  activo: boolean
}

export function FundoFormDrawer({
  open,
  form,
  empresas,
  onClose,
  onSaved,
}: {
  open: boolean
  form: FundoForm | null
  empresas: { value: number; label: string }[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [empresaId, setEmpresaId] = useState('')
  const [nombre, setNombre] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!form) return
    setEmpresaId(String(form.empresaId))
    setNombre(form.nombre)
    setDomicilio(form.domicilio)
    setActivo(form.activo)
    setError('')
  }, [form])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) {
      setError('Ingrese el nombre')
      return
    }
    if (!empresaId) {
      setError('Seleccione una empresa')
      return
    }
    const body = {
      empresa_id: Number(empresaId),
      nombre: nombre.trim(),
      domicilio: domicilio.trim() || null,
      activo,
    }
    setSaving(true)
    try {
      if (form?.id) {
        await apiPatch(`/api/v1/fundos/${form.id}`, body)
        toast.success('Fundo actualizado')
      } else {
        await apiPost('/api/v1/fundos', body)
        toast.success('Fundo creado')
      }
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={form?.id ? 'Editar fundo' : 'Nuevo fundo'}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Empresa"
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          options={empresas}
        />
        <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} error={error} />
        <Input label="Domicilio" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
        <Switch checked={activo} onChange={setActivo} label="Activo" />
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Drawer>
  )
}

export function ModuloFormDrawer({
  open,
  form,
  fundos,
  onClose,
  onSaved,
}: {
  open: boolean
  form: ModuloForm | null
  fundos: { id: number; nombre: string }[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [fundoId, setFundoId] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!form) return
    setFundoId(String(form.fundoId))
    setCodigo(form.codigo)
    setNombre(form.nombre)
    setActivo(form.activo)
    setError('')
  }, [form])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!codigo.trim()) {
      setError('Ingrese el código')
      return
    }
    if (!fundoId) {
      setError('Seleccione un fundo')
      return
    }
    const body = {
      fundo_id: Number(fundoId),
      codigo: codigo.trim(),
      nombre: nombre.trim() || null,
      activo,
    }
    setSaving(true)
    try {
      if (form?.id) {
        await apiPatch(`/api/v1/modulos/${form.id}`, body)
        toast.success('Módulo actualizado')
      } else {
        await apiPost('/api/v1/modulos', body)
        toast.success('Módulo creado')
      }
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={form?.id ? 'Editar módulo' : 'Nuevo módulo'}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Fundo"
          value={fundoId}
          onChange={(e) => setFundoId(e.target.value)}
          options={fundos.map((f) => ({ value: f.id, label: f.nombre }))}
        />
        <Input
          label="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          error={error}
          placeholder="M-01"
        />
        <Input
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Opcional"
        />
        <Switch checked={activo} onChange={setActivo} label="Activo" />
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Drawer>
  )
}

export function TurnoFormDrawer({
  open,
  form,
  modulos,
  onClose,
  onSaved,
}: {
  open: boolean
  form: TurnoForm | null
  modulos: { id: number; codigo: string; nombre: string | null; fundoNombre?: string }[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [moduloId, setModuloId] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!form) return
    setModuloId(String(form.moduloId))
    setCodigo(form.codigo)
    setNombre(form.nombre)
    setActivo(form.activo)
    setError('')
  }, [form])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!codigo.trim()) {
      setError('Ingrese el código')
      return
    }
    if (!moduloId) {
      setError('Seleccione un módulo')
      return
    }
    const body = {
      modulo_id: Number(moduloId),
      codigo: codigo.trim(),
      nombre: nombre.trim() || null,
      activo,
    }
    setSaving(true)
    try {
      if (form?.id) {
        await apiPatch(`/api/v1/turnos/${form.id}`, body)
        toast.success('Turno actualizado')
      } else {
        await apiPost('/api/v1/turnos', body)
        toast.success('Turno creado')
      }
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={form?.id ? 'Editar turno' : 'Nuevo turno'}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Módulo"
          value={moduloId}
          onChange={(e) => setModuloId(e.target.value)}
          options={modulos.map((m) => ({
            value: m.id,
            label: m.fundoNombre ? `${m.fundoNombre} · ${labelCodigo(m.codigo, m.nombre)}` : labelCodigo(m.codigo, m.nombre),
          }))}
        />
        <Input
          label="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          error={error}
          placeholder="T-01"
        />
        <Input
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Opcional"
        />
        <Switch checked={activo} onChange={setActivo} label="Activo" />
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Drawer>
  )
}

export function LoteFormDrawer({
  open,
  form,
  turnos,
  onClose,
  onSaved,
}: {
  open: boolean
  form: LoteForm | null
  turnos: { id: number; codigo: string; nombre: string | null; moduloCodigo?: string }[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [turnoId, setTurnoId] = useState('')
  const [codigo, setCodigo] = useState('')
  const [areaHa, setAreaHa] = useState('')
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!form) return
    setTurnoId(String(form.turnoId))
    setCodigo(form.codigo)
    setAreaHa(form.areaHa)
    setActivo(form.activo)
    setError('')
  }, [form])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!codigo.trim()) {
      setError('Ingrese el código')
      return
    }
    if (!turnoId) {
      setError('Seleccione un turno')
      return
    }
    const ha = Number(areaHa.replace(',', '.'))
    if (!Number.isFinite(ha) || ha <= 0) {
      setError('Ingrese las hectáreas (mayor a 0)')
      return
    }
    const body = {
      turno_id: Number(turnoId),
      codigo: codigo.trim(),
      area_ha: ha,
      activo,
    }
    setSaving(true)
    try {
      if (form?.id) {
        await apiPatch(`/api/v1/lotes/${form.id}`, body)
        toast.success('Lote actualizado')
      } else {
        await apiPost('/api/v1/lotes', body)
        toast.success('Lote creado')
      }
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={form?.id ? 'Editar lote' : 'Nuevo lote'}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Turno"
          value={turnoId}
          onChange={(e) => setTurnoId(e.target.value)}
          options={turnos.map((t) => ({
            value: t.id,
            label: t.moduloCodigo
              ? `${t.moduloCodigo} · ${labelCodigo(t.codigo, t.nombre)}`
              : labelCodigo(t.codigo, t.nombre),
          }))}
        />
        <Input
          label="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          error={error}
          placeholder="L-01"
        />
        <Input
          label="Hectáreas"
          type="number"
          min="0.01"
          step="0.01"
          value={areaHa}
          onChange={(e) => setAreaHa(e.target.value)}
          placeholder="0.00"
        />
        <Switch checked={activo} onChange={setActivo} label="Activo" />
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Drawer>
  )
}

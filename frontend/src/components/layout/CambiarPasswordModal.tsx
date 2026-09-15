import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Form'
import { Modal } from '../ui/Overlay'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { ApiError } from '../../lib/api'

export function CambiarPasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, cambiarPassword } = useAuth()
  const toast = useToast()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [errors, setErrors] = useState<{ actual?: string; nueva?: string; confirmar?: string }>({})
  const [saving, setSaving] = useState(false)

  function cerrar() {
    setActual('')
    setNueva('')
    setConfirmar('')
    setErrors({})
    onClose()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!actual) next.actual = 'Ingrese su contraseña actual'
    if (nueva.length < 8) next.nueva = 'Use al menos 8 caracteres'
    else if (nueva === user?.dni) next.nueva = 'La nueva contraseña no puede ser su DNI'
    if (confirmar !== nueva) next.confirmar = 'Las contraseñas no coinciden'
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    try {
      await cambiarPassword(actual, nueva)
      toast.success('Contraseña actualizada')
      cerrar()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña'
      if (msg.toLowerCase().includes('actual')) setErrors({ actual: msg })
      else toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={cerrar} title="Cambiar contraseña">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          id="password-actual"
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          error={errors.actual}
          required
        />
        <Input
          id="password-nueva"
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres. No use su DNI."
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          error={errors.nueva}
          required
        />
        <Input
          id="password-confirmar"
          label="Repita la nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          error={errors.confirmar}
          required
        />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={cerrar} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar contraseña
          </Button>
        </div>
      </form>
    </Modal>
  )
}

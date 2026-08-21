import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Form'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { apiGet, ApiError } from '../lib/api'
import { isValidDni } from '../lib/utils'
import type { Paginated, Usuario } from '../types/api'

// Login (mock): 1 sola llamada exacta por DNI + incluir_inactivos para
// distinguir "no existe" de "existe pero inactivo" sin pedir dos veces.

export function LoginPage() {
  const { user, login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [dni, setDni] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ dni?: string; password?: string }>({})

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!isValidDni(dni)) next.dni = 'Ingrese un DNI de 8 dígitos'
    if (!password || password.length < 4) next.password = 'Contraseña requerida (mín. 4)'
    setErrors(next)
    if (Object.keys(next).length) {
      toast.error('Revise los campos del formulario')
      return
    }

    setLoading(true)
    try {
      // Todavía no hay JWT: validamos que el DNI exista en maestros.
      // GET /api/v1/usuarios?dni=&incluir_inactivos=true — 1 sola llamada.
      const page = await apiGet<Paginated<Usuario>>('/api/v1/usuarios', {
        dni,
        limit: 1,
        incluir_inactivos: true,
      })
      const found = page.items[0]
      if (!found) {
        toast.error('DNI no registrado en el sistema')
        setErrors({ dni: 'No hay usuario con este DNI' })
        return
      }
      if (!found.activo) {
        toast.error('Usuario inactivo')
        setErrors({ dni: 'Este usuario está inactivo' })
        return
      }

      login({ id: found.id, dni: found.dni, nombre: found.nombre })
      toast.success(`Bienvenido/a, ${found.nombre.split(' ')[0]}`)
      navigate('/')
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'No se pudo iniciar sesión. Intente de nuevo.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: 'linear-gradient(160deg, #f7f4ef 0%, #e8efe4 45%, #d4e0cd 100%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[42vh]"
        style={{
          background:
            'radial-gradient(ellipse 70% 80% at 50% 0%, rgba(61,79,58,0.12), transparent)',
        }}
      />

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-olive-800 text-olive-100 shadow-lg shadow-olive-900/10">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
              <path
                d="M5 17c2.5-5 5-7.5 7-8.5 2 .8 4.5 3.5 7 8.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="12" cy="9" r="1.6" fill="#7dd3c7" />
            </svg>
          </div>
          <p className="text-xs font-medium tracking-[0.18em] text-teal-800 uppercase">Aquanqa</p>
          <h1 className="mt-2 font-display text-3xl text-olive-950">Despacho Campo</h1>
          <p className="mt-2 text-sm text-muted">Ingrese con su DNI y contraseña</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-line bg-sand-0/90 p-6 shadow-sm shadow-olive-950/5 backdrop-blur"
        >
          <div className="space-y-4">
            <Input
              label="Usuario / DNI"
              name="dni"
              inputMode="numeric"
              autoComplete="username"
              placeholder="DNI registrado"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
              error={errors.dni}
            />
            <Input
              label="Contraseña"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
          </div>
          <Button type="submit" className="mt-6 w-full" disabled={loading}>
            {loading ? 'Verificando…' : 'Ingresar'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">Aquanqa</p>
      </div>
    </div>
  )
}

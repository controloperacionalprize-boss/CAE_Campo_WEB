import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { InfoBanner } from '../components/ui/Feedback'
import { Input } from '../components/ui/Form'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ApiError } from '../lib/api'
import { isValidDni } from '../lib/utils'

export function LoginPage() {
  const { user, login, motivoSalida } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [dni, setDni] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ dni?: string; password?: string }>({})
  const destino = (location.state as { desde?: string } | null)?.desde || '/'

  if (user) return <Navigate to={destino} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!isValidDni(dni)) next.dni = 'Ingrese un DNI de 8 dígitos'
    if (!password) next.password = 'Ingrese su contraseña'
    setErrors(next)
    if (Object.keys(next).length) return

    setLoading(true)
    try {
      const sesion = await login(dni, password)
      toast.success(`Bienvenido/a, ${sesion.usuario.nombre.split(' ')[0]}`)
      navigate(destino, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErrors({ password: err.message })
      } else {
        toast.error(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión. Intente de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-sand-50"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 70% 80% at 50% 0%, rgba(27,58,107,0.1), transparent)',
        }}
      />

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-olive-800 text-olive-100 shadow-lg shadow-olive-900/10">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
              <path
                d="M12 3.2 20.2 7.6v8.8L12 20.8 3.8 16.4V7.6L12 3.2Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M3.8 7.6 12 12l8.2-4.4M12 12v8.8"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-xs font-medium tracking-[0.18em] text-teal-800 uppercase">Aquanqa</p>
          <h1 className="mt-2 font-display text-3xl text-olive-950">Despacho Campo</h1>
          <p className="mt-2 text-sm text-muted">Ingrese con su DNI y contraseña</p>
        </div>

        {motivoSalida && <InfoBanner message={motivoSalida} />}

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-line bg-sand-0 p-6 shadow-[var(--shadow-card)]"
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
              required
            />
            <div className="relative">
              <Input
                label="Contraseña"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-[30px] right-3 text-muted hover:text-olive-900"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="mt-6 w-full" loading={loading}>
            Ingresar
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">Aquanqa · Despacho Campo</p>
      </div>
    </div>
  )
}

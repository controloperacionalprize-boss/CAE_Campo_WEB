import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-olive-950/30 backdrop-blur-[2px]" onClick={onClose} aria-label="Cerrar" />
      <div
        className={cn(
          'relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-sand-0 p-5 shadow-xl sm:rounded-2xl sm:p-6',
          wide ? 'sm:max-w-xl' : 'sm:max-w-md',
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-xl text-olive-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-olive-100">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <button
        type="button"
        aria-hidden={!open}
        className={cn(
          'fixed inset-0 z-40 bg-olive-950/25 transition',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-sand-0 shadow-xl transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg text-olive-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-olive-100">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </>
  )
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="mb-4 flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition',
            value === t.id
              ? 'border-teal-800 text-teal-800'
              : 'border-transparent text-muted hover:text-olive-900',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { connectGuiaEvents, type GuiaLiveEvent, type LiveStatus } from '../lib/sse'
import { cn } from '../lib/utils'

type Listener = (event: GuiaLiveEvent) => void

type LiveEventsState = {
  status: LiveStatus
  subscribe: (listener: Listener) => () => void
}

const LiveEventsContext = createContext<LiveEventsState | null>(null)

export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LiveStatus>('connecting')
  const listeners = useRef(new Set<Listener>())

  useEffect(() => {
    const ac = new AbortController()
    void connectGuiaEvents(
      (event) => {
        listeners.current.forEach((fn) => fn(event))
      },
      setStatus,
      ac.signal,
    )
    return () => ac.abort()
  }, [])

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener)
    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  const value = useMemo<LiveEventsState>(() => ({ status, subscribe }), [status, subscribe])

  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>
}

export function useLiveEvents() {
  const ctx = useContext(LiveEventsContext)
  if (!ctx) throw new Error('useLiveEvents debe usarse dentro de LiveEventsProvider')
  return ctx
}

export function useOnGuiaLive(handler: (event: GuiaLiveEvent) => void) {
  const { subscribe } = useLiveEvents()
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })
  useEffect(() => subscribe((event) => handlerRef.current(event)), [subscribe])
}

export function LiveStatusBadge({ className }: { className?: string }) {
  const { status } = useLiveEvents()
  const label = status === 'live' ? 'En vivo' : status === 'connecting' ? 'Conectando…' : 'Sin conexión'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-line bg-sand-0 px-2.5 py-1 text-[11px] font-medium',
        status === 'live' ? 'text-success' : status === 'connecting' ? 'text-olive-800' : 'text-muted',
        className,
      )}
      title="Los despachos del móvil aparecen al instante"
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === 'live' ? 'animate-pulse bg-success' : status === 'connecting' ? 'bg-warn' : 'bg-muted/60',
        )}
      />
      {label}
    </span>
  )
}

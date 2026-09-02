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
  const [status, setStatus] = useState<LiveStatus>('disconnected')
  const listeners = useRef(new Set<Listener>())
  const acRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    acRef.current?.abort()
    acRef.current = null
    setStatus('disconnected')
  }, [])

  const start = useCallback(() => {
    if (acRef.current) return
    const ac = new AbortController()
    acRef.current = ac
    void connectGuiaEvents(
      (event) => {
        listeners.current.forEach((fn) => fn(event))
      },
      setStatus,
      ac.signal,
    )
  }, [])

  useEffect(() => () => stop(), [stop])

  const subscribe = useCallback(
    (listener: Listener) => {
      listeners.current.add(listener)
      if (listeners.current.size === 1) start()
      return () => {
        listeners.current.delete(listener)
        if (listeners.current.size === 0) stop()
      }
    },
    [start, stop],
  )

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

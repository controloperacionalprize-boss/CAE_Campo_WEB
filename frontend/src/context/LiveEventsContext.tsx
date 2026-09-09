import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { connectGuiaEvents, type GuiaLiveEvent, type LiveEvent } from '../lib/sse'

type Listener = (event: LiveEvent) => void

type LiveEventsState = {
  subscribe: (listener: Listener) => () => void
}

const LiveEventsContext = createContext<LiveEventsState | null>(null)

export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const listeners = useRef(new Set<Listener>())

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener)
    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    void connectGuiaEvents(
      (event) => {
        listeners.current.forEach((fn) => fn(event))
      },
      () => {},
      ac.signal,
    )
    return () => ac.abort()
  }, [])

  const value = useMemo<LiveEventsState>(() => ({ subscribe }), [subscribe])

  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>
}

export function useLiveEvents() {
  const ctx = useContext(LiveEventsContext)
  if (!ctx) throw new Error('useLiveEvents debe usarse dentro de LiveEventsProvider')
  return ctx
}

export function useOnLiveEvent(handler: (event: LiveEvent) => void) {
  const { subscribe } = useLiveEvents()
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })
  useEffect(() => subscribe((event) => handlerRef.current(event)), [subscribe])
}

export function useOnGuiaLive(handler: (event: GuiaLiveEvent) => void) {
  useOnLiveEvent((event) => {
    if (event.type === 'guia.created' || event.type === 'guia.updated') handler(event)
  })
}

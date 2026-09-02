import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Sincroniza pestañas con ?tab= en la URL para compartir enlaces directos. */
export function useTabParam(defaultTab: string, validTabs: string[]) {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('tab')
  const tab = raw && validTabs.includes(raw) ? raw : defaultTab

  const setTab = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (id === defaultTab) next.delete('tab')
          else next.set('tab', id)
          return next
        },
        { replace: true },
      )
    },
    [defaultTab, setSearchParams],
  )

  return [tab, setTab] as const
}

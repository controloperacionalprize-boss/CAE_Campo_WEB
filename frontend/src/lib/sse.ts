import { API_BASE, apiHeaders, isAbortError } from './api'
import type { GuiaIngreso } from '../types/api'

export type LiveStatus = 'connecting' | 'live' | 'disconnected'

export type GuiaLiveEvent = {
  type: 'guia.created' | 'guia.updated'
  guia: GuiaIngreso
}

function eventosUrl() {
  const base = API_BASE || window.location.origin
  return new URL('/api/v1/eventos', `${base}/`)
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = window.setTimeout(resolve, ms)
    const onAbort = () => {
      window.clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const raw of block.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  if (!dataLines.length) return null
  return { event, data: dataLines.join('\n') }
}

function emitParsed(block: string, onEvent: (event: GuiaLiveEvent) => void) {
  const parsed = parseSseBlock(block)
  if (!parsed || parsed.event === 'ready') return
  if (parsed.event !== 'guia.created' && parsed.event !== 'guia.updated') return
  try {
    const body = JSON.parse(parsed.data) as Partial<GuiaLiveEvent>
    if (!body.guia || typeof body.guia !== 'object') return
    onEvent({ type: parsed.event, guia: body.guia })
  } catch {
    /* frame incompleto o no JSON */
  }
}

export async function connectGuiaEvents(
  onEvent: (event: GuiaLiveEvent) => void,
  onStatus: (status: LiveStatus) => void,
  signal: AbortSignal,
): Promise<void> {
  let delay = 1000
  onStatus('connecting')

  while (!signal.aborted) {
    try {
      const res = await fetch(eventosUrl(), {
        headers: { ...apiHeaders(false), Accept: 'text/event-stream' },
        signal,
      })
      if (!res.ok || !res.body) {
        onStatus('disconnected')
        await sleep(delay, signal)
        delay = Math.min(delay * 2, 15_000)
        onStatus('connecting')
        continue
      }

      onStatus('live')
      delay = 1000
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (!signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        buf = buf.replace(/\r\n/g, '\n')
        let sep = buf.indexOf('\n\n')
        while (sep >= 0) {
          const block = buf.slice(0, sep)
          buf = buf.slice(sep + 2)
          emitParsed(block, onEvent)
          sep = buf.indexOf('\n\n')
        }
      }

      if (signal.aborted) return
      onStatus('connecting')
    } catch (e) {
      if (signal.aborted || isAbortError(e)) return
      onStatus('disconnected')
    }

    if (signal.aborted) return
    try {
      await sleep(delay, signal)
    } catch {
      return
    }
    delay = Math.min(delay * 2, 15_000)
    onStatus('connecting')
  }
}

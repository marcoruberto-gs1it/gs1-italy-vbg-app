import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { acquireCamera, parkCamera } from './camera'
import { byPosition } from './decodeImage'
import type { DecoderRequest, DecoderResponse, Hit, Quad } from './types'

export type CameraError = 'insecure' | 'unsupported' | 'denied' | 'notfound' | 'busy' | 'unknown'
export type CameraStatus = 'starting' | 'live' | 'error'

type Options = {
  /** Fotocamera accesa (scanner aperto). */
  enabled: boolean
  /** Decodifica attiva (nessun esito o pannello sopra lo scanner). */
  active: boolean
  /** Barcode letti (più di uno solo da un'etichetta con GS1-128), con la posizione sullo schermo. */
  onDetect: (hits: Hit[], quads: Quad[]) => void
}

type FrameMap = { scale: number; factor: number; width: number; mirrored: boolean }

const MAX_SIDE = 1280
const MIN_INTERVAL = 70
// Simbologie senza cifra di controllo obbligatoria: chiediamo due letture identiche.
const NEEDS_CONFIRM = /Codabar|Code39|Code93|ITF/
/**
 * Etichetta logistica: con un GS1-128 (identificatore ]C1) nell'inquadratura si raccolgono per poco
 * tempo tutti i barcode visibili, perché i dati dell'articolo stanno spesso su 2–3 GS1-128. Con EAN,
 * QR Code e gli altri si consegna subito il primo barcode, come sempre (sullo scaffale ci sono i
 * barcode dei prodotti vicini).
 */
const LABEL_WINDOW = 600
const isGs1128 = (hit: Hit) => hit.symbologyIdentifier === ']C1'

function classify(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : (error as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'notfound'
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') return 'busy'
  return 'unknown'
}

const watchedTracks = new WeakSet<MediaStreamTrack>()

export function useScanner(videoRef: RefObject<HTMLVideoElement | null>, { enabled, active, onDetect }: Options) {
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [error, setError] = useState<CameraError | null>(null)
  const [torch, setTorch] = useState({ available: false, on: false })
  const [mirrored, setMirrored] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionRef = useRef(0)
  const activeRef = useRef(active)
  const onDetectRef = useRef(onDetect)
  const pendingRef = useRef(new Map<number, (hits: Hit[]) => void>())
  const nextIdRef = useRef(1)
  const lastTextRef = useRef<{ text: string; at: number } | null>(null)

  useEffect(() => {
    onDetectRef.current = onDetect
  }, [onDetect])

  useEffect(() => {
    const worker = new Worker(new URL('./decoder.worker.ts', import.meta.url), { type: 'module' })
    const pending = pendingRef.current
    worker.onmessage = ({ data }: MessageEvent<DecoderResponse>) => {
      if (data.type !== 'result') return
      pending.get(data.id)?.(data.hits)
      pending.delete(data.id)
    }
    workerRef.current = worker
    return () => {
      worker.terminate()
      pending.forEach((resolve) => resolve([]))
      pending.clear()
      workerRef.current = null
    }
  }, [])

  const decode = useCallback((request: DecoderRequest, transfer: Transferable[] = []) => {
    const worker = workerRef.current
    if (!worker) return Promise.resolve([] as Hit[])
    return new Promise<Hit[]>((resolve) => {
      pendingRef.current.set(request.id, resolve)
      worker.postMessage(request, transfer)
    })
  }, [])

  // La fotocamera non viene chiusa: resta disponibile per la prossima apertura senza nuove richieste di permesso.
  const stop = useCallback(() => {
    sessionRef.current += 1
    parkCamera()
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setTorch({ available: false, on: false })
  }, [videoRef])

  const start = useCallback(async () => {
    const session = ++sessionRef.current
    setError(null)
    setStatus('starting')
    if (!window.isSecureContext) {
      setError('insecure')
      setStatus('error')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('unsupported')
      setStatus('error')
      return
    }
    try {
      const stream = await acquireCamera()
      if (session !== sessionRef.current) return
      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      const capabilities = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] }
      if (capabilities.focusMode?.includes('continuous')) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {})
      }
      setTorch({ available: Boolean(capabilities.torch), on: false })
      setMirrored(track.getSettings().facingMode === 'user')
      if (!watchedTracks.has(track)) {
        watchedTracks.add(track)
        // 'ended' arriva solo se la fotocamera viene tolta dall'esterno (altra app, scollegata).
        track.addEventListener('ended', () => {
          if (streamRef.current?.getVideoTracks()[0] === track) {
            setError('busy')
            setStatus('error')
          }
        })
      }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      video.muted = true
      video.setAttribute('playsinline', '')
      await video.play().catch(() => {})
      if (!activeRef.current) video.pause()
      if (session === sessionRef.current) setStatus('live')
    } catch (err) {
      if (session !== sessionRef.current) return
      setError(window.isSecureContext ? classify(err) : 'insecure')
      setStatus('error')
    }
  }, [videoRef])

  // Avvio, arresto quando la pagina è nascosta, ripresa quando torna visibile.
  useEffect(() => {
    if (!enabled) return
    void start()
    const onVisibility = () => {
      if (document.hidden) stop()
      else void start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
      setStatus('starting')
    }
  }, [enabled, start, stop])

  // Il video resta acceso (ripresa istantanea) ma si congela mentre l'esito è a schermo.
  useEffect(() => {
    activeRef.current = active
    const video = videoRef.current
    if (!video || !streamRef.current) return
    if (active) {
      lastTextRef.current = null
      void video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [active, videoRef])

  // Ciclo di decodifica: un solo fotogramma in volo verso il worker alla volta.
  useEffect(() => {
    if (status !== 'live') return
    let raf = 0
    let busy = false
    let last = 0
    let stopped = false
    // Barcode raccolti da un'etichetta con GS1-128: testo → lettura, posizione, quante volte visto.
    let label: { until: number; seen: Map<string, { hit: Hit; quad: Quad; count: number }> } | null = null
    const canvas = document.createElement('canvas')

    const deliver = (items: { hit: Hit; quad: Quad }[]) => {
      if (!items.length) return
      activeRef.current = false
      label = null
      const ordered = byPosition(items.map((i) => i.hit))
      onDetectRef.current(ordered, ordered.map((hit) => items.find((i) => i.hit === hit)!.quad))
    }
    // Fine della raccolta: i barcode senza cifra di controllo valgono solo se letti almeno due volte.
    const closeLabel = () => {
      if (!label) return
      const items = [...label.seen.values()].filter((i) => !NEEDS_CONFIRM.test(i.hit.format) || i.count > 1)
      label = null
      deliver(items)
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const video = videoRef.current
      // Scanner in pausa (esito o pannello aperto): la raccolta in corso si annulla.
      if (!activeRef.current) label = null
      if (label && now >= label.until && !busy) return closeLabel()
      if (busy || !ctx || !video || !activeRef.current || now - last < MIN_INTERVAL || video.readyState < 2) return
      const vw = video.videoWidth
      const vh = video.videoHeight
      const ew = video.clientWidth
      const eh = video.clientHeight
      if (!vw || !vh || !ew || !eh) return
      last = now

      // Decodifichiamo esattamente l'area visibile (object-fit: cover).
      const scale = Math.max(ew / vw, eh / vh)
      const visW = ew / scale
      const visH = eh / scale
      const factor = Math.min(1, MAX_SIDE / Math.max(visW, visH))
      canvas.width = Math.round(visW * factor)
      canvas.height = Math.round(visH * factor)
      ctx.drawImage(video, (vw - visW) / 2, (vh - visH) / 2, visW, visH, 0, 0, canvas.width, canvas.height)
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const map: FrameMap = { scale, factor, width: ew, mirrored }

      busy = true
      const id = nextIdRef.current++
      void decode({ type: 'frame', id, width: frame.width, height: frame.height, buffer: frame.data.buffer }, [frame.data.buffer]).then((hits) => {
        busy = false
        if (stopped || !activeRef.current) return
        const toScreen = ({ x, y }: { x: number; y: number }) => {
          const sx = (x / map.factor) * map.scale
          return { x: map.mirrored ? map.width - sx : sx, y: (y / map.factor) * map.scale }
        }
        const quadOf = ({ position: p }: Hit): Quad => ({
          topLeft: toScreen(p.topLeft),
          topRight: toScreen(p.topRight),
          bottomRight: toScreen(p.bottomRight),
          bottomLeft: toScreen(p.bottomLeft),
        })

        // Etichetta con GS1-128: si raccolgono i barcode visibili fino alla fine della finestra.
        if (!label && hits.some(isGs1128)) label = { until: now + LABEL_WINDOW, seen: new Map() }
        if (label) {
          for (const hit of hits) {
            const known = label.seen.get(hit.text)
            label.seen.set(hit.text, { hit, quad: quadOf(hit), count: (known?.count ?? 0) + 1 })
          }
          if (performance.now() >= label.until) closeLabel()
          return
        }

        const hit = hits[0]
        if (!hit) return
        if (NEEDS_CONFIRM.test(hit.format)) {
          const previous = lastTextRef.current
          lastTextRef.current = { text: hit.text, at: now }
          if (!previous || previous.text !== hit.text || now - previous.at > 1500) return
        }
        deliver([{ hit, quad: quadOf(hit) }])
      })
    }
    raf = requestAnimationFrame(tick)
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
    }
  }, [status, mirrored, decode, videoRef])

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track || !torch.available) return
    const next = !torch.on
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorch({ available: true, on: next })
    } catch {
      setTorch({ available: false, on: false })
    }
  }, [torch])

  return { status, error, torch, mirrored, retry: start, toggleTorch }
}

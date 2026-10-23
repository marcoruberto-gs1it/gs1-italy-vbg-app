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
  /** Barcode rilevati finora mentre si raccoglie un'etichetta (vuoto quando la raccolta si annulla). */
  onCollect?: (hits: Hit[], quads: Quad[]) => void
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
// Raccolta adattiva: almeno LABEL_MIN, si chiude LABEL_QUIET dopo l'ultimo barcode nuovo, mai oltre LABEL_MAX.
const LABEL_MIN = 900
const LABEL_QUIET = 700
const LABEL_MAX = 3000
// Durante la raccolta i fotogrammi si analizzano alla risoluzione piena della fotocamera: i GS1-128 di
// un'etichetta sono spesso densi e a 1280 px le barre più sottili si perdono.
const LABEL_MAX_SIDE = 2560
// …e si alternano due modi di separare barre e spazi: su un'immagine un po' sfocata uno legge quello che l'altro perde.
const LABEL_BINARIZERS = ['LocalAverage', 'FixedThreshold'] as const
const isGs1128 = (hit: Hit) => hit.symbologyIdentifier === ']C1'

function classify(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : (error as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'notfound'
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') return 'busy'
  return 'unknown'
}

const watchedTracks = new WeakSet<MediaStreamTrack>()

export function useScanner(videoRef: RefObject<HTMLVideoElement | null>, { enabled, active, onDetect, onCollect }: Options) {
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [error, setError] = useState<CameraError | null>(null)
  const [torch, setTorch] = useState({ available: false, on: false })
  const [mirrored, setMirrored] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionRef = useRef(0)
  const activeRef = useRef(active)
  const onDetectRef = useRef(onDetect)
  const onCollectRef = useRef(onCollect)
  const pendingRef = useRef(new Map<number, (hits: Hit[]) => void>())
  const nextIdRef = useRef(1)
  const lastTextRef = useRef<{ text: string; at: number } | null>(null)

  useEffect(() => {
    onDetectRef.current = onDetect
    onCollectRef.current = onCollect
  }, [onDetect, onCollect])

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
    let label: { start: number; lastNew: number; seen: Map<string, { hit: Hit; quad: Quad; count: number }> } | null = null
    const labelDone = (now: number) => Boolean(label && (now - label.start >= LABEL_MAX || (now - label.start >= LABEL_MIN && now - label.lastNew >= LABEL_QUIET)))
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
      if (!activeRef.current && label) {
        label = null
        onCollectRef.current?.([], [])
      }
      if (label && labelDone(now) && !busy) return closeLabel()
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
      const factor = Math.min(1, (label ? LABEL_MAX_SIDE : MAX_SIDE) / Math.max(visW, visH))
      canvas.width = Math.round(visW * factor)
      canvas.height = Math.round(visH * factor)
      ctx.drawImage(video, (vw - visW) / 2, (vh - visH) / 2, visW, visH, 0, 0, canvas.width, canvas.height)
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const map: FrameMap = { scale, factor, width: ew, mirrored }

      busy = true
      const id = nextIdRef.current++
      const binarizer = label ? LABEL_BINARIZERS[id % LABEL_BINARIZERS.length] : undefined
      void decode({ type: 'frame', id, width: frame.width, height: frame.height, buffer: frame.data.buffer, binarizer }, [frame.data.buffer]).then((hits) => {
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
        if (!label && hits.some(isGs1128)) label = { start: now, lastNew: now, seen: new Map() }
        if (label) {
          for (const hit of hits) {
            const known = label.seen.get(hit.text)
            if (!known) label.lastNew = performance.now()
            label.seen.set(hit.text, { hit, quad: quadOf(hit), count: (known?.count ?? 0) + 1 })
          }
          // Evidenziazione dal vivo: i barcode visti finora, nell'ordine di lettura dell'etichetta.
          const seen = [...label.seen.values()]
          const ordered = byPosition(seen.map((i) => i.hit))
          onCollectRef.current?.(ordered, ordered.map((hit) => seen.find((i) => i.hit === hit)!.quad))
          if (labelDone(performance.now())) closeLabel()
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

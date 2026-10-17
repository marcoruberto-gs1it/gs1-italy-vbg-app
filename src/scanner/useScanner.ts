import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { acquireCamera, parkCamera } from './camera'
import type { DecoderRequest, DecoderResponse, Hit, Quad } from './types'

export type CameraError = 'insecure' | 'unsupported' | 'denied' | 'notfound' | 'busy' | 'unknown'
export type CameraStatus = 'starting' | 'live' | 'error'

type Options = {
  /** Fotocamera accesa (scanner aperto). */
  enabled: boolean
  /** Decodifica attiva (nessun esito o pannello sopra lo scanner). */
  active: boolean
  onDetect: (hit: Hit, quad: Quad) => void
}

type FrameMap = { scale: number; factor: number; width: number; mirrored: boolean }

const MAX_SIDE = 1280
const MIN_INTERVAL = 70
// Simbologie senza cifra di controllo obbligatoria: chiediamo due letture identiche.
const NEEDS_CONFIRM = /Codabar|Code39|Code93|ITF/

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
  const pendingRef = useRef(new Map<number, (hit: Hit | null) => void>())
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
      pending.get(data.id)?.(data.hit)
      pending.delete(data.id)
    }
    workerRef.current = worker
    return () => {
      worker.terminate()
      pending.forEach((resolve) => resolve(null))
      pending.clear()
      workerRef.current = null
    }
  }, [])

  const decode = useCallback((request: DecoderRequest, transfer: Transferable[] = []) => {
    const worker = workerRef.current
    if (!worker) return Promise.resolve(null)
    return new Promise<Hit | null>((resolve) => {
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
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const video = videoRef.current
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
      void decode({ type: 'frame', id, width: frame.width, height: frame.height, buffer: frame.data.buffer }, [frame.data.buffer]).then((hit) => {
        busy = false
        if (stopped || !hit || !activeRef.current) return
        if (NEEDS_CONFIRM.test(hit.format)) {
          const previous = lastTextRef.current
          lastTextRef.current = { text: hit.text, at: now }
          if (!previous || previous.text !== hit.text || now - previous.at > 1500) return
        }
        const toScreen = ({ x, y }: { x: number; y: number }) => {
          const sx = (x / map.factor) * map.scale
          return { x: map.mirrored ? map.width - sx : sx, y: (y / map.factor) * map.scale }
        }
        const p = hit.position
        activeRef.current = false
        onDetectRef.current(hit, {
          topLeft: toScreen(p.topLeft),
          topRight: toScreen(p.topRight),
          bottomRight: toScreen(p.bottomRight),
          bottomLeft: toScreen(p.bottomLeft),
        })
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

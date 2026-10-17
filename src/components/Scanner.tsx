import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { CameraOff, Flashlight, FlashlightOff, ImageUp, Keyboard, RotateCcw, X } from 'lucide-react'
import type { Hit, Quad } from '../scanner/types'
import { useScanner, type CameraError } from '../scanner/useScanner'

const cameraMessages: Record<CameraError, [string, string]> = {
  denied: ['Accesso alla fotocamera negato', 'Consentilo nelle impostazioni del browser, poi riprova.'],
  insecure: ['Serve una connessione sicura', 'Apri l’app da un indirizzo https:// o da localhost.'],
  notfound: ['Nessuna fotocamera trovata', 'Collega una fotocamera o inserisci il codice a mano.'],
  busy: ['Fotocamera occupata', 'Chiudi le altre app che la stanno usando, poi riprova.'],
  unsupported: ['Browser non compatibile', 'Aggiorna il browser o inserisci il codice a mano.'],
  unknown: ['Fotocamera non avviata', 'Riprova, oppure inserisci il codice a mano.'],
}

type Props = {
  paused: boolean
  onRead: (hit: Hit, center: { x: number; y: number }) => void
  onClose: () => void
  onManual: () => void
  onImage: () => void
  onIssue: (issue: CameraError | null) => void
}

function quadStyle(q: Quad, linear: boolean): CSSProperties {
  const xs = [q.topLeft.x, q.topRight.x, q.bottomRight.x, q.bottomLeft.x]
  const ys = [q.topLeft.y, q.topRight.y, q.bottomRight.y, q.bottomLeft.y]
  const pad = 14
  const width = Math.max(Math.max(...xs) - Math.min(...xs) + pad * 2, 64)
  // Per i codici lineari zxing restituisce solo la linea di scansione: estendiamo il riquadro all'altezza tipica delle barre.
  const height = Math.max(Math.max(...ys) - Math.min(...ys) + pad * 2, linear ? width * 0.5 : 48)
  const left = (Math.min(...xs) + Math.max(...xs)) / 2 - width / 2
  const top = (Math.min(...ys) + Math.max(...ys)) / 2 - height / 2
  return { left, top, width, height, margin: 0 }
}

export function Scanner({ paused, onRead, onClose, onManual, onImage, onIssue }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [lock, setLock] = useState<{ quad: Quad; linear: boolean } | null>(null)

  const onDetect = useCallback(
    (hit: Hit, quad: Quad) => {
      setLock({ quad, linear: !/QR|Matrix|Aztec|PDF417|MaxiCode/i.test(hit.format) })
      navigator.vibrate?.(35)
      const rect = videoRef.current?.getBoundingClientRect()
      const cx = (quad.topLeft.x + quad.topRight.x + quad.bottomRight.x + quad.bottomLeft.x) / 4
      const cy = (quad.topLeft.y + quad.topRight.y + quad.bottomRight.y + quad.bottomLeft.y) / 4
      onRead(hit, { x: cx + (rect?.left ?? 0), y: cy + (rect?.top ?? 0) })
    },
    [onRead],
  )

  const camera = useScanner(videoRef, { enabled: true, active: !paused && !lock, onDetect })

  // Quando si torna allo scanner dopo un esito, il mirino si riapre.
  const [wasPaused, setWasPaused] = useState(paused)
  if (paused !== wasPaused) {
    setWasPaused(paused)
    if (!paused) setLock(null)
  }

  useEffect(() => {
    onIssue(camera.status === 'live' ? null : camera.error)
  }, [camera.status, camera.error, onIssue])

  const errorText = camera.error ? cameraMessages[camera.error] : null

  return (
    <section className={`scanner ${camera.mirrored ? 'is-mirrored' : ''}`} aria-label="Scanner">
      <video ref={videoRef} className="scanner-video" autoPlay muted playsInline />

      {camera.status !== 'error' && (
        <div className={`finder ${lock ? 'is-locked' : ''} ${camera.status === 'live' ? 'is-live' : ''}`} style={lock ? quadStyle(lock.quad, lock.linear) : undefined} aria-hidden="true">
          <i className="c tl" />
          <i className="c tr" />
          <i className="c br" />
          <i className="c bl" />
          <span className="beam" />
        </div>
      )}
      {lock && <div className="flash" aria-hidden="true" />}

      <header className="scanner-top">
        <button className="glass" type="button" onClick={onClose} aria-label="Chiudi lo scanner">
          <X size={22} />
        </button>
      </header>

      {camera.status === 'starting' && <div className="pill">Avvio fotocamera…</div>}

      {errorText && (
        <div className="camera-error" role="alert">
          <CameraOff size={28} strokeWidth={1.6} />
          <h1>{errorText[0]}</h1>
          <p>{errorText[1]}</p>
          <div className="row">
            <button className="btn btn-light" type="button" onClick={() => void camera.retry()}>
              <RotateCcw size={17} /> Riprova
            </button>
            <button className="btn btn-ghost" type="button" onClick={onManual}>
              <Keyboard size={17} /> Inserisci
            </button>
          </div>
        </div>
      )}

      <nav className="scanner-dock" aria-label="Strumenti">
        <button className="glass" type="button" onClick={onImage} aria-label="Leggi da una foto">
          <ImageUp size={21} />
        </button>
        {camera.torch.available ? (
          <button className={`glass glass-lg ${camera.torch.on ? 'is-on' : ''}`} type="button" onClick={() => void camera.toggleTorch()} aria-label={camera.torch.on ? 'Spegni la torcia' : 'Accendi la torcia'} aria-pressed={camera.torch.on}>
            {camera.torch.on ? <Flashlight size={24} /> : <FlashlightOff size={24} />}
          </button>
        ) : (
          <span className="dock-spacer" />
        )}
        <button className="glass" type="button" onClick={onManual} aria-label="Inserisci un codice">
          <Keyboard size={21} />
        </button>
      </nav>
    </section>
  )
}

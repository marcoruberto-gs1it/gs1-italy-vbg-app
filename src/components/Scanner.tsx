import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { CameraOff, Flashlight, FlashlightOff, ImageUp, Keyboard, RotateCcw, X } from 'lucide-react'
import type { Hit, Quad } from '../scanner/types'
import { useScanner, type CameraError } from '../scanner/useScanner'
import { t } from '../i18n'

/** Segna un testo da tradurre senza tradurlo subito. */
const k = (s: string) => s

/** Titolo e spiegazione per ogni problema della fotocamera (tradotti al momento dell'uso). */
const cameraMessages: Record<CameraError, [string, string]> = {
  denied: [k('Accesso alla fotocamera negato'), k('Consentilo nelle impostazioni del browser, poi riprova.')],
  insecure: [k('Serve una connessione sicura'), k('Apri l’app da un indirizzo https:// o da localhost.')],
  notfound: [k('Nessuna fotocamera trovata'), k('Collega una fotocamera o inserisci il codice a mano.')],
  busy: [k('Fotocamera occupata'), k('Chiudi le altre app che la stanno usando, poi riprova.')],
  unsupported: [k('Browser non compatibile'), k('Aggiorna il browser o inserisci il codice a mano.')],
  unknown: [k('Fotocamera non avviata'), k('Riprova, oppure inserisci il codice a mano.')],
}

type Props = {
  paused: boolean
  /** Barcode letti: più di uno quando l'inquadratura contiene un'etichetta logistica (GS1-128). */
  onRead: (hits: Hit[], center: { x: number; y: number }) => void
  onClose: () => void
  onManual: () => void
  onImage: () => void
  onIssue: (issue: CameraError | null) => void
  /** Indicazione in alto (es. quando si legge l'altro barcode di un articolo). */
  hint?: string
}

/** Rettangolo che contiene tutti i quadrilateri. */
function enclosing(quads: Quad[]): Quad {
  const points = quads.flatMap((q) => [q.topLeft, q.topRight, q.bottomRight, q.bottomLeft])
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  return { topLeft: { x: left, y: top }, topRight: { x: right, y: top }, bottomRight: { x: right, y: bottom }, bottomLeft: { x: left, y: bottom } }
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

export function Scanner({ paused, onRead, onClose, onManual, onImage, onIssue, hint }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [lock, setLock] = useState<{ quad: Quad; linear: boolean } | null>(null)

  const onDetect = useCallback(
    (hits: Hit[], quads: Quad[]) => {
      // Il mirino si aggancia all'area che contiene tutti i barcode letti.
      const quad = quads.length === 1 ? quads[0] : enclosing(quads)
      setLock({ quad, linear: hits.length > 1 || !/QR|Matrix|Aztec|PDF417|MaxiCode/i.test(hits[0].format) })
      navigator.vibrate?.(hits.length > 1 ? [35, 60, 35] : 35)
      const rect = videoRef.current?.getBoundingClientRect()
      const cx = (quad.topLeft.x + quad.topRight.x + quad.bottomRight.x + quad.bottomLeft.x) / 4
      const cy = (quad.topLeft.y + quad.topRight.y + quad.bottomRight.y + quad.bottomLeft.y) / 4
      onRead(hits, { x: cx + (rect?.left ?? 0), y: cy + (rect?.top ?? 0) })
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
    <section className={`scanner ${camera.mirrored ? 'is-mirrored' : ''}`} aria-label={t('Scanner')}>
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
        <button className="glass" type="button" onClick={onClose} aria-label={t('Chiudi lo scanner')}>
          <X size={22} />
        </button>
        {hint && <p className="scanner-hint" role="status">{hint}</p>}
      </header>

      {camera.status === 'starting' && <div className="pill">{t('Avvio fotocamera…')}</div>}

      {errorText && (
        <div className="camera-error" role="alert">
          <CameraOff size={28} strokeWidth={1.6} />
          <h1>{t(errorText[0])}</h1>
          <p>{t(errorText[1])}</p>
          <div className="row">
            <button className="btn btn-light" type="button" onClick={() => void camera.retry()}>
              <RotateCcw size={17} /> {t('Riprova')}
            </button>
            <button className="btn btn-ghost" type="button" onClick={onManual}>
              <Keyboard size={17} /> {t('Inserisci')}
            </button>
          </div>
        </div>
      )}

      <nav className="scanner-dock" aria-label={t('Strumenti')}>
        <button className="glass" type="button" onClick={onImage} aria-label={t('Leggi da una foto')}>
          <ImageUp size={21} />
        </button>
        {camera.torch.available ? (
          <button className={`glass glass-lg ${camera.torch.on ? 'is-on' : ''}`} type="button" onClick={() => void camera.toggleTorch()} aria-label={camera.torch.on ? t('Spegni la torcia') : t('Accendi la torcia')} aria-pressed={camera.torch.on}>
            {camera.torch.on ? <Flashlight size={24} /> : <FlashlightOff size={24} />}
          </button>
        ) : (
          <span className="dock-spacer" />
        )}
        <button className="glass" type="button" onClick={onManual} aria-label={t('Inserisci un codice')}>
          <Keyboard size={21} />
        </button>
      </nav>
    </section>
  )
}

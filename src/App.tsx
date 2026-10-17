import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScanBarcode, Trash2 } from 'lucide-react'
import './App.css'
import { Drawer, Header, TabBar, type InfoTopic, type Tab } from './components/Chrome'
import { HistoryList, ManualForm, Sheet } from './components/Common'
import { Home } from './components/Home'
import { IllPhone } from './components/Illustrations'
import { InfoContent, infoTitles } from './components/InfoSheets'
import { Result } from './components/Result'
import { Scanner } from './components/Scanner'
import { needsVerification, type Scan } from './components/scan'
import { interpretScan, loadToolkit } from './gs1/interpret'
import { verifyKey } from './gs1/vbg'
import { decodeImage } from './scanner/decodeImage'
import { formatName } from './scanner/formats'
import type { Hit } from './scanner/types'
import type { CameraError } from './scanner/useScanner'

type SheetState = { type: 'manual' } | { type: 'info'; topic: InfoTopic } | null

const HISTORY_KEY = 'vbg-history-v2'
const LOCK_MS = 560
const PERSISTENT_ISSUES: CameraError[] = ['denied', 'insecure', 'unsupported', 'notfound']

function readHistory(): Scan[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as Scan[]
  } catch {
    return []
  }
}

function initialIssue(): CameraError | null {
  if (!window.isSecureContext) return 'insecure'
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
  return null
}

function enterFullscreen() {
  const root = document.documentElement
  const standalone = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches
  if (standalone || document.fullscreenElement || !root.requestFullscreen) return
  root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
}

function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
}

export default function App() {
  const fileRef = useRef<HTMLInputElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scan, setScan] = useState<Scan | null>(null)
  const [origin, setOrigin] = useState({ x: 0, y: 0 })
  const [sheet, setSheet] = useState<SheetState>(null)
  const [drawer, setDrawer] = useState(false)
  const [reading, setReading] = useState(false)
  const [history, setHistory] = useState<Scan[]>(readHistory)
  const [notice, setNotice] = useState('')
  const [cameraIssue, setCameraIssue] = useState<CameraError | null>(initialIssue)
  const [raised, setRaised] = useState(false)

  useEffect(() => {
    void loadToolkit()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)))
    } catch {
      /* archiviazione non disponibile */
    }
  }, [history])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  // Stato del permesso fotocamera, dove il browser lo espone.
  useEffect(() => {
    let status: PermissionStatus | undefined
    const sync = () => {
      const state = status?.state
      if (!state) return
      setCameraIssue((current) => (state === 'denied' ? 'denied' : current === 'denied' ? null : current))
    }
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((result) => {
        status = result
        sync()
        result.addEventListener('change', sync)
      })
      .catch(() => {})
    return () => status?.removeEventListener('change', sync)
  }, [])

  useGSAP(
    () => {
      if (tab === 'home' || !pageRef.current) return
      gsap.from(pageRef.current, { y: 18, opacity: 0, duration: 0.45, ease: 'power3.out' })
    },
    { dependencies: [tab] },
  )

  // La verifica Verified by GS1 arriva dopo l'esito: aggiorna la schermata aperta e la cronologia.
  const verify = useCallback((target: Scan) => {
    const primary = target.primary
    if (!primary || !needsVerification(target)) return
    const apply = (vbg: Scan['vbg']) => {
      setScan((current) => (current?.id === target.id ? { ...current, vbg } : current))
      setHistory((list) => list.map((item) => (item.id === target.id ? { ...item, vbg } : item)))
    }
    apply(undefined)
    void verifyKey(primary.ai, primary.value).then(apply)
  }, [])

  const show = useCallback(
    (result: Scan, center?: { x: number; y: number }) => {
      setOrigin(center ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.4 })
      setScan(result)
      setHistory((list) => [result, ...list.filter((item) => item.raw !== result.raw)].slice(0, 30))
      verify(result)
    },
    [verify],
  )

  const onRead = useCallback(
    (hit: Hit, center: { x: number; y: number }) => {
      setReading(true)
      const started = performance.now()
      void interpretScan(hit.text, formatName(hit.format, hit.symbologyIdentifier))
        .then((result) => {
          window.setTimeout(() => {
            show(result, center)
            setReading(false)
          }, Math.max(0, LOCK_MS - (performance.now() - started)))
        })
    },
    [show],
  )

  const onIssue = useCallback((issue: CameraError | null) => {
    if (issue === null || PERSISTENT_ISSUES.includes(issue)) setCameraIssue(issue)
  }, [])

  function openScanner() {
    enterFullscreen()
    setScan(null)
    setSheet(null)
    setScannerOpen(true)
  }

  function closeScanner() {
    setScannerOpen(false)
    exitFullscreen()
  }

  function closeResult() {
    setScan(null)
    closeScanner()
  }

  async function readManual(value: string) {
    const result = await interpretScan(value, 'Manuale')
    setSheet(null)
    show(result)
  }

  async function readFile(file: File | undefined) {
    if (!file) return
    const hit = await decodeImage(file)
    if (!hit) {
      setNotice('Nessun codice trovato nella foto')
      return
    }
    show(await interpretScan(hit.text, formatName(hit.format, hit.symbologyIdentifier)))
  }

  function openFromHistory(item: Scan) {
    setOrigin({ x: window.innerWidth / 2, y: window.innerHeight })
    setScan(item)
    verify(item)
  }

  return (
    <div className="shell">
      <div className="main" inert={scannerOpen || Boolean(scan)} onScroll={(e) => setRaised(e.currentTarget.scrollTop > 4)}>
        <Header raised={raised} onMenu={() => setDrawer(true)} onLogo={() => setTab('home')} />

        {tab === 'home' ? (
          <Home
            cameraIssue={cameraIssue}
            last={history[0] ?? null}
            onScan={openScanner}
            onManual={() => setSheet({ type: 'manual' })}
            onOpen={openFromHistory}
            onInfo={(topic) => setSheet({ type: 'info', topic })}
          />
        ) : (
          <div className="page" ref={pageRef}>
            <div className="page-head">
              <h1>Scansioni recenti</h1>
              {history.length > 0 && (
                <button className="text-btn" type="button" onClick={() => setHistory([])}>
                  <Trash2 size={16} /> Svuota
                </button>
              )}
            </div>
            {history.length ? (
              <HistoryList items={history} onOpen={openFromHistory} />
            ) : (
              <div className="empty-card">
                <IllPhone />
                <p>Qui trovi i codici che leggi. Restano solo su questo dispositivo.</p>
                <button className="cta" type="button" onClick={openScanner}><ScanBarcode size={20} /> Scansiona un codice</button>
              </div>
            )}
          </div>
        )}

        <TabBar tab={tab} onTab={setTab} onScan={openScanner} badge={history.length} />
      </div>

      {scannerOpen && (
        <Scanner
          paused={Boolean(scan) || Boolean(sheet) || reading}
          onRead={onRead}
          onClose={closeScanner}
          onManual={() => setSheet({ type: 'manual' })}
          onImage={() => fileRef.current?.click()}
          onIssue={onIssue}
        />
      )}

      {scan && <Result key={scan.id} scan={scan} origin={origin} onClose={closeResult} onRescan={openScanner} onRetry={() => verify(scan)} onNotice={setNotice} />}

      {drawer && (
        <Drawer
          onClose={() => setDrawer(false)}
          onScan={openScanner}
          onManual={() => setSheet({ type: 'manual' })}
          onImage={() => fileRef.current?.click()}
          onTab={setTab}
          onInfo={(topic) => setSheet({ type: 'info', topic })}
        />
      )}

      {sheet?.type === 'manual' && (
        <Sheet title="Inserisci un codice" onClose={() => setSheet(null)}>
          <ManualForm onSubmit={readManual} />
        </Sheet>
      )}
      {sheet?.type === 'info' && (
        <Sheet title={infoTitles[sheet.topic]} tall onClose={() => setSheet(null)}>
          <InfoContent topic={sheet.topic} onTryDemo={() => void readManual('09506000134352')} />
        </Sheet>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = '' }} />
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

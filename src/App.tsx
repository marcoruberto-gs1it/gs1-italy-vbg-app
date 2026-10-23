import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScanBarcode, Trash2 } from 'lucide-react'
import { isSettled, sendEvent, type ScanSource } from './analytics/events'
import './App.css'
import { Drawer, Header, TabBar, type InfoTopic, type Tab } from './components/Chrome'
import { HistoryList, ManualForm, Sheet } from './components/Common'
import { Home } from './components/Home'
import { PrivacyContent } from './components/Privacy'
import { IllPhone } from './components/Illustrations'
import { InfoContent, infoTitles } from './components/InfoSheets'
import { Result } from './components/Result'
import { Scanner } from './components/Scanner'
import { alreadyRead, awaitsAnswer, combineMany, combineScans, isLabel, needsVerification, withDisplayFormat, type Scan } from './components/scan'
import { packSymbol } from './components/symbolData'
import { interpretScan, loadToolkit } from './gs1/interpret'
import { canCoexist, checkSyntax, loadSyntaxEngine } from './gs1/syntax'
import { verifyKey } from './gs1/vbg'
import { checkWebRisk } from './gs1/webRisk'
import { decodeImage } from './scanner/decodeImage'
import { formatName } from './scanner/formats'
import { alreadyReloaded, loadVersion, useUpdateAvailable } from './lib/update'
import type { Hit } from './scanner/types'
import type { CameraError } from './scanner/useScanner'
import { t, useLang } from './i18n'

type SheetState = { type: 'manual' } | { type: 'info'; topic: InfoTopic } | { type: 'privacy' } | null

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
  // Scansione a cui si sta aggiungendo un altro barcode dello stesso articolo (dati su più barcode).
  const [companion, setCompanion] = useState<Scan | null>(null)
  const companionRef = useRef<Scan | null>(null)
  // Statistiche: scansioni nuove in attesa che tutti i controlli asincroni siano arrivati.
  const pendingEvents = useRef(new Map<string, ScanSource>())
  // Scansioni chiuse dall'utente (risultato chiuso o sostituito): la statistica non aspetta più la risposta.
  const closedEvents = useRef(new Set<string>())
  const historyRef = useRef(history)
  // Lingua corrente: al cambio si ridisegna tutta l'interfaccia (i testi si calcolano a ogni rendering).
  const lang = useLang()

  useEffect(() => {
    void loadToolkit()
    void loadSyntaxEngine().catch(() => {})
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)))
    } catch {
      /* archiviazione non disponibile */
    }
  }, [history])

  /*
   * Statistiche: un solo evento per articolo, quando è "chiuso". Cioè quando sono arrivati i controlli
   * (sintassi, VbG, siti malevoli) e non c'è una domanda in sospeso sull'altro barcode: l'utente ha
   * risposto, ha letto l'altro barcode, oppure ha chiuso il risultato (o l'app va in background).
   */
  const dispatch = useCallback((id: string) => {
    const source = pendingEvents.current.get(id)
    const item = historyRef.current.find((h) => h.id === id)
    pendingEvents.current.delete(id)
    closedEvents.current.delete(id)
    if (source && item) sendEvent(item, source)
  }, [])

  // Etichette logistiche: si aspetta la chiusura del risultato, perché l'utente può aggiungere altri barcode.
  const open = (item: Scan) => (awaitsAnswer(item) || isLabel(item)) && !closedEvents.current.has(item.id)
  const ready = (item: Scan) => isSettled(item) && !open(item)

  useEffect(() => {
    historyRef.current = history
    for (const id of [...pendingEvents.current.keys()]) {
      const item = history.find((h) => h.id === id)
      if (!item) pendingEvents.current.delete(id)
      else if (ready(item)) dispatch(id)
    }
  }, [history, dispatch])

  /** L'utente ha lasciato la scansione: si invia appena i controlli sono arrivati, senza più aspettare la risposta. */
  const closeEvent = useCallback(
    (id: string) => {
      if (!pendingEvents.current.has(id)) return
      closedEvents.current.add(id)
      const item = historyRef.current.find((h) => h.id === id)
      if (item && isSettled(item)) dispatch(id)
    },
    [dispatch],
  )

  // App in background o chiusa: si invia tutto ciò che è in sospeso (ultimo momento affidabile sui telefoni).
  // Si aspetta solo la scansione di cui si sta leggendo l'altro barcode (la fotocamera o la scelta di una
  // foto possono mandare l'app in background), salvo quando la pagina viene chiusa davvero.
  useEffect(() => {
    const flush = (closing: boolean) => {
      for (const id of [...pendingEvents.current.keys()]) if (closing || companionRef.current?.id !== id) dispatch(id)
    }
    const onHidden = () => document.visibilityState === 'hidden' && flush(false)
    const onPageHide = () => flush(true)
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [dispatch])

  // Il risultato mostrato cambia (chiuso, nuova scansione, altra voce della cronologia): la scansione
  // precedente è chiusa. Non durante la lettura dell'altro barcode, che poi torna allo stesso risultato.
  const shownId = useRef<string | null>(null)
  useEffect(() => {
    const previous = shownId.current
    shownId.current = scan?.id ?? null
    if (previous && previous !== scan?.id && companionRef.current?.id !== previous) closeEvent(previous)
  }, [scan?.id, closeEvent])

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
  // refresh: richiede di nuovo i dati già arrivati (es. nella nuova lingua) senza tornare allo stato "in verifica".
  const verify = useCallback((target: Scan, refresh = false) => {
    const primary = target.primary
    if (!primary || !(refresh ? target.vbg && target.vbg.state !== 'error' : needsVerification(target))) return
    const apply = (vbg: Scan['vbg']) => {
      setScan((current) => (current?.id === target.id ? { ...current, vbg } : current))
      setHistory((list) => list.map((item) => (item.id === target.id ? { ...item, vbg } : item)))
    }
    if (!refresh) apply(undefined)
    void verifyKey(primary.ai, primary.value).then(apply)
  }, [])

  // Controllo con la GS1 Barcode Syntax Engine: come la verifica VbG, arriva dopo l'esito.
  const lint = useCallback((target: Scan) => {
    if (target.kind !== 'gs1' || target.syntax !== undefined) return
    void checkSyntax(target).then((syntax) => {
      setScan((current) => (current?.id === target.id ? { ...current, syntax } : current))
      setHistory((list) => list.map((item) => (item.id === target.id ? { ...item, syntax } : item)))
    })
  }, [])

  // Link del codice: confronto con gli elenchi di siti malevoli di Google (tramite il Worker).
  const guard = useCallback((target: Scan) => {
    if (!target.url || target.webRisk) return
    void checkWebRisk(target.url).then((webRisk) => {
      setScan((current) => (current?.id === target.id ? { ...current, webRisk } : current))
      setHistory((list) => list.map((item) => (item.id === target.id ? { ...item, webRisk } : item)))
    })
  }, [])

  /**
   * Secondo barcode dello stesso articolo: i dati si uniscono alla scansione di partenza e si ricontrollano
   * insieme (GS1 General Specifications §4.13.2). Restituisce false se va mostrato come nuova scansione.
   */
  const attach = useCallback(
    async (base: Scan, extra: Scan) => {
      const combined = combineScans(base, extra)
      // AI che GS1 non ammette insieme (es. (01) e (02)): il barcode è di un altro articolo.
      const joined: typeof combined = combined.ok && !(await canCoexist(combined.data)) ? { ok: false, reason: 'other-item' } : combined
      if (!joined.ok) {
        if (joined.reason === 'not-gs1') {
          setNotice(t('Il barcode letto non contiene dati GS1'))
          setScan(base)
          return true
        }
        // Il barcode non completa l'articolo di partenza: quell'articolo è chiuso, il nuovo si apre a parte.
        closeEvent(base.id)
        setNotice(joined.reason === 'other-item'
          ? t('È un altro articolo: aperto come nuova scansione')
          : t('I due barcode hanno valori diversi per l’AI ({ai}): aperto come nuova scansione', { ai: joined.ai ?? '' }))
        return false
      }
      const fresh = await interpretScan(joined.data, base.format)
      const samePrimary = fresh.primary?.ai === base.primary?.ai && fresh.primary?.value === base.primary?.value
      const merged = withDisplayFormat({
        ...base,
        raw: joined.data,
        primary: fresh.primary,
        fields: fresh.fields,
        digitalLink: fresh.digitalLink ?? base.digitalLink,
        checkDigit: fresh.checkDigit,
        issuer: fresh.issuer ?? base.issuer,
        barcodes: joined.barcodes,
        syntax: undefined,
        vbg: samePrimary ? base.vbg : undefined,
      })
      setScan(merged)
      setHistory((list) => list.map((item) => (item.id === merged.id ? merged : item)))
      verify(merged)
      lint(merged)
      return true
    },
    [verify, lint, closeEvent],
  )

  const present = useCallback(
    (scanned: Scan, center?: { x: number; y: number }, source?: ScanSource) => {
      const result = withDisplayFormat(scanned)
      // Stesso codice già in cronologia: la voce viene sostituita, quindi la sua statistica parte ora.
      for (const old of historyRef.current) if (old.raw === result.raw && old.id !== result.id) dispatch(old.id)
      if (source) {
        pendingEvents.current.set(result.id, source)
        // Se un controllo non risponde, l'evento parte comunque con i dati disponibili
        // (salvo che si aspetti la risposta dell'utente sull'altro barcode).
        window.setTimeout(() => {
          const item = historyRef.current.find((h) => h.id === result.id)
          if (pendingEvents.current.has(result.id) && item && !open(item)) dispatch(result.id)
        }, 12_000)
      }
      setOrigin(center ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.4 })
      setScan(result)
      setHistory((list) => [result, ...list.filter((item) => item.raw !== result.raw)].slice(0, 30))
      verify(result)
      lint(result)
      guard(result)
    },
    [verify, lint, guard, dispatch],
  )

  // Ogni lettura passa da qui: se si sta leggendo l'altro barcode di un articolo, i dati si uniscono.
  const show = useCallback(
    (scanned: Scan, center?: { x: number; y: number }, source?: ScanSource) => {
      const base = companionRef.current
      if (!base) return present(scanned, center, source)
      // Lo scanner ha riletto un barcode già letto (l'etichetta è ancora inquadrata): si continua a cercare.
      if (alreadyRead(base, scanned)) {
        setNotice(t('Barcode già letto: inquadra un altro barcode dell’etichetta'))
        return
      }
      companionRef.current = null
      setCompanion(null)
      void attach(base, scanned).then((handled) => {
        if (!handled) present(scanned, center, source)
      })
    },
    [attach, present],
  )

  // Rilegge una scansione nella lingua corrente: nomi dei campi, date, paesi, messaggi della Syntax Engine
  // e dati Verified by GS1 (la scansione può essere stata fatta in un'altra lingua).
  const localize = useCallback(
    (target: Scan) => {
      void interpretScan(target.raw, target.format).then((fresh) =>
        setScan((current) => (current?.id === target.id ? { ...current, primary: fresh.primary, fields: fresh.fields } : current)),
      )
      if (target.syntax !== undefined) lint({ ...target, syntax: undefined })
      verify(target, true)
    },
    [lint, verify],
  )

  // Cambio di lingua con una scansione aperta: la si rilegge subito nella nuova lingua.
  const shownLang = useRef(lang)
  useEffect(() => {
    if (shownLang.current === lang) return
    shownLang.current = lang
    if (scan) localize(scan)
  }, [lang, localize, scan])

  /**
   * Barcode letti insieme (fotocamera o foto): uno solo nella maggior parte dei casi; più di uno da
   * un'etichetta logistica. I barcode GS1 compatibili diventano un unico articolo, letto da più barcode;
   * quelli di altri articoli si scartano (e lo si dice). Senza dati GS1 vale il primo barcode.
   */
  const readHits = useCallback(async (hits: Hit[]): Promise<Scan> => {
    const scans: Scan[] = await Promise.all(
      hits.map(async (hit) => ({ ...(await interpretScan(hit.text, formatName(hit.format, hit.symbologyIdentifier))), symbol: packSymbol(hit.symbol) })),
    )
    // Etichetta logistica: i GS1-128 (i barcode dell'etichetta) vengono prima; gli altri barcode letti
    // (es. l'EAN di un prodotto vicino) si aggiungono solo se compatibili con l'etichetta.
    const labelFirst = (s: Scan) => (s.format === 'GS1-128' ? 0 : 1)
    const gs1 = scans.filter((s) => s.kind === 'gs1').sort((a, b) => labelFirst(a) - labelFirst(b))
    const joined = gs1.length > 1 ? await combineMany(gs1, canCoexist) : null
    if (!joined) return gs1[0] ?? scans[0]
    if (joined.skipped) setNotice(t('{n} barcode di altri articoli non considerati', { n: joined.skipped }))
    const fresh = await interpretScan(joined.data, gs1[0].format)
    return { ...fresh, format: gs1[0].format, barcodes: joined.barcodes }
  }, [])

  const onRead = useCallback(
    (hits: Hit[], center: { x: number; y: number }) => {
      setReading(true)
      const started = performance.now()
      void readHits(hits).then((result) => {
        window.setTimeout(() => {
          show(result, center, 'camera')
          setReading(false)
        }, Math.max(0, LOCK_MS - (performance.now() - started)))
      })
    },
    [show, readHits],
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
    // Lettura dell'altro barcode annullata: si torna alla scansione di partenza.
    const base = companionRef.current
    if (base) {
      companionRef.current = null
      setCompanion(null)
      setScan(base)
    }
  }

  // "Non c'è un altro barcode": la risposta resta con la scansione e la statistica può partire.
  function decline(target: Scan) {
    const answer = (item: Scan): Scan => (item.id === target.id ? { ...item, assoc: 'declined' } : item)
    setScan((current) => current && answer(current))
    setHistory((list) => list.map(answer))
  }

  function readCompanion(base: Scan) {
    companionRef.current = base
    setCompanion(base)
    enterFullscreen()
    setScan(null)
    setSheet(null)
    setScannerOpen(true)
  }

  function closeResult() {
    setScan(null)
    closeScanner()
  }

  async function readManual(value: string) {
    const result = await interpretScan(value, 'Manuale')
    setSheet(null)
    show(result, undefined, 'manual')
  }

  async function readFile(file: File | undefined) {
    if (!file) return
    const hits = await decodeImage(file)
    if (!hits.length) {
      setNotice(t('Nessun codice trovato nella foto'))
      return
    }
    // Come con la fotocamera: più barcode solo da un'etichetta con GS1-128, altrimenti il primo.
    show(await readHits(hits.some((h) => h.symbologyIdentifier === ']C1') ? hits : hits.slice(0, 1)), undefined, 'image')
  }

  function openFromHistory(stored: Scan) {
    setOrigin({ x: window.innerWidth / 2, y: window.innerHeight })
    setScan(stored)
    verify(stored)
    lint(stored)
    guard(stored)
    localize(stored)
  }

  // Versione più nuova pubblicata: se l'app è ferma sulla home si ricarica da sola, altrimenti lo propone.
  const update = useUpdateAvailable()
  const idle = tab === 'home' && !scan && !scannerOpen
  useEffect(() => {
    if (update && idle) loadVersion(update, true)
  }, [update, idle])

  return (
    <div className="shell">
      <div className="main" inert={scannerOpen || Boolean(scan)} onScroll={(e) => setRaised(e.currentTarget.scrollTop > 4)}>
        <Header raised={raised} onMenu={() => setDrawer(true)} onLogo={() => setTab('home')} />

        {tab === 'home' ? (
          <Home
            cameraIssue={cameraIssue}
            onScan={openScanner}
            onManual={() => setSheet({ type: 'manual' })}
            onInfo={(topic) => setSheet({ type: 'info', topic })}
            onPrivacy={() => setSheet({ type: 'privacy' })}
          />
        ) : (
          <div className="page" ref={pageRef}>
            <div className="page-head">
              <h1>{t('Scansioni recenti')}</h1>
              {history.length > 0 && (
                <button className="text-btn" type="button" onClick={() => setHistory([])}>
                  <Trash2 size={16} /> {t('Svuota')}
                </button>
              )}
            </div>
            {history.length ? (
              <HistoryList items={history} onOpen={openFromHistory} />
            ) : (
              <div className="empty-card">
                <IllPhone />
                <p>{t('Qui trovi i codici che leggi. Restano solo su questo dispositivo.')}</p>
                <button className="cta" type="button" onClick={openScanner}><ScanBarcode size={20} /> {t('Scansiona un codice')}</button>
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
          hint={companion ? t('Inquadra l’altro barcode dello stesso articolo') : undefined}
        />
      )}

      {scan && <Result key={scan.id} scan={scan} origin={origin} onClose={closeResult} onRescan={openScanner} onRetry={() => verify(scan)} onNotice={setNotice} onCompanion={() => readCompanion(scan)} onDecline={() => decline(scan)} />}

      {drawer && (
        <Drawer
          onClose={() => setDrawer(false)}
          onPrivacy={() => setSheet({ type: 'privacy' })}
          onScan={openScanner}
          onManual={() => setSheet({ type: 'manual' })}
          onImage={() => fileRef.current?.click()}
          onTab={setTab}
          onInfo={(topic) => setSheet({ type: 'info', topic })}
        />
      )}

      {sheet?.type === 'manual' && (
        <Sheet title={t('Inserisci un codice')} onClose={() => setSheet(null)}>
          <ManualForm onSubmit={readManual} />
        </Sheet>
      )}
      {sheet?.type === 'privacy' && (
        <Sheet title={t('Privacy e dati')} tall onClose={() => setSheet(null)}>
          <PrivacyContent />
        </Sheet>
      )}
      {sheet?.type === 'info' && (
        <Sheet title={infoTitles[sheet.topic]} tall onClose={() => setSheet(null)}>
          <InfoContent topic={sheet.topic} onTryDemo={() => void readManual('09506000134352')} />
        </Sheet>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = '' }} />
      {notice && <div className="toast" role="status">{notice}</div>}
      {update && (!idle || alreadyReloaded(update)) && (
        <div className="update-toast" role="status">
          <span>{t('È disponibile una nuova versione dell’app')}</span>
          <button type="button" onClick={() => loadVersion(update)}>{t('Aggiorna')}</button>
        </div>
      )}
    </div>
  )
}

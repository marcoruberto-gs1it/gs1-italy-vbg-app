/*
 * Gestore unico della fotocamera.
 * Ogni chiamata a getUserMedia può far ricomparire la richiesta di permesso (Firefox, Safari iOS, app
 * installate su iPhone, siti con certificato non valido). Per chiederlo una volta sola:
 *  - lo stream resta in vita per tutta la sessione e viene riusato a ogni apertura dello scanner;
 *  - a scanner chiuso le tracce vengono solo disattivate e lo stream viene rilasciato dopo un po'
 *    (o quando l'app va in background), così la spia della fotocamera non resta accesa;
 *  - la fotocamera scelta viene ricordata, così si apre con una sola richiesta invece di più tentativi.
 */

const DEVICE_KEY = 'vbg-camera-device'
const IDLE_RELEASE_MS = 90_000

let stream: MediaStream | null = null
let pending: Promise<MediaStream> | null = null
let idleTimer: number | undefined

function remembered() {
  try {
    return localStorage.getItem(DEVICE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function remember(stream: MediaStream) {
  const id = stream.getVideoTracks()[0]?.getSettings().deviceId
  try {
    if (id) localStorage.setItem(DEVICE_KEY, id)
  } catch {
    /* archiviazione non disponibile */
  }
}

function forget() {
  try {
    localStorage.removeItem(DEVICE_KEY)
  } catch {
    /* archiviazione non disponibile */
  }
}

const isLive = (s: MediaStream | null): s is MediaStream => Boolean(s?.getVideoTracks().some((t) => t.readyState === 'live'))
const errorName = (error: unknown) => (error as { name?: string })?.name ?? ''
const HD = { width: { ideal: 1920 }, height: { ideal: 1080 } }

async function open(): Promise<MediaStream> {
  // 1. Fotocamera già scelta in passato: una sola richiesta.
  const deviceId = remembered()
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: deviceId }, ...HD } })
    } catch (error) {
      if (/NotAllowed|Security/.test(errorName(error))) throw error
      forget()
    }
  }

  // 2. Prima volta: fotocamera posteriore, con risoluzione ridotta se il dispositivo non la supporta.
  const chain: MediaStreamConstraints[] = [
    { audio: false, video: { facingMode: { ideal: 'environment' }, ...HD } },
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: true },
  ]
  let lastError: unknown
  for (const constraints of chain) {
    try {
      const opened = await navigator.mediaDevices.getUserMedia(constraints)
      return await preferMainBackCamera(opened)
    } catch (error) {
      lastError = error
      if (/NotAllowed|Security/.test(errorName(error))) throw error
      if (/NotReadable|Abort|TrackStart/.test(errorName(error))) await new Promise((r) => setTimeout(r, 400))
    }
  }
  throw lastError
}

/** Su molti Android la prima fotocamera posteriore è un grandangolo che non mette a fuoco da vicino. */
async function preferMainBackCamera(opened: MediaStream): Promise<MediaStream> {
  const track = opened.getVideoTracks()[0]
  if (!track || track.getSettings().facingMode === 'user') return opened
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
  const backs = devices.filter((d) => /back|rear|environment|posteriore/i.test(d.label))
  const main = backs.find((d) => /camera2 0\b|camera 0\b/i.test(d.label))
  if (backs.length < 2 || !main || main.deviceId === track.getSettings().deviceId) return opened
  try {
    const better = await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: main.deviceId }, ...HD } })
    opened.getTracks().forEach((t) => t.stop())
    return better
  } catch {
    return opened
  }
}

/** Restituisce lo stream della fotocamera, aprendolo solo se non ce n'è già uno attivo. */
export async function acquireCamera(): Promise<MediaStream> {
  window.clearTimeout(idleTimer)
  if (isLive(stream)) {
    stream.getVideoTracks().forEach((t) => (t.enabled = true))
    return stream
  }
  pending ??= open()
    .then((opened) => {
      stream = opened
      remember(opened)
      return opened
    })
    .finally(() => {
      pending = null
    })
  return pending
}

/** Scanner chiuso: spegne il flusso subito e rilascia la fotocamera se non viene riaperta a breve. */
export function parkCamera() {
  if (!stream) return
  stream.getVideoTracks().forEach((t) => (t.enabled = false))
  window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(releaseCamera, IDLE_RELEASE_MS)
}

export function releaseCamera() {
  window.clearTimeout(idleTimer)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}

/** Stato del permesso, dove il browser lo espone. */
export async function cameraPermission(): Promise<PermissionState | 'unknown'> {
  try {
    return (await navigator.permissions.query({ name: 'camera' as PermissionName })).state
  } catch {
    return 'unknown'
  }
}

// In background il sistema operativo sospende comunque la fotocamera: la liberiamo subito.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseCamera()
  })
  window.addEventListener('pagehide', releaseCamera)
}

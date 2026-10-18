import { useEffect, useState } from 'react'

const CHECK_EVERY = 15 * 60_000

/**
 * C'è una versione dell'app più nuova di quella aperta? L'app installata nella schermata Home
 * (o una scheda lasciata aperta) non si ricarica da sola: si controlla version.json all'avvio,
 * quando l'app torna in primo piano e ogni 15 minuti.
 */
export function useUpdateAvailable() {
  const [available, setAvailable] = useState<string | null>(null)
  useEffect(() => {
    let last = 0
    const check = async () => {
      if (Date.now() - last < 60_000) return
      last = Date.now()
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const { version } = (await res.json()) as { version?: string }
        if (version && version !== __APP_VERSION__) setAvailable(version)
      } catch {
        // Offline o file assente (sviluppo): nessun avviso.
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && void check()
    void check()
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => void check(), CHECK_EVERY)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [])
  return available
}

const RELOADED = 'vbg-reloaded-for'

/** La ricarica automatica per questa versione è già stata tentata? */
export function alreadyReloaded(version: string) {
  try {
    return sessionStorage.getItem(RELOADED) === version
  } catch {
    return true
  }
}

/**
 * Carica la versione nuova. L'indirizzo porta il numero di versione, così il browser non riusa la
 * pagina che ha in memoria. `auto`: ricarica automatica, al massimo una volta per versione
 * (se la pagina servita fosse ancora quella vecchia, non si entra in un ciclo di ricariche).
 */
export function loadVersion(version: string, auto = false) {
  try {
    if (auto && alreadyReloaded(version)) return false
    sessionStorage.setItem(RELOADED, version)
  } catch {
    if (auto) return false
  }
  const url = new URL(window.location.href)
  url.searchParams.set('v', version)
  window.location.replace(url)
  return true
}

import { useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { fetchLatestVersion, loadVersion } from '../lib/update'

type State = 'idle' | 'checking' | 'latest' | 'offline'

/**
 * Versione dell'app e controllo manuale degli aggiornamenti: utile soprattutto con l'app aggiunta
 * alla schermata Home, che non ha un pulsante per ricaricare.
 */
export function AppVersion() {
  const [state, setState] = useState<State>('idle')
  async function check() {
    setState('checking')
    const latest = await fetchLatestVersion()
    if (!latest) return setState('offline')
    if (latest !== __APP_VERSION__) return void loadVersion(latest)
    setState('latest')
  }
  return (
    <div className="app-version">
      <span title={`build ${__APP_VERSION__}`}>v. {__APP_RELEASE__}</span>
      <button type="button" onClick={() => void check()} disabled={state === 'checking'}>
        {state === 'latest' ? <><Check size={15} /> È l’ultima</> : state === 'offline' ? 'Sei offline: riprova' : <><RefreshCw size={15} className={state === 'checking' ? 'spin' : undefined} /> Cerca aggiornamenti</>}
      </button>
    </div>
  )
}

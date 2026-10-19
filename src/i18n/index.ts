/*
 * Lingua dell'interfaccia: italiano o inglese.
 * Ordine di scelta: ?lang=it|en nell'indirizzo → scelta salvata dall'utente → lingue del browser, in ordine
 * di preferenza (la prima tra italiano e inglese; se non c'è nessuna delle due, inglese).
 * La scelta si salva solo se diversa dalla lingua del browser: così chi non ha mai cambiato lingua, o è
 * tornato a quella del browser, segue sempre le impostazioni del browser.
 * I testi restano in italiano nel codice e fanno da chiave: le traduzioni sono in en.json.
 */
import { useSyncExternalStore } from 'react'
import EN from './en.json'

export type Lang = 'it' | 'en'

export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'it', label: 'Italiano', short: 'IT' },
  { id: 'en', label: 'English', short: 'EN' },
]

const KEY = 'vbg-lang-choice'
/** Chiave della prima versione: salvava anche le scelte uguali alla lingua del browser, quindi si scarta. */
const OLD_KEY = 'vbg-lang'
const isLang = (v: unknown): v is Lang => v === 'it' || v === 'en'

/** Lingua del browser: la prima supportata tra quelle preferite (it-IT → it, en-US → en), altrimenti inglese. */
export function browserLang(languages: readonly string[]): Lang {
  for (const tag of languages) {
    const base = tag.toLowerCase().split(/[-_]/)[0]
    if (isLang(base)) return base
  }
  return 'en'
}

/** Lingua da usare: parametro nell'indirizzo, poi scelta salvata, poi lingue del browser. */
export function detectLang(param: string | null, stored: string | null, languages: readonly string[]): Lang {
  if (isLang(param)) return param
  if (isLang(stored)) return stored
  return browserLang(languages)
}

const navigatorLanguages = () => (typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language])

function readStored() {
  try {
    localStorage.removeItem(OLD_KEY)
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

let current: Lang =
  typeof window === 'undefined'
    ? 'it'
    : detectLang(new URLSearchParams(window.location.search).get('lang'), readStored(), navigatorLanguages())
const listeners = new Set<() => void>()
if (typeof document !== 'undefined') document.documentElement.lang = current

export const lang = () => current

/** Locale per numeri e date. */
export const locale = () => (current === 'en' ? 'en-GB' : 'it-IT')

/** Cambia lingua e la ricorda per le prossime visite (se è quella del browser, torna a seguire il browser). */
export function setLang(next: Lang) {
  if (next === current) return
  current = next
  try {
    if (next === browserLang(navigatorLanguages())) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch {
    // Archiviazione non disponibile (navigazione privata): vale solo per questa visita.
  }
  document.documentElement.lang = next
  const url = new URL(window.location.href)
  if (url.searchParams.has('lang')) {
    url.searchParams.delete('lang')
    window.history.replaceState(null, '', url)
  }
  listeners.forEach((l) => l())
}

/** Lingua corrente, con nuovo rendering quando cambia. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}

const dict = EN as Record<string, string>

/**
 * Testo nella lingua corrente. La chiave è il testo italiano; `{nome}` viene sostituito con vars.nome.
 * Senza traduzione resta l'italiano (il test i18n.test.ts impedisce che succeda).
 */
export function t(it: string, vars?: Record<string, string | number>): string {
  const s = current === 'en' ? (dict[it] ?? it) : it
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}

/** Solo per i test: imposta la lingua senza toccare archiviazione e pagina. */
export function _setLangForTest(l: Lang) {
  current = l
}

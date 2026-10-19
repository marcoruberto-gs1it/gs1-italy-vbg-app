/*
 * Testi e formati da mostrare, nella lingua corrente. I valori interni (nome della simbologia,
 * "Manuale"…) restano invariati: finiscono nelle statistiche e devono essere uguali in ogni lingua.
 */
import { locale, t } from '../i18n'

/** Nome della simbologia da mostrare: le simbologie vere restano col loro nome, le descrizioni dell'app si traducono. */
export function formatLabel(format: string): string {
  switch (format) {
    case 'Manuale': return t('Inserito a mano')
    case 'Codice con link': return t('Codice con link')
    case 'Codice con dati GS1': return t('Codice con dati GS1')
    case 'Codice con testo': return t('Codice con testo')
    case 'Data Matrix con GS1 Digital Link': return t('Data Matrix con GS1 Digital Link')
    default: return format
  }
}

const cache = new Map<string, Intl.DateTimeFormat>()
function fmt(key: string, opts: Intl.DateTimeFormatOptions) {
  const k = `${locale()}|${key}`
  let f = cache.get(k)
  if (!f) cache.set(k, (f = new Intl.DateTimeFormat(locale(), opts)))
  return f
}

/** Data e ora brevi (es. 18 ott, 16:27). */
export const shortDateTime = (d: Date | number) => fmt('sdt', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(d)
/** Data estesa (es. 18 ottobre 2026). */
export const longDate = (d: Date | number) => fmt('ld', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
/** Data e ora estese, per il rapporto PDF. */
export const longDateTime = (d: Date | number) => fmt('ldt', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
/** Numero nella lingua corrente. */
export const num = (n: number, opts?: Intl.NumberFormatOptions) => n.toLocaleString(locale(), opts)

/*
 * Valutazione dei link letti da un QR Code, contro quishing e phishing.
 *
 * Un GS1 Digital Link può stare su qualsiasi dominio, quindi la correttezza del link non dice nulla
 * sulla sua affidabilità. Il riferimento è il registro Verified by GS1: un dominio è considerato del
 * titolare solo se compare tra i link o il sito web che il titolare ha registrato per quel codice.
 */
import type { Verification } from './vbg'
import { threatLabel, type WebRiskResult } from './webRisk'

export type LinkLevel = 'trusted' | 'unknown' | 'danger' | 'pending'

export type LinkCheck = {
  url: string
  /** Dominio come lo vede il browser (i caratteri internazionali restano in forma xn--). */
  host: string
  level: LinkLevel
  /** Perché il link è affidabile o meno, in italiano. */
  reasons: string[]
  /** Dominio registrato a cui il link somiglia, se sembra un'imitazione. */
  imitates?: string
}

/** Resolver ufficiali GS1: portano sempre alla destinazione scelta dal titolare del codice. */
const GS1_RESOLVERS = new Set(['id.gs1.org'])

const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'shorturl.at',
  's.id', 'rb.gy', 't.ly', 'qrco.de', 'tiny.cc', 'bl.ink', 'shor.by', 'v.gd', 'lnkd.in', 'qr.me-qr.com',
])

// Suffissi a due livelli più comuni, per ricavare il dominio registrabile (es. azienda.co.uk).
const SECOND_LEVEL = new Set(['co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'co.jp', 'co.nz', 'com.br', 'com.cn', 'co.za', 'com.mx', 'com.tr', 'co.in', 'com.ar', 'com.sg', 'co.kr', 'gov.it'])

/** Dominio registrabile: "shop.barilla.com" → "barilla.com". */
export function registrableDomain(host: string) {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.')
  if (labels.length <= 2) return labels.join('.')
  const lastTwo = labels.slice(-2).join('.')
  return SECOND_LEVEL.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo
}

function hostOf(href: string) {
  try {
    return new URL(href).hostname.toLowerCase()
  } catch {
    return undefined
  }
}

function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = temp
    }
  }
  return row[b.length]
}

/** Domini che il titolare del codice ha registrato su Verified by GS1. */
export function registeredDomains(vbg?: Verification) {
  const hrefs = [...(vbg?.links.map((l) => l.href) ?? []), ...(vbg?.licensee?.website ? [vbg.licensee.website] : [])]
  return [...new Set(hrefs.map(hostOf).filter((h): h is string => Boolean(h)).map(registrableDomain))]
}

/**
 * @param vbg verifica VbG del codice contenuto nel link; `undefined` se ancora in corso,
 *            `null` se il link non contiene un codice GS1 (codice con un link qualsiasi).
 * @param webRisk esito del controllo negli elenchi di siti malevoli di Google; `undefined` se in corso.
 */
export function assessLink(url: string, vbg: Verification | undefined | null, webRisk?: WebRiskResult): LinkCheck {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { url, host: url, level: 'danger', reasons: ['L’indirizzo non è valido.'] }
  }
  const host = parsed.hostname.toLowerCase()
  const domain = registrableDomain(host)
  const danger: string[] = []
  const warnings: string[] = []

  // Segnali di pericolo: valgono anche per i domini registrati.
  if (webRisk?.threats.length) danger.push(`Google segnala questo sito come ${webRisk.threats.map(threatLabel).join(', ')}.`)
  if (parsed.username || parsed.password || /^[^/]*\/\/[^/]*@/.test(url)) danger.push('L’indirizzo contiene una “@”, un trucco per nascondere il dominio reale.')
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) danger.push('Al posto del nome di un sito c’è un indirizzo IP.')
  if (host.split('.').some((label) => label.startsWith('xn--'))) danger.push('Il dominio contiene caratteri speciali che possono imitare il nome di un marchio noto.')
  if (parsed.protocol !== 'https:') warnings.push('La connessione non è cifrata (http invece di https).')
  if (SHORTENERS.has(host) || SHORTENERS.has(domain)) warnings.push('È un link accorciato: la destinazione reale è nascosta.')

  // Informazione positiva: non cambia il livello, si aggiunge ai motivi.
  const clean = webRisk?.checked && !webRisk.threats.length ? ['Non risulta negli elenchi di siti malevoli di Google (Web Risk).'] : []

  if (GS1_RESOLVERS.has(host) && !danger.length) {
    return { url, host, level: warnings.length ? 'unknown' : 'trusted', reasons: ['Resolver ufficiale GS1: porta alla pagina scelta dal titolare del codice.', ...warnings, ...clean] }
  }

  const registered = vbg ? registeredDomains(vbg) : []
  const name = domain.split('.')[0]
  const imitates = registered.find((r) => {
    const other = r.split('.')[0]
    return r !== domain && name.length >= 4 && levenshtein(name, other) <= 2
  })
  if (imitates) danger.push(`Il dominio somiglia a ${imitates}, registrato dal titolare, ma non è lo stesso.`)

  if (danger.length) return { url, host, level: 'danger', reasons: [...danger, ...warnings], imitates }
  if (vbg === undefined || webRisk === undefined) return { url, host, level: 'pending', reasons: ['Controllo il dominio nel registro Verified by GS1 e negli elenchi di siti malevoli…'] }

  if (registered.includes(domain)) {
    const owner = vbg?.licensee?.name
    return {
      url,
      host,
      level: warnings.length ? 'unknown' : 'trusted',
      reasons: [`Il dominio ${domain} è registrato${owner ? ` da ${owner}` : ' dal titolare del codice'} su Verified by GS1.`, ...warnings, ...clean],
    }
  }

  const why =
    vbg === null
      ? 'Il codice letto non contiene dati GS1: non c’è un titolare a cui confrontare il dominio.'
      : vbg.state === 'error'
        ? 'Il registro Verified by GS1 non è raggiungibile: il dominio non è stato confrontato.'
        : vbg.state === 'invalid'
          ? 'Il codice contenuto nel link non risulta valido nel registro GS1.'
          : registered.length
        ? `Il dominio ${domain} non è tra quelli registrati dal titolare su Verified by GS1.`
        : 'Il titolare non ha registrato siti o link su Verified by GS1: il dominio non è confrontabile.'
  return { url, host, level: 'unknown', reasons: [why, ...warnings, ...clean] }
}

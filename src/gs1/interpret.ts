/*
 * Interpretazione di una scansione GS1.
 * Scomposizione negli AI con la GS1 Barcode Syntax Engine (lo stesso GS1 Barcode Syntax Dictionary
 * usato per la validazione: tutti gli AI ufficiali). Se i dati non sono validi o l'engine non è
 * disponibile si ripiega sul GS1 Digital Link Toolkit, più tollerante, così si vede comunque il
 * contenuto (e il controllo di sintassi segnala l'errore). Accetta GTIN puri, element string con
 * parentesi o FNC1 e URI GS1 Digital Link (anche compressi).
 */
import type { AiValues } from '../vendor/gs1/GS1DigitalLinkToolkit.js'
import { PRIMARY_KEYS, aiLabel, checkDigitOk } from './aiDictionary'
import { readable, type Tone } from './aiFormat'
import { loadSyntaxEngine } from './syntax'

export type { Tone }

export type Field = {
  ai: string
  label: string
  value: string
  display: string
  note?: string
  tone?: Tone
}

export type ScanResult = {
  id: string
  raw: string
  format: string
  at: number
  kind: 'gs1' | 'url' | 'text'
  primary?: Field
  fields: Field[]
  digitalLink?: string
  url?: string
  checkDigit?: boolean
  issuer?: string
}

type Toolkit = InstanceType<typeof import('../vendor/gs1/GS1DigitalLinkToolkit.js').default>

let toolkitPromise: Promise<Toolkit> | null = null
let prefixesPromise: Promise<{ prefix: string; mo: string }[]> | null = null
let countriesPromise: Promise<Map<string, string>> | null = null

export function loadToolkit() {
  toolkitPromise ??= import('../vendor/gs1/GS1DigitalLinkToolkit.js').then(({ default: T }) => new T())
  return toolkitPromise
}

function loadPrefixes() {
  prefixesPromise ??= import('../vendor/gs1/mo-prefixes.json').then(({ default: list }) =>
    (list as { prefix: unknown; mo: string }[])
      .filter((entry): entry is { prefix: string; mo: string } => typeof entry.prefix === 'string')
      .sort((a, b) => b.prefix.length - a.prefix.length),
  )
  return prefixesPromise
}

function loadCountries() {
  countriesPromise ??= import('../vendor/gs1/countries.json').then(({ default: list }) => {
    // Codice numerico ISO 3166 → codice alpha-2 (il nome si calcola nella lingua corrente).
    return new Map((list as { 'alpha-2': string; 'country-code': string }[]).map((c) => [c['country-code'], c['alpha-2']]))
  })
  return countriesPromise
}

const GS = String.fromCharCode(29)
const GTIN_RE = /^(\d{8}|\d{12,14})$/
const DL_RE = /^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?\/(01|gtin|8006|itip|8013|gmn|8010|cpid|414|gln|417|party|8017|gsrnp|8018|gsrn|255|gcn|00|sscc|253|gdti|401|ginc|402|gsin|8003|grai|8004|giai)\/\d{4}[^/\s]*/i
const DL_COMPRESSED_RE = /^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?\/[0-9A-Za-z_-]{10,}$/
async function issuerFor(ai: string, value: string) {
  const prefixes = await loadPrefixes()
  const key = ai === '01' || ai === '00' ? value.padStart(ai === '01' ? 14 : 18, '0').slice(1) : value
  return prefixes.find((entry) => key.startsWith(entry.prefix))?.mo
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function asUrl(text: string) {
  try {
    const url = new URL(text)
    return /^https?:$/.test(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}

type Parsed = { values: AiValues; other: AiValues; url?: string; digitalLink?: string }

/**
 * Scomposizione con la GS1 Barcode Syntax Engine: AI e valori nell'ordine del codice, più il GS1 Digital
 * Link equivalente. null se l'engine rifiuta i dati (es. cifra di controllo errata) o non è disponibile.
 * Accetta AI non in dizionario e non controlla le associazioni tra AI: qui serve leggere, non validare
 * (lo fa checkSyntax, che trova l'engine con le impostazioni normali).
 */
async function viaEngine(input: { ai: string } | { data: string }): Promise<{ values: AiValues; digitalLink?: string } | null> {
  let engine: Awaited<ReturnType<typeof loadSyntaxEngine>>
  try {
    engine = await loadSyntaxEngine()
  } catch {
    return null
  }
  const settings = { permitUnknownAIs: engine.permitUnknownAIs, validateAIassociations: engine.validateAIassociations }
  try {
    engine.permitUnknownAIs = true
    engine.validateAIassociations = false
    if ('ai' in input) engine.aiDataStr = input.ai
    else engine.dataStr = input.data
    const values: AiValues = {}
    for (const line of engine.hri) {
      const m = line.match(/^\((\d{2,4})\) (.*)$/s)
      if (m) values[m[1]] = m[2]
    }
    let digitalLink: string | undefined
    try {
      digitalLink = engine.getDLuri('https://id.gs1.org')
    } catch {
      digitalLink = undefined // nessuna chiave primaria: niente GS1 Digital Link
    }
    return Object.keys(values).length ? { values, digitalLink } : null
  } catch {
    return null
  } finally {
    engine.permitUnknownAIs = settings.permitUnknownAIs
    engine.validateAIassociations = settings.validateAIassociations
  }
}

/** Estrae gli AI dal contenuto, oppure null se non è un dato GS1. */
async function extract(raw: string, manual: boolean): Promise<Parsed | null> {
  const tk = await loadToolkit()
  let text = raw.trim().replace(/^\][A-Za-z]\d/, '')
  if (text.startsWith(GS)) text = text.slice(1)

  if (GTIN_RE.test(text)) {
    const values = { '01': text.padStart(14, '0') }
    return { values, other: {}, digitalLink: (await viaEngine({ ai: `(01)${values['01']}` }))?.digitalLink }
  }

  const url = asUrl(text)
  if (url) {
    try {
      const uncompressed = DL_RE.test(url) ? url : DL_COMPRESSED_RE.test(url) ? tk.decompressGS1DigitalLink(url, false, 'https://id.gs1.org') : null
      if (!uncompressed) return null
      const { GS1, other } = tk.extractFromGS1digitalLink(uncompressed)
      const engine = await viaEngine({ data: uncompressed })
      if (engine) return { values: engine.values, other, url, digitalLink: engine.digitalLink }
      return Object.keys(GS1).length ? { values: GS1, other, url } : null
    } catch {
      return null
    }
  }

  const bracketed = /^\(\d{2,4}\)/.test(text)
  const looksGs1 = bracketed || text.includes(GS) || (manual && /^\d{4,}/.test(text))
  if (!looksGs1) return null
  // Dati grezzi del lettore: FNC1 iniziale e separatori GS diventano "^" per l'engine.
  const engine = await viaEngine(bracketed ? { ai: text } : { data: `^${text.replaceAll(GS, '^')}` })
  if (engine) return { values: engine.values, other: {}, digitalLink: engine.digitalLink }
  // Dati non validi: si mostrano lo stesso. Con le parentesi gli AI si leggono direttamente (anche
  // quelli che il Toolkit non conosce); per i dati grezzi serve la tabella del Toolkit.
  if (bracketed) {
    const values: AiValues = Object.fromEntries([...text.matchAll(/\((\d{2,4})\)((?:\\\(|[^(])*)/g)].map((m) => [m[1], m[2].replace(/\\\(/g, '(')]))
    return Object.keys(values).length ? { values, other: {} } : null
  }
  try {
    const values = tk.extractFromGS1elementStrings(text)
    return Object.keys(values).length ? { values, other: {} } : null
  } catch {
    return null
  }
}

export async function interpretScan(raw: string, format: string): Promise<ScanResult> {
  const base = { id: makeId(), raw, format, at: Date.now() }
  const parsed = await extract(raw, format === 'Manuale')

  if (!parsed) {
    const url = asUrl(raw.trim())
    return { ...base, kind: url ? 'url' : 'text', url, fields: [] }
  }

  const countries = await loadCountries()
  const keys = Object.keys(parsed.values)
  // Chiave primaria (GTIN, SSCC, GLN…) e i suoi qualificatori, poi gli altri AI nell'ordine del codice.
  const primaryAi = keys.find((ai) => ai in PRIMARY_KEYS)
  const qualifiers = primaryAi ? PRIMARY_KEYS[primaryAi].filter((ai) => ai in parsed.values) : []
  const ordered = [...(primaryAi ? [primaryAi] : []), ...qualifiers, ...keys.filter((ai) => ai !== primaryAi && !qualifiers.includes(ai))]

  const fields: Field[] = ordered.map((ai) => {
    const value = parsed.values[ai]
    return { ai, value, label: aiLabel(ai), ...readable(ai, value, countries) }
  })

  let digitalLink = parsed.digitalLink
  if (primaryAi && !digitalLink) {
    try {
      digitalLink = (await loadToolkit()).buildGS1digitalLink(parsed.values, false, 'https://id.gs1.org', parsed.other)
    } catch {
      digitalLink = undefined
    }
  }

  const primary = primaryAi ? fields[0] : undefined
  return {
    ...base,
    kind: 'gs1',
    primary,
    fields: primary ? fields.slice(1) : fields,
    digitalLink,
    url: parsed.url,
    checkDigit: primaryAi ? checkDigitOk(primaryAi, parsed.values[primaryAi]) : undefined,
    issuer: primaryAi ? await issuerFor(primaryAi, parsed.values[primaryAi]) : undefined,
  }
}

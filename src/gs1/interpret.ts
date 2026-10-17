/*
 * Interpretazione di una scansione GS1.
 * Port TypeScript della logica di gs1/interpretGS1scan (Apache 2.0), basata sul
 * GS1 Digital Link Toolkit ufficiale: accetta GTIN puri, element string con
 * parentesi o FNC1 e URI GS1 Digital Link (anche compressi).
 */
import type { AiValues } from '../vendor/gs1/GS1DigitalLinkToolkit.js'
import { aiLabel } from './labels'

export type Tone = 'ok' | 'warn' | 'bad'

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
    const names = new Intl.DisplayNames(['it'], { type: 'region' })
    return new Map((list as { 'alpha-2': string; 'country-code': string }[]).map((c) => [c['country-code'], names.of(c['alpha-2']) ?? c['alpha-2']]))
  })
  return countriesPromise
}

const GS = String.fromCharCode(29)
const GTIN_RE = /^(\d{8}|\d{12,14})$/
const DL_RE = /^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?\/(01|gtin|8006|itip|8013|gmn|8010|cpid|414|gln|417|party|8017|gsrnp|8018|gsrn|255|gcn|00|sscc|253|gdti|401|ginc|402|gsin|8003|grai|8004|giai)\/\d{4}[^/\s]*/i
const DL_COMPRESSED_RE = /^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?\/[0-9A-Za-z_-]{10,}$/
const DATE_AIS = new Set(['11', '12', '13', '15', '16', '17'])

/** Anno a 2 cifre secondo la regola GS1 (finestra -49/+50 anni). */
function gs1Year(yy: number) {
  const now = new Date().getFullYear()
  const century = Math.floor(now / 100) * 100
  const diff = yy - (now % 100)
  if (diff >= 51) return century - 100 + yy
  if (diff <= -50) return century + 100 + yy
  return century + yy
}

function parseGs1Date(value: string) {
  const year = gs1Year(Number(value.slice(0, 2)))
  const month = Number(value.slice(2, 4))
  const day = Number(value.slice(4, 6))
  // DD = 00 indica l'ultimo giorno del mese
  return day === 0 ? new Date(year, month, 0) : new Date(year, month - 1, day)
}

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })

function describeDate(ai: string, value: string): Pick<Field, 'display' | 'note' | 'tone'> {
  if (!/^\d{6}$/.test(value)) return { display: value }
  const date = parseGs1Date(value)
  const display = value.endsWith('00') ? date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) : dateFmt.format(date)
  if (ai !== '17' && ai !== '15') return { display }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return { display, note: ai === '17' ? 'Scaduto' : 'Superato', tone: 'bad' }
  if (days === 0) return { display, note: 'Oggi', tone: 'warn' }
  if (days <= 7) return { display, note: `Tra ${days} ${days === 1 ? 'giorno' : 'giorni'}`, tone: 'warn' }
  return { display, note: 'Valido', tone: 'ok' }
}

const measureUnits: Record<string, string> = {
  '310': 'kg', '311': 'm', '312': 'm', '313': 'm', '314': 'm²', '315': 'l', '316': 'm³',
  '320': 'lb', '330': 'kg', '331': 'm', '332': 'm', '333': 'm', '334': 'm²', '335': 'l', '336': 'm³',
}

function formatDisplay(ai: string, value: string, countries: Map<string, string>): Pick<Field, 'display' | 'note' | 'tone'> {
  if (DATE_AIS.has(ai)) return describeDate(ai, value)
  if (ai === '01' || ai === '02') {
    return { display: value.length === 14 && value.startsWith('0') ? value.slice(1) : value }
  }
  const unit = measureUnits[ai.slice(0, 3)]
  if (ai.length === 4 && unit) {
    const decimals = Number(ai[3])
    const amount = Number(value) / 10 ** decimals
    return { display: `${amount.toLocaleString('it-IT', { maximumFractionDigits: decimals })} ${unit}` }
  }
  if (/^39[02]\d$/.test(ai)) {
    const amount = Number(value) / 10 ** Number(ai[3])
    return { display: amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: Number(ai[3]) }) }
  }
  if (['422', '423', '424', '425', '426'].includes(ai)) {
    const names = value.match(/\d{3}/g)?.map((code) => countries.get(code) ?? code)
    if (names) return { display: names.join(', ') }
  }
  return { display: value }
}

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

/** Estrae gli AI dal contenuto, oppure null se non è un dato GS1. */
async function extract(raw: string, manual: boolean): Promise<{ values: AiValues; other: AiValues; url?: string } | null> {
  const tk = await loadToolkit()
  let text = raw.trim().replace(/^\][A-Za-z]\d/, '')
  if (text.startsWith(GS)) text = text.slice(1)

  if (GTIN_RE.test(text)) return { values: { '01': text.padStart(14, '0') }, other: {} }

  const url = asUrl(text)
  if (url) {
    try {
      const uncompressed = DL_RE.test(url) ? url : DL_COMPRESSED_RE.test(url) ? tk.decompressGS1DigitalLink(url, false, 'https://id.gs1.org') : null
      if (!uncompressed) return null
      const { GS1, other } = tk.extractFromGS1digitalLink(uncompressed)
      return Object.keys(GS1).length ? { values: GS1, other, url } : null
    } catch {
      return null
    }
  }

  const looksGs1 = /^\(\d{2,4}\)/.test(text) || text.includes(GS) || (manual && /^\d{4,}/.test(text))
  if (!looksGs1) return null
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

  const [tk, countries] = await Promise.all([loadToolkit(), loadCountries()])
  const entry = (ai: string) => tk.aitable.find((item) => item.ai === ai)
  const keys = Object.keys(parsed.values)
  const primaryAi = keys.find((ai) => entry(ai)?.type === 'I')
  const qualifiers = primaryAi ? (tk.aiQualifiers[primaryAi] ?? []).filter((ai) => ai in parsed.values) : []
  const ordered = [...(primaryAi ? [primaryAi] : []), ...qualifiers, ...keys.filter((ai) => ai !== primaryAi && !qualifiers.includes(ai))]

  const fields: Field[] = ordered.map((ai) => {
    const value = parsed.values[ai]
    return { ai, value, label: aiLabel(ai, entry(ai)?.title), ...formatDisplay(ai, value, countries) }
  })

  let checkDigit: boolean | undefined
  if (primaryAi && entry(primaryAi)?.checkDigit) {
    try {
      tk.verifyCheckDigit(primaryAi, parsed.values[primaryAi])
      checkDigit = true
    } catch {
      checkDigit = false
    }
  }

  let digitalLink: string | undefined
  if (primaryAi) {
    try {
      digitalLink = tk.buildGS1digitalLink(parsed.values, false, 'https://id.gs1.org', parsed.other)
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
    checkDigit,
    issuer: primaryAi ? await issuerFor(primaryAi, parsed.values[primaryAi]) : undefined,
  }
}

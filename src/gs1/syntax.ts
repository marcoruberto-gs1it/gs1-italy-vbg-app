/*
 * Controllo completo della sintassi GS1 con la libreria ufficiale GS1 Barcode Syntax Engine
 * (gs1/gs1-syntax-engine, build WebAssembly). Applica le regole del GS1 Barcode Syntax Dictionary:
 * formato e contenuto di ogni AI (date, cifre di controllo, caratteri ammessi) e le associazioni
 * tra AI (combinazioni vietate e AI obbligatori).
 */
import type { ScanResult } from './interpret'
import { lang, t } from '../i18n'
import { missingFromEngine, valueAssociations, type AssociationNotice } from './associations'

export type SyntaxCheck = {
  ok: boolean
  /** Messaggio in italiano; `original` conserva quello della libreria. */
  message?: string
  original?: string
  /** Dato con la parte errata tra barre verticali, es. (17)27|13|40 */
  markup?: string
  /** Il problema riguarda solo la forma del GS1 Digital Link, non i dati. */
  digitalLink?: boolean
  /** Associazioni obbligatorie tra AI non soddisfatte o incoerenti: avvisi, non errori (vedi associations.ts). */
  notices?: AssociationNotice[]
}

type Encoder = InstanceType<typeof import('../vendor/gs1/syntax-engine/gs1encoder.mjs').GS1encoder>

let enginePromise: Promise<Encoder> | null = null

export function loadSyntaxEngine() {
  enginePromise ??= import('../vendor/gs1/syntax-engine/gs1encoder.mjs').then(async ({ GS1encoder }) => {
    const engine = new GS1encoder()
    await engine.init()
    return engine
  })
  return enginePromise
}

/** Segna un testo da tradurre senza tradurlo subito. */
const k = (s: string) => s

const phrases: [RegExp, string][] = [
  [/The date contains an illegal month of the year\.?/i, k('il mese della data non esiste')],
  [/The date contains an illegal day of the month\.?/i, k('il giorno della data non esiste')],
  [/The numeric check digit is incorrect\.?/i, k('la cifra di controllo è errata')],
  [/The (?:data|component) is too short\.?/i, k('il valore è troppo corto')],
  [/The (?:data|component) is too long\.?/i, k('il valore è troppo lungo')],
  [/contains an illegal character\.?/i, k('contiene un carattere non ammesso')],
  [/A non-digit character was found where a digit is expected\.?/i, k('contiene una lettera dove è richiesta una cifra')],
  [/The hour.*illegal/i, k('l’ora non è valida')],
  [/The (?:minute|second).*illegal/i, k('i minuti o i secondi non sono validi')],
  [/is not a valid ISO 3166 .*country code/i, k('il codice paese non è valido')],
  [/is not a valid ISO 4217 .*currency code/i, k('il codice valuta non è valido')],
  [/The GCP .* is (?:too short|invalid)/i, k('il prefisso aziendale GS1 non è valido')],
]

/** Traduce i messaggi più comuni della libreria; per gli altri resta il testo originale. */
export function translate(message: string): string {
  // In inglese il messaggio originale della GS1 Barcode Syntax Engine è già leggibile.
  if (lang() === 'en') return message
  let m: RegExpMatchArray | null
  if ((m = message.match(/It is invalid to pair AI \((\d+)\) with AI \((\d+)\)/i))) {
    return t('Gli AI ({a}) e ({b}) non possono comparire nello stesso codice.', { a: m[1], b: m[2] })
  }
  if ((m = message.match(/Required AIs for AI \((\d+)\) are not satisfied: ([\d,+ ]+)/i))) {
    const options = m[2].split(',').map((s) => s.trim()).join(', ')
    return t('L’AI ({ai}) richiede anche uno di questi AI, che mancano: {list}.', { ai: m[1], list: options })
  }
  if ((m = message.match(/^AI \((\d+)\):\s*(.*)$/i))) {
    const phrase = phrases.find(([re]) => re.test(m![2]))
    return phrase ? `AI (${m[1]}): ${t(phrase[1])}.` : message
  }
  const phrase = phrases.find(([re]) => re.test(message))
  const text = phrase && t(phrase[1])
  return text ? text[0].toUpperCase() + text.slice(1) + '.' : message
}

type EngineInput = { ai: string } | { data: string }

/**
 * Dati da controllare, il più possibile come sono stati letti: element string con parentesi o dati
 * grezzi con FNC1 così come sono (l'engine vede anche, per esempio, lo stesso AI ripetuto con valori
 * diversi); altrimenti (GTIN puro, GS1 Digital Link) l'element string ricostruita dagli AI.
 */
function engineInput(scan: ScanResult): EngineInput {
  const GS = String.fromCharCode(29)
  let text = scan.raw.trim().replace(/^\][A-Za-z]\d/, '')
  if (text.startsWith(GS)) text = text.slice(1)
  if (/^\(\d{2,4}\)/.test(text)) return { ai: text }
  if (text.includes(GS)) return { data: `^${text.replaceAll(GS, '^')}` }
  return { ai: asAiString(scan) }
}

function load(engine: Encoder, input: EngineInput) {
  if ('ai' in input) engine.aiDataStr = input.ai
  else engine.dataStr = input.data
}

function asAiString(scan: ScanResult) {
  const all = [...(scan.primary ? [scan.primary] : []), ...scan.fields]
  return all.map((f) => `(${f.ai})${f.value}`).join('')
}

/** Verifica dati e (se presente) GS1 Digital Link. Restituisce null se il contenuto non è GS1. */
export async function checkSyntax(scan: ScanResult): Promise<SyntaxCheck | null> {
  if (scan.kind !== 'gs1') return null
  let engine: Encoder
  try {
    engine = await loadSyntaxEngine()
  } catch {
    return null
  }

  // 1. I dati GS1, con tutte le regole del Syntax Dictionary. L'engine controlla nell'ordine i dati di
  // ogni AI, le coppie vietate e infine gli AI obbligatori: se l'errore è un AI obbligatorio mancante,
  // dati e coppie sono già in regola. Il dato mancante può stare in un altro barcode dello stesso
  // articolo (§4.13.2), quindi diventa un avviso; si ricontrolla senza associazioni per non perdere
  // gli altri errori (es. lo stesso AI ripetuto con valori diversi).
  const data = engineInput(scan)
  const notices: AssociationNotice[] = []
  try {
    load(engine, data)
  } catch (error) {
    const original = error instanceof Error ? error.message : String(error)
    const missing = missingFromEngine(original)
    const failure = missing ? withoutAssociations(engine, data) : { original, markup: engine.errMarkup || undefined }
    if (failure) return { ok: false, message: translate(failure.original), original: failure.original, markup: failure.markup }
    notices.push(missing!)
  }
  const values = Object.fromEntries([...(scan.primary ? [scan.primary] : []), ...scan.fields].map((f) => [f.ai, f.value]))
  notices.push(...valueAssociations(values))
  const extra = notices.length ? { notices } : {}

  // 2. La forma del GS1 Digital Link letto (solo link non compressi: quelli compressi li espande il toolkit).
  if (scan.url && /\/(01|00|414|417|8003|8004|8006|8010|8013|8017|8018|253|255|401|402|gtin|sscc|gln)\//i.test(scan.url)) {
    try {
      engine.dataStr = scan.url
    } catch (error) {
      const original = error instanceof Error ? error.message : String(error)
      return { ok: false, digitalLink: true, message: t('Il link non rispetta la sintassi GS1 Digital Link: {error}', { error: translate(original) }), original, markup: engine.errMarkup || undefined, ...extra }
    }
  }
  return { ok: true, ...extra }
}

/**
 * I dati di più barcode possono stare sullo stesso articolo? No se la GS1 Barcode Syntax Engine trova
 * una coppia di AI vietata (es. (01) con (02)) o lo stesso AI con valori diversi: quel barcode è di
 * un altro articolo. Gli AI obbligatori mancanti non contano (possono stare in un altro barcode); un
 * valore non valido in un singolo AI nemmeno (lo segnala poi il controllo di sintassi). Senza engine: sì.
 */
export async function canCoexist(data: string): Promise<boolean> {
  let engine: Encoder
  try {
    engine = await loadSyntaxEngine()
  } catch {
    return true
  }
  try {
    engine.aiDataStr = data
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/invalid to pair|Multiple instances/i.test(message)) return false
    if (!missingFromEngine(message)) return true
    // AI mancante: l'engine si ferma prima di controllare i valori ripetuti, quindi si ricontrolla senza associazioni.
    const failure = withoutAssociations(engine, { ai: data })
    return !failure || !/Multiple instances/i.test(failure.original)
  }
}

/** Ricontrollo senza le associazioni tra AI: null se i dati sono validi, altrimenti l'errore. */
function withoutAssociations(engine: Encoder, data: EngineInput): { original: string; markup?: string } | null {
  try {
    engine.validateAIassociations = false
    load(engine, data)
    return null
  } catch (error) {
    return { original: error instanceof Error ? error.message : String(error), markup: engine.errMarkup || undefined }
  } finally {
    engine.validateAIassociations = true
  }
}

/*
 * Controllo completo della sintassi GS1 con la libreria ufficiale GS1 Barcode Syntax Engine
 * (gs1/gs1-syntax-engine, build WebAssembly). Applica le regole del GS1 Barcode Syntax Dictionary:
 * formato e contenuto di ogni AI (date, cifre di controllo, caratteri ammessi) e le associazioni
 * tra AI (combinazioni vietate e AI obbligatori).
 */
import type { ScanResult } from './interpret'

export type SyntaxCheck = {
  ok: boolean
  /** Messaggio in italiano; `original` conserva quello della libreria. */
  message?: string
  original?: string
  /** Dato con la parte errata tra barre verticali, es. (17)27|13|40 */
  markup?: string
  /** Il problema riguarda solo la forma del GS1 Digital Link, non i dati. */
  digitalLink?: boolean
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

const phrases: [RegExp, string][] = [
  [/The date contains an illegal month of the year\.?/i, 'il mese della data non esiste'],
  [/The date contains an illegal day of the month\.?/i, 'il giorno della data non esiste'],
  [/The numeric check digit is incorrect\.?/i, 'la cifra di controllo è errata'],
  [/The (?:data|component) is too short\.?/i, 'il valore è troppo corto'],
  [/The (?:data|component) is too long\.?/i, 'il valore è troppo lungo'],
  [/contains an illegal character\.?/i, 'contiene un carattere non ammesso'],
  [/A non-digit character was found where a digit is expected\.?/i, 'contiene una lettera dove è richiesta una cifra'],
  [/The hour.*illegal/i, 'l’ora non è valida'],
  [/The (?:minute|second).*illegal/i, 'i minuti o i secondi non sono validi'],
  [/is not a valid ISO 3166 .*country code/i, 'il codice paese non è valido'],
  [/is not a valid ISO 4217 .*currency code/i, 'il codice valuta non è valido'],
  [/The GCP .* is (?:too short|invalid)/i, 'il prefisso aziendale GS1 non è valido'],
]

/** Traduce i messaggi più comuni della libreria; per gli altri resta il testo originale. */
export function translate(message: string): string {
  let m: RegExpMatchArray | null
  if ((m = message.match(/It is invalid to pair AI \((\d+)\) with AI \((\d+)\)/i))) {
    return `Gli AI (${m[1]}) e (${m[2]}) non possono comparire nello stesso codice.`
  }
  if ((m = message.match(/Required AIs for AI \((\d+)\) are not satisfied: ([\d,+ ]+)/i))) {
    const options = m[2].split(',').map((s) => s.trim()).join(', ')
    return `L’AI (${m[1]}) richiede anche uno di questi AI, che mancano: ${options}.`
  }
  if ((m = message.match(/^AI \((\d+)\):\s*(.*)$/i))) {
    const phrase = phrases.find(([re]) => re.test(m![2]))
    return phrase ? `AI (${m[1]}): ${phrase[1]}.` : message
  }
  const phrase = phrases.find(([re]) => re.test(message))
  return phrase ? phrase[1][0].toUpperCase() + phrase[1].slice(1) + '.' : message
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

  // 1. I dati GS1, con tutte le regole del Syntax Dictionary.
  try {
    engine.aiDataStr = asAiString(scan)
  } catch (error) {
    const original = error instanceof Error ? error.message : String(error)
    return { ok: false, message: translate(original), original, markup: engine.errMarkup || undefined }
  }

  // 2. La forma del GS1 Digital Link letto (solo link non compressi: quelli compressi li espande il toolkit).
  if (scan.url && /\/(01|00|414|417|8003|8004|8006|8010|8013|8017|8018|253|255|401|402|gtin|sscc|gln)\//i.test(scan.url)) {
    try {
      engine.dataStr = scan.url
    } catch (error) {
      const original = error instanceof Error ? error.message : String(error)
      return { ok: false, digitalLink: true, message: `Il link non rispetta la sintassi GS1 Digital Link: ${translate(original)}`, original, markup: engine.errMarkup || undefined }
    }
  }
  return { ok: true }
}

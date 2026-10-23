/*
 * Associazioni obbligatorie tra AI (GS1 General Specifications, Release 26.0, §4.13.2, tabella 4-5).
 *
 * Le associazioni che dipendono solo dal numero dell'AI ("il (10) va con (01), (02)…") sono nel
 * GS1 Barcode Syntax Dictionary e le controlla la GS1 Barcode Syntax Engine (syntax.ts). Qui ci sono
 * solo le righe della tabella che dipendono dal VALORE, che il dizionario non può esprimere:
 * l'indicatore del GTIN (prima cifra del GTIN-14).
 *
 * Per GS1 gli AI associati devono stare "sulla stessa entità fisica", non per forza nello stesso
 * barcode (es. più GS1-128 su un'etichetta logistica): per questo i dati mancanti sono avvisi, che
 * si risolvono leggendo l'altro barcode dell'articolo.
 */
import { t } from '../i18n'
import { aiLabel } from './aiDictionary'

export type AssociationNotice = {
  /** missing: manca un AI che può stare in un altro barcode; mismatch: dati incoerenti tra loro. */
  kind: 'missing' | 'mismatch'
  /** AI che fa scattare la regola. */
  ai: string
  message: string
}

/** Misure commerciali (§3.6.2, "3nnn*" della tabella): 31nn, 32nn e le 35nn/36nn non logistiche. */
const TRADE_MEASURE = /^(31[0-6]|32\d|35[0-2]|35[67]|36[01]|36[4-6])\d$/

/** Dati che la tabella lega a un "GTIN di un prodotto a peso variabile". */
const isVariableMeasureData = (ai: string) => ai === '30' || TRADE_MEASURE.test(ai) || /^39[235]\d$/.test(ai) || ai === '8001' || ai === '8005'

/** Indicatore del GTIN contenuto in un AI (01, 02, 8006, 8026: GTIN-14 nelle prime 14 cifre). */
function indicator(ai: string, value: string): string | undefined {
  if (!['01', '02', '8006', '8026'].includes(ai) || !/^\d{14}/.test(value)) return undefined
  return value[0]
}

/** Avvisi sulle associazioni che dipendono dal valore dei dati. values: AI → valore. */
export function valueAssociations(values: Record<string, string>): AssociationNotice[] {
  const ais = Object.keys(values)
  const notices: AssociationNotice[] = []
  const gtins = ['01', '02'].filter((ai) => ai in values)

  // (01) o (02) con N1 = 9 → (30) OR 3nnn* OR (8001); se è un prodotto su ordinazione, (01) → (242).
  for (const ai of gtins) {
    if (indicator(ai, values[ai]) !== '9') continue
    const variable = ais.some((a) => a === '30' || TRADE_MEASURE.test(a) || a === '8001')
    if (!variable && !('242' in values)) {
      notices.push({
        kind: 'missing',
        ai,
        message: t('GTIN di un prodotto a peso variabile (indicatore 9): va insieme alla quantità variabile (30), a una misura commerciale (31nn, 32nn, 35nn, 36nn) o alle dimensioni del rotolo (8001). Se è un prodotto su ordinazione, va insieme al numero di variante (242).'),
      })
    }
  }

  // (242) → (01), (02), (8006) o (8026) con N1 = 9.
  if ('242' in values) {
    const keys = ['01', '02', '8006', '8026'].filter((ai) => ai in values)
    if (keys.length && !keys.some((ai) => indicator(ai, values[ai]) === '9')) {
      notices.push({ kind: 'mismatch', ai: '242', message: t('Il numero di variante su ordinazione (242) va usato con un GTIN con indicatore 9, che identifica un prodotto su ordinazione.') })
    }
  }

  // (30), 3nnn*, (392n), (393n), (395n), (8001), (8005): "il GTIN deve riferirsi a un prodotto a peso
  // variabile". Gli indicatori 1–8 identificano imballi a quantità fissa (il 9 è riservato al peso
  // variabile, §2.1.7.2): l'incoerenza si vede solo lì. Con indicatore 0 servirebbero i dati anagrafici.
  for (const gtin of gtins) {
    const n = indicator(gtin, values[gtin])
    if (!n || !/[1-8]/.test(n)) continue
    for (const ai of ais.filter(isVariableMeasureData)) {
      notices.push({
        kind: 'mismatch',
        ai,
        message: t('«{name}» ({ai}) riguarda prodotti a peso variabile, ma il GTIN ({gtin}) ha indicatore {n}, che identifica un imballo a quantità fissa: per il peso variabile l’indicatore è 9.', { name: aiLabel(ai), ai, gtin, n }),
      })
    }
  }
  return notices
}

/** Testo per un'alternativa del Syntax Dictionary: "01" → GTIN (01), "01+21" → GTIN (01) e Numero di serie (21), "31nn" → misura (31nn). */
function requirementText(option: string) {
  return option
    .split('+')
    .map((ai) => (/n/.test(ai) ? t('misura ({ai})', { ai }) : `${aiLabel(ai)} (${ai})`))
    .join(` ${t('e')} `)
}

/**
 * Avviso per l'errore "Required AIs for AI (x) are not satisfied: a,b+c" della Syntax Engine:
 * l'AI x richiede uno dei gruppi elencati, che può trovarsi in un altro barcode.
 */
export function missingFromEngine(message: string): AssociationNotice | null {
  const m = message.match(/Required AIs for AI \((\d{2,4})\) are not satisfied: ([\dn,+ ]+)/i)
  if (!m) return null
  const options = m[2].split(',').map((s) => s.trim()).filter(Boolean)
  return {
    kind: 'missing',
    ai: m[1],
    message: t('«{name}» ({ai}) va insieme a: {list}.', { name: aiLabel(m[1]), ai: m[1], list: options.map(requirementText).join(` ${t('oppure')} `) }),
  }
}

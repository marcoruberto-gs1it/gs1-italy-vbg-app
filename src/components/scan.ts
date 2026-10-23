import type { ScanResult } from '../gs1/interpret'
import { PRIMARY_KEYS } from '../gs1/aiDictionary'
import { canVerify, type Verification } from '../gs1/vbg'
import type { SyntaxCheck } from '../gs1/syntax'
import type { WebRiskResult } from '../gs1/webRisk'
import type { StoredSymbol } from './symbolData'
import { t } from '../i18n'

/** `vbg` assente = verifica non ancora arrivata (o non richiesta, vedi needsVerification). */
export type Scan = ScanResult & {
  vbg?: Verification
  symbol?: StoredSymbol
  syntax?: SyntaxCheck | null
  webRisk?: WebRiskResult
  /** Barcode letti per questo articolo, quando i dati sono su più barcode (es. etichetta logistica). */
  barcodes?: Barcode[]
  /** Risposta dell'utente alla domanda sull'altro barcode: declined = "non c'è". */
  assoc?: 'declined'
}

/** Avvisi su dati mancanti che potrebbero stare in un altro barcode dell'articolo. */
export const missingNotices = (scan: Scan) => (scan.syntax?.notices ?? []).filter((n) => n.kind === 'missing')

/** In attesa che l'utente dica se c'è un altro barcode (la statistica parte dopo la risposta o alla chiusura). */
export const awaitsAnswer = (scan: Scan) => missingNotices(scan).length > 0 && !scan.assoc

/** Un barcode letto: simbologia, contenuto e AI che conteneva (ais assente nelle scansioni salvate prima della 1.4.1). */
export type Barcode = { format: string; raw: string; ais?: string[] }

const aisOf = (scan: Scan) => [...(scan.primary ? [scan.primary] : []), ...scan.fields].map((f) => f.ai)

/**
 * Dati dell'articolo raggruppati per barcode letto, nell'ordine di lettura. Un AI presente in più
 * barcode (stesso valore) compare in ciascun gruppo. null se l'articolo è stato letto da un solo barcode.
 */
export function fieldsByBarcode(scan: Scan) {
  if (!scan.barcodes || scan.barcodes.some((b) => !b.ais)) return null
  const all = [...(scan.primary ? [scan.primary] : []), ...scan.fields]
  return scan.barcodes.map((barcode) => ({ barcode, fields: barcode.ais!.map((ai) => all.find((f) => f.ai === ai)).filter((f) => f !== undefined) }))
}

export type Combination =
  | { ok: true; data: string; barcodes: NonNullable<Scan['barcodes']> }
  | { ok: false; reason: 'not-gs1' | 'other-item' | 'different-values'; ai?: string }

/**
 * Unisce i dati di un secondo barcode dello stesso articolo (GS1 General Specifications §4.13.2: gli AI
 * associati possono stare in barcode diversi). Chiavi diverse possono convivere (es. SSCC e GTIN
 * sull'etichetta di un collo che è anche un'unità commerciale); lo stesso AI con valori diversi no:
 * se è una chiave (GTIN, SSCC…) è un altro articolo. data: element string con tutti gli AI, da reinterpretare.
 */
export function combineScans(base: Scan, extra: Scan): Combination {
  if (extra.kind !== 'gs1') return { ok: false, reason: 'not-gs1' }
  const values = new Map<string, string>()
  for (const field of [base.primary, ...base.fields, extra.primary, ...extra.fields]) {
    if (!field) continue
    const known = values.get(field.ai)
    if (known !== undefined && known !== field.value) return { ok: false, reason: field.ai in PRIMARY_KEYS ? 'other-item' : 'different-values', ai: field.ai }
    values.set(field.ai, field.value)
  }
  // Parentesi nei valori: si proteggono come previsto dalla sintassi con parentesi.
  const data = [...values].map(([ai, value]) => `(${ai})${value.replace(/\(/g, '\\(')}`).join('')
  const barcodes = [...barcodesOf(base), ...barcodesOf(extra)]
  return { ok: true, data, barcodes }
}

/** Barcode di una scansione: quelli già uniti, oppure lei stessa. */
const barcodesOf = (scan: Scan): Barcode[] => scan.barcodes ?? [{ format: scan.format, raw: scan.raw, ais: aisOf(scan) }]

/**
 * Più barcode letti insieme (etichetta logistica): si uniscono nell'ordine di lettura quelli compatibili
 * con i precedenti; quelli di un altro articolo, con valori in conflitto o con AI che GS1 non ammette
 * insieme (coexist, vedi canCoexist) si scartano e si contano.
 * null se resta un solo barcode.
 */
export async function combineMany(scans: Scan[], coexist: (data: string) => Promise<boolean> = async () => true): Promise<{ data: string; barcodes: Barcode[]; skipped: number } | null> {
  const [first, ...rest] = scans
  if (!first) return null
  let acc: Scan = first
  let data = ''
  let skipped = 0
  for (const extra of rest) {
    const joined = combineScans(acc, extra)
    if (!joined.ok || !(await coexist(joined.data))) {
      skipped += 1
      continue
    }
    data = joined.data
    // Si prosegue con i soli AI e valori: bastano a combineScans per i confronti successivi.
    const fields = [...(acc.primary ? [acc.primary] : []), ...acc.fields, ...(extra.primary ? [extra.primary] : []), ...extra.fields]
    acc = { ...acc, primary: undefined, fields, barcodes: joined.barcodes }
  }
  return acc.barcodes && acc.barcodes.length > 1 ? { data, barcodes: acc.barcodes, skipped } : null
}

export function needsVerification(scan: Scan) {
  return canVerify(scan.primary?.ai) && (!scan.vbg || scan.vbg.state === 'error')
}

export function titleOf(scan: Scan) {
  if (scan.vbg?.name) return scan.vbg.name
  if (scan.primary) return scan.primary.display
  if (scan.kind === 'url' && scan.url) return new URL(scan.url).hostname.replace(/^www\./, '')
  return scan.raw
}

export function formatKind(format: string) {
  if (/QR|Codice con/i.test(format)) return 'qr' as const
  if (/Matrix|Aztec|PDF417|MaxiCode/i.test(format)) return 'datamatrix' as const
  if (/DataBar/i.test(format)) return 'databar' as const
  if (/128|39|93|ITF|Codabar/i.test(format)) return 'gs1128' as const
  if (/Manuale/i.test(format)) return 'keyboard' as const
  return 'ean' as const
}

/** Segna un testo da tradurre senza tradurlo subito. */
const k = (s: string) => s

/** Che cosa identifica la chiave primaria, in parole semplici (tradotto in codeType). */
const keyKinds: Record<string, [string, string]> = {
  '01': [k('Prodotto'), 'GTIN'],
  '00': [k('Unità logistica'), 'SSCC'],
  '414': [k('Località'), 'GLN'],
  '417': [k('Azienda'), 'GLN'],
  '8003': [k('Asset riutilizzabile'), 'GRAI'],
  '8004': [k('Asset individuale'), 'GIAI'],
  '8017': [k('Fornitore di servizi'), 'GSRN'],
  '8018': [k('Destinatario di servizi'), 'GSRN'],
  '253': [k('Documento'), 'GDTI'],
  '401': [k('Spedizione'), 'GINC'],
  '402': [k('Spedizione'), 'GSIN'],
  '255': [k('Coupon'), 'GCN'],
  '8010': [k('Componente'), 'CPID'],
  '8013': [k('Modello di prodotto'), 'GMN'],
  '8006': [k('Parte di prodotto'), 'ITIP'],
}

export type CodeType = { title: string; tag: string; manual: boolean; count: number }

/**
 * Tipo di codice letto. Titolo: la simbologia (EAN-13, GS1-128…), oppure la chiave GS1 se il codice
 * è stato digitato. Etichetta: che cosa identifica (Prodotto · GTIN, Unità logistica · SSCC…).
 */
export function codeType(scan: Scan): CodeType {
  const manual = scan.format === 'Manuale'
  const count = (scan.primary ? 1 : 0) + scan.fields.length
  const primary = scan.primary
  let subject: string
  let key: string | undefined
  if (primary) {
    const kind = keyKinds[primary.ai]
    ;[subject, key] = kind ? [t(kind[0]), kind[1]] : [primary.label, undefined]
    // GTIN-14 con indicatore 1–8: imballo che contiene più unità; 9: prodotto a peso variabile (§2.1.7.2).
    if (primary.ai === '01' && primary.value.length === 14 && !primary.value.startsWith('0')) {
      ;[subject, key] = [primary.value.startsWith('9') ? t('Prodotto a peso variabile') : t('Imballo'), 'GTIN-14']
    }
  } else {
    subject = scan.kind === 'gs1' ? t('Dati GS1') : scan.kind === 'url' ? t('Link') : t('Testo')
  }
  // title resta il nome interno della simbologia (finisce nelle statistiche): per mostrarlo usare formatLabel().
  return {
    title: manual ? (key ?? subject) : scan.format,
    tag: manual ? subject : key ? `${subject} · ${key}` : subject,
    manual,
    count,
  }
}

/**
 * Nome da mostrare per i codici QR: "QR Code Standard GS1" solo se contengono dati GS1.
 * Un QR Code qualsiasi non viene chiamato così, per non attribuirgli una conformità che non ha.
 */
export function withDisplayFormat<T extends Scan>(scan: T): T {
  // ITF con un GTIN a 14 cifre: è un ITF-14, simbologia degli standard GS1 (General Specifications §5.3).
  if (scan.format === 'ITF' && scan.primary?.ai === '01' && scan.primary.value.length === 14) return { ...scan, format: 'ITF-14' }
  // Data Matrix con GS1 Digital Link: ammesso dagli standard GS1 (General Specifications §5.9).
  if (scan.format === 'Data Matrix' && scan.kind === 'gs1' && scan.url) return { ...scan, format: 'Data Matrix con GS1 Digital Link' }
  if (!/QR/i.test(scan.format) || scan.format === 'QR Code Standard GS1') return scan
  // QR Code con GS1 Digital Link: conforme allo standard GS1.
  if (scan.kind === 'gs1' && scan.url) return { ...scan, format: 'QR Code Standard GS1' }
  if (scan.kind === 'gs1') return { ...scan, format: 'Codice con dati GS1' }
  return { ...scan, format: scan.kind === 'url' ? 'Codice con link' : 'Codice con testo' }
}

export type Compliance = {
  level: 'gs1' | 'error' | 'partial' | 'manual' | 'none'
  title: string
  detail: string
  /** Dato con la parte errata evidenziata dalla GS1 Barcode Syntax Engine. */
  markup?: string
}

/**
 * Simbologie degli standard GS1 (GS1 General Specifications §5.1.1), come le nominano formatName e
 * withDisplayFormat. Non ne fanno parte Code 128, Code 39, Code 93, Codabar, ITF di altra lunghezza,
 * PDF417, MaxiCode, Aztec (anche con dati GS1), Micro QR e rMQR.
 */
const GS1_SYMBOLOGIES = /^(EAN-13|EAN-8|UPC-A|UPC-E|ITF-14|GS1-128|GS1 DataBar.*|GS1 DataMatrix|QR Code Standard GS1|Data Matrix con GS1 Digital Link)$/

/** Il codice letto fa parte degli standard GS1? Valuta simbologia, contenuto e cifra di controllo. */
export function gs1Compliance(scan: Scan): Compliance {
  const notGs1 = scan.kind === 'url'
    ? t('Contiene un link qualsiasi: non identifica nulla nel sistema GS1.')
    : t('Il contenuto non identifica nulla nel sistema GS1.')
  const badCheck = { level: 'error' as const, title: t('Codice GS1 con errori'), detail: t('La cifra di controllo non è corretta: il codice potrebbe essere stampato o letto male.') }
  // Errore trovato dalla GS1 Barcode Syntax Engine (regole del GS1 Barcode Syntax Dictionary).
  const syntaxError = scan.syntax && !scan.syntax.ok
    ? { level: 'error' as const, title: t('Codice GS1 con errori'), detail: scan.syntax.message ?? t('I dati non rispettano le regole GS1.'), markup: scan.syntax.markup }
    : null
  const verified = scan.syntax?.ok ? ` ${t('Controllato con la GS1 Barcode Syntax Engine.')}` : ''

  if (scan.format === 'Manuale') {
    if (scan.kind !== 'gs1') return { level: 'none', title: t('Non è un codice GS1'), detail: notGs1 }
    if (syntaxError) return syntaxError
    if (scan.checkDigit === false) return badCheck
    return { level: 'manual', title: t('Dati in formato GS1'), detail: `${t('Inserito a mano: non c’è un simbolo stampato da verificare.')}${verified}` }
  }

  const gs1Symbol =
    GS1_SYMBOLOGIES.test(scan.format) ||
    (scan.format === 'ITF' && scan.primary?.ai === '01' && scan.primary.value.length === 14) ||
    // GS1 Digital Link in un Data Matrix: ammesso dagli standard GS1.
    (/Data ?Matrix/i.test(scan.format) && scan.kind === 'gs1' && Boolean(scan.url))

  if (gs1Symbol && scan.kind === 'gs1') {
    if (syntaxError) return syntaxError
    if (scan.checkDigit === false) return badCheck
    return { level: 'gs1', title: t('Codice Standard GS1'), detail: `${t('Simbologia e dati conformi agli standard GS1.')}${verified}` }
  }
  if (scan.kind === 'gs1') {
    return { level: 'partial', title: t('Dati GS1 in un codice non standard'), detail: t('I dati seguono il formato GS1, ma il simbolo non è codificato secondo gli standard GS1.') }
  }
  return { level: 'none', title: t('Non è un codice GS1'), detail: notGs1 }
}

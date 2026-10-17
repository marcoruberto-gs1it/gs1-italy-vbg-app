import type { ScanResult } from '../gs1/interpret'
import { canVerify, type Verification } from '../gs1/vbg'
import type { StoredSymbol } from './symbolData'

/** `vbg` assente = verifica non ancora arrivata (o non richiesta, vedi needsVerification). */
export type Scan = ScanResult & { vbg?: Verification; symbol?: StoredSymbol }

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

/** Che cosa identifica la chiave primaria, in parole semplici. */
const keyKinds: Record<string, [string, string]> = {
  '01': ['Prodotto', 'GTIN'],
  '00': ['Unità logistica', 'SSCC'],
  '414': ['Località', 'GLN'],
  '417': ['Azienda', 'GLN'],
  '8003': ['Asset riutilizzabile', 'GRAI'],
  '8004': ['Asset individuale', 'GIAI'],
  '8017': ['Fornitore di servizi', 'GSRN'],
  '8018': ['Destinatario di servizi', 'GSRN'],
  '253': ['Documento', 'GDTI'],
  '401': ['Spedizione', 'GINC'],
  '402': ['Spedizione', 'GSIN'],
  '255': ['Coupon', 'GCN'],
  '8010': ['Componente', 'CPID'],
  '8013': ['Modello di prodotto', 'GMN'],
  '8006': ['Parte di prodotto', 'ITIP'],
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
    ;[subject, key] = keyKinds[primary.ai] ?? [primary.label, undefined]
    // GTIN-14 con indicatore diverso da 0: imballo che contiene più unità.
    if (primary.ai === '01' && primary.value.length === 14 && !primary.value.startsWith('0')) [subject, key] = ['Imballo', 'GTIN-14']
  } else {
    subject = scan.kind === 'gs1' ? 'Dati GS1' : scan.kind === 'url' ? 'Link' : 'Testo'
  }
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
}

/** Simbologie degli standard GS1 (come le nomina formatName / withDisplayFormat). */
const GS1_SYMBOLOGIES = /^(EAN-13|EAN-8|UPC-A|UPC-E|ITF-14|GS1-128|GS1 DataBar.*|GS1 DataMatrix|QR Code Standard GS1)$/

/** Il codice letto fa parte degli standard GS1? Valuta simbologia, contenuto e cifra di controllo. */
export function gs1Compliance(scan: Scan): Compliance {
  const notGs1 = scan.kind === 'url'
    ? 'Contiene un link qualsiasi: non identifica nulla nel sistema GS1.'
    : 'Il contenuto non identifica nulla nel sistema GS1.'
  const badCheck = { level: 'error' as const, title: 'Codice GS1 con errori', detail: 'La cifra di controllo non è corretta: il codice potrebbe essere stampato o letto male.' }

  if (scan.format === 'Manuale') {
    if (scan.kind !== 'gs1') return { level: 'none', title: 'Non è un codice GS1', detail: notGs1 }
    if (scan.checkDigit === false) return badCheck
    return { level: 'manual', title: 'Dati in formato GS1', detail: 'Inserito a mano: non c’è un simbolo stampato da verificare.' }
  }

  const gs1Symbol =
    GS1_SYMBOLOGIES.test(scan.format) ||
    (scan.format === 'ITF' && scan.primary?.ai === '01' && scan.primary.value.length === 14) ||
    // GS1 Digital Link in un Data Matrix: ammesso dagli standard GS1.
    (/Data ?Matrix/i.test(scan.format) && scan.kind === 'gs1' && Boolean(scan.url))

  if (gs1Symbol && scan.kind === 'gs1') {
    if (scan.checkDigit === false) return badCheck
    return { level: 'gs1', title: 'Codice Standard GS1', detail: 'Simbologia e dati conformi agli standard GS1.' }
  }
  if (scan.kind === 'gs1') {
    return { level: 'partial', title: 'Dati GS1 in un codice non standard', detail: 'I dati seguono il formato GS1, ma il simbolo non è codificato secondo gli standard GS1.' }
  }
  return { level: 'none', title: 'Non è un codice GS1', detail: notGs1 }
}

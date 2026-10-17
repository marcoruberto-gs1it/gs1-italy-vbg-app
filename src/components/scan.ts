import type { ScanResult } from '../gs1/interpret'
import { canVerify, type Verification } from '../gs1/vbg'

/** `vbg` assente = verifica non ancora arrivata (o non richiesta, vedi needsVerification). */
export type Scan = ScanResult & { vbg?: Verification }

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
  if (/QR/i.test(format)) return 'qr' as const
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
